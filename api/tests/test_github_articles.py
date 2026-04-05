"""
Tests for app/github_articles.py

Strategy: patch httpx.AsyncClient at the module level so both
list_article_metas and get_article use a controlled mock client.
The mock supports the async-context-manager protocol (aenter/aexit)
and exposes an AsyncMock .get() whose side_effect maps request URLs
to pre-built httpx.Response objects.
"""

import base64
import json
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.github_articles import create_article, get_article, list_article_metas, save_article
from app.models.article import Article, ArticleMeta, ArticleVersion

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

TOKEN = "test-access-token"
GITHUB_API_BASE = "https://api.github.com"
REPO = "linnienaryshkin/inkwell"


def _b64(data: str) -> str:
    """Return plain base64 string (no line breaks) for a UTF-8 string."""
    return base64.b64encode(data.encode()).decode()


def _b64_wrapped(data: str) -> str:
    """
    Return base64 with embedded newlines every 60 chars — exactly as the
    GitHub Contents API returns for larger files.  Verifies that the
    .replace('\\n', '') stripping logic works correctly.
    """
    raw_b64 = base64.b64encode(data.encode()).decode()
    # Insert a newline every 60 characters
    return "\n".join(raw_b64[i : i + 60] for i in range(0, len(raw_b64), 60))


def _github_content_response(raw: str, status: int = 200) -> httpx.Response:
    """Build an httpx.Response mimicking a GitHub Contents API response."""
    body = {"content": _b64(raw), "encoding": "base64"}
    return httpx.Response(status, json=body, request=httpx.Request("GET", "https://api.github.com"))


def _make_dir_entry(name: str) -> dict:
    return {"name": name, "type": "dir", "path": f"articles/{name}"}


def _make_file_entry(name: str) -> dict:
    return {"name": name, "type": "file", "path": f"articles/{name}"}


def _meta_json(title: str, status: str = "draft", tags: list | None = None) -> str:
    return json.dumps({"title": title, "status": status, "tags": tags or []})


def _make_client_mock(url_map: dict[str, httpx.Response]) -> MagicMock:
    """
    Return a MagicMock that behaves as an async context manager whose
    .get() coroutine looks up the response by URL from url_map.
    """

    async def _get(url: str, **kwargs) -> httpx.Response:
        if url in url_map:
            return url_map[url]
        raise KeyError(f"Unexpected URL in test: {url}")

    mock_client = MagicMock()
    mock_client.get = AsyncMock(side_effect=_get)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    client_class = MagicMock(return_value=mock_client)
    return client_class


# ---------------------------------------------------------------------------
# list_article_summaries
# ---------------------------------------------------------------------------


class TestListArticleMetas:
    def _articles_url(self) -> str:
        return f"{GITHUB_API_BASE}/repos/{REPO}/contents/articles"

    def _meta_url(self, slug: str) -> str:
        return f"{GITHUB_API_BASE}/repos/{REPO}/contents/articles/{slug}/meta.json"

    @pytest.mark.asyncio
    async def test_two_valid_folders_returns_two_metas(self):
        """
        GitHub returns 2 dir entries + 2 valid meta.json files.
        Exercises the asyncio.gather parallel path.
        """
        dirs_response = httpx.Response(
            200,
            json=[_make_dir_entry("hello-world"), _make_dir_entry("second-post")],
            request=httpx.Request("GET", self._articles_url()),
        )
        meta1 = _github_content_response(_meta_json("Hello World", "published", ["intro"]))
        meta2 = _github_content_response(_meta_json("Second Post", "draft", []))

        url_map = {
            self._articles_url(): dirs_response,
            self._meta_url("hello-world"): meta1,
            self._meta_url("second-post"): meta2,
        }

        with patch("app.github_articles.httpx.AsyncClient", _make_client_mock(url_map)):
            result = await list_article_metas(TOKEN)

        assert len(result) == 2
        by_slug = {m.slug: m for m in result}

        assert "hello-world" in by_slug
        hw = by_slug["hello-world"]
        assert isinstance(hw, ArticleMeta)
        assert hw.title == "Hello World"
        assert hw.status == "published"
        assert hw.tags == ["intro"]

        assert "second-post" in by_slug
        sp = by_slug["second-post"]
        assert sp.title == "Second Post"
        assert sp.status == "draft"
        assert sp.tags == []

    @pytest.mark.asyncio
    async def test_non_dir_entries_are_skipped(self):
        """
        GitHub returns a mix of dir and file entries — only dirs are processed.
        """
        dirs_response = httpx.Response(
            200,
            json=[
                _make_dir_entry("my-article"),
                _make_file_entry("README.md"),
                _make_file_entry(".gitkeep"),
            ],
            request=httpx.Request("GET", self._articles_url()),
        )
        meta = _github_content_response(_meta_json("My Article", "draft", []))

        url_map = {
            self._articles_url(): dirs_response,
            self._meta_url("my-article"): meta,
        }

        with patch("app.github_articles.httpx.AsyncClient", _make_client_mock(url_map)):
            result = await list_article_metas(TOKEN)

        assert len(result) == 1
        assert result[0].slug == "my-article"

    @pytest.mark.asyncio
    async def test_malformed_meta_json_raises_value_error(self):
        """
        meta.json contains invalid JSON → ValueError is raised.
        """
        dirs_response = httpx.Response(
            200,
            json=[_make_dir_entry("bad-article")],
            request=httpx.Request("GET", self._articles_url()),
        )
        bad_meta = _github_content_response("{ this is not valid JSON !!!")

        url_map = {
            self._articles_url(): dirs_response,
            self._meta_url("bad-article"): bad_meta,
        }

        with patch("app.github_articles.httpx.AsyncClient", _make_client_mock(url_map)):
            with pytest.raises(ValueError, match="bad-article"):
                await list_article_metas(TOKEN)

    @pytest.mark.asyncio
    async def test_github_401_on_dir_listing_raises_http_status_error(self):
        """
        GitHub returns 401 on the directory listing → httpx.HTTPStatusError propagates.
        """
        unauth_response = httpx.Response(
            401,
            json={"message": "Bad credentials"},
            request=httpx.Request("GET", self._articles_url()),
        )

        url_map = {self._articles_url(): unauth_response}

        with patch("app.github_articles.httpx.AsyncClient", _make_client_mock(url_map)):
            with pytest.raises(httpx.HTTPStatusError) as exc_info:
                await list_article_metas(TOKEN)

        assert exc_info.value.response.status_code == 401

    @pytest.mark.asyncio
    async def test_github_404_on_meta_json_raises_http_status_error(self):
        """
        Directory listing succeeds but meta.json returns 404 → HTTPStatusError raised.
        """
        dirs_response = httpx.Response(
            200,
            json=[_make_dir_entry("ghost-article")],
            request=httpx.Request("GET", self._articles_url()),
        )
        not_found = httpx.Response(
            404,
            json={"message": "Not Found"},
            request=httpx.Request("GET", self._meta_url("ghost-article")),
        )

        url_map = {
            self._articles_url(): dirs_response,
            self._meta_url("ghost-article"): not_found,
        }

        with patch("app.github_articles.httpx.AsyncClient", _make_client_mock(url_map)):
            with pytest.raises(httpx.HTTPStatusError) as exc_info:
                await list_article_metas(TOKEN)

        assert exc_info.value.response.status_code == 404


# ---------------------------------------------------------------------------
# get_article
# ---------------------------------------------------------------------------


def _commits_url() -> str:
    return f"{GITHUB_API_BASE}/repos/{REPO}/commits"


def _commits_response(slug: str, commits: list[dict] | None = None) -> httpx.Response:
    """Build a mock GitHub commits API response for a given article slug."""
    if commits is None:
        commits = [
            {
                "sha": "abc123",
                "commit": {
                    "message": "initial commit",
                    "committer": {"date": "2026-01-01T00:00:00Z"},
                },
            }
        ]
    return httpx.Response(
        200,
        json=commits,
        request=httpx.Request("GET", _commits_url()),
    )


class TestGetArticle:
    def _content_url(self, slug: str) -> str:
        return f"{GITHUB_API_BASE}/repos/{REPO}/contents/articles/{slug}/content.md"

    def _meta_url(self, slug: str) -> str:
        return f"{GITHUB_API_BASE}/repos/{REPO}/contents/articles/{slug}/meta.json"

    def _versions_url(self) -> str:
        return _commits_url()

    @pytest.mark.asyncio
    async def test_valid_slug_returns_article_with_correct_fields(self):
        """
        All three concurrent fetches succeed → Article returned with correct fields.
        Exercises the full asyncio.gather path (content.md + meta.json + versions).
        """
        slug = "hello-world"
        content_md = "# Hello World\n\nThis is the content."
        meta = _meta_json("Hello World", "published", ["python", "intro"])

        url_map = {
            self._content_url(slug): _github_content_response(content_md),
            self._meta_url(slug): _github_content_response(meta),
            self._versions_url(): _commits_response(slug),
        }

        with patch("app.github_articles.httpx.AsyncClient", _make_client_mock(url_map)):
            result = await get_article(TOKEN, slug)

        assert isinstance(result, Article)
        assert result.slug == slug
        assert result.meta.title == "Hello World"
        assert result.meta.status == "published"
        assert result.meta.tags == ["python", "intro"]
        assert result.content == content_md
        assert len(result.versions) == 1
        assert isinstance(result.versions[0], ArticleVersion)
        assert result.versions[0].sha == "abc123"

    @pytest.mark.asyncio
    async def test_content_md_404_raises_http_status_error(self):
        """
        content.md returns 404 → httpx.HTTPStatusError propagates (not swallowed).
        """
        slug = "missing-content"

        not_found = httpx.Response(
            404,
            json={"message": "Not Found"},
            request=httpx.Request("GET", self._content_url(slug)),
        )

        url_map = {
            self._content_url(slug): not_found,
            self._meta_url(slug): _github_content_response(_meta_json("Title")),
            self._versions_url(): _commits_response(slug),
        }

        with patch("app.github_articles.httpx.AsyncClient", _make_client_mock(url_map)):
            with pytest.raises(httpx.HTTPStatusError) as exc_info:
                await get_article(TOKEN, slug)

        assert exc_info.value.response.status_code == 404

    @pytest.mark.asyncio
    async def test_malformed_meta_json_raises_value_error(self):
        """
        meta.json is fetched successfully but contains invalid JSON → ValueError raised.
        """
        slug = "bad-meta"

        url_map = {
            self._content_url(slug): _github_content_response("# Content"),
            self._meta_url(slug): _github_content_response("not { valid json"),
            self._versions_url(): _commits_response(slug),
        }

        with patch("app.github_articles.httpx.AsyncClient", _make_client_mock(url_map)):
            with pytest.raises(ValueError, match="bad-meta"):
                await get_article(TOKEN, slug)

    @pytest.mark.asyncio
    async def test_base64_with_line_breaks_decodes_correctly(self):
        """
        GitHub wraps base64 content with newlines every 60 chars.
        Verifies the .replace('\\n', '') stripping in fetch_file() decodes correctly.
        """
        slug = "wrapped-b64"
        # Use a long content string to guarantee line wrapping at 60-char boundaries
        long_content = "# Wrapped\n\n" + ("A" * 200)
        meta = _meta_json("Wrapped", "draft", [])

        # Build responses with line-wrapped base64 manually
        wrapped_content_b64 = _b64_wrapped(long_content)
        wrapped_meta_b64 = _b64_wrapped(meta)

        content_body = {"content": wrapped_content_b64, "encoding": "base64"}
        meta_body = {"content": wrapped_meta_b64, "encoding": "base64"}

        content_response = httpx.Response(
            200,
            json=content_body,
            request=httpx.Request("GET", self._content_url(slug)),
        )
        meta_response = httpx.Response(
            200,
            json=meta_body,
            request=httpx.Request("GET", self._meta_url(slug)),
        )

        url_map = {
            self._content_url(slug): content_response,
            self._meta_url(slug): meta_response,
            self._versions_url(): _commits_response(slug),
        }

        with patch("app.github_articles.httpx.AsyncClient", _make_client_mock(url_map)):
            result = await get_article(TOKEN, slug)

        assert result.content == long_content
        assert result.meta.title == "Wrapped"

    @pytest.mark.asyncio
    async def test_missing_versions_is_non_fatal(self):
        """
        Commits API returns 404 → error is swallowed; Article is still returned with empty versions.
        """
        slug = "no-versions"
        content_md = "# No Versions\n\nContent."
        meta = _meta_json("No Versions", "draft", ["test"])

        not_found = httpx.Response(
            404,
            json={"message": "Not Found"},
            request=httpx.Request("GET", self._versions_url()),
        )

        url_map = {
            self._content_url(slug): _github_content_response(content_md),
            self._meta_url(slug): _github_content_response(meta),
            self._versions_url(): not_found,
        }

        with patch("app.github_articles.httpx.AsyncClient", _make_client_mock(url_map)):
            result = await get_article(TOKEN, slug)

        assert isinstance(result, Article)
        assert result.slug == slug
        assert result.meta.title == "No Versions"
        assert result.content == content_md
        assert result.versions == []

    @pytest.mark.asyncio
    async def test_versions_are_returned_in_article(self):
        """
        Commits API returns multiple commits → versions list included in Article.
        """
        slug = "with-versions"
        content_md = "# With Versions"
        meta = _meta_json("With Versions", "published", ["devto"])
        commits = [
            {
                "sha": "sha1",
                "commit": {
                    "message": "second commit",
                    "committer": {"date": "2026-02-01T00:00:00Z"},
                },
            },
            {
                "sha": "sha0",
                "commit": {
                    "message": "initial commit",
                    "committer": {"date": "2026-01-01T00:00:00Z"},
                },
            },
        ]

        url_map = {
            self._content_url(slug): _github_content_response(content_md),
            self._meta_url(slug): _github_content_response(meta),
            self._versions_url(): httpx.Response(
                200,
                json=commits,
                request=httpx.Request("GET", self._versions_url()),
            ),
        }

        with patch("app.github_articles.httpx.AsyncClient", _make_client_mock(url_map)):
            result = await get_article(TOKEN, slug)

        assert isinstance(result, Article)
        assert len(result.versions) == 2
        assert result.versions[0].sha == "sha1"
        assert result.versions[0].message == "second commit"
        assert result.versions[1].sha == "sha0"


# ---------------------------------------------------------------------------
# Helpers for create_article / save_article
# ---------------------------------------------------------------------------


def _make_git_data_client_mock(
    get_url_map: dict[str, httpx.Response],
    post_responses: list[httpx.Response],
    patch_url_map: dict[str, httpx.Response],
) -> MagicMock:
    """
    Return a mock AsyncClient for the Git Data API write path.
    - .get() looks up by URL in get_url_map
    - .post() pops responses sequentially from post_responses; captures call args
    - .patch() looks up by URL in patch_url_map
    """
    post_calls: list[dict] = []
    post_queue = list(post_responses)

    async def _get(url: str, **kwargs) -> httpx.Response:
        if url in get_url_map:
            return get_url_map[url]
        raise KeyError(f"Unexpected GET URL in test: {url}")

    async def _post(url: str, **kwargs) -> httpx.Response:
        post_calls.append({"url": url, "json": kwargs.get("json", {})})
        if post_queue:
            return post_queue.pop(0)
        raise KeyError(f"Unexpected POST URL in test (queue exhausted): {url}")

    async def _patch(url: str, **kwargs) -> httpx.Response:
        if url in patch_url_map:
            return patch_url_map[url]
        raise KeyError(f"Unexpected PATCH URL in test: {url}")

    mock_client = MagicMock()
    mock_client.get = AsyncMock(side_effect=_get)
    mock_client.post = AsyncMock(side_effect=_post)
    mock_client.patch = AsyncMock(side_effect=_patch)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client._post_calls = post_calls

    client_class = MagicMock(return_value=mock_client)
    return client_class


def _make_two_phase_git_mock(
    write_get_url_map: dict[str, httpx.Response],
    write_post_responses: list[httpx.Response],
    write_patch_url_map: dict[str, httpx.Response],
    read_get_url_map: dict[str, httpx.Response],
) -> tuple[MagicMock, MagicMock]:
    """
    create_article and save_article open one AsyncClient for writes (Git Data API),
    then call get_article() which opens a second AsyncClient for reads (Contents API).
    Returns (class_mock, write_client_mock).
    """
    write_wrapper = _make_git_data_client_mock(
        write_get_url_map, write_post_responses, write_patch_url_map
    )
    read_wrapper = _make_client_mock(read_get_url_map)

    write_client = write_wrapper.return_value
    read_client = read_wrapper.return_value

    call_count = [0]

    def _side_effect(*args, **kwargs):
        call_count[0] += 1
        return write_client if call_count[0] == 1 else read_client

    class_mock = MagicMock(side_effect=_side_effect)
    return class_mock, write_client


def _blob_response(sha: str) -> httpx.Response:
    return httpx.Response(
        201,
        json={"sha": sha},
        request=httpx.Request("POST", f"{GITHUB_API_BASE}/repos/{REPO}/git/blobs"),
    )


def _ref_response(head_sha: str) -> httpx.Response:
    return httpx.Response(
        200,
        json={"object": {"sha": head_sha}},
        request=httpx.Request("GET", f"{GITHUB_API_BASE}/repos/{REPO}/git/ref/heads/main"),
    )


def _commit_get_response(head_sha: str, tree_sha: str) -> httpx.Response:
    return httpx.Response(
        200,
        json={"tree": {"sha": tree_sha}},
        request=httpx.Request("GET", f"{GITHUB_API_BASE}/repos/{REPO}/git/commits/{head_sha}"),
    )


def _tree_response(tree_sha: str) -> httpx.Response:
    return httpx.Response(
        201,
        json={"sha": tree_sha},
        request=httpx.Request("POST", f"{GITHUB_API_BASE}/repos/{REPO}/git/trees"),
    )


def _commit_post_response(commit_sha: str) -> httpx.Response:
    return httpx.Response(
        201,
        json={"sha": commit_sha},
        request=httpx.Request("POST", f"{GITHUB_API_BASE}/repos/{REPO}/git/commits"),
    )


def _ref_patch_response() -> httpx.Response:
    return httpx.Response(
        200,
        json={"object": {"sha": "updated"}},
        request=httpx.Request("PATCH", f"{GITHUB_API_BASE}/repos/{REPO}/git/refs/heads/main"),
    )


def _error_response(status: int, method: str, url: str) -> httpx.Response:
    return httpx.Response(status, json={"message": "error"}, request=httpx.Request(method, url))


def _default_write_maps(
    head_sha: str = "head-sha",
    base_tree_sha: str = "base-tree-sha",
    new_tree_sha: str = "new-tree-sha",
    new_commit_sha: str = "new-commit-sha",
) -> tuple[dict, list, dict]:
    """Return (get_map, post_responses, patch_map) for a successful _commit_files call."""
    get_map = {
        f"{GITHUB_API_BASE}/repos/{REPO}/git/ref/heads/main": _ref_response(head_sha),
        f"{GITHUB_API_BASE}/repos/{REPO}/git/commits/{head_sha}": _commit_get_response(
            head_sha, base_tree_sha
        ),
    }
    # post_responses are consumed in order: blob×2, tree×1, commit×1
    post_responses = [
        _blob_response("blob-meta-sha"),
        _blob_response("blob-content-sha"),
        _tree_response(new_tree_sha),
        _commit_post_response(new_commit_sha),
    ]
    patch_map = {
        f"{GITHUB_API_BASE}/repos/{REPO}/git/refs/heads/main": _ref_patch_response(),
    }
    return get_map, post_responses, patch_map


# ---------------------------------------------------------------------------
# create_article
# ---------------------------------------------------------------------------


REPO = "linnienaryshkin/inkwell"
GITHUB_API_BASE_URL = "https://api.github.com"


class TestCreateArticle:
    def _content_get_url(self, slug: str) -> str:
        return f"{GITHUB_API_BASE_URL}/repos/{REPO}/contents/articles/{slug}/content.md"

    def _meta_get_url(self, slug: str) -> str:
        return f"{GITHUB_API_BASE_URL}/repos/{REPO}/contents/articles/{slug}/meta.json"

    def _commits_url(self) -> str:
        return f"{GITHUB_API_BASE_URL}/repos/{REPO}/commits"

    def _make_read_url_map(self, slug: str, title: str, content: str, tags: list) -> dict:
        meta_str = json.dumps({"title": title, "status": "draft", "tags": tags})
        return {
            self._content_get_url(slug): _github_content_response(content),
            self._meta_get_url(slug): _github_content_response(meta_str),
            self._commits_url(): _commits_response(slug),
        }

    @pytest.mark.asyncio
    async def test_success_returns_article_with_version(self):
        """
        All Git Data API calls succeed; the subsequent get_article() returns an Article.
        """
        slug = "new-article"
        title = "New Article"
        tags = ["python"]
        content = "# New Article\n\nHello."

        get_map, post_responses, patch_map = _default_write_maps()
        read_url_map = self._make_read_url_map(slug, title, content, tags)
        class_mock, _ = _make_two_phase_git_mock(get_map, post_responses, patch_map, read_url_map)

        with patch("app.github_articles.httpx.AsyncClient", class_mock):
            result = await create_article(TOKEN, title, slug, tags, content)

        assert isinstance(result, Article)
        assert result.slug == slug
        assert len(result.versions) == 1

    @pytest.mark.asyncio
    async def test_meta_json_blob_content_is_correct(self):
        """
        The blob POST for meta.json, when base64-decoded, must contain
        {"title": ..., "status": "draft", "tags": [...]}.
        """
        slug = "meta-check"
        title = "Meta Check"
        tags = ["a", "b"]
        content = "content body"

        get_map, post_responses, patch_map = _default_write_maps()
        read_url_map = self._make_read_url_map(slug, title, content, tags)
        class_mock, write_client = _make_two_phase_git_mock(
            get_map, post_responses, patch_map, read_url_map
        )

        with patch("app.github_articles.httpx.AsyncClient", class_mock):
            await create_article(TOKEN, title, slug, tags, content)

        # Blob POSTs come first (parallel, but index 0 = meta, 1 = content by list order)
        meta_blob_body = write_client._post_calls[0]["json"]
        decoded = json.loads(base64.b64decode(meta_blob_body["content"]).decode("utf-8"))
        assert decoded["title"] == title
        assert decoded["status"] == "draft"
        assert decoded["tags"] == tags

    @pytest.mark.asyncio
    async def test_content_md_blob_content_is_correct(self):
        """
        The blob POST for content.md, when base64-decoded, must match the supplied content.
        """
        slug = "content-check"
        title = "Content Check"
        tags = []
        content = "# Content Check\n\nBody text here."

        get_map, post_responses, patch_map = _default_write_maps()
        read_url_map = self._make_read_url_map(slug, title, content, tags)
        class_mock, write_client = _make_two_phase_git_mock(
            get_map, post_responses, patch_map, read_url_map
        )

        with patch("app.github_articles.httpx.AsyncClient", class_mock):
            await create_article(TOKEN, title, slug, tags, content)

        content_blob_body = write_client._post_calls[1]["json"]
        decoded = base64.b64decode(content_blob_body["content"]).decode("utf-8")
        assert decoded == content

    @pytest.mark.asyncio
    async def test_blob_post_error_raises_http_status_error(self):
        """
        If blob POST returns an error, HTTPStatusError propagates.
        """
        slug = "conflict-slug"
        title = "Conflict"
        tags = []
        content = "content"

        error = _error_response(422, "POST", f"{GITHUB_API_BASE}/repos/{REPO}/git/blobs")
        get_map, _, patch_map = _default_write_maps()
        # Replace blob responses with one error (second blob won't be reached)
        class_mock, _ = _make_two_phase_git_mock(get_map, [error], patch_map, {})

        with patch("app.github_articles.httpx.AsyncClient", class_mock):
            with pytest.raises(httpx.HTTPStatusError) as exc_info:
                await create_article(TOKEN, title, slug, tags, content)

        assert exc_info.value.response.status_code == 422

    @pytest.mark.asyncio
    async def test_ref_get_error_raises_http_status_error(self):
        """
        If GET /git/ref/heads/main returns 404, HTTPStatusError propagates.
        """
        slug = "ref-error"
        title = "Ref Error"
        tags = []
        content = "content"

        ref_url = f"{GITHUB_API_BASE}/repos/{REPO}/git/ref/heads/main"
        get_map = {
            ref_url: _error_response(404, "GET", ref_url),
        }
        _, post_responses, patch_map = _default_write_maps()
        class_mock, _ = _make_two_phase_git_mock(get_map, post_responses, patch_map, {})

        with patch("app.github_articles.httpx.AsyncClient", class_mock):
            with pytest.raises(httpx.HTTPStatusError) as exc_info:
                await create_article(TOKEN, title, slug, tags, content)

        assert exc_info.value.response.status_code == 404


# ---------------------------------------------------------------------------
# save_article
# ---------------------------------------------------------------------------


class TestSaveArticle:
    def _meta_url(self, slug: str) -> str:
        return f"{GITHUB_API_BASE_URL}/repos/{REPO}/contents/articles/{slug}/meta.json"

    def _content_url(self, slug: str) -> str:
        return f"{GITHUB_API_BASE_URL}/repos/{REPO}/contents/articles/{slug}/content.md"

    def _commits_url(self) -> str:
        return f"{GITHUB_API_BASE_URL}/repos/{REPO}/commits"

    def _make_read_url_map(self, slug: str, title: str, content: str, tags: list) -> dict:
        meta_str = json.dumps({"title": title, "status": "draft", "tags": tags})
        return {
            self._content_url(slug): _github_content_response(content),
            self._meta_url(slug): _github_content_response(meta_str),
            self._commits_url(): _commits_response(slug),
        }

    @pytest.mark.asyncio
    async def test_success_returns_updated_article(self):
        """
        All Git Data API calls succeed; returns the updated Article from get_article().
        """
        slug = "existing-article"
        title = "Updated Title"
        tags = ["updated"]
        content = "# Updated\n\nNew content."
        message = "update existing-article"

        get_map, post_responses, patch_map = _default_write_maps()
        read_url_map = self._make_read_url_map(slug, title, content, tags)
        class_mock, _ = _make_two_phase_git_mock(get_map, post_responses, patch_map, read_url_map)

        with patch("app.github_articles.httpx.AsyncClient", class_mock):
            result = await save_article(TOKEN, slug, title, tags, content, message)

        assert isinstance(result, Article)
        assert result.slug == slug
        assert result.meta.title == title

    @pytest.mark.asyncio
    async def test_commit_message_used_in_git_commit(self):
        """
        The message field in the git commit POST body must equal the supplied commit message.
        """
        slug = "msg-check"
        title = "Msg Check"
        tags = []
        content = "content"
        custom_message = "fix: correct heading typo"

        get_map, post_responses, patch_map = _default_write_maps()
        read_url_map = self._make_read_url_map(slug, title, content, tags)
        class_mock, write_client = _make_two_phase_git_mock(
            get_map, post_responses, patch_map, read_url_map
        )

        with patch("app.github_articles.httpx.AsyncClient", class_mock):
            await save_article(TOKEN, slug, title, tags, content, custom_message)

        # post_calls order: blob×2, tree, commit
        commit_post_body = write_client._post_calls[3]["json"]
        assert commit_post_body["message"] == custom_message

    @pytest.mark.asyncio
    async def test_default_commit_message_used_when_none(self):
        """
        The router fills in 'update <slug>' when the client omits the message field.
        """
        slug = "default-msg"
        title = "Default Msg"
        tags = []
        content = "content"
        default_message = f"update {slug}"

        get_map, post_responses, patch_map = _default_write_maps()
        read_url_map = self._make_read_url_map(slug, title, content, tags)
        class_mock, write_client = _make_two_phase_git_mock(
            get_map, post_responses, patch_map, read_url_map
        )

        with patch("app.github_articles.httpx.AsyncClient", class_mock):
            await save_article(TOKEN, slug, title, tags, content, default_message)

        commit_post_body = write_client._post_calls[3]["json"]
        assert commit_post_body["message"] == default_message

    @pytest.mark.asyncio
    async def test_ref_get_404_raises_http_status_error(self):
        """
        If GET /git/ref/heads/main returns 404, HTTPStatusError propagates.
        """
        slug = "not-found"
        title = "T"
        tags = []
        content = "c"
        message = "update not-found"

        ref_url = f"{GITHUB_API_BASE}/repos/{REPO}/git/ref/heads/main"
        get_map = {ref_url: _error_response(404, "GET", ref_url)}
        _, post_responses, patch_map = _default_write_maps()
        class_mock, _ = _make_two_phase_git_mock(get_map, post_responses, patch_map, {})

        with patch("app.github_articles.httpx.AsyncClient", class_mock):
            with pytest.raises(httpx.HTTPStatusError) as exc_info:
                await save_article(TOKEN, slug, title, tags, content, message)

        assert exc_info.value.response.status_code == 404
