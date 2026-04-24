from typing import Annotated

from langchain_anthropic import ChatAnthropic
from langgraph.checkpoint.memory import MemorySaver
from langgraph.func import task
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict


class State(TypedDict):
    """State for the chat graph."""

    messages: Annotated[list, add_messages]


_checkpointer = MemorySaver()
_model = ChatAnthropic(model="claude-haiku-4-5-20251001")

SYSTEM_PROMPT = "You are a co-author helping developer-writers craft clear, well-structured technical articles. Help with structure, clarity, tone, and technical accuracy."


@task
def _call_model(state: State) -> dict:
    """Call Claude with the system prompt prepended (not stored in checkpoint)."""
    messages = [{"role": "user", "content": SYSTEM_PROMPT}] + state["messages"]
    response = _model.invoke(messages)
    return {"messages": [response]}


def _build_graph() -> object:
    """Build and compile the chat graph."""
    graph_builder = StateGraph(State)
    graph_builder.add_node("llm", _call_model)
    graph_builder.add_edge(START, "llm")
    graph_builder.add_edge("llm", END)
    return graph_builder.compile(checkpointer=_checkpointer)


graph = _build_graph()
