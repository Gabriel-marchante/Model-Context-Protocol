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

        List<String> uploadedFiles = new ArrayList<>();

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
                    else if (content.startsWith("data:video/")) {
                        // VÍDEO → subir a Files API y usar fileData
                        String mimeType = content.substring(content.indexOf("data:") + 5, content.indexOf(";"));
                        String base64Data = content.substring(content.indexOf(",") + 1).replaceAll("\\s", "");
                        byte[] videoBytes = Base64.getDecoder().decode(base64Data);
                        
                        String fileUri = uploadToFilesApi(videoBytes, mimeType, name);
                        uploadedFiles.add(fileUri);
                        waitForFileActive(fileUri);
                        
                        Map<String, Object> fileData = new LinkedHashMap<>();
                        fileData.put("mimeType", mimeType);
                        fileData.put("fileUri", fileUri);
                        userParts.add(Map.of("fileData", fileData));
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
                    "Eres Claudio, un asistente de IA de última generación con visión, oído y análisis de vídeo integrados. " +
                    "Tienes la capacidad nativa de ver imágenes, escuchar audio y analizar vídeos que te envío. " +
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
        } finally {
            // Eliminar archivos temporales de Google una vez procesados
            for (String fileUri : uploadedFiles) {
                try {
                    deleteFileFromFilesApi(fileUri);
                } catch (Exception e) {
                    System.err.println("Advertencia: No se pudo eliminar el archivo temporal de Google " + fileUri + " - " + e.getMessage());
                }
            }
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

    /**
     * Sube un archivo a la Google Files API (resumable upload).
     * Retorna el fileUri para usar en generateContent.
     */
    @SuppressWarnings("unchecked")
    private String uploadToFilesApi(byte[] fileBytes, String mimeType, String displayName) throws Exception {
        // Paso 1: Iniciar sesión de subida resumable
        String initUrl = "https://generativelanguage.googleapis.com/upload/v1beta/files";

        String metadata = objectMapper.writeValueAsString(
            Map.of("file", Map.of("displayName", displayName)));

        HttpRequest initRequest = HttpRequest.newBuilder()
            .uri(URI.create(initUrl))
            .header("x-goog-api-key", apiKey)
            .header("Content-Type", "application/json")
            .header("X-Goog-Upload-Protocol", "resumable")
            .header("X-Goog-Upload-Command", "start")
            .header("X-Goog-Upload-Header-Content-Length", String.valueOf(fileBytes.length))
            .header("X-Goog-Upload-Header-Content-Type", mimeType)
            .POST(HttpRequest.BodyPublishers.ofString(metadata))
            .build();

        HttpResponse<String> initResponse = httpClient.send(initRequest, HttpResponse.BodyHandlers.ofString());

        if (initResponse.statusCode() != 200) {
            throw new RuntimeException("Error iniciando upload: HTTP " + initResponse.statusCode() + " - " + initResponse.body());
        }

        // Obtener la URL de subida del header de respuesta
        String uploadUrl = initResponse.headers().firstValue("X-Goog-Upload-URL")
            .or(() -> initResponse.headers().firstValue("x-goog-upload-url"))
            .orElseThrow(() -> new RuntimeException("No se recibió URL de subida de Google Files API"));

        // Paso 2: Subir los bytes reales
        HttpRequest uploadRequest = HttpRequest.newBuilder()
            .uri(URI.create(uploadUrl))
            .header("X-Goog-Upload-Offset", "0")
            .header("X-Goog-Upload-Command", "upload, finalize")
            .POST(HttpRequest.BodyPublishers.ofByteArray(fileBytes))
            .build();

        HttpResponse<String> uploadResponse = httpClient.send(uploadRequest, HttpResponse.BodyHandlers.ofString());

        if (uploadResponse.statusCode() != 200) {
            throw new RuntimeException("Error subiendo archivo: HTTP " + uploadResponse.statusCode() + " - " + uploadResponse.body());
        }

        // Parsear respuesta para obtener el URI del archivo
        Map<String, Object> responseBody = objectMapper.readValue(uploadResponse.body(), Map.class);
        Map<String, Object> fileInfo = (Map<String, Object>) responseBody.get("file");
        return (String) fileInfo.get("uri");
    }

    /**
     * Espera a que un archivo subido a Files API termine de procesarse (estado ACTIVE).
     * Google necesita tiempo para procesar vídeos antes de poder analizarlos.
     */
    @SuppressWarnings("unchecked")
    private void waitForFileActive(String fileUri) throws Exception {
        // fileUri = "https://generativelanguage.googleapis.com/v1beta/files/abc123"
        String statusUrl = fileUri;

        for (int i = 0; i < 30; i++) { // Máximo ~60 segundos de espera
            HttpRequest statusRequest = HttpRequest.newBuilder()
                .uri(URI.create(statusUrl))
                .header("x-goog-api-key", apiKey)
                .GET()
                .build();

            HttpResponse<String> statusResponse = httpClient.send(statusRequest, HttpResponse.BodyHandlers.ofString());
            Map<String, Object> body = objectMapper.readValue(statusResponse.body(), Map.class);

            String state = (String) body.get("state");
            if ("ACTIVE".equals(state)) {
                return; // Listo para usar
            }
            if ("FAILED".equals(state)) {
                throw new RuntimeException("Google no pudo procesar el archivo de vídeo");
            }

            // Estado PROCESSING: esperar 2 segundos y reintentar
            Thread.sleep(2000);
        }

        throw new RuntimeException("Timeout: el vídeo tardó demasiado en procesarse");
    }

    /**
     * Elimina un archivo temporal de Google Files API
     */
    private void deleteFileFromFilesApi(String fileUri) throws Exception {
        HttpRequest deleteRequest = HttpRequest.newBuilder()
            .uri(URI.create(fileUri))
            .header("x-goog-api-key", apiKey)
            .DELETE()
            .build();
            
        httpClient.send(deleteRequest, HttpResponse.BodyHandlers.discarding());
    }
}
