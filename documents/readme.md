# 🚀 AI QA Desktop Tool — Project Introduction & Structure

---

# 🧠 1. Giới thiệu dự án

## 🎯 Tên dự án

**AI QA Desktop Tool**

---

## 📌 Mô tả

AI QA Desktop Tool là một phần mềm desktop chạy trên macOS và Windows, cho phép **tự động kiểm thử ứng dụng web bằng AI**, không cần viết script test thủ công.

Người dùng chỉ cần:

* Nhập URL
* (Optional) Login
* Nhấn **Run Test**

→ Hệ thống sẽ:

* Crawl ứng dụng
* Tự động thực hiện các hành động (click, form, navigation)
* Phát hiện lỗi
* Trả về report chi tiết

---

## 🔥 Mục tiêu

* Giảm effort QA manual
* Không cần viết test script
* Tăng coverage test nhanh
* Build nền tảng AI-driven testing (product-level)

---

## 🧩 Phân biệt với tool truyền thống

| Traditional Testing | AI QA Tool        |
| ------------------- | ----------------- |
| Viết script         | Không cần script  |
| Hardcode selector   | AI + dynamic      |
| Static test         | Smart exploration |
| Tốn thời gian       | Nhanh             |

---

## 🧠 Insight cốt lõi

> ❗ Đây không phải tool automation test
> 👉 Mà là **AI-driven software quality platform**

---

# 🏗️ 2. Kiến trúc tổng thể

```
Desktop App (Electron + React)
        ↓
Orchestrator (Core Logic)
        ↓
 ├── Crawl Engine (Playwright)
 ├── Action Engine
 ├── Validator Engine
 └── AI Layer (Ollama / OpenAI)
        ↓
Storage (SQLite)
        ↓
Report System
```

---

# 🧱 3. Công nghệ sử dụng

## 🖥️ Desktop

* Electron

## 🎨 UI

* React
* Tailwind CSS

## ⚙️ Core

* Node.js
* TypeScript

## 🧪 Testing Engine

* Playwright

## 🤖 AI

* Ollama (local)
* OpenAI (future)

## 💾 Database

* SQLite

---

# 📁 4. Project Structure

```
ai-qa-tool/
├── app/                        # React UI (renderer)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   └── Report.tsx
│   │   ├── components/
│   │   │   ├── InputUrl.tsx
│   │   │   ├── RunButton.tsx
│   │   │   └── ResultList.tsx
│   │   ├── hooks/
│   │   └── App.tsx
│   └── index.html
│
├── electron/                  # Electron main process
│   ├── main.ts
│   ├── preload.ts
│   └── ipc/
│       └── test.ipc.ts
│
├── core/                      # Core logic (quan trọng nhất)
│   ├── orchestrator.ts       # điều phối toàn bộ flow
│   ├── crawler.ts            # crawl route
│   ├── executor.ts           # thực thi action
│   ├── validator.ts          # validate kết quả
│   ├── state.ts              # quản lý state
│   └── rule-engine.ts        # rule-based logic
│
├── ai/                        # AI layer
│   ├── ollama.ts             # connect local AI
│   ├── decision.ts           # chọn action
│   ├── evaluator.ts          # đánh giá kết quả
│   └── prompt.ts             # quản lý prompt
│
├── playwright/               # browser control
│   └── browser.ts
│
├── db/                        # database
│   ├── client.ts
│   ├── schema.sql
│   └── repository/
│       ├── run.repo.ts
│       └── step.repo.ts
│
├── report/                    # report system
│   ├── writer.ts
│   └── formatter.ts
│
├── docker/                    # docker config
│   ├── Dockerfile
│   └── docker-compose.yml
│
├── config/
│   └── env.ts
│
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

# 🔄 5. Flow hoạt động

```
User nhập URL
    ↓
Electron gửi request
    ↓
Orchestrator start
    ↓
Crawler lấy danh sách page
    ↓
Executor chạy action (Playwright)
    ↓
Validator kiểm tra lỗi
    ↓
AI (optional) phân tích / gợi ý
    ↓
Lưu DB
    ↓
Trả report về UI
```

---

# 🤖 6. Vai trò của AI

## ✅ AI làm:

* Suggest action
* Generate test scenario
* Analyze error

## ❌ AI không làm:

* Control browser trực tiếp
* Quyết định toàn bộ flow

---

# ⚠️ 7. Thách thức

* Login flow (OTP, captcha)
* Dynamic route
* Infinite crawl
* AI hallucination
* Performance (Electron + browser)

---

# 🚀 8. Roadmap phát triển

## Phase 1 (MVP)

* Crawl page
* Click button
* Screenshot
* JSON report

---

## Phase 2

* Form fill
* Detect error (console/network)
* Basic UI report

---

## Phase 3 (AI)

* AI suggest action
* AI evaluate result

---

## Phase 4 (Product)

* Dashboard
* History
* Diff report
* Multi-run

---

# 🎯 9. Định hướng tương lai

* SaaS version
* CI/CD integration
* Multi-user testing
* AI autonomous testing

---

# 🔥 10. Kết luận

AI QA Desktop Tool là một sản phẩm có tiềm năng cao:

* Giải quyết pain point thật (QA automation)
* Có thể scale thành SaaS
* Kết hợp tốt giữa automation + AI

---

👉 Focus:

* Core engine (crawler + orchestrator)
* Stability
* Smart AI usage

---

🚀 Build nhanh → Validate → Scale
