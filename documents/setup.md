# Setup — AI QA Desktop Tool

## 1) Yêu cầu

- **Node.js**: khuyến nghị Node 20+ (hoặc 22)
- **Docker Desktop**: để chạy Ollama container
- **macOS / Windows**: chạy Electron

---

## 2) Start Ollama bằng Docker

Chạy tại **root project**:

```bash
docker compose -f docker/docker-compose.yml up -d
```

Kiểm tra container đang chạy:

```bash
docker ps
```

Test nhanh Ollama API:

```bash
curl http://localhost:11434/api/tags
```

---

## 3) Pull model Ollama (ví dụ `llama3.2`)

```bash
docker exec -it ai-qa-ollama ollama pull llama3.2
```

Nếu bạn dùng model khác, nhớ cập nhật `OLLAMA_MODEL` ở bước cấu hình môi trường.

---

## 4) Cấu hình môi trường `.env`

Tạo file `.env` từ mẫu:

```bash
cp .env.example .env
```

Ví dụ cấu hình để bật AI qua Ollama:

```bash
ENABLE_AI=true
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

---

## 5) Cài dependencies và chạy app (dev)

```bash
npm install
npm run dev
```

UI sẽ chạy qua Vite (dev server) và Electron sẽ mở cửa sổ app.

---

## 6) (Tuỳ chọn) Build production

```bash
npm run build
```

---

## 7) (Tuỳ chọn) Build Dockerfile hiện tại

Hiện `docker/Dockerfile` là **placeholder** cho “core runner” (chưa chạy Playwright trong container).

```bash
docker build -f docker/Dockerfile -t ai-qa-core .
docker run --rm ai-qa-core
```

