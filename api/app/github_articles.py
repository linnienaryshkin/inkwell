import asyncio
import base64
import json

import httpx

from app.models.article import Article, ArticleMeta, ArticleVersion

ARTICLES_REPO = "linnienaryshkin/inkwell"
GITHUB_API_BASE = "https://api.github.com"


async def list_article_metas(access_token: str) -> list[ArticleMeta]:
    """
    Fetch all article metadata from GitHub.
    1. GET /repos/{ARTICLES_REPO}/contents/articles → list of dir entries
    2. For each entry where type == "dir", fetch meta.json in parallel
    Returns list[ArticleMeta]; raises httpx.HTTPStatusError on GitHub errors,
    ValueError on malformed meta.json.
    """
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json",
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GITHUB_API_BASE}/repos/{ARTICLES_REPO}/contents/articles",
            headers=headers,
        )
        resp.raise_for_status()
        entries = resp.json()
        dirs = [e for e in entries if e["type"] == "dir"]

        async def fetch_meta(entry: dict) -> ArticleMeta:
            slug = entry["name"]
            meta_resp = await client.get(
                f"{GITHUB_API_BASE}/repos/{ARTICLES_REPO}/contents/articles/{slug}/meta.json",
                headers=headers,
            )
            meta_resp.raise_for_status()
            content_b64 = meta_resp.json()["content"]
            # GitHub wraps Base64 with line breaks — remove them
            raw = base64.b64decode(content_b64.replace("\n", "")).decode("utf-8")
            try:
                meta_data = json.loads(raw)
            except json.JSONDecodeError as e:
                raise ValueError(f"Invalid meta.json for {slug}: {e}") from e
            return ArticleMeta(slug=slug, **meta_data)

        metas = await asyncio.gather(*[fetch_meta(d) for d in dirs])
        return list(metas)


async def get_article(access_token: str, slug: str) -> Article:
    """
    Fetch a full article (meta + content + commit history) for a single slug.
    Versions are fetched from the Git commit log for articles/{slug}/.
    Missing commit history is non-fatal (returns empty list).
    Raises httpx.HTTPStatusError if meta.json or content.md is missing.
    Raises ValueError if meta.json is malformed.
    """
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json",
    }
    base_url = f"{GITHUB_API_BASE}/repos/{ARTICLES_REPO}/contents/articles/{slug}"

    async with httpx.AsyncClient() as client:

        async def fetch_file(path: str) -> str:
            resp = await client.get(f"{base_url}/{path}", headers=headers)
            resp.raise_for_status()
            content_b64 = resp.json()["content"]
            return base64.b64decode(content_b64.replace("\n", "")).decode("utf-8")

        async def fetch_versions() -> list[ArticleVersion]:
            try:
                resp = await client.get(
                    f"{GITHUB_API_BASE}/repos/{ARTICLES_REPO}/commits",
                    headers=headers,
                    params={"path": f"articles/{slug}", "per_page": 10},
                )
                resp.raise_for_status()
                commits = resp.json()
                return [
                    ArticleVersion(
                        sha=c["sha"],
                        message=c["commit"]["message"],
                        committed_at=c["commit"]["committer"]["date"],
                    )
                    for c in commits
                ]
            except Exception:
                return []

        content_raw, meta_raw, versions = await asyncio.gather(
            fetch_file("content.md"),
            fetch_file("meta.json"),
            fetch_versions(),
        )

        try:
            meta_data = json.loads(meta_raw)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid meta.json for {slug}: {e}") from e

        meta = ArticleMeta(slug=slug, **meta_data)
        return Article(slug=slug, content=content_raw, meta=meta, versions=versions)


def _encode_meta(title: str, tags: list[str]) -> str:
    """Return a base64-encoded meta.json payload (status always 'draft' on create/save)."""
    raw = json.dumps({"title": title, "status": "draft", "tags": tags})
    return base64.b64encode(raw.encode("utf-8")).decode("utf-8")


def _encode_content(content: str) -> str:
    """Return a base64-encoded content.md payload."""
    return base64.b64encode(content.encode("utf-8")).decode("utf-8")


async def create_article(
    access_token: str,
    title: str,
    slug: str,
    tags: list[str],
    content: str,
) -> Article:
    """
    Creates articles/<slug>/meta.json and articles/<slug>/content.md on main.
    Sequential PUTs (meta first, content second).
    GitHub returns 422 if files already exist — let it propagate.
    After both PUTs succeed, calls get_article() and returns the result.
    """
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json",
    }
    base_url = f"{GITHUB_API_BASE}/repos/{ARTICLES_REPO}/contents/articles/{slug}"

    async with httpx.AsyncClient() as client:
        meta_resp = await client.put(
            f"{base_url}/meta.json",
            headers=headers,
            json={
                "message": f"create {slug}: meta.json",
                "content": _encode_meta(title, tags),
            },
        )
        meta_resp.raise_for_status()

        content_resp = await client.put(
            f"{base_url}/content.md",
            headers=headers,
            json={
                "message": f"create {slug}: content.md",
                "content": _encode_content(content),
            },
        )
        content_resp.raise_for_status()

    return await get_article(access_token, slug)


async def save_article(
    access_token: str,
    slug: str,
    title: str,
    tags: list[str],
    content: str,
    message: str,
) -> Article:
    """
    Updates articles/<slug>/meta.json and articles/<slug>/content.md on main.
    GitHub Contents API PUT requires the current file SHA to update an existing file.
    Steps:
      1. GET meta.json → extract sha
      2. GET content.md → extract sha
      (Steps 1+2 run in parallel via asyncio.gather)
      3. PUT meta.json with new content + sha
      4. PUT content.md with new content + sha
      (Steps 3+4 run in parallel via asyncio.gather)
    After all PUTs succeed, calls get_article() and returns the result.
    """
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json",
    }
    base_url = f"{GITHUB_API_BASE}/repos/{ARTICLES_REPO}/contents/articles/{slug}"

    async with httpx.AsyncClient() as client:

        async def get_sha(path: str) -> str:
            resp = await client.get(f"{base_url}/{path}", headers=headers)
            resp.raise_for_status()
            return resp.json()["sha"]

        sha_meta, sha_content = await asyncio.gather(
            get_sha("meta.json"),
            get_sha("content.md"),
        )

        async def put_file(path: str, encoded_content: str, sha: str) -> None:
            resp = await client.put(
                f"{base_url}/{path}",
                headers=headers,
                json={
                    "message": message,
                    "content": encoded_content,
                    "sha": sha,
                },
            )
            resp.raise_for_status()

        await asyncio.gather(
            put_file("meta.json", _encode_meta(title, tags), sha_meta),
            put_file("content.md", _encode_content(content), sha_content),
        )

    return await get_article(access_token, slug)
