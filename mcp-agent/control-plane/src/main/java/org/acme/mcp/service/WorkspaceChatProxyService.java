package org.acme.mcp.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.acme.mcp.model.Workspace;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@ApplicationScoped
public class WorkspaceChatProxyService {

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    @Inject
    WorkspaceService workspaceService;

    @Inject
    ObjectMapper objectMapper;

    public Map<String, Object> chat(UUID userId, String message,
            java.util.List<java.util.Map<String, String>> attachments) {
        Workspace workspace = workspaceService.getOrCreateDefault(userId);
        if (!WorkspaceService.STATUS_PROVISIONED.equals(workspace.status) || workspace.runtimeUrl == null
                || workspace.runtimeUrl.isBlank()) {
            return Map.of("error", "Aplica primero la configuracion del workspace y arranca workspace-runtime.");
        }

        try {
            java.util.Map<String, Object> chatPayload = new java.util.LinkedHashMap<>();
            chatPayload.put("conversationId", userId.toString());
            chatPayload.put("message", message);
            if (attachments != null && !attachments.isEmpty()) {
                chatPayload.put("attachments", attachments);
            }
            String payload = objectMapper.writeValueAsString(chatPayload);
            HttpRequest request = HttpRequest.newBuilder(runtimeUri(workspace.runtimeUrl))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(180))
                    .POST(HttpRequest.BodyPublishers.ofString(payload))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            String contentType = response.headers().firstValue("Content-Type").orElse("");
            if (!contentType.contains("application/json")) {
                String bodyPreview = response.body() == null ? ""
                        : (response.body().length() > 200 ? response.body().substring(0, 200) + "..."
                                : response.body());
                return Map.of("error",
                        "El workspace runtime devolvio una respuesta no JSON (posiblemente un error HTML). Verifica que el puerto 8090 no este ocupado por otro proceso. Detalle: "
                                + bodyPreview);
            }

            Map<String, Object> responseBody = response.body() == null || response.body().isBlank()
                    ? Map.of()
                    : objectMapper.readValue(response.body(), new TypeReference<Map<String, Object>>() {
                    });
            if (response.statusCode() >= 400) {
                String error = String.valueOf(responseBody.getOrDefault("error",
                        "El workspace runtime devolvio un error HTTP " + response.statusCode() + '.'));
                return Map.of("error", error);
            }

            Map<String, Object> data = new LinkedHashMap<>(responseBody);
            data.putIfAbsent("mode", "workspace-runtime");
            data.put("runtimeUrl", workspace.runtimeUrl);
            return data;
        } catch (Exception e) {
            e.printStackTrace();
            return Map.of(
                    "error",
                    "No se pudo contactar con tu workspace runtime en " + workspace.runtimeUrl
                            + ". Arrancalo con el comando generado en la configuracion. Detalle: "
                            + (e.getMessage() != null ? e.getMessage() : e.toString()));
        }
    }

    private URI runtimeUri(String runtimeUrl) {
        String baseUrl = runtimeUrl.endsWith("/") ? runtimeUrl.substring(0, runtimeUrl.length() - 1) : runtimeUrl;
        return URI.create(baseUrl + "/api/chat");
    }
}
