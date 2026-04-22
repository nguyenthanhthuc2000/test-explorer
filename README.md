# AI QA Desktop Tool

## Dev setup

### 1) Start Ollama (Docker)

```bash
docker compose -f docker/docker-compose.yml up -d
```

Pull a model (example):

```bash
docker exec -it ai-qa-ollama ollama pull llama3.2
```

### 2) Install deps

```bash
npm install
```

### 3) Run app (Electron + Vite)

```bash
npm run dev
```

## Environment

Copy and edit:

```bash
cp .env.example .env
```

