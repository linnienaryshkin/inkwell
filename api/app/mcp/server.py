"""FastMCP server instance.

This module creates the shared FastMCP instance that tools and resources
register themselves with via decorators.
"""

from mcp.server import FastMCP

mcp = FastMCP(
    name="inkwell",
    json_response=True,  # Return JSON-serializable responses by default
    stateless_http=True,  # Each HTTP request is independent, no shared state between calls
    tools=None,  # Tools will be registered via decorators in other modules
)
