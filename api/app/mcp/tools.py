"""MCP tool input parameter type hints.

These type annotations are used in handler function signatures
to provide detailed parameter descriptions in the MCP tool schemas
that FastMCP automatically derives from function annotations.
"""


def list_articles_tool_input() -> None:
    """List all articles for the authenticated user.

    Args:
        access_token: GitHub access token for API authentication.
    """


def get_article_tool_input() -> None:
    """Get a specific article by slug.

    Args:
        access_token: GitHub access token for API authentication.
        slug: The article slug (directory name).
    """


def create_article_tool_input() -> None:
    """Create a new article.

    Args:
        access_token: GitHub access token for API authentication.
        title: Article title.
        slug: Article slug (becomes directory name).
        tags: List of article tags.
        content: Initial markdown content.
    """


def save_article_tool_input() -> None:
    """Save an existing article (full save with title, tags, content).

    Args:
        access_token: GitHub access token for API authentication.
        slug: Article slug (directory name).
        title: Updated article title.
        tags: Updated article tags.
        content: Updated markdown content.
        message: Commit message (optional).
    """


def delete_article_tool_input() -> None:
    """Delete an article.

    Args:
        access_token: GitHub access token for API authentication.
        slug: The article slug (directory name).
    """
