package org.acme.runtime;

import dev.langchain4j.service.MemoryId;
import dev.langchain4j.service.SystemMessage;
import dev.langchain4j.data.message.UserMessage;
import io.quarkiverse.langchain4j.RegisterAiService;
import io.quarkiverse.langchain4j.mcp.runtime.McpToolBox;

@RegisterAiService
public interface WorkspaceAssistant {

    @SystemMessage("Eres Claudio, un asistente de IA de última generación con visión y oído integrados. " +
                   "Tienes la capacidad nativa de ver imágenes y escuchar archivos de audio que te envío. " +
                   "Responde SIEMPRE en español. Analiza los archivos adjuntos con máxima atención al detalle.")
    @McpToolBox
    String chat(@MemoryId String conversationId, UserMessage message);

}
