package org.acme.runtime;

import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.*;

@Path("/api/chat")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class ChatResource {

    @ConfigProperty(name = "quarkus.langchain4j.ai.gemini.api-key")
    String apiKey;
    
    @ConfigProperty(name = "quarkus.langchain4j.ai.gemini.chat-model.model-id", defaultValue = "gemini-2.5-flash")
    String modelId;

    private static final HttpClient httpClient = HttpClient.newHttpClient();

    @Inject
    ObjectMapper objectMapper;

    @POST
    @SuppressWarnings("unchecked")
    public Map<String, Object> chat(Map<String, Object> payload) {
        String message = payload == null || payload.get("message") == null
                ? ""
                : String.valueOf(payload.get("message"));
        
        List<Map<String, String>> attachments = payload == null ? null 
                : (List<Map<String, String>>) payload.get("attachments");

        try {
            // === 1. Construir las "parts" del mensaje para Gemini ===
            List<Map<String, Object>> userParts = new ArrayList<>();

            // Procesar adjuntos como datos binarios REALES
            if (attachments != null) {
                for (Map<String, String> att : attachments) {
                    String content = att.getOrDefault("fileContent", "").trim();
                    String name = att.getOrDefault("fileName", "adjunto");

                    if (content.startsWith("data:image/")) {
                        // IMAGEN → inlineData con MIME real extraído del Data URL
                        userParts.add(buildInlineData(content));
                    }
                    else if (content.startsWith("data:audio/")) {
                        // AUDIO → inlineData
                        userParts.add(buildInlineData(content));
                    }
                    else if (content.startsWith("data:application/pdf")) {
                        // PDF / PRESENTACIONES → inlineData
                        userParts.add(buildInlineData(content));
                    }
                    else if (content.startsWith("data:text/") && content.contains("base64,")) {
                        // TEXTO enviado como Data URL → decodificar Base64 a texto plano
                        String base64Data = content.substring(content.indexOf(",") + 1);
                        String decoded = new String(Base64.getDecoder().decode(base64Data), java.nio.charset.StandardCharsets.UTF_8);
                        userParts.add(Map.of("text", "--- ARCHIVO: " + name + " ---\n" + decoded + "\n\n"));
                    }
                    else if (!content.startsWith("data:")) {
                        // TEXTO enviado como contenido plano (readAsText en el frontend)
                        userParts.add(Map.of("text", "--- ARCHIVO: " + name + " ---\n" + content + "\n\n"));
                    }
                }
            }

            // Texto del usuario
            if (!message.isBlank()) {
                userParts.add(Map.of("text", message));
            }

            // === 2. Construir el cuerpo JSON para la API de Gemini ===
            Map<String, Object> requestBody = new LinkedHashMap<>();

            // System instruction (identidad de Claudio)
            Map<String, Object> systemInstruction = Map.of(
                "parts", List.of(Map.of("text", 
                    "Eres Claudio, un asistente de IA de última generación con visión y oído integrados. " +
                    "Tienes la capacidad nativa de ver imágenes y escuchar archivos de audio que te envío. " +
                    "Responde SIEMPRE en español. Analiza los archivos adjuntos con máxima atención al detalle. " +
                    "PROHIBIDO INVENTAR: si no puedes analizar un archivo, dilo claramente."))
            );
            requestBody.put("systemInstruction", systemInstruction);

            // Contents (el mensaje del usuario con partes multimodales)
            List<Map<String, Object>> contents = new ArrayList<>();
            Map<String, Object> userContent = new LinkedHashMap<>();
            userContent.put("role", "user");
            userContent.put("parts", userParts);
            contents.add(userContent);
            requestBody.put("contents", contents);

            // Generation config
            Map<String, Object> genConfig = new LinkedHashMap<>();
            genConfig.put("maxOutputTokens", 8192);
            requestBody.put("generationConfig", genConfig);

            // === 3. Enviar petición HTTP directa a Gemini ===
            String jsonBody = objectMapper.writeValueAsString(requestBody);
            String url = "https://generativelanguage.googleapis.com/v1beta/models/" 
                       + modelId + ":generateContent";

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .header("x-goog-api-key", apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            // === 4. Parsear la respuesta ===
            if (response.statusCode() != 200) {
                return Map.of("error", "Error de Gemini (HTTP " + response.statusCode() + "): " + response.body());
            }

            Map<String, Object> responseBody = objectMapper.readValue(response.body(), Map.class);

            // Comprobar bloqueo por seguridad
            List<Map<String, Object>> candidates = (List<Map<String, Object>>) responseBody.get("candidates");
            if (candidates == null || candidates.isEmpty()) {
                Map<String, Object> feedback = (Map<String, Object>) responseBody.get("promptFeedback");
                String reason = feedback != null ? String.valueOf(feedback.get("blockReason")) : "desconocida";
                return Map.of("error", "Gemini bloqueó la respuesta. Razón: " + reason);
            }

            Map<String, Object> firstCandidate = candidates.get(0);
            Map<String, Object> candidateContent = (Map<String, Object>) firstCandidate.get("content");
            if (candidateContent == null) {
                String finish = String.valueOf(firstCandidate.getOrDefault("finishReason", "UNKNOWN"));
                return Map.of("error", "Gemini no generó contenido. finishReason: " + finish);
            }

            List<Map<String, Object>> parts = (List<Map<String, Object>>) candidateContent.get("parts");
            if (parts != null) {
                // Buscar la primera part que tenga texto (no asumir que es la última)
                for (Map<String, Object> part : parts) {
                    String text = (String) part.get("text");
                    if (text != null && !text.isBlank()) {
                        return Map.of("reply", text);
                    }
                }
            }

            return Map.of("error", "Respuesta vacía de Gemini");

        } catch (Exception e) {
            String errorMsg = e.getMessage() != null ? e.getMessage() : e.toString();
            return Map.of("error", "Error: " + errorMsg);
        }
    }

    /** Extrae MIME type y datos Base64 de un Data URL y construye un bloque inlineData para Gemini */
    private Map<String, Object> buildInlineData(String dataUrl) {
        String mimeType = dataUrl.substring(dataUrl.indexOf("data:") + 5, dataUrl.indexOf(";"));
        String base64Data = dataUrl.substring(dataUrl.indexOf(",") + 1).replaceAll("\\s", "");
        Map<String, Object> inlineData = new LinkedHashMap<>();
        inlineData.put("mimeType", mimeType);
        inlineData.put("data", base64Data);
        return Map.of("inlineData", inlineData);
    }
}
