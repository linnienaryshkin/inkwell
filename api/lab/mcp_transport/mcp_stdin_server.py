import asyncio

from mcp.server.fastmcp import Context, FastMCP

mcp = FastMCP(name="Demo Server", log_level="ERROR")

"""
uv run api/lab/mcp_transport/mcp_stdin_server.py
"""

print("=== MCP STDIO Transport Demo ===")

print("Example messages:")
print(
    '{"jsonrpc": "2.0", "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "demo-client", "version": "1.0.0"}}, "id": 1}'
)
print('{"jsonrpc": "2.0", "method":"notifications/initialized"}')
print(
    '{"jsonrpc": "2.0", "method": "tools/call", "params": {"_meta": {"progressToken": "abc123"}, "name": "add", "arguments": {"a": 5, "b": 3}}, "id": 3}'
)

print("\n", "=" * 30, "\n")


@mcp.tool()
async def add(a: int, b: int, ctx: Context) -> int:
    """Add two integers and return their sum.

    Args:
        a: First integer to add.
        b: Second integer to add.
        ctx: MCP context for logging and progress reporting.

    Returns:
        The sum of a and b.
    """
    await ctx.info("Preparing to add...")
    await asyncio.sleep(2)
    await ctx.report_progress(80, 100)

    return a + b


if __name__ == "__main__":
    mcp.run(transport="stdio")
