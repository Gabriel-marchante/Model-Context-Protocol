# Informe Técnico: Funcionalidad de Subida de Documentos y Multimedia

Este informe detalla el funcionamiento, arquitectura y límites de la capacidad de subida de múltiples archivos e imágenes implementada en la plataforma MCP-Agent.

## 1. ¿Qué es y cómo funciona?
La funcionalidad permite a los usuarios adjuntar uno o varios archivos (documentos de texto, código, imágenes) a una sesión de chat. 
- **Frontend**: El navegador lee los archivos seleccionados mediante la API `FileReader`.
- **Transferencia**: Los archivos se convierten a una representación textual (texto plano para documentos y Base64 para imágenes) y se envían en un array llamado `attachments` dentro del JSON de la petición POST.
- **Procesamiento**: El servidor recibe estos adjuntos, extrae su contenido y lo concatena al inicio del mensaje del usuario, proporcionando al modelo de IA el contexto necesario.

## 2. Consumo de Recursos
- **Tokens de entrada**: Es el consumo principal. Al añadir el contenido del archivo al prompt, el número de tokens aumenta proporcionalmente al tamaño del archivo.
- **Ancho de banda**: El envío de imágenes en Base64 aumenta significativamente el tamaño de la petición HTTP (un ~33% más que el archivo binario original).
- **Memoria del servidor**: El backend (Quarkus) debe cargar todo el cuerpo del JSON en memoria antes de procesarlo.

## 3. Tipos de Archivos Soportados
- **Documentos/Ficheros**: Cualquier archivo que pueda interpretarse como texto (`.txt`, `.md`, `.json`, `.java`, `.sql`, `.ts`, `.py`, etc.).
- **Fotos/Imágenes**: Formatos estándar web (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`). Se envían como imágenes adjuntas con un prefijo descriptivo.
- **Vídeos**: Actualmente **no son procesados**. El sistema detecta el archivo pero, al no poder convertirlo a un formato de texto útil para el prompt, solo envía una nota indicando que el contenido binario no puede procesarse.

## 4. Límites de Tamaño y Cómo Ampliarlos
Actualmente existe un límite de **4 MB** por archivo.

### ¿Dónde se cambia?
1. **Frontend (Límite de 4MB)**: 
   En `src/main/resources/META-INF/resources/index.html`, busca la constante `maxSize`:
   ```javascript
   const maxSize = 4 * 1024 * 1024; // Cambia este 4 por el valor deseado
   ```
2. **Backend (Límite global de Quarkus)**:
   Si quieres subir archivos muy grandes (ej. 20MB), debes añadir esto a `application.properties`:
   ```properties
   quarkus.http.limits.max-body-size=20M
   ```

## 5. Restricciones de API y Modelos
- **Modelos Gratuitos (Gemini 1.5 Flash)**: Muy rápidos y con buena capacidad multimodal, pero con límites de "peticiones por minuto" (RPM) bajos. Subir muchos archivos grandes puede provocar errores **429 (Too Many Requests)**.
- **Modelos de Pago (Gemini 1.5 Pro)**: Permiten ventanas de contexto mucho más grandes (hasta 2M de tokens) y tienen límites de velocidad superiores, ideales para analizar documentación técnica extensa o múltiples imágenes de alta resolución.

## 6. Detalles de Implementación (Cambios en el Código)
Para añadir esta funcionalidad se tocaron tres puntos clave:
1. **Frontend (`index.html`)**: Se añadió un input de tipo `file`, la lógica `handleFileSelect` con `FileReader` y la gestión del array `attachedFiles`.
2. **Proxy (`WorkspaceChatProxyService.java`)**: Se actualizó el método `chat` para aceptar y reenviar la lista de `attachments` al runtime.
3. **Runtime (`ChatResource.java`)**: Se implementó la lógica que recorre los adjuntos y los inyecta en el `StringBuilder` del mensaje antes de llamar al `Assistant`.

## 7. Paso a Paso: Cómo implementar esto en otro proyecto Quarkus

Para replicar esta funcionalidad en un nuevo proyecto Quarkus, sigue estos pasos técnicos:

### Paso 1: Dependencias en `pom.xml`
Asegúrate de tener las extensiones necesarias para JSON y LangChain4j:
```xml
<dependencies>
    <dependency>
        <groupId>io.quarkus</groupId>
        <artifactId>quarkus-rest-jackson</artifactId>
    </dependency>
    <dependency>
        <groupId>io.quarkiverse.langchain4j</groupId>
        <artifactId>quarkus-langchain4j-ai-gemini</artifactId>
        <version>0.21.0</version> <!-- o la versión más reciente -->
    </dependency>
</dependencies>
```

### Paso 2: Definir el Servicio de IA
Crea una interfaz para el asistente:
```java
@RegisterAiService
public interface MyAssistant {
    String chat(@MemoryId String id, @UserMessage String message);
}
```

### Paso 3: Crear el Endpoint REST (El "Corazón")
Crea un recurso JAX-RS que procese la lista de adjuntos. La clave es concatenar los adjuntos al prompt:

```java
@Path("/api/chat")
public class ChatResource {
    @Inject MyAssistant assistant;

    @POST
    public Map<String, String> chat(ChatRequest request) {
        StringBuilder promptWithFiles = new StringBuilder();
        
        // 1. Procesar adjuntos
        if (request.attachments != null) {
            for (Attachment att : request.attachments) {
                promptWithFiles.append("[Archivo: ").append(att.fileName).append("]\n")
                               .append(att.fileContent).append("\n\n");
            }
        }
        
        // 2. Añadir el mensaje real del usuario
        promptWithFiles.append("Mensaje: ").append(request.message);
        
        // 3. Llamar a la IA
        String response = assistant.chat(request.conversationId, promptWithFiles.toString());
        return Map.of("reply", response);
    }
}

// DTOs necesarios
public class ChatRequest {
    public String message;
    public String conversationId;
    public List<Attachment> attachments;
}
public class Attachment {
    public String fileName;
    public String fileContent; // Aquí llegará el texto o Base64
}
```

### Paso 4: Lógica de envío desde el Frontend (JS)
En tu HTML/JS, usa `FileReader` para leer los archivos y enviarlos como JSON:

```javascript
async function sendFiles(files, userMessage) {
    const attachments = await Promise.all(files.map(async file => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve({
                fileName: file.name,
                fileContent: e.target.result // Texto o Base64
            });
            // Si es imagen, usa readAsDataURL. Si es texto, readAsText.
            if (file.type.startsWith('image/')) reader.readAsDataURL(file);
            else reader.readAsText(file);
        });
    }));

    await fetch('/api/chat', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            message: userMessage,
            attachments: attachments
        })
    });
}
```

## 8. Integración en otros proyectos Quarkus
Para llevar esta funcionalidad a otro proyecto Quarkus, necesitas:
1. **Dependencias**:
   ```xml
   <dependency>
       <groupId>io.quarkiverse.langchain4j</groupId>
       <artifactId>quarkus-langchain4j-ai-gemini</artifactId>
   </dependency>
   <dependency>
       <groupId>io.quarkus</groupId>
       <artifactId>quarkus-rest-jackson</artifactId>
   </dependency>
   ```
2. **Handler de Mensajes**: Implementar un endpoint que reciba un objeto con la lista de archivos (nombre y contenido base64/texto) y los concatene al prompt antes de enviarlo al `AiService`.
