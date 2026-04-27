"""Inkwell Article Management Agent using LangGraph.

A ReAct-style agent that manages Inkwell articles using LangGraph and Anthropic.
This agent can list, create, update, and delete articles.

Run with:
uv run langgraph dev api/lab/inkwell_article_agent.py:graph
"""

from typing import Annotated, Any, Literal

from dotenv import load_dotenv
from langchain.tools import tool
from langchain_anthropic import ChatAnthropic
from langgraph.graph import START, StateGraph
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict

# Load environment variables
load_dotenv()


# ============================================================================
# Tools for Inkwell Article Management
# ============================================================================


@tool(parse_docstring=True)
def list_articles() -> dict[str, Any]:
    """List all Inkwell articles (summaries with metadata).

    Returns:
        dict: A dictionary containing the list of articles or an error message.
    """
    print("📄 Listing all Inkwell articles...")
    # Mock implementation - in production, this would call the REST API
    return {
        "status": "success",
        "articles": [
            {"slug": "intro-to-rust", "title": "Intro to Rust", "status": "published"},
            {"slug": "golang-patterns", "title": "Go Design Patterns", "status": "draft"},
        ],
        "total": 2,
    }


@tool(parse_docstring=True)
def get_article(slug: str) -> dict[str, Any]:
    """Retrieve the full content of an article by slug.

    Args:
        slug: The article slug (unique identifier).

    Returns:
        dict: The article data including content, or an error message.
    """
    print(f"📖 Fetching article: {slug}...")
    # Mock implementation
    if slug == "intro-to-rust":
        return {
            "status": "success",
            "article": {
                "slug": slug,
                "title": "Intro to Rust",
                "content": "# Intro to Rust\n\n...",
                "tags": ["rust", "systems-programming"],
                "status": "published",
            },
        }
    return {"status": "error", "message": f"Article '{slug}' not found"}


@tool(parse_docstring=True)
def create_article(title: str, slug: str, tags: list[str], content: str) -> dict[str, Any]:
    """Create a new Inkwell article.

    Args:
        title: Article title.
        slug: URL-friendly identifier (must be unique).
        tags: List of tags for categorization.
        content: Markdown content of the article.

    Returns:
        dict: Confirmation with the created article metadata or error.
    """
    print(f"✨ Creating article: {slug}...")
    return {
        "status": "success",
        "message": f"Article '{slug}' created successfully",
        "article": {
            "slug": slug,
            "title": title,
            "tags": tags,
            "status": "draft",
        },
    }


@tool(parse_docstring=True)
def update_article(
    slug: str, title: str, tags: list[str], content: str, message: str = ""
) -> dict[str, Any]:
    """Update an existing Inkwell article.

    Args:
        slug: Article slug to update.
        title: Updated title.
        tags: Updated tags.
        content: Updated markdown content.
        message: Optional commit message for version control.

    Returns:
        dict: Confirmation with the updated article or error.
    """
    print(f"📝 Updating article: {slug}...")
    return {
        "status": "success",
        "message": f"Article '{slug}' updated successfully",
        "article": {"slug": slug, "title": title, "tags": tags},
    }


@tool(parse_docstring=True)
def delete_article(slug: str) -> dict[str, Any]:
    """Delete an Inkwell article.

    Args:
        slug: The article slug to delete.

    Returns:
        dict: Confirmation or error message.
    """
    print(f"🗑️  Deleting article: {slug}...")
    return {"status": "success", "message": f"Article '{slug}' deleted successfully"}


@tool(parse_docstring=True)
def search_articles(query: str) -> dict[str, Any]:
    """Search articles by title or content.

    Args:
        query: Search query string.

    Returns:
        dict: List of matching articles.
    """
    print(f"🔍 Searching articles for: {query}...")
    return {
        "status": "success",
        "query": query,
        "results": [
            {
                "slug": "intro-to-rust",
                "title": "Intro to Rust",
                "excerpt": "Learn the basics...",
            }
        ],
    }


# ============================================================================
# State Definition and Graph Setup
# ============================================================================


class State(TypedDict):
    """State for the Inkwell agent."""

    messages: Annotated[list, add_messages]


def should_continue(state: State) -> Literal["tools", "__end__"]:
    """Route to tools if the model calls them, otherwise end."""
    messages = state["messages"]
    last_message = messages[-1]
    # If the model called tools, continue to the tools node
    if last_message.tool_calls:
        return "tools"
    # Otherwise, we're done
    return "__end__"


def call_model(state: State) -> dict[str, Any]:
    """Call the Anthropic model to generate a response or tool calls."""
    messages = state["messages"]
    model = ChatAnthropic(model="claude-haiku-4-5", temperature=0.7)  # type: ignore[call-arg]

    tools = [
        list_articles,
        get_article,
        create_article,
        update_article,
        delete_article,
        search_articles,
    ]

    response = model.bind_tools(tools).invoke(messages)
    return {"messages": [response]}


def process_tool_calls(state: State) -> dict[str, Any]:
    """Process tool calls and return results."""
    messages = state["messages"]
    last_message = messages[-1]

    tool_results = []
    for tool_call in last_message.tool_calls:
        tool_name = tool_call["name"]
        tool_input = tool_call["args"]

        # Get the tool function and execute it
        tools_map = {
            "list_articles": list_articles,
            "get_article": get_article,
            "create_article": create_article,
            "update_article": update_article,
            "delete_article": delete_article,
            "search_articles": search_articles,
        }

        if tool_name in tools_map:
            tool_result = tools_map[tool_name].invoke(tool_input)
            tool_results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": tool_call["id"],
                    "content": str(tool_result),
                }
            )

    return {"messages": tool_results}


# ============================================================================
# Build the Graph
# ============================================================================

graph_builder = StateGraph(State)

# Add nodes
graph_builder.add_node("model", call_model)
graph_builder.add_node("tools", process_tool_calls)

# Add edges
graph_builder.add_edge(START, "model")
graph_builder.add_conditional_edges("model", should_continue)
graph_builder.add_edge("tools", "model")

# Compile the graph
graph = graph_builder.compile()

if __name__ == "__main__":
    # Simple test
    print("🚀 Inkwell Article Agent initialized!")
    print("Run with: uv run langgraph dev api/lab/inkwell_article_agent.py:graph")
