import express from "express";
import { spawn } from "child_process";
import { chromium } from "playwright";

const app = express();
app.use(express.json());

/**
 * =========================
 * 🔹 MCP REGISTRY
 * =========================
 */
const MCP_SERVERS = {};

/**
 * =========================
 * 🔹 START MCP (persistente)
 * =========================
 */
function startMCP(name, command, args, env = {}, cwd = ".") {
  console.log(`🚀 Iniciando MCP: ${name}`);

  const proc = spawn(command, args, {
    env: { ...process.env, ...env },
    shell: false,
    cwd
  });

  MCP_SERVERS[name] = {
    proc,
    buffer: "",
    callbacks: []
  };

  proc.stdout.setEncoding("utf-8");

  proc.stdout.on("data", (data) => {
    const server = MCP_SERVERS[name];
    server.buffer += data;

    // Procesa línea por línea
    let lines = server.buffer.split("\n");
    server.buffer = lines.pop(); // Mantén la última línea incompleta en el buffer

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      try {
        const json = JSON.parse(trimmedLine);
        const cb = server.callbacks.shift();
        if (cb) {
          cb.resolve(json);
        }
      } catch (e) {
        // Ignora líneas que no son JSON (logs, advertencias, etc.)
        console.log(`ℹ️ [${name} log] ${trimmedLine}`);
      }
    }
  });

  proc.stderr.on("data", (data) => {
    console.log(`ℹ️ [${name} error] ${data.toString().trim()}`);
  });

  proc.on("error", (err) => {
    console.error(`💥 MCP ${name} error:`, err.message);
  });

  proc.on("close", () => {
    console.log(`♻️ MCP ${name} cerrado`);

    // evita loops infinitos problemáticos
    if (name === "browser") {
      console.log("🚫 Browser MCP desactivado (reemplazado por Playwright)");
      return;
    }

    setTimeout(() => {
      startMCP(name, command, args, env, cwd);
    }, 3000);
  });

  console.log(`✅ MCP ${name} iniciado`);
}

/**
 * =========================
 * 🔹 CALL MCP
 * =========================
 */
function callMCP(name, input) {
  return new Promise((resolve, reject) => {
    const server = MCP_SERVERS[name];

    if (!server) return reject(`MCP ${name} no existe`);

    console.log(`📡 [Gateway -> ${name}] Enviando petición...`);

    const timeout = setTimeout(() => {
      reject("Timeout MCP");
    }, 120000); // Increased to 120s

    server.callbacks.push({
      resolve: (data) => {
        clearTimeout(timeout);
        resolve(data);
      },
      reject
    });

    server.proc.stdin.write(JSON.stringify(input) + "\n");
  });
}

/**
 * =========================
 * 🔹 MCPs ACTIVOS
 * =========================
 */

startMCP(
  "thinking",
  "npx",
  ["-y", "@modelcontextprotocol/server-sequential-thinking"]
);

startMCP(
  "filesystem",
  "npx",
  [
    "-y",
    "@modelcontextprotocol/server-filesystem",
    "C:\\Users\\gmarchante\\"
  ]
);

startMCP(
  "search",
  "npx",
  ["-y", "serper-search-scrape-mcp-server"],
  {
    SERPER_API_KEY: "987009d1551b2893564a5fbaa80f45b671d650ca"
  }
);

startMCP(
  "docs",
  "npx",
  ["-y", "@upstash/context7-mcp"],
  {
    CONTEXT7_API_KEY: "ctx7sk-4d54ce3e-a441-46ad-9911-7db40b01e970"
  }
);

startMCP(
  "terminal",
  "npx",
  ["-y", "@wonderwhy-er/desktop-commander"]
);

startMCP(
  "mcpadvisor",
  "node",
  ["dist/index.js"],
  {
    SUPPRESS_NO_CONFIG_WARNING: "1",
    MCP_COMPASS_MAIN: "true",
    LOG_LEVEL: "debug"
  },
  "../mcpadvisor" // I will need to update startMCP to support Cwd as 5th param or just use prefix in command
);

/**
 * =========================
 * 🔥 BROWSER (PLAYWRIGHT PRO)
 * =========================
 */
app.post("/browser", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "Falta URL" });
    }

    const browser = await chromium.launch({
      headless: true
    });

    const page = await browser.newPage();

    await page.goto(url, {
      waitUntil: "domcontentloaded"
    });

    const title = await page.title();
    const html = await page.content();

    await browser.close();

    res.json({
      url,
      title,
      html
    });

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

/**
 * =========================
 * 🔹 AUTO ROUTES MCP
 * =========================
 */
const routes = [
  "thinking",
  "filesystem",
  "search",
  "docs",
  "terminal",
  "mcpadvisor"
];

routes.forEach((route) => {
  app.post(`/${route}`, async (req, res) => {
    try {
      const result = await callMCP(route, req.body);
      res.json(result);
    } catch (e) {
      res.status(500).json({
        error: e.toString()
      });
    }
  });
});

/**
 * =========================
 * 🔹 HEALTH CHECK
 * =========================
 */
app.get("/", (req, res) => {
  res.json({
    status: "MCP Gateway PRO (Playwright Edition)",
    mcp: routes.concat(["browser"])
  });
});

/**
 * =========================
 * 🔹 START SERVER
 * =========================
 */
app.listen(3000, () => {
  console.log("🔥 MCP Gateway PRO en http://localhost:3000");
});

