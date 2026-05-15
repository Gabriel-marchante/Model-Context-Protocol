# 🚀 MCP Gateway PRO (Local AI Tools Hub)

Este proyecto es un **gateway local de MCP (Model Context Protocol)**
que centraliza múltiples herramientas de IA y sistema en un único
servidor HTTP.

Permite conectar agentes o aplicaciones a herramientas como: - 🧠
razonamiento (thinking) - 🔎 búsqueda web (serper) - 📁 sistema de
archivos (filesystem) - 💻 ejecución de comandos (terminal) - 📚
documentación (context7)

------------------------------------------------------------------------

# 🧩 Arquitectura

Agente / LLM ↓ MCP Gateway (Node.js + Express) ↓ MCP Servers (stdio) ├──
thinking ├── filesystem ├── search ├── docs └── terminal

------------------------------------------------------------------------

# ⚙️ Requisitos

-   Node.js 18+
-   npm
-   Windows / Linux / Mac
-   API keys:
    -   Serper (búsqueda)
    -   Context7 (docs)

------------------------------------------------------------------------

# 📦 Instalación

``` bash
npm install
```

------------------------------------------------------------------------

# ▶️ Ejecución

``` bash
node server.js
```

------------------------------------------------------------------------

# 🧠 MCPs incluidos

## Thinking

POST http://localhost:3000/thinking

## Search

POST http://localhost:3000/search

## Filesystem

POST http://localhost:3000/filesystem

## Terminal

POST http://localhost:3000/terminal

## Docs

POST http://localhost:3000/docs

------------------------------------------------------------------------

# 🌐 Health

GET http://localhost:3000/

------------------------------------------------------------------------

# 🚀 Roadmap

-   memoria
-   agentes
-   UI
