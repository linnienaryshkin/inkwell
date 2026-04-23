from langchain_anthropic import ChatAnthropic
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import START, MessagesState, StateGraph

_memory = MemorySaver()


def build_graph() -> StateGraph:
    """Build and compile the cowriter LangGraph graph.

    Returns:
        CompiledStateGraph: Compiled graph with in-memory checkpointing.
    """
    model = ChatAnthropic(model="claude-haiku-4-5-20251001")
    builder = StateGraph(MessagesState)

    def call_model(state: MessagesState) -> dict:
        """Call the language model with the current messages.

        Args:
            state: Current message state.

        Returns:
            dict: Dictionary with the new message added to the messages list.
        """
        return {"messages": [model.invoke(state["messages"])]}

    builder.add_node("call_model", call_model)
    builder.add_edge(START, "call_model")
    return builder.compile(checkpointer=_memory)


graph = build_graph()
