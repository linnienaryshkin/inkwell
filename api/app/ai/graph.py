"""LangGraph chat assistant graph."""

from langchain_anthropic import ChatAnthropic
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, MessagesState, StateGraph

# Module-level singleton: MemorySaver for in-memory thread history
memory = MemorySaver()


def call_llm(state: MessagesState) -> MessagesState:
    """Call Claude Haiku with the current message state."""
    llm = ChatAnthropic(model="claude-haiku-4-5-20251001")
    messages = state["messages"]
    response = llm.invoke(messages)
    return {"messages": [response]}


# Build the graph: START → call_llm → END
builder = StateGraph(MessagesState)
builder.add_node("llm", call_llm)
builder.add_edge(START, "llm")
builder.add_edge("llm", END)

# Compile with MemorySaver for persistence across invocations
graph = builder.compile(checkpointer=memory)
