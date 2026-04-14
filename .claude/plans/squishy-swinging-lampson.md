# LangGraph Lab Notebook — Inkwell Article Agent

## Context

The current `api/lab/langgraph.ipynb` is a scratch pad mirroring the academy's `simple-graph.ipynb` pattern with Anthropic and a Tavily test. The goal is to rewrite it as a living, structured notebook that grows one section per academy module — starting with a real working Inkwell article agent (Module 1), then adding stub sections for Modules 2–6 that document what will be built as learning progresses.

This is a learning artifact, not production code. It should be engaging, concrete, and directly connected to the Inkwell domain.

---

## Notebook Structure

6 sections. Section 1 is fully implemented; Sections 2–6 are markdown headers + stub cells.

A **shared setup cell** at the top loads `.env`, applies `nest_asyncio`, and sets `ACCESS_TOKEN = os.getenv("GITHUB_ACCESS_TOKEN")`.

---

## Section 1 — Module 1: Inkwell Article Agent (full implementation)

**Core concept:** ReAct loop + tool-calling + MemorySaver multi-turn conversation.

**Inkwell scenario:** Conversational writing assistant. User says "list my articles", "get content of my-first-post", "create a draft called LangGraph Notes", "append a conclusion and save it" — all in one thread. Agent decides which tool to call, calls it, reads result, replies naturally.

### Cells

**Cell 1 — Setup**

```python
import asyncio, os, sys
import nest_asyncio; nest_asyncio.apply()
from dotenv import load_dotenv; load_dotenv()
# Section 1 uses mock data — no real GitHub token needed
```

**Cell 2 — Mock data + tool definitions**

Mock article data hardcoded in the notebook (3-4 fake articles with realistic markdown content). Tools operate against an in-memory dict `MOCK_ARTICLES: dict[str, Article]`.

- `list_articles_tool()` → returns formatted "slug | title | status | tags" per line from `MOCK_ARTICLES`
- `get_article_tool(slug: str)` → returns meta + content (from `MOCK_ARTICLES[slug]`), truncated to 2000 chars
- `create_article_tool(title, slug, tags, content)` → adds to `MOCK_ARTICLES`, returns "Created: {slug}"
- `save_article_tool(slug, title, tags, content, message)` → updates `MOCK_ARTICLES[slug]`, returns "Saved: {slug} — commit: {message}"

`delete_article` intentionally omitted — too destructive for an autonomous agent.

Tool return values are plain strings — better for haiku-class model.

> **Note:** Once you're comfortable with the agent's behavior, swap the mock implementations for real `github_articles.py` calls by adding `ACCESS_TOKEN = os.getenv("GITHUB_ACCESS_TOKEN")` and wiring each tool to the async functions (see the async note at the bottom of this doc).

**Cell 3 — Graph construction**

```python
from langchain_anthropic import ChatAnthropic
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver
from IPython.display import display, Image

llm = ChatAnthropic(model="claude-haiku-4-5", temperature=0.1)
tools = [list_articles_tool, get_article_tool, create_article_tool, save_article_tool]
memory = MemorySaver()

agent = create_react_agent(
    model=llm,
    tools=tools,
    checkpointer=memory,
    state_modifier="You are an Inkwell writing assistant with access to the user's GitHub-backed article library. When asked to save changes, always confirm the commit message with the user before proceeding."
)

display(Image(agent.get_graph().draw_mermaid_png()))
```

Uses `create_react_agent` (prebuilt) — Module 1 is about understanding the loop, not hand-wiring edges.

**Cell 4 — Single-turn smoke test**

```python
config = {"configurable": {"thread_id": "inkwell-lab-1"}}
result = await agent.ainvoke(
    {"messages": [HumanMessage(content="List all my articles")]},
    config=config
)
print(result["messages"][-1].content)
```

**Cell 5 — Multi-turn conversation demo**

```python
async def chat(user_input: str, thread_id: str = "inkwell-lab-1"):
    config = {"configurable": {"thread_id": thread_id}}
    result = await agent.ainvoke(
        {"messages": [HumanMessage(content=user_input)]},
        config=config,
    )
    return result["messages"][-1].content

# Turn 1: agent lists articles
response1 = await chat("List my articles and tell me which one looks most complete")
print(response1)

# Turn 2: agent remembers context, fetches content
response2 = await chat("Get the full content of that article")
print(response2)

# Turn 3: agent uses both prior turns to edit and save
response3 = await chat("Add a concluding section summarizing the main points and save it")
print(response3)
```

MemorySaver + shared thread_id carries full message history across turns.

---

## Section 2 — Module 2: Richer State (stub)

**Core concept:** Custom state schemas (TypedDict/Pydantic/Dataclass), reducers, message trimming.

**Inkwell scenario:** Editorial assistant that tracks `current_article: Article | None`, `draft_history: Annotated[list[str], operator.add]` (content snapshots), and `token_count: int` alongside messages. Message trimming keeps context bounded when editing long articles.

**APIs to use:** Custom `TypedDict` schema on `StateGraph`, `Annotated` reducers, `trim_messages` from `langchain_core.messages`.

**TODO:** Define `ArticleAgentState`, wire a `load_article` node that populates `current_article`, add `trim_messages` before each LLM call.

---

## Section 3 — Module 3: Human-in-the-Loop for Destructive Actions (stub)

**Core concept:** Static breakpoints, dynamic interrupts, edit-state-human-feedback, time-travel.

**Inkwell scenario:** Before `save_article_tool` fires, pause and show the user the proposed commit message and content diff. Human can approve, edit message, or reject. Time-travel: "roll back to before I told the agent to add that section."

**APIs to use:** `interrupt_before=["save_node"]` on `compile`, `graph.update_state(config, {...})` to inject human edit, `graph.invoke(None, config)` to resume, `graph.get_state_history(config)` + `checkpoint_id` for time-travel.

**TODO:** Add `confirm_save` node between agent decision and tool execution. Node raises `NodeInterrupt` with proposed content. Resume only on approval.

---

## Section 4 — Module 4: Parallel Article Audit (Map-Reduce) (stub)

**Core concept:** Parallelization via `Send`, sub-graphs, map-reduce.

**Inkwell scenario:** "Audit all my articles" — list all → fan out in parallel to fetch + analyze each (missing tags? very short content? no conclusion?) → fan back in to produce a consolidated editorial report.

**APIs to use:** `Send` from `langgraph.types` to fan out per-article sub-graph instances, a `article_auditor` sub-graph returning `{slug, issues}`, a `reduce_audit` node with `operator.add` reducer on `audit_results: list[dict]`.

**TODO:** `audit_router` returns `[Send("audit_article", {"slug": m.slug}) for m in metas]`. Wire fan-out → fan-in.

---

## Section 5 — Module 5: Long-Term Writer Memory (stub)

**Core concept:** LangGraph Memory Store for cross-thread persistent memory. Profile vs. collection memory.

**Inkwell scenario:** Agent remembers user's writing preferences across sessions (preferred tone, recurring tags, liked articles). Between sessions (different thread_ids), loads profile from Store and tailors suggestions. A "notes to self" collection stores per-article research snippets.

**APIs to use:** `InMemoryStore` passed to `create_react_agent(store=store)`, `store.put/get/search`, profile at `("users", user_id, "profile")`, notes at `("users", user_id, "article_notes", slug)`.

**TODO:** Define `WriterProfile` Pydantic model. Wire `update_memory` node after each agent turn to extract and save profile updates.

---

## Section 6 — Module 6: LangGraph Platform Deployment (stub)

**Core concept:** LangGraph Platform, deployed graph instances, assistants versioning, double-texting prevention.

**Inkwell scenario:** The Section 1 agent deployed as a persistent service. Notebook connects via `LangGraphClient`, creates "editorial assistant" and "terse summarizer" as two assistant configs over the same graph. Demonstrates double-texting strategies (enqueue/reject/rollback).

**APIs to use:** `langgraph_sdk.get_client(url=LANGGRAPH_URL)`, `client.assistants.create(graph_id=...)`, `client.runs.stream(...)`, `multitask_strategy` param.

**TODO:** Add `LANGGRAPH_URL` to `.env`. Show `client.assistants.search()` to verify deployment. Run two assistant configs against the same article content.

---

## Critical Files

- `api/lab/langgraph.ipynb` — file to rewrite
- `api/app/github_articles.py` — async functions to wrap as tools
- `api/app/models/article.py` — Pydantic models (Article, ArticleMeta, ArticleVersion)
- `api/.env` — must have `GITHUB_ACCESS_TOKEN`

## Async Note

All `github_articles.py` functions are `async`. Use `nest_asyncio.apply()` in setup cell and define tools as `async` functions with `@tool`. Use `agent.ainvoke(...)` instead of `.invoke(...)`.

## Verification

1. Run Cell 1 — confirm `ACCESS_TOKEN` is set
2. Run Cell 2 — confirm all 4 tools import without error
3. Run Cell 3 — Mermaid diagram renders showing agent → tools cycle
4. Run Cell 4 — agent returns list of real articles from GitHub
5. Run Cell 5 — three-turn conversation where agent fetches and edits a real article, demonstrating MemorySaver context carry-over
