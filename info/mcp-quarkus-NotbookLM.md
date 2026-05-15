# 1. MCP (Model Context Protocol)

### ¿Qué es un MCP?
El **Model Context Protocol (MCP)** es un estándar abierto introducido por Anthropic para solucionar el problema de la fragmentación en las integraciones de IA.

Imagina que es el **"USB-C para modelos de lenguaje"**. Antes, si querías que un agente leyera tus archivos locales o consultara una base de datos, te nías que escribir código específico para cada modelo o plataforma. MCP permite que los desarrolladores expongan sus datos a través de un protocolo universal que cualquier LLM compatible puede consumir.

### Los Tres Actores del Flujo
Para entender el traspaso, primero debemos ubicar dónde reside cada parte:

* **MCP Host (El Entorno):** Es la aplicación que usas (ej. Claude Desktop, una IDE, o tu agente local en Quarkus). Es quien tiene el modelo de lenguaje (LLM).
* **MCP Client (El Conector):** Un componente dentro del Host que mantiene la conexión abierta con los servidores.
* **MCP Server (La Fuente):** Un proceso ligero (tu app Quarkus) que tiene acceso a los datos reales (archivos, bases de datos, APIs).

### Secuencia del Flujo de Datos (Paso a Paso)
El flujo sigue un modelo de Solicitud-Respuesta basado en **JSON-RPC**, usualmente sobre `stdio` (entrada/salida estándar) o `HTTP/SSE`.

* **Paso A: Inicialización y "Handshake"**
    Cuando inicias tu agente, el Host se conecta al Server. El Server envía una lista de capacidades.
    *Traspaso:* "Hola, soy el servidor de Quarkus y puedo ofrecerte estas 3 herramientas: `leer_db`, `buscar_docs` y `consultar_clima`."

* **Paso B: El LLM identifica la necesidad**
    El usuario pregunta: "¿Qué dicen mis notas locales sobre la arquitectura de microservicios?". El LLM analiza la pregunta y se da cuenta de que no tiene esa información en su entrenamiento, pero ve que hay una herramienta llamada `buscar_docs`.

* **Paso C: La Llamada a la Herramienta (Tool Call)**
    El Host envía una solicitud estructurada al Server:
    ```json
    {
      "method": "tools/call",
      "params": {
        "name": "buscar_docs",
        "arguments": { "query": "microservicios" }
      }
    }
    ```

* **Paso D: Ejecución Local en Quarkus**
    Aquí es donde entra tu lógica de Java:
    * Quarkus recibe el JSON.
    * Ejecuta una consulta SQL o lee un archivo en tu disco duro.
    * Procesa los datos (ej. extrae el texto relevante).

* **Paso E: Respuesta del Servidor (Contexto)**
    El Server devuelve el contenido al Host:
    ```json
    {
      "result": {
        "content": [
          {
            "type": "text",
            "text": "La arquitectura de microservicios en este proyecto usa Quarkus y Kafka..."
          }
        ]
      }
    }
    ```

* **Paso F: Inyección en el Contexto (Prompt)**
    El Host recibe este texto y lo inserta de forma invisible en la conversación con el LLM. Ahora el LLM "sabe" lo que dicen tus archivos y puede responderte con precisión.

### Tipos de Traspaso de Datos
* **Resources (Recursos):** Datos de "solo lectura" que el servidor expone (como un archivo .log o un esquema de base de datos). El modelo puede leerlos cuando quiera.
* **Tools (Herramientas):** Funciones ejecutables (como "enviar un email" o "calcular una métrica"). Tienen efectos secundarios o requieren computación activa.
* **Prompts:** Plantillas predefinidas que el servidor envía al host para guiar al modelo sobre cómo usar los datos.

---

# 2. Quarkus: Java para la era de la IA

Quarkus es un framework de Java nativo de Kubernetes, diseñado para convertir a Java en un competidor de alto rendimiento frente a lenguajes más ligeros como Go o Node.js.

### ¿Cómo funciona? (La "Magia" de Quarkus)
La clave de Quarkus es su filosofía **"Container First"**. A diferencia de los frameworks tradicionales (como Spring Boot), que hacen mucho trabajo pesado mientras la aplicación se está ejecutando, Quarkus lo hace antes.

**El concepto "Build-time vs Runtime"**
* **Frameworks Tradicionales:** Cuando lanzas la app, el framework escanea todas las clases, lee configuraciones y genera proxies. Esto consume tiempo y RAM cada vez que reinicias.
* **Quarkus:** Realiza el escaneo de anotaciones y la configuración del framework durante la fase de compilación. El resultado es un ejecutable que ya sabe exactamente qué tiene que hacer, eliminando código muerto que no se usa.

**Compilación Nativa con GraalVM**
Quarkus permite compilar tu código Java directamente a un ejecutable nativo (binario) para el sistema operativo.
* **Sin JVM:** No necesitas una Java Virtual Machine instalada para correr el binario.
* **Arranque instantáneo:** Una app puede pasar de "apagada" a "lista para recibir tráfico" en milisegundos (**<20ms**).
* **Bajo consumo:** Puede usar hasta un **90% menos de memoria** en reposo que una app Java estándar.

### ¿Para qué se suele utilizar?
* **Microservicios:** Es ideal para arquitecturas donde tienes decenas o cientos de servicios pequeños que deben escalar rápido.
* **Serverless (FaaS):** En AWS Lambda o Google Cloud Functions, pagas por el tiempo de ejecución. Como Quarkus arranca casi instantáneamente, evitas el problema del "Cold Start".
* **Kubernetes y Cloud Native:** Diseñado para vivir en contenedores. Su baja huella de memoria ahorra dinero en la factura de la nube.
* **Aplicaciones de IA:** Gracias a extensiones como **LangChain4j**, es el estándar para crear agentes de IA y servicios de backend que conectan modelos de lenguaje.

### Características principales
* **Desarrollo de "Modo Live" (Live Coding):** Modifica tu código Java, guarda el archivo y los cambios se aplican instantáneamente sin reiniciar. Tan rápido como Python o JavaScript.
* **Unificación de Imperativo y Reactivo:** Permite escribir código de bloqueo tradicional y código no bloqueante en la misma aplicación sobre el mismo motor (Netty y Vert.x).
* **Ecosistema de Extensiones:** Hibernate (DB), RESTEasy (APIs), Quarkus LangChain4j (LLMs), SmallRye Health (Monitoreo).

---

# 3. NotebookLM: El cerebro de contexto compartido

NotebookLM es un asistente de investigación y redacción potenciado por IA desarrollado por Google. A diferencia de otros LLMs, está diseñado para ser un especialista en **tus propios datos**.

### ¿Para qué sirve realmente? (El concepto de "Grounding")
Soluciona las "alucinaciones" (inventar datos) mediante el **Grounding (anclaje)**:
* La IA no busca en todo Internet, sino que escanea exclusivamente las fuentes que subiste.
* Si la respuesta no está en tus documentos, te dirá que no lo sabe.

### ¿Qué se puede hacer en él?
* **A. Gestión de Fuentes Multiformato:** Sube hasta 50 fuentes (PDF, texto, Google Docs/Slides, URLs, texto copiado). Cada una de hasta 500,000 palabras.
* **B. Generación de "Audio Overviews":** Crea un podcast fotorrealista donde dos voces discuten y resumen tus documentos.
* **C. Guías de Estudio y Sumarios:** Genera automáticamente FAQs, cuestionarios, índices y cronologías.
* **D. Citación Transparente:** Incluye números de cita que te llevan al párrafo exacto del documento original para verificar datos.

### ¿Para qué se usa comúnmente?
* **Investigación Académica:** Comparar papers y detectar contradicciones entre autores.
* **Análisis de Negocios:** Detectar tendencias en reportes trimestrales y llamadas de inversores.
* **Desarrollo de Software:** Subir documentación de Quarkus y especificaciones de MCP para diseñar la arquitectura sin errores.
* **Creación de Contenido:** Organizar notas dispersas para escribir guiones o artículos técnicos.