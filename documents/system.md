# 🏗️ AI QA Desktop Tool — System Architecture (TestExplorer)

---

# 🎯 1. Kiến trúc tổng thể (High-level)

```
+-----------------------------+
|       Desktop App           |
|   (Electron + React UI)     |
+-------------+---------------+
              |
              | IPC
              ↓
+-----------------------------+
|     Main Process (Node)     |
|        Orchestrator         |
+-------------+---------------+
              |
              ↓
+---------------------------------------------+
|                Core Engine                  |
|---------------------------------------------|
| Crawl Engine   | Action Engine | Validator  |
| (Playwright)   |               | Engine     |
+---------------------------------------------+
              |
              ↓
+-----------------------------+
|        AI Layer             |
|  (Ollama / OpenAI Hybrid)   |
+-----------------------------+
              |
              ↓
+-----------------------------+
|        Storage              |
|        (SQLite)             |
+-----------------------------+
              |
              ↓
+-----------------------------+
|        Report System        |
+-----------------------------+
```

---

# 🧠 2. Kiến trúc chi tiết (Component-level)

```
[ React UI ]
    |
    | (IPC: run-test)
    ↓
[ Electron Main ]
    |
    ↓
[ Orchestrator ]
    |
    ├── State Manager
    │     ├── visited routes
    │     ├── current page
    │     └── action history
    |
    ├── Rule Engine
    │     └── heuristic decision (no AI)
    |
    ├── Crawl Engine (Playwright)
    │     ├── open page
    │     ├── extract links
    │     └── detect navigation
    |
    ├── Action Engine
    │     ├── click
    │     ├── fill form
    │     └── navigate
    |
    ├── Validator Engine
    │     ├── console error
    │     ├── network error
    │     └── UI state
    |
    ├── AI Adapter
    │     ├── Ollama (local)
    │     └── OpenAI (fallback)
    |
    └── Storage Layer
          ├── runs
          ├── steps
          ├── screenshots
          └── selector cache
```

---

# 🔄 3. Data Flow (Runtime Flow)

```
User Input URL
      ↓
Electron UI → IPC → Main
      ↓
Orchestrator.run()
      ↓
Open Browser (Playwright)
      ↓
Crawl initial page
      ↓
Extract actions (button/link/form)
      ↓
Rule Engine decide
      ↓
(IF needed) → AI suggest
      ↓
Execute action
      ↓
Validate result
      ↓
Save to SQLite
      ↓
Loop (BFS / limited)
      ↓
Generate Report
      ↓
Return to UI
```

---

# 🔁 4. Crawl Flow (BFS Strategy)

```
queue = ["/"]
visited = {}

WHILE queue NOT empty:
    url = queue.pop()

    IF visited:
        continue

    visit(url)

    extract:
        - links
        - buttons
        - forms

    push new routes → queue

LIMIT:
    maxDepth
    maxPages
```

---

# 🤖 5. AI Integration Flow

```
Rule Engine → confidence score

IF confidence < threshold:
    → call AI

AI returns:
    - next action
    - selector suggestion

System:
    - validate result
    - cache selector
```

---

# 💾 6. Storage Architecture

```
SQLite DB

runs
 ├── id
 ├── url
 └── status

steps
 ├── action
 ├── selector
 └── result

screenshots
 ├── path
 └── step_id

selectors_cache
 ├── text
 └── selector
```

---

# 🐳 7. Docker Architecture (Dev only)

```
Host (Mac / Windows)
   |
   ├── Electron App (local)
   |
   └── Docker
        ├── Core Service (Node + Playwright)
        └── Ollama (AI)
```

---

# ⚠️ 8. Key Design Principles

## 1. AI không phải core

→ fallback được

## 2. Deterministic > AI

→ rule engine trước

## 3. State-driven system

→ tránh loop

## 4. Isolation

→ UI ≠ Core ≠ AI

---

# 🚀 9. Scaling Architecture (Future)

```
Desktop App
     ↓
Local Agent
     ↓
Cloud API
     ↓
Distributed Test Runner
     ↓
AI Service (centralized)
```

---

# 🎯 10. Kết luận

Kiến trúc này đảm bảo:

* ✔️ Cross-platform (Electron)
* ✔️ Stable test engine (Playwright)
* ✔️ AI extensible (Ollama → OpenAI)
* ✔️ Scalable (local → cloud)

---

🔥 Core cần focus:

* Orchestrator
* Crawl Engine
* State Manager

---

👉 Đây là nền tảng đủ để:

* build MVP
* demo product
* scale thành SaaS sau này
