"""
GitHub-backed article storage — Contents API (reads) + Git Data API (writes).

Article layout in the repo:

    articles/
    └── {slug}/
        ├── meta.json   {"title": str, "status": "draft"|"published", "tags": [str]}
        └── content.md  raw markdown

Functions
─────────
  list_article_metas  List all article slugs + metadata (no content)
  get_article         Fetch full article: meta + content + version history
  create_article      Create both files in one commit (Git Data API)
  save_article        Update both files in one commit (Git Data API)
  delete_article      Delete both files sequentially (Contents API)

Read path  (Contents API)
─────────────────────────
  Caller                     GitHub Contents API
    |                                |
    |-- GET /contents/articles ----->|  list dir entries
    |<-- [{name, type}, ...] --------|
    |                                |
    |-- GET /contents/.../meta.json  |  (parallel per slug)
    |-- GET /contents/.../content.md |  (parallel)
    |-- GET /commits?path=articles/… |  (parallel, non-fatal on failure)
    |<-- base64 content + commits ---|
    |                                |
    |   decode → ArticleMeta/Article |

Write path  (_commit_files — used by create_article and save_article)
──────────────────────────────────────────────────────────────────────

  ┌── parallel ──────────────────────────────────────┐
  │  POST /git/blobs  (meta.json raw)   → blob_sha_1 │
  │  POST /git/blobs  (content.md raw)  → blob_sha_2 │
  │                                                   │
  │  GET /git/ref/heads/main → head_sha               │
  │  GET /git/commits/{head_sha} → base_tree_sha      │
  └───────────────────────────────────────────────────┘
            │
            ▼
  POST /git/trees  {base_tree, [{path, mode, blob_sha}, ...]}  → new_tree_sha
            │
            ▼
  POST /git/commits  {message, tree: new_tree_sha, parents: [head_sha]}  → new_commit_sha
            │
            ▼
  PATCH /git/refs/heads/main  {sha: new_commit_sha}

  Result: both files land in one commit on main.

Delete path  (Contents API)
────────────────────────────
  GET  meta.json + content.md  (parallel) → file SHAs
  DELETE meta.json  (sha required by GitHub)
  DELETE content.md (sequential — avoids tree SHA race)
"""

import asyncio
import base64
import json

import httpx

from app.models.article import Article, ArticleMeta, ArticleVersion

ARTICLES_REPO = "linnienaryshkin/inkwell"
GITHUB_API_BASE = "https://api.github.com"


async def list_article_metas(access_token: str) -> list[ArticleMeta]:
    """Fetch all article metadata from GitHub.

    Lists all article directories, then fetches meta.json for each in parallel.

    Args:
        access_token: GitHub access token for API authentication.

    Returns:
        list[ArticleMeta]: List of all article metadata summaries.

    Raises:
        httpx.HTTPStatusError: On GitHub API errors.
        ValueError: If meta.json is malformed JSON.
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
    """Fetch a full article including content and commit history.

    Retrieves meta.json, content.md, and Git commit history for an article.
    Missing commit history is non-fatal (returns empty list).

    Args:
        access_token: GitHub access token for API authentication.
        slug: The article slug (directory name).

    Returns:
        Article: Full article with metadata, content, and version history.

    Raises:
        httpx.HTTPStatusError: If meta.json or content.md is missing or on GitHub API errors.
        ValueError: If meta.json is malformed JSON.
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


async def delete_article(access_token: str, slug: str) -> None:
    """Delete an article's meta.json and content.md from GitHub.

    Fetches file SHAs for both files in parallel, then deletes them sequentially
    to avoid tree SHA conflicts.

    Args:
        access_token: GitHub access token for API authentication.
        slug: The article slug (directory name).

    Returns:
        None

    Raises:
        httpx.HTTPStatusError: If either file is not found or GitHub API error occurs.
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

        async def delete_file(path: str, sha: str) -> None:
            resp = await client.request(
                "DELETE",
                f"{base_url}/{path}",
                headers={**headers, "Content-Type": "application/json"},
                content=json.dumps({"message": f"delete {slug}: {path}", "sha": sha}).encode(),
            )
            resp.raise_for_status()

        await delete_file("meta.json", sha_meta)
        await delete_file("content.md", sha_content)


async def _create_blob(client: httpx.AsyncClient, headers: dict, raw: str) -> str:
    """Create a Git blob object on GitHub and return its SHA.

    Args:
        client: The httpx AsyncClient for making requests.
        headers: HTTP headers including Authorization.
        raw: Raw file content to upload.

    Returns:
        str: The SHA hash of the created blob.

    Raises:
        httpx.HTTPStatusError: On GitHub API error.
    """
    resp = await client.post(
        f"{GITHUB_API_BASE}/repos/{ARTICLES_REPO}/git/blobs",
        headers=headers,
        json={
            "content": base64.b64encode(raw.encode("utf-8")).decode("utf-8"),
            "encoding": "base64",
        },
    )
    resp.raise_for_status()
    return resp.json()["sha"]


async def _commit_files(
    client: httpx.AsyncClient,
    headers: dict,
    message: str,
    files: list[tuple[str, str]],
) -> None:
    """Write multiple files to main in a single commit via the Git Data API.

    Creates blobs for all files, fetches the current HEAD and tree SHAs, creates
    a new tree, commits it, and advances the main branch reference.

    Args:
        client: The httpx AsyncClient for making requests.
        headers: HTTP headers including Authorization.
        message: Commit message.
        files: List of (tree_path, raw_content) tuples to commit.

    Returns:
        None

    Raises:
        httpx.HTTPStatusError: On GitHub API errors.
    """

    async def get_head_and_tree() -> tuple[str, str]:
        ref_resp = await client.get(
            f"{GITHUB_API_BASE}/repos/{ARTICLES_REPO}/git/ref/heads/main",
            headers=headers,
        )
        ref_resp.raise_for_status()
        head_sha = ref_resp.json()["object"]["sha"]

        commit_resp = await client.get(
            f"{GITHUB_API_BASE}/repos/{ARTICLES_REPO}/git/commits/{head_sha}",
            headers=headers,
        )
        commit_resp.raise_for_status()
        base_tree_sha = commit_resp.json()["tree"]["sha"]
        return head_sha, base_tree_sha

    blob_shas, (head_sha, base_tree_sha) = await asyncio.gather(
        asyncio.gather(*[_create_blob(client, headers, raw) for _, raw in files]),
        get_head_and_tree(),
    )

    tree_resp = await client.post(
        f"{GITHUB_API_BASE}/repos/{ARTICLES_REPO}/git/trees",
        headers=headers,
        json={
            "base_tree": base_tree_sha,
            "tree": [
                {"path": path, "mode": "100644", "type": "blob", "sha": sha}
                for (path, _), sha in zip(files, blob_shas)
            ],
        },
    )
    tree_resp.raise_for_status()
    new_tree_sha = tree_resp.json()["sha"]

    commit_resp = await client.post(
        f"{GITHUB_API_BASE}/repos/{ARTICLES_REPO}/git/commits",
        headers=headers,
        json={"message": message, "tree": new_tree_sha, "parents": [head_sha]},
    )
    commit_resp.raise_for_status()
    new_commit_sha = commit_resp.json()["sha"]

    ref_resp = await client.patch(
        f"{GITHUB_API_BASE}/repos/{ARTICLES_REPO}/git/refs/heads/main",
        headers=headers,
        json={"sha": new_commit_sha},
    )
    ref_resp.raise_for_status()


async def create_article(
    access_token: str,
    title: str,
    slug: str,
    tags: list[str],
    content: str,
) -> Article:
    """Create a new article with metadata and initial content in a single commit.

    Creates both meta.json and content.md files, then fetches and returns
    the complete article object.

    Args:
        access_token: GitHub access token for API authentication.
        title: Article title.
        slug: Article slug (becomes directory name).
        tags: List of article tags.
        content: Initial markdown content.

    Returns:
        Article: The newly created article with full metadata and history.

    Raises:
        httpx.HTTPStatusError: On GitHub API errors.
    """
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json",
    }
    meta_raw = json.dumps({"title": title, "status": "draft", "tags": tags})
    async with httpx.AsyncClient() as client:
        await _commit_files(
            client,
            headers,
            f"create {slug}",
            [
                (f"articles/{slug}/meta.json", meta_raw),
                (f"articles/{slug}/content.md", content),
            ],
        )
    return await get_article(access_token, slug)


async def save_article(
    access_token: str,
    slug: str,
    title: str,
    tags: list[str],
    content: str,
    message: str,
) -> Article:
    """Update an existing article's metadata and content in a single commit.

    Updates both meta.json and content.md files, then fetches and returns
    the complete updated article object.

    Args:
        access_token: GitHub access token for API authentication.
        slug: Article slug (directory name).
        title: Updated article title.
        tags: Updated article tags.
        content: Updated markdown content.
        message: Commit message.

    Returns:
        Article: The updated article with full metadata and history.

    Raises:
        httpx.HTTPStatusError: On GitHub API errors.
    """
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json",
    }
    meta_raw = json.dumps({"title": title, "status": "draft", "tags": tags})
    async with httpx.AsyncClient() as client:
        await _commit_files(
            client,
            headers,
            message,
            [
                (f"articles/{slug}/meta.json", meta_raw),
                (f"articles/{slug}/content.md", content),
            ],
        )
    return await get_article(access_token, slug)
