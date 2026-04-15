# MCP Advisor (mcpadvisor)

MCP Advisor es un servidor de **Model Context Protocol (MCP)** diseñado para ayudarte a descubrir, recomendar e instalar otros servidores MCP. Actúa como un consultor inteligente que facilita la expansión de las capacidades de tu asistente de IA.

## Características

- 🔍 **Recomendación Inteligente**: Busca en repositorios de internet y bases de datos internas para encontrar el servidor MCP que mejor se adapte a tus necesidades específicas.
- 📦 **Guía de Instalación**: Proporciona instrucciones detalladas paso a paso sobre cómo instalar y configurar servidores MCP en diferentes clientes (Claude Desktop, Windsurf, Cursor, Cline, etc.).
- 🌐 **Múltiples Transportes**: Soporta comunicación vía `stdio`, `sse` (Server-Sent Events) y `rest`.
- 🔎 **Motores de Búsqueda Integrados**: Utiliza Meilisearch, Compass, GetMcp y Nacos para obtener los mejores resultados.

## Instalación

1. Clona el repositorio.
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Compila el proyecto:
   ```bash
   npm run build
   ```

## Configuración

MCP Advisor utiliza variables de entorno para su configuración. Puedes configurar un archivo `.env` o pasarlas directamente.

### Variables Principales
- `TRANSPORT_TYPE`: Tipo de transporte (`stdio`, `sse`, `rest`). Por defecto es `stdio`.
- `SERVER_PORT`: Puerto para los modos SSE o REST (por defecto `3000`).
- `SERVER_HOST`: Host para el servidor (por defecto `localhost`).

### Proveedores de Búsqueda (Opcional)
- **Meilisearch local**: Usa el flag `--local-meilisearch` al arrancar para que el servidor intente gestionar su propia instancia de Meilisearch.
- **Nacos**: Requiere `NACOS_SERVER_ADDR`, `NACOS_USERNAME` y `NACOS_PASSWORD`.

## Uso

### Ejecutar el servidor
Para iniciar el servidor en modo estándar (stdio):
```bash
npm start
```

Para iniciar en modo SSE:
```bash
npm start -- --mode=sse --port=3000
```

## Herramientas (Tools)

El servidor expone las siguientes herramientas MCP:

### 1. `recommend-mcp-servers`
Busca servidores MCP profesionales basados en una descripción de la tarea.
- **Argumentos**:
  - `taskDescription` (requerido): Descripción precisa de lo que necesitas (ej: "Servidor MCP para análisis de riesgos financieros").
  - `keywords` (opcional): Lista de palabras clave.
  - `capabilities` (opcional): Lista de capacidades técnicas requeridas.

### 2. `install-mcp-server`
Genera una guía de instalación completa para un servidor MCP específico.
- **Argumentos**:
  - `mcpName` (requerido): Nombre del servidor a instalar.
  - `sourceUrl` (requerido): URL de origen (ej: enlace de GitHub).
  - `mcpClient` (opcional): Cliente que usas (ej: `Claude Desktop`, `Cursor`, `Windsurf`).

## Recursos (Resources)

- `logs`: Acceso a los logs del servidor para depuración.

## Desarrollo

- **Test**: `npm test`
- **Lint**: `npm run lint`
- **Build**: `npm run build`

---
Generado para el proyecto Gabriel-marchante/Model-Context-Protocol
