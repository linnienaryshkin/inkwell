"""FastMCP server entrypoint.

Handles MCP tool calls and resources for articles.
Reuses models and GitHub layer from main_rest.

Importing this module automatically registers all tools and resources via decorators.

Works with:
  - Direct execution: uv run python -m app.main_mcp
  - MCP Inspector: mcp dev api/app/main_mcp.py:mcp (from project root)
"""
# ruff: noqa: E402, I001

import sys
from pathlib import Path

# Ensure the api directory is in the path for mcp dev discovery
# Must happen BEFORE importing app modules so mcp dev can find the app package
api_dir = Path(__file__).parent.parent
if str(api_dir) not in sys.path:
    sys.path.insert(0, str(api_dir))

import app.mcp.prompts  # noqa: F401 - Import triggers @mcp.prompt decorators
import app.mcp.resources  # noqa: F401 - Import triggers @mcp.resource decorators
import app.mcp.tools  # noqa: F401 - Import triggers @mcp.tool decorators
from app.mcp.server import mcp


if __name__ == "__main__":
    """Run the MCP server on stdio (pipe-based).

    The server listens for MCP protocol messages on stdin and writes
    responses to stdout. This allows Claude Code and other MCP clients
    to invoke tools through the standard MCP protocol.
    """
    mcp.run(transport="stdio")
