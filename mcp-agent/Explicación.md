# Cómo viaja un archivo desde el chat hasta Gemini

## 📤 FASE 1: El usuario sube un archivo

El usuario arrastra o selecciona un archivo en el chat. En ese momento, el navegador sabe dos cosas: el **nombre** del archivo y sus **bytes brutos** (los 0s y 1s que componen el archivo).

El navegador no puede enviar bytes brutos por JSON (JSON solo acepta texto), así que usa una función llamada `FileReader` para convertir esos bytes a texto. El resultado es una cadena llamada **Data URL** con este formato:

```
data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...
      ^^^^^^^^^^         ^^^^^^^^^^^^^^^^^^^^^^^^^^
      tipo de archivo    los bytes del archivo en texto (Base64)
```

La parte **base64** significa que los bytes se han convertido a caracteres ASCII usando un sistema que representa cualquier byte como una combinación de 64 caracteres posibles. Un archivo de 1 MB se convierte en ~1.33 MB de texto (un 33% más grande).

## 📡 FASE 2: El navegador envía el JSON al backend

El frontend empaqueta todo en un JSON y lo manda al servidor:

```
POST /api/chat
{
  "message": "¿Qué palabra aparece en la imagen?",
  "attachments": [
    {
      "fileName": "foto.jpg",
      "fileContent": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
    }
  ]
}
```

El servidor recibe este JSON como texto puro. Todavía no sabe si es una imagen, un audio o un PDF. Solo tiene una cadena de texto larga.

## 🔍 FASE 3: El backend identifica qué es cada archivo

El servidor mira los primeros caracteres del campo `fileContent`. Esos primeros caracteres siempre revelan el tipo:

| El `fileContent` empieza por... | Es un... | El servidor hace... |
|---|---|---|
| `data:image/jpeg` | JPEG | → inlineData |
| `data:image/png` | PNG | → inlineData |
| `data:image/webp` | WebP | → inlineData |
| `data:audio/mpeg` | MP3 | → inlineData |
| `data:audio/wav` | WAV | → inlineData |
| `data:application/pdf` | PDF | → inlineData |
| `data:video/mp4` | Vídeo MP4 | → Files API |
| `data:text/plain` | Texto como DataURL | → decodificar + text |
| Cualquier otra cosa sin `data:` | Texto plano | → text |

Una vez identificado el tipo, el backend sigue un camino diferente para cada uno.

## 🛤️ FASE 4: Qué pasa con cada tipo

### 👁️ Si es IMAGEN, AUDIO o PDF

Estos tres se tratan igual. El servidor:

1. **Extrae el tipo MIME:** de `data:image/jpeg;base64,...` saca `image/jpeg`
2. **Extrae los datos Base64:** todo lo que hay después de la coma
3. **Construye un bloque inlineData:** mete el MIME y los datos en un objeto JSON

El resultado es un objeto que va a incluirse directamente en el mensaje que se enviará a Gemini:

```json
{ "inlineData": { "mimeType": "image/jpeg", "data": "/9j/4AAQ..." } }
```

Los datos viajan dentro del propio mensaje JSON. No hay ninguna llamada extra a ningún sitio. Todo va en un solo paquete.

### 🎬 Si es VÍDEO

Los vídeos son demasiado grandes para meterlos en el JSON (superarían el límite de ~20 MB). El servidor hace tres cosas antes de poder preguntar a Gemini:

**Paso A — Decodificar:** Convierte la cadena Base64 de vuelta a bytes reales (el archivo de vídeo original).

**Paso B — Subir a Files API:** Manda esos bytes a los servidores de Google en dos peticiones HTTP:

- **Primera:** "Oye Google, voy a subirte un archivo MP4 de X bytes. ¿Me das una URL donde mandarlo?"
  Google responde con una URL temporal.
- **Segunda:** Manda los bytes reales a esa URL.
  Google responde: "Recibido. El URI de tu archivo es `https://.../files/abc123`. Ahora lo proceso."

**Paso C — Esperar:** Google necesita tiempo para procesar el vídeo (extraer fotogramas, indexar audio, etc.). El servidor pregunta cada 2 segundos "¿Ya está listo?" hasta que Google responde `ACTIVE`. Máximo 60 segundos de espera.

Solo entonces el servidor construye el bloque para Gemini, pero en vez de meter los bytes, mete la **referencia**:

```json
{ "fileData": { "mimeType": "video/mp4", "fileUri": "https://.../files/abc123" } }
```

### 📝 Si es TEXTO o CÓDIGO

No hay transformación binaria. El servidor simplemente añade el contenido como texto plano con un delimitador para que Gemini entienda que es un archivo adjunto y no parte de la pregunta:

```json
{ "text": "--- ARCHIVO: config.json ---\n{ \"debug\": true }\n\n" }
```

Si el texto llegó codificado como Base64 (porque el frontend usó `readAsDataURL`), el servidor primero lo decodifica a texto legible y luego hace lo mismo.

## 📦 FASE 5: El backend construye el mensaje completo para Gemini

Con todas las "partes" ya preparadas, el servidor monta el JSON final. Un mensaje puede tener varias partes: primero todos los adjuntos (imágenes, audio, PDF, vídeo o texto), y al final el texto del usuario. **El orden importa:** los adjuntos van antes que la pregunta.

```json
{
  "systemInstruction": {
    "parts": [{ "text": "Eres Claudio, un asistente con visión y oído..." }]
  },
  "contents": [{
    "role": "user",
    "parts": [
      { "inlineData": { "mimeType": "image/jpeg", "data": "/9j/..." } },
      { "text": "¿Qué palabra aparece en la imagen?" }
    ]
  }],
  "generationConfig": { "maxOutputTokens": 8192 }
}
```

El campo `systemInstruction` es la "personalidad" del agente: quién es, cómo debe comportarse, en qué idioma responde. Gemini lo procesa antes que el mensaje del usuario.

## 🚀 FASE 6: El backend manda la petición a Gemini

Una sola petición HTTP POST a la API de Google:

```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
Header: x-goog-api-key: AIzaSy...
Header: Content-Type: application/json
Body: <el JSON de la fase anterior>
```

La API Key va en el header (no en la URL) para que no quede registrada en logs de servidores intermedios. La URL incluye el nombre del modelo. El body es el JSON con los adjuntos y el mensaje.

## 🧠 FASE 7: Cómo interpreta Gemini cada tipo

Aquí es donde ocurre la "magia". Gemini no trata todos los tipos igual:

- **Imagen:** Gemini tiene un modelo de visión integrado. Los bytes de la imagen se decodifican internamente y se convierten en una representación vectorial de lo que "ve": formas, colores, texto, objetos, caras. El modelo puede leer texto en la imagen, identificar objetos, analizar gráficos, etc. Cada imagen consume ~258 tokens del contexto.
- **Audio:** Gemini transcribe el audio y lo analiza. Entiende el contenido hablado, el idioma, el tono. Consume aproximadamente 32 tokens por segundo de audio.
- **PDF:** Gemini lo trata como un documento con estructura. Extrae el texto de cada página, analiza las imágenes que pueda contener, entiende tablas y diagramas. Ve el documento página a página.
- **Vídeo:** Google ya ha procesado el vídeo antes (fase 4). Gemini recibe los fotogramas y el audio por separado y los analiza de forma conjunta. Puede describir lo que ocurre en cada momento, leer texto en pantalla, identificar personas o lugares.
- **Texto:** Gemini lo lee como texto puro. Los delimitadores `--- ARCHIVO: nombre ---` le ayudan a entender que es contenido de un fichero, no parte de la conversación. Puede analizar código, detectar errores, resumir documentos, etc.

## 📬 FASE 8: Gemini responde

Gemini devuelve un JSON estructurado:

```json
{
  "candidates": [{
    "content": {
      "parts": [{ "text": "La palabra que aparece en la imagen es 'ALONE'." }],
      "role": "model"
    },
    "finishReason": "STOP"
  }],
  "usageMetadata": {
    "promptTokenCount": 278,
    "candidatesTokenCount": 14
  }
}
```

- `candidates` es la lista de respuestas posibles (normalmente solo hay una).
- `content.parts[].text` es el texto de la respuesta.
- `finishReason: STOP` significa que terminó correctamente. Otros valores posibles: `SAFETY` (bloqueado), `RECITATION` (plagio detectado), `MAX_TOKENS` (se cortó por límite).
- `usageMetadata` indica cuántos tokens se han consumido (importante para controlar costes).

## 🖥️ FASE 9: El usuario ve la respuesta

El backend extrae el texto de `candidates[0].content.parts[0].text` y lo manda de vuelta al frontend:

```json
{ "reply": "La palabra que aparece en la imagen es 'ALONE'." }
```

El frontend muestra ese texto en el chat como la respuesta del agente. Desde el punto de vista del usuario, simplemente subió una imagen, hizo una pregunta, y recibió una respuesta. Todo lo demás (Base64, inlineData, Files API, polling, JSON de Gemini) fue invisible.

## ⏱️ Tiempos aproximados de respuesta

| Tipo | Tiempo típico |
|---|---|
| Texto solo | 1-3 segundos |
| Imagen | 2-5 segundos |
| Audio (1 min) | 3-8 segundos |
| PDF (10 páginas) | 3-7 segundos |
| Vídeo (1 min) | 30-90 segundos (subida + procesamiento + análisis) |

El vídeo tarda mucho más porque hay dos fases previas (subida a Files API + espera de procesamiento) antes de que Gemini siquiera empiece a analizarlo.

## 🛑 FASE 10: Límites y Restricciones (Files API)

La subida de vídeos (y archivos grandes) a la **Google Files API** tiene unos límites que debes conocer:

1. **Límite por vídeo individual:** 
   - Tamaño máximo: **2 GB**.
   - Duración máxima: Aproximadamente **1 hora**. *(Los vídeos más largos consumen demasiados tokens de contexto y darán error).*
2. **Límite de almacenamiento total:**
   - Cada proyecto de Google AI Studio tiene un máximo de **20 GB acumulados**. Si llegas a los 20 GB, los nuevos vídeos serán rechazados.
3. **Límite temporal (Caducidad):**
   - Google **borra automáticamente** todos los archivos subidos pasadas **48 horas**. La Files API no es un disco duro, es un espacio de procesamiento temporal.
4. **Límites locales (Quarkus):**
   - Tu servidor local está configurado con `quarkus.http.limits.max-body-size=2000M`, por lo que el frontend puede enviar archivos de hasta 2 GB al backend de golpe.

## 🗑️ FASE 11: Borrado automático inmediato

Dado que el límite es de 20 GB, si el agente procesa muchos vídeos a lo largo del día, este límite se podría agotar antes de que pasen las 48 horas de caducidad automática de Google. 

Para evitar chocar *nunca* con este límite, el Backend implementa una **política de borrado inmediato**:
1. Antes de enviar nada a Google, se inicializa una lista vacía `List<String> uploadedFiles`.
2. Cada vez que se sube un vídeo a la Files API, se guarda su URL temporal en esa lista.
3. El proceso de petición a Gemini se envuelve en un bloque `try ... catch ... finally`.
4. El bloque **`finally`** garantiza que, pase lo que pase (tanto si la IA responde correctamente como si hay un fallo), justo antes de enviar la respuesta al usuario se ejecuta una petición **HTTP DELETE** a Google por cada vídeo subido.

Gracias a esto, el almacenamiento consumido de la Files API en Google vuelve siempre a **0%** en cuestión de segundos, haciendo que puedas subir infinitos vídeos sin preocuparte por el límite de 20 GB.