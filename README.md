# 🤖 Model Context Protocol

Colección de servidores MCP personalizados para extender las capacidades de la IA

> Integración fluida entre modelos de IA y fuentes de datos del mundo real, siguiendo el estándar abierto de Anthropic.

---

## 📦 Proyectos disponibles

| Proyecto | Tecnología | Descripción |
|---|---|---|
| [NotebookLM MCP](#-notebooklm-mcp--agente-rag-con-quarkus) | Java + Quarkus | Agente RAG que interactúa con documentos privados en Google NotebookLM |
| [Weather MCP](#-weather-mcp) | Java + Quarkus | Servidor MCP para consulta del tiempo |
| [MCP Advisor](#-mcp-advisor) | Node.js | Servidor MCP para descubrir, recomendar e instalar otros servidores MCP |
| [MCP Client](#-mcp-client-plataforma-multiusuario) | Java + Quarkus | Plataforma multiusuario para gestionar y orquestar servidores MCP |

---

## 🗒️ NotebookLM MCP — Agente RAG con Quarkus

Agente de IA de nivel empresarial desarrollado en Java + Quarkus que interactúa de forma segura con documentos privados alojados en Google NotebookLM.

### Arquitectura

```
┌─────────────────────────────────────────────┐
│         Petición en lenguaje natural         │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│   Capa de Inteligencia — Quarkus + LangChain4j │
│   Procesa el lenguaje y decide qué usar      │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│   Capa de Conectividad — MCP                │
│   Ejecuta comandos en la máquina local      │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│   Capa de Datos — Google NotebookLM         │
│   Almacena y busca en documentos privados   │
└─────────────────────────────────────────────┘
```

### Tecnologías

![Java](https://img.shields.io/badge/Java-17+-orange) ![Quarkus](https://img.shields.io/badge/Quarkus-blue) ![LangChain4j](https://img.shields.io/badge/LangChain4j-green) ![Gemini](https://img.shields.io/badge/Gemini-AI-purple)

### Requisitos previos

- Java 17 o superior
- Google Chrome instalado
- API Key de Google AI Studio
- Binarios del motor MCP (`notebooklm-mcp.exe` y `notebooklm-mcp-auth.exe`)

### Instalación y uso

**1. Autenticación de Google**

```bash
# Ejecuta el asistente de login para generar el token de sesión
C:\Users\<tu-usuario>\.local\bin\notebooklm-mcp-auth.exe
# Se abrirá Chrome — inicia sesión y espera el mensaje SUCCESS
```

**2. Configuración** — edita `src/main/resources/application.properties`:

```properties
# Tu API Key de Gemini
quarkus.langchain4j.ai.gemini.api-key=TU_API_KEY_AQUÍ

# Ruta al motor MCP (usa / o \\ en Windows)
quarkus.langchain4j.mcp.notebooklm.command=C:/Users/<tu-usuario>/.local/bin/notebooklm-mcp.exe

# Timeout para procesos largos
quarkus.langchain4j.ai.gemini.timeout=120s
```

**3. Arrancar el agente**

```bash
./mvnw quarkus:dev
```

**4. Usar el agente** — abre en el navegador:

```
http://localhost:8080/firecrawl?pregunta=dime qué cuadernos tengo disponibles
http://localhost:8080/firecrawl?pregunta=hazme un resumen del documento técnico
http://localhost:8080/firecrawl?pregunta=crea un nuevo cuaderno llamado Notas de IA
```

### 🛡️ Sistema Anti-Alucinaciones

El agente usa un **Prompt Híbrido de seguridad** que garantiza que la IA no invente datos:

- **Prioridad de herramientas** — ante cualquier pregunta de contenido, la IA tiene prohibido usar su conocimiento general y debe consultar NotebookLM vía MCP
- **Restricción estricta** — si la herramienta no devuelve el dato exacto, el agente responde: *"No tengo esa información en los documentos"*
- **Contexto real** — se prioriza la veracidad sobre la creatividad

### Solución de problemas comunes

| Error | Causa | Solución |
|---|---|---|
| Error 429 | Límite de la versión gratuita de Gemini | Espera 60 segundos y reintenta |
| CreateProcess error=2 | Ruta incorrecta en application.properties | Usa `/` o `\\` en la ruta |
| TimeoutException | Motor MCP no arranca | Verifica que el `.exe` no esté bloqueado por el antivirus |

---

## 🌤️ Weather MCP

Servidor MCP desarrollado con **Java + Quarkus** que expone herramientas para consultar información meteorológica, integrándose con cualquier cliente MCP compatible.

### Tecnologías

![Java](https://img.shields.io/badge/Java-17+-orange) ![Quarkus](https://img.shields.io/badge/Quarkus-blue)

### Arranque

```bash
./mvnw quarkus:dev
```

El servidor estará disponible en `http://localhost:8080`. La Dev UI de Quarkus está disponible en modo dev en `http://localhost:8080/q/dev/`.

---

## 🔍 MCP Advisor

Servidor MCP desarrollado en **Node.js** que actúa como consultor inteligente para descubrir, recomendar e instalar otros servidores MCP. Busca en repositorios de internet y bases de datos internas para encontrar el servidor que mejor se adapte a tus necesidades.

### Características

- 🔍 **Recomendación inteligente** — busca en múltiples motores (Meilisearch, Compass, GetMcp, Nacos)
- 📦 **Guía de instalación** — instrucciones paso a paso para Claude Desktop, Windsurf, Cursor, Cline, etc.
- 🌐 **Múltiples transportes** — soporta `stdio`, `sse` y `rest`

### Instalación

```bash
npm install
npm run build
```

### Uso

```bash
# Modo stdio (por defecto)
npm start

# Modo SSE
npm start -- --mode=sse --port=3000
```

### Herramientas disponibles

| Tool | Descripción |
|---|---|
| `recommend-mcp-servers` | Busca servidores MCP según una descripción de tarea |
| `install-mcp-server` | Genera una guía de instalación para un servidor MCP concreto |

### Variables de entorno

| Variable | Descripción | Por defecto |
|---|---|---|
| `TRANSPORT_TYPE` | Tipo de transporte (`stdio`, `sse`, `rest`) | `stdio` |
| `SERVER_PORT` | Puerto para modos SSE o REST | `3000` |
| `SERVER_HOST` | Host del servidor | `localhost` |

---

## 🖥️ MCP Client — Plataforma Multiusuario

Plataforma **Java + Quarkus** dividida en dos módulos que permite gestionar y orquestar múltiples servidores MCP por usuario, con su propia API key y configuración aislada.

### Módulos

- **`control-plane`** — gestión multiusuario de cuentas, API keys y servidores MCP por URL, con arranque local del runtime del usuario.
- **`workspace-runtime`** — runtime de chat mínimo que usa `quarkus-langchain4j-mcp` de forma declarativa.

### Flujo

1. El usuario se registra en `control-plane` con su Gemini API key
2. Guarda uno o varios servidores MCP `streamable-http` por nombre + URL
3. Pulsa **Aplicar** — se genera la configuración declarativa del `workspace-runtime`
4. Pulsa **Arrancar runtime** — el `control-plane` levanta el `workspace-runtime` con la API key ya inyectada
5. El chat del `control-plane` hace proxy a ese runtime aislado

### Arranque

```powershell
# Control plane
.\mvnw.cmd -pl control-plane quarkus:dev
```

El `workspace-runtime` puede arrancarse desde la UI con el botón **Arrancar runtime**, o manualmente con el comando generado en la vista previa del workspace.

> En desarrollo, `control-plane` usa H2 embebida. Para producción define `DB_URL`, `DB_USER` y `DB_PASS` en `control-plane/.env`.

### Tests

```powershell
.\mvnw.cmd test
```

---

## 🌐 Sobre MCP

**Model Context Protocol (MCP)** es el estándar abierto de Anthropic que define cómo los modelos de IA se comunican con herramientas y fuentes de datos externas. Permite construir integraciones reutilizables y seguras entre cualquier LLM y el mundo real.

Más info: [modelcontextprotocol.io](https://modelcontextprotocol.io)

---

## ✍️ Créditos

Desarrollado por **Macloud Team (Gabriel Marchante)**. Inspirado en herramientas de seguridad clásicas y estética retro-futurista.

---

[![LinkedIn](https://img.shields.io/badge/LinkedIn-blue?logo=linkedin)](https://linkedin.com/in/gabriel-marchante) [![GitHub](https://img.shields.io/badge/GitHub-black?logo=github)](https://github.com/Gabriel-marchante)

*Construyendo puentes entre la IA y el mundo real. 🌉*
