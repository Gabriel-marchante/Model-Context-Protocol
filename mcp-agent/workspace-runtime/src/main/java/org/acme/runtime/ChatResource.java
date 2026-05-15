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

                    if (content.contains("data:image/")) {
                        String mimeType = content.substring(content.indexOf("data:") + 5, content.indexOf(";"));
                        String base64Data = content.substring(content.indexOf(",") + 1).replaceAll("\\s", "");
                        
                        // Esto genera: { "inlineData": { "mimeType": "image/jpeg", "data": "base64..." } }
                        Map<String, Object> inlineData = new LinkedHashMap<>();
                        inlineData.put("mimeType", mimeType);
                        inlineData.put("data", base64Data);
                        userParts.add(Map.of("inlineData", inlineData));
                    }
                    else if (content.contains("data:audio/")) {
                        String mimeType = content.substring(content.indexOf("data:") + 5, content.indexOf(";"));
                        String base64Data = content.substring(content.indexOf(",") + 1).replaceAll("\\s", "");
                        
                        Map<String, Object> inlineData = new LinkedHashMap<>();
                        inlineData.put("mimeType", mimeType);
                        inlineData.put("data", base64Data);
                        userParts.add(Map.of("inlineData", inlineData));
                    }
                    else if (!content.contains("base64,")) {
                        userParts.add(Map.of("text", "--- ARCHIVO: " + name + " ---\n" + content));
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
                       + modelId + ":generateContent?key=" + apiKey;

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            // === 4. Parsear la respuesta ===
            Map<String, Object> responseBody = objectMapper.readValue(response.body(), Map.class);
            
            if (response.statusCode() != 200) {
                return Map.of("error", "Error de Gemini (HTTP " + response.statusCode() + "): " + response.body());
            }

            List<Map<String, Object>> candidates = (List<Map<String, Object>>) responseBody.get("candidates");
            if (candidates != null && !candidates.isEmpty()) {
                Map<String, Object> candidateContent = (Map<String, Object>) candidates.get(0).get("content");
                List<Map<String, Object>> parts = (List<Map<String, Object>>) candidateContent.get("parts");
                if (parts != null && !parts.isEmpty()) {
                    String text = (String) parts.get(parts.size() - 1).get("text");
                    return Map.of("reply", text != null ? text : "");
                }
            }

            return Map.of("error", "Respuesta vacía de Gemini");

        } catch (Exception e) {
            String errorMsg = e.getMessage() != null ? e.getMessage() : e.toString();
            return Map.of("error", "Error: " + errorMsg);
        }
    }
}
