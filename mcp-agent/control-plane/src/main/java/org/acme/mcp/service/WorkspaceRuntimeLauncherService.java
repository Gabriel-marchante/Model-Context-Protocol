package org.acme.mcp.service;

import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.acme.mcp.model.User;
import org.acme.mcp.model.Workspace;
import org.jboss.logging.Logger;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@ApplicationScoped
public class WorkspaceRuntimeLauncherService {

    private static final Logger LOG = Logger.getLogger(WorkspaceRuntimeLauncherService.class);
    private final Map<UUID, Process> processes = new ConcurrentHashMap<>();

    @Inject
    WorkspaceService workspaceService;

    @Inject
    EncryptionService encryptionService;

    @PreDestroy
    public void cleanupAll() {
        LOG.info("Cleanup: Deteniendo todos los runtimes activos...");
        processes.keySet().forEach(userId -> {
            try {
                stop(userId);
            } catch (Exception e) {
                LOG.error("Error al detener runtime para usuario " + userId, e);
            }
        });
    }

    public Map<String, Object> start(UUID userId) {
        Workspace workspace = workspaceService.getOrCreateDefault(userId);
        if (!WorkspaceService.STATUS_PROVISIONED.equals(workspace.status) || workspace.configPath == null || workspace.configPath.isBlank()) {
            return Map.of("error", "Primero debes aplicar la configuracion del workspace.");
        }

        Process existing = processes.get(userId);
        if (existing != null && existing.isAlive()) {
            return status(userId);
        }

        User user = User.findById(userId);
        if (user == null || user.geminiKeyEnc == null || user.geminiKeyEnc.isBlank()) {
            return Map.of("error", "El usuario no tiene una API key de Gemini disponible.");
        }

        String geminiKey = encryptionService.decrypt(user.geminiKeyEnc);
        Path repoRoot = repoRoot();
        Path configPath = Paths.get(workspace.configPath).toAbsolutePath();

        // Verificar si el puerto ya esta ocupado antes de intentar arrancar e intentar limpieza
        if (isPortInUse(workspace.runtimePort)) {
            LOG.info("Puerto " + workspace.runtimePort + " ocupado. Intentando limpieza automatica...");
            try {
                forceKillPort(workspace.runtimePort);
                Thread.sleep(2000); // Dar tiempo al SO para liberar el socket
            } catch (Exception e) {
                return Map.of("error", "El puerto " + workspace.runtimePort + " ya esta ocupado y no se pudo liberar automaticamente. Prueba a limpiarlo manualmente.");
            }
        }

        Path logPath = configPath.getParent().resolve("workspace-runtime.log");
        try {
            Files.createDirectories(logPath.getParent());
        } catch (IOException e) {
            return Map.of("error", "No se pudo preparar el directorio de logs del workspace: " + e.getMessage());
        }

        ProcessBuilder builder = new ProcessBuilder(
                "cmd.exe", "/c",
                "mvnw.cmd", "-pl", "workspace-runtime", "quarkus:dev",
                "\"-Dquarkus.http.port=" + workspace.runtimePort + "\"",
                "\"-Dquarkus.config.locations=" + configPath.toUri() + "\""
        );
        builder.directory(repoRoot.toFile());
        builder.environment().put("GEMINI_API_KEY", geminiKey);
        builder.redirectErrorStream(true);
        builder.redirectOutput(logPath.toFile());

        try {
            Process process = builder.start();
            processes.put(userId, process);
            return Map.of(
                    "started", true,
                    "runtimeUrl", workspace.runtimeUrl,
                    "logPath", logPath.toAbsolutePath().toString(),
                    "status", "starting"
            );
        } catch (IOException e) {
            return Map.of("error", "No se pudo arrancar workspace-runtime: " + e.getMessage());
        }
    }

    public Map<String, Object> stop(UUID userId) {
        Process process = processes.remove(userId);
        Workspace workspace = workspaceService.getOrCreateDefault(userId);

        // Siempre intentamos limpiar el puerto por si el proceso quedo huertano
        if (workspace.runtimePort != null) {
            try {
                forceKillPort(workspace.runtimePort);
            } catch (Exception e) {
                LOG.warn("No se pudo forzar la limpieza del puerto " + workspace.runtimePort + ": " + e.getMessage());
            }
        }

        if (process == null) {
            return Map.of("stopped", true, "message", "No habia proceso registrado, pero se intento limpiar el puerto.");
        }

        try {
            if (System.getProperty("os.name").toLowerCase().contains("win")) {
                long pid = process.pid();
                LOG.info("Matando arbol de procesos para PID: " + pid);
                new ProcessBuilder("taskkill", "/F", "/T", "/PID", String.valueOf(pid)).start().waitFor();
            } else {
                process.descendants().forEach(ProcessHandle::destroy);
                process.destroy();
            }
            return Map.of("stopped", true);
        } catch (Exception e) {
            return Map.of("stopped", false, "error", "No se pudo detener el proceso de forma limpia: " + e.getMessage());
        }
    }

    public Map<String, Object> status(UUID userId) {
        Workspace workspace = workspaceService.getOrCreateDefault(userId);
        Process process = processes.get(userId);
        boolean running = process != null && process.isAlive();
        if (!running && process != null) {
            processes.remove(userId);
        }
        String logPath = workspace.configPath == null || workspace.configPath.isBlank()
                ? ""
                : Paths.get(workspace.configPath).getParent().resolve("workspace-runtime.log").toAbsolutePath().toString();
        return Map.of(
                "running", running,
                "runtimeUrl", workspace.runtimeUrl == null ? "" : workspace.runtimeUrl,
                "logPath", logPath,
                "workspaceStatus", workspace.status
        );
    }

    public Map<String, Object> readLogTail(UUID userId) {
        Workspace workspace = workspaceService.getOrCreateDefault(userId);
        if (workspace.configPath == null || workspace.configPath.isBlank()) {
            return Map.of("content", "", "logPath", "", "runtimeRunning", false);
        }
        Path logPath = Paths.get(workspace.configPath).getParent().resolve("workspace-runtime.log").toAbsolutePath();
        if (!Files.exists(logPath)) {
            return Map.of("content", "", "logPath", logPath.toString(), "runtimeRunning", false);
        }
        try {
            List<String> lines = Files.readAllLines(logPath, StandardCharsets.UTF_8);
            int fromIndex = Math.max(0, lines.size() - 200);
            String content = String.join(System.lineSeparator(), lines.subList(fromIndex, lines.size()));
            return Map.of(
                    "content", content,
                    "logPath", logPath.toString(),
                    "runtimeRunning", status(userId).get("running")
            );
        } catch (IOException e) {
            return Map.of("error", "No se pudo leer el log del workspace runtime: " + e.getMessage());
        }
    }

    private boolean isPortInUse(int port) {
        try (java.net.Socket socket = new java.net.Socket("localhost", port)) {
            return true;
        } catch (java.io.IOException e) {
            return false;
        }
    }

    private void forceKillPort(int port) throws IOException, InterruptedException {
        // Busca el PID que ocupa el puerto usando netstat y lo mata
        ProcessBuilder builder = new ProcessBuilder("cmd.exe", "/c", 
            "for /f \"tokens=5\" %a in ('netstat -aon ^| findstr :" + port + " ^| findstr LISTENING') do taskkill /F /PID %a");
        builder.start().waitFor();
    }

    private Path repoRoot() {
        Path current = Paths.get(System.getProperty("user.dir")).toAbsolutePath();
        while (current != null) {
            if (Files.exists(current.resolve("mvnw.cmd")) && Files.isDirectory(current.resolve("workspace-runtime"))) {
                return current;
            }
            current = current.getParent();
        }
        return new File(".").toPath().toAbsolutePath();
    }
}
