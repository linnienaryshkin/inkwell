# Plan: AI Chat Assistant (Issue #148)

## Context

Inkwell needs an AI co-writer feature: a chat tab in the right sidebar where users can discuss and improve their article with a Claude-backed assistant. Threads are scoped per user + article, stored in memory only, backed by a minimal LangGraph graph (START → LLM → END). The UX mirrors GitHub Copilot's two-state panel: threads list → active thread.

---

## Architecture

```
SidePanel ("chat" tab)
  └── ChatTab
        ├── threads view: list of ThreadMeta + "New Thread" input
        └── active thread view: messages + bottom input

FastAPI /ai/*
  └── chat router → ai.service → ai.graph (LangGraph + MemorySaver)
```

---

## Backend

### New files

**`api/app/routers/deps.py`** — extract `require_auth` from `articles.py` here so both routers share it.

```python
def require_auth(gh_access_token: str | None = Cookie(default=None)) -> str:
    if not gh_access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return gh_access_token
```

**`api/app/models/chat.py`** — Pydantic schemas:

```python
class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    created_at: str  # ISO 8601

class ChatThread(BaseModel):
    id: str; slug: str; title: str; created_at: str
    messages: list[ChatMessage] = []

class ThreadMeta(BaseModel):          # list response
    id: str; slug: str; title: str; created_at: str

class CreateThreadRequest(BaseModel): # POST /ai/threads body
    slug: str; message: str; article_content: str

class CreateThreadResponse(BaseModel):
    thread_id: str; reply: str

class PostMessageRequest(BaseModel):  # POST /ai/threads/{id} body
    message: str; article_content: str

class PostMessageResponse(BaseModel):
    reply: str
```

Note: `article_content` is sent by the client (not fetched server-side) so unsaved edits are always in context.

**`api/app/ai/graph.py`** — LangGraph definition:

```python
_memory = MemorySaver()  # module-level singleton

def build_graph() -> CompiledStateGraph:
    model = ChatAnthropic(model="claude-haiku-4-5-20251001")
    builder = StateGraph(MessagesState)
    builder.add_node("call_model", lambda s: {"messages": [model.invoke(s["messages"])]})
    builder.add_edge(START, "call_model")
    return builder.compile(checkpointer=_memory)

graph = build_graph()
```

**`api/app/ai/service.py`** — business logic, module-level `_threads: dict[str, ChatThread]`:

- `_token_key(token)` — sha256 hex[:16] to namespace threads per user without storing raw tokens
- `list_threads(token, slug) → list[ThreadMeta]` — filter by slug + token key
- `create_thread(token, slug, message, article_content) → CreateThreadResponse` — uuid4 thread id, inject system prompt + HumanMessage, invoke graph, store thread + messages
- `post_message(thread_id, message, article_content) → PostMessageResponse` — 404 if missing, invoke graph with existing thread_id

System prompt template:
```
You are a writing cowriter assistant for the article below.
Help the author improve, expand, or discuss their work.

--- ARTICLE CONTENT ---
{article_content}
--- END ARTICLE ---
```

The system prompt is a `SystemMessage` prepended per invocation — not stored in `MemorySaver` — so article content stays fresh.

**`api/app/routers/chat.py`** — FastAPI router:

| Method | Path | Auth | Status | Delegates to |
|--------|------|------|--------|-------------|
| GET | `/ai/threads?slug=` | cookie | 200 | `service.list_threads` |
| POST | `/ai/threads` | cookie | 201 | `service.create_thread` |
| POST | `/ai/threads/{thread_id}` | cookie | 200 | `service.post_message` |

POST `/{thread_id}` returns 404 if thread not found, 403 if thread belongs to a different user.

### Modified files

**`api/app/routers/articles.py`** — replace local `require_auth` with import from `app.routers.deps`.

**`api/app/main_rest.py`** — add:
```python
from app.routers import chat
app.include_router(chat.router, prefix="/ai", tags=["ai"])
```

**`api/tests/test_chat.py`** — new tests following `test_articles.py` patterns. Mock all LangGraph calls with:
```python
patch("app.ai.service.graph.invoke", return_value={"messages": [AIMessage(content="mock reply")]})
```

Test coverage:
- `TestListThreads`: empty list, filtered by slug, 401, cross-user isolation
- `TestCreateThread`: 201 + reply, 401, 422 on empty message, correct thread_id in graph call
- `TestPostMessage`: returns reply, 401, 404 unknown thread, 403 wrong user

---

## Frontend

### New files

**`ui/src/components/ChatTab.tsx`** — owns all chat UI state:

```typescript
type View = "threads" | "thread";
// local state:
const [view, setView] = useState<View>("threads");
const [threads, setThreads] = useState<ThreadMeta[]>([]);
const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
const [messages, setMessages] = useState<ChatMessage[]>([]);
const [input, setInput] = useState("");
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

- When `article` is null → placeholder: "Open an article to start chatting."
- On mount / article change → `fetchThreads(article.meta.slug)`
- Threads view: list of `ThreadMeta` + bottom input with "New Thread" label
- Thread view: back button + message bubbles + bottom input
- User bubbles: right-aligned, `background: var(--accent)`, `color: var(--bg-primary)`
- Assistant bubbles: left-aligned, `background: var(--bg-tertiary)`, rendered with `<ReactMarkdown>`
- Send button: `background: var(--accent)`, disabled while `loading`

**`ui/src/components/ChatTab.test.tsx`** — mock all `api.ts` functions, test: placeholder state, thread list loading, new thread creation, message send, back navigation.

### Modified files

**`ui/src/services/api.ts`** — add:

```typescript
export type ThreadMeta = { id: string; slug: string; title: string; created_at: string };
export type ChatMessage = { role: "user" | "assistant"; content: string; created_at: string };

export async function fetchThreads(slug: string): Promise<ThreadMeta[]>
export async function createThread(body: { slug: string; message: string; article_content: string }): Promise<{ thread_id: string; reply: string }>
export async function postMessage(threadId: string, body: { message: string; article_content: string }): Promise<{ reply: string }>
```

Follow existing `fetchWithTimeout` + `credentials: "include"` pattern.

**`ui/src/components/SidePanel.tsx`** — three changes:
1. Type union: `"lint" | "publish" | "toc" | "chat"` (Props + onTabChange)
2. Tab array: `(["lint", "publish", "toc", "chat"] as const)`
3. Add content block: `{activeTab === "chat" && <ChatTab article={article} />}`

**`ui/src/app/studio/page.tsx`** — widen the `useState` type:
```typescript
const [sidePanelTab, setSidePanelTab] = useState<"lint" | "publish" | "toc" | "chat">("publish");
```

**`ui/src/components/SidePanel.test.tsx`** — add test for chat tab render.

---

## Implementation Order

1. `api/app/routers/deps.py` + update `articles.py` import
2. `api/app/models/chat.py`
3. `api/app/ai/graph.py`
4. `api/app/ai/service.py`
5. `api/app/routers/chat.py`
6. `api/app/main_rest.py` — register router
7. `api/tests/test_chat.py`
8. `ui/src/services/api.ts` — add 3 functions
9. `ui/src/components/ChatTab.tsx`
10. `ui/src/components/SidePanel.tsx` + `studio/page.tsx`
11. `ui/src/components/ChatTab.test.tsx` + `SidePanel.test.tsx`

---

## Verification

```bash
task test              # all tests pass (ui + api)
task quality-gate      # lint, types, format all clean
task dev               # start all servers
# Open http://localhost:5173, select an article, click "chat" tab
# Create a new thread, verify reply appears
# Go back to thread list, click existing thread, send another message
```

Critical files to read before implementing:
- `api/app/routers/articles.py` — `require_auth` source + router conventions
- `api/app/main_rest.py` — router registration pattern
- `ui/src/components/SidePanel.tsx` — current tab structure
- `ui/src/services/api.ts` — fetch helper pattern
- `api/tests/test_articles.py` — test structure reference
