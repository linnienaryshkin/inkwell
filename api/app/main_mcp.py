"""FastMCP server entrypoint.

Handles MCP tool calls for articles CRUD operations.
Reuses models and GitHub layer from main_rest.
"""

import asyncio

from mcp.server import FastMCP

from app.mcp.handlers import (
    handle_create_article,
    handle_delete_article,
    handle_get_article,
    handle_list_articles,
    handle_save_article,
)

# Create FastMCP server instance
app = FastMCP(name="inkwell")

# Register all tools with their handlers
# FastMCP derives input/output schemas from the function signatures
app.add_tool(
    handle_list_articles,
    name="list_articles",
    description="List all articles for the authenticated user",
)
app.add_tool(
    handle_get_article,
    name="get_article",
    description="Get a specific article by slug",
)
app.add_tool(
    handle_create_article,
    name="create_article",
    description="Create a new article",
)
app.add_tool(
    handle_save_article,
    name="save_article",
    description="Save an existing article (full save with title, tags, content)",
)
app.add_tool(
    handle_delete_article,
    name="delete_article",
    description="Delete an article",
)


async def run() -> None:
    """Run the MCP server on stdio (pipe-based).

    The server listens for MCP protocol messages on stdin and writes
    responses to stdout. This allows Claude Code and other MCP clients
    to invoke tools through the standard MCP protocol.
    """
    async with app.run_stdio():
        pass


if __name__ == "__main__":
    asyncio.run(run())
