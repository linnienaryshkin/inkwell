"""FastMCP server instance.

This module creates the shared FastMCP instance that tools and resources
register themselves with via decorators.
"""

from mcp.server import FastMCP

mcp = FastMCP(name="inkwell")
