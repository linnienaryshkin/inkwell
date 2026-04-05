import asyncio
import base64
import json

import httpx

from app.models.article import Article, ArticleMeta, ArticleSummary

ARTICLES_REPO = "linnienaryshkin/inkwell"
GITHUB_API_BASE = "https://api.github.com"


async def list_article_summaries(access_token: str) -> list[ArticleSummary]:
    """
    Fetch all article summaries from GitHub.
    1. GET /repos/{ARTICLES_REPO}/contents/articles → list of dir entries
    2. For each entry where type == "dir", fetch meta.json in parallel
    Returns list[ArticleSummary]; raises httpx.HTTPStatusError on GitHub errors,
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

        async def fetch_summary(entry: dict) -> ArticleSummary:
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
            meta = ArticleMeta(**meta_data)
            return ArticleSummary(slug=slug, title=meta.title, status=meta.status, tags=meta.tags)

        summaries = await asyncio.gather(*[fetch_summary(d) for d in dirs])
        return list(summaries)


async def get_article(access_token: str, slug: str) -> Article:
    """
    Fetch a full article (meta + content + publish-log) for a single slug.
    publish-log.json is fetched but not included in the returned Article.
    Missing publish-log.json is non-fatal (returns empty dict).
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

        async def fetch_publish_log() -> dict:
            try:
                raw = await fetch_file("publish-log.json")
                return json.loads(raw)
            except Exception:
                return {}

        content_raw, meta_raw, _ = await asyncio.gather(
            fetch_file("content.md"),
            fetch_file("meta.json"),
            fetch_publish_log(),
        )

        try:
            meta_data = json.loads(meta_raw)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid meta.json for {slug}: {e}") from e

        meta = ArticleMeta(**meta_data)
        return Article(
            slug=slug,
            title=meta.title,
            status=meta.status,
            tags=meta.tags,
            content=content_raw,
        )
