"""FastMCP server entrypoint.

Handles MCP tool calls for articles CRUD operations.
Reuses models and GitHub layer from main_rest.

Importing this module automatically registers all tools via decorators.

Works with:
  - Direct execution: uv run python -m app.main_mcp
  - MCP Inspector: mcp dev api/app/main_mcp.py:mcp (from project root)
"""

import sys
from pathlib import Path

import app.mcp.tools  # noqa: F401 - Import triggers @mcp.tool decorators
from app.mcp.server import mcp

# Ensure the api directory is in the path for mcp dev discovery
api_dir = Path(__file__).parent.parent
if str(api_dir) not in sys.path:
    sys.path.insert(0, str(api_dir))


if __name__ == "__main__":
    """Run the MCP server on stdio (pipe-based).

    The server listens for MCP protocol messages on stdin and writes
    responses to stdout. This allows Claude Code and other MCP clients
    to invoke tools through the standard MCP protocol.
    """
    mcp.run(transport="stdio")
