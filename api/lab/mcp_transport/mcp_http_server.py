import asyncio

from mcp.server.fastmcp import Context, FastMCP
from starlette.requests import Request
from starlette.responses import Response

"""
MCP HTTP Transport -- Three Modes
==================================

Legend:  C = MCP Client    S = FastMCP Server
         -->  request       <--  response / streamed event


------------------------------------------------------------------------
Mode 1: Default  (stateful + SSE streaming)
------------------------------------------------------------------------
Sessions are maintained server-side.  The client receives a chunked SSE
stream.  Progress and log events arrive before the final result.  A GET
on /mcp lets the client re-attach to a live session.

  --- Initialize ---

  C --> S  POST /mcp
           Accept: text/event-stream
           {method: "initialize", ...}

  C <-- S  200 OK
           Content-Type: text/event-stream
           mcp-session-id: <uuid>

           event: message
           data: {result: {capabilities, ...}}
           [stream closes]

  --- Tool Call ---

  C --> S  POST /mcp
           Accept: text/event-stream
           mcp-session-id: <uuid>
           {method: "tools/call", params: {name:"add", arguments:{a:1,b:2}}}

  C <-- S  200 OK  (Content-Type: text/event-stream)

           event: message
           data: {method: "notifications/message",
                  params: {level:"info", data:"Preparing to add..."}}

           event: message
           data: {method: "notifications/progress",
                  params: {progress:80, total:100}}

           event: message
           data: {result: {content:[{type:"text", text:"3"}]}}
           [stream closes]

  --- Re-attach (missed events) ---

  C --> S  GET /mcp
           Accept: text/event-stream
           mcp-session-id: <uuid>
           Last-Event-ID: <last-seen-id>

  C <-- S  200 OK  (Content-Type: text/event-stream)
           [server replays missed events]


------------------------------------------------------------------------
Mode 2: stateless_http=True  (no session, SSE per-request)
------------------------------------------------------------------------
The server never allocates a session.  Every request is self-contained.
Streaming still works within a single request, but there is no session
ID and no way to re-attach.  Ideal for serverless / edge deployments.

  --- Initialize ---

  C --> S  POST /mcp
           Accept: text/event-stream
           {method: "initialize", ...}

  C <-- S  200 OK  (Content-Type: text/event-stream)
           [no mcp-session-id header]

           event: message
           data: {result: {capabilities, ...}}
           [stream closes]

  --- Tool Call ---

  C --> S  POST /mcp
           Accept: text/event-stream
           {method: "tools/call", params: {name:"add", arguments:{a:1,b:2}}}
           [no session header -- each request is fully independent]

  C <-- S  200 OK  (Content-Type: text/event-stream)

           event: message
           data: {method: "notifications/message",
                  params: {level:"info", data:"Preparing to add..."}}

           event: message
           data: {method: "notifications/progress",
                  params: {progress:80, total:100}}

           event: message
           data: {result: {content:[{type:"text", text:"3"}]}}
           [stream closes]

  --- Re-attach -- NOT possible ---

  (no GET /mcp; client must retry the full tool call)


------------------------------------------------------------------------
Mode 3: json_response=True  (no SSE, single JSON response)
------------------------------------------------------------------------
The server returns a plain JSON body instead of an SSE stream.  There
are no intermediate progress or log events -- only the final result.
Simplest option for clients that do not support SSE.  Can be combined
with stateless_http=True.

  --- Initialize ---

  C --> S  POST /mcp
           Accept: application/json
           {method: "initialize", ...}

  C <-- S  200 OK
           Content-Type: application/json
           {result: {capabilities, ...}}

  --- Tool Call ---

  C --> S  POST /mcp
           Accept: application/json
           {method: "tools/call", params: {name:"add", arguments:{a:1,b:2}}}

  C <-- S  200 OK
           Content-Type: application/json
           {result: {content:[{type:"text", text:"3"}]}}

           NOTE: ctx.info() and ctx.report_progress() calls are silently
           dropped -- they cannot be delivered in a single JSON body.

  (no streaming, no session ID, no re-attach)
"""


mcp = FastMCP(
    "mcp-server",
    # stateless_http=True,
    # json_response=True,
)

"""
uv run api/lab/mcp_transport/mcp_http_server.py

And open demo page at file://{path_to_repo}/api/lab/mcp_transport/index.html
E.g. file:///Users/Ilia_Naryshkin/projects/inkwell/api/lab/mcp_transport/index.html
"""


@mcp.tool()
async def add(a: int, b: int, ctx: Context) -> int:
    """Add two integers together with progress reporting.

    Args:
        a: First integer to add.
        b: Second integer to add.
        ctx: MCP context for logging and progress reporting.

    Returns:
        int: The sum of a and b.
    """
    await ctx.info("Preparing to add...")
    await asyncio.sleep(2)
    await ctx.report_progress(80, 100)

    return a + b


@mcp.custom_route("/", methods=["GET"])
async def get(request: Request) -> Response:
    """Serve the demo HTML page for MCP HTTP transport testing.

    Args:
        request: The incoming HTTP request.

    Returns:
        Response: HTML response containing the demo page.
    """
    with open("index.html") as f:
        html_content = f.read()
    return Response(content=html_content, media_type="text/html")


mcp.run(transport="streamable-http")
