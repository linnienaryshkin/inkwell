"""MCP resource definitions using @mcp.resource decorator.

These resources are registered with the FastMCP server and provide
access to article schema definitions and metadata information.

**App-controlled: Our app decides when to call these.**
Results are used primarily by our app to understand the API contract.

**Resources provided:**
- inkwell://article-schemas: List all available schema definitions
- inkwell://article-schemas/{schema_name}: Get a specific schema
- inkwell://article-statuses: List valid article status values
- inkwell://article-constants: Provide field metadata and validation rules

**Use cases:**
- Getting data into our app (schema inspection)
- Adding context to messages (API contract documentation)
- Dynamic UI generation based on schema constraints
- Validation rule enforcement in frontend
"""

from app.mcp.server import mcp
from app.models.article import (
    Article,
    ArticleCreate,
    ArticleMeta,
    ArticlePatch,
    ArticleSave,
    ArticleVersion,
)


@mcp.resource("inkwell://article-schemas", mime_type="application/json")
def list_article_schemas() -> dict[str, dict]:
    """List all available article schema definitions.

    Returns:
        dict[str, dict]: A mapping of schema names to their JSON schema representations.
            - ArticleMeta: Metadata summary for articles in list endpoints
            - Article: Full article with content and version history
            - ArticleCreate: Request schema for creating articles
            - ArticlePatch: Partial update schema (all fields optional)
            - ArticleSave: Full article save schema for updates
            - ArticleVersion: Git commit metadata for article versions
    """
    return {
        "ArticleMeta": ArticleMeta.model_json_schema(),
        "Article": Article.model_json_schema(),
        "ArticleCreate": ArticleCreate.model_json_schema(),
        "ArticlePatch": ArticlePatch.model_json_schema(),
        "ArticleSave": ArticleSave.model_json_schema(),
        "ArticleVersion": ArticleVersion.model_json_schema(),
    }


@mcp.resource("inkwell://article-schemas/{schema_name}", mime_type="application/json")
def get_article_schema(schema_name: str) -> dict:
    """Get a specific article schema definition.

    Args:
        schema_name: Name of the schema to retrieve (e.g., 'ArticleMeta', 'Article').

    Returns:
        dict: The JSON schema representation of the requested schema.

    Raises:
        ValueError: If the schema name is not found.
    """
    schemas = {
        "ArticleMeta": ArticleMeta,
        "Article": Article,
        "ArticleCreate": ArticleCreate,
        "ArticlePatch": ArticlePatch,
        "ArticleSave": ArticleSave,
        "ArticleVersion": ArticleVersion,
    }

    if schema_name not in schemas:
        raise ValueError(
            f"Schema '{schema_name}' not found. Available schemas: {', '.join(schemas.keys())}"
        )

    return schemas[schema_name].model_json_schema()


@mcp.resource("inkwell://article-statuses", mime_type="application/json")
def list_article_statuses() -> dict[str, str]:
    """List all valid article status values.

    Returns:
        dict[str, str]: Mapping of status codes to their descriptions.
    """
    return {
        "draft": "Article is in draft status and not published",
        "published": "Article has been published",
    }


@mcp.resource("inkwell://article-constants", mime_type="application/json")
def list_article_constants() -> dict:
    """Provide article-related constants and enumerations used by the Inkwell API.

    Returns:
        dict: Mapping of constant names to their values and descriptions.
    """
    return {
        "statuses": {
            "valid_values": ["draft", "published"],
            "description": "Article publication status",
        },
        "article_fields": {
            "slug": {
                "type": "string",
                "description": "Unique identifier for the article (directory name)",
                "pattern": "^[a-z0-9-]+$",
            },
            "title": {
                "type": "string",
                "description": "Article title (required, non-empty)",
            },
            "content": {
                "type": "string",
                "description": "Article content in markdown format",
            },
            "tags": {
                "type": "array",
                "items": {"type": "string"},
                "description": "List of article tags",
            },
            "status": {
                "type": "string",
                "enum": ["draft", "published"],
                "description": "Article publication status",
            },
        },
    }
