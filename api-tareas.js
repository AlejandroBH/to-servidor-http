const http = require("http");
const url = require("url");
const fs = require("fs").promises;
const path = require("path");
const Joi = require("joi");

// Configuración de Autenticación
const API_KEY_SECRETA = "mi-clave-secreta-de-api-2025";

// Base de datos en memoria
let tareas = [
  {
    id: 1,
    titulo: "Aprender Node.js",
    descripcion: "Completar tutoriales básicos",
    completada: false,
    prioridad: "alta",
  },
  {
    id: 2,
    titulo: "Practicar HTTP",
    descripcion: "Crear servidor básico",
    completada: true,
    prioridad: "media",
  },
];

let siguienteId = 3;

// Definición de esquema joi para POST
const EsquemaTareaPOST = Joi.object({
  titulo: Joi.string().trim().min(3).max(100).required(),
  descripcion: Joi.string().trim().allow("").max(500).optional(),
  prioridad: Joi.string()
    .valid("alta", "media", "baja")
    .default("media")
    .optional(),
  completada: Joi.any().forbidden(),
  id: Joi.any().forbidden(),
});

// Definición de esquema joi para PUT
const EsquemaTareaPUT = Joi.object({
  titulo: Joi.string().trim().min(3).max(100).optional(),
  descripcion: Joi.string().trim().allow("").max(500).optional(),
  completada: Joi.boolean().optional(),
  prioridad: Joi.string().valid("alta", "media", "baja").optional(),
}).min(1);

// Funcion para logging
function logOperacion(metodo, ruta, statusCode, mensaje, error = false) {
  const timestamp = new Date().toISOString();
  const nivel = error ? "ERROR" : "INFO";
  const logMensaje = `[${timestamp}] [${nivel}] ${metodo} ${ruta} -> ${statusCode} - ${mensaje}`;

  if (error) {
    console.error(`🔴 ${logMensaje}`);
  } else {
    console.log(`🟢 ${logMensaje}`);
  }
}

// Funciones helper
function enviarJSON(response, data, statusCode = 200) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
    "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
  });
  response.end(JSON.stringify(data, null, 2));
}

function enviarHTML(response, html, statusCode = 200) {
  response.writeHead(statusCode, {
    "Content-Type": "text/html",
    "Access-Control-Allow-Origin": "*",
  });
  response.end(html);
}

function obtenerCuerpo(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk.toString();
    });

    request.on("end", () => {
      try {
        if (!body) {
          resolve({}); // Cuerpo vacío, resolvemos con un objeto vacío
          return;
        }
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("JSON inválido"));
      }
    });

    request.on("error", reject);
  });
}

// Middleware de validación de esquemas
async function validarEsquema(request, response, esquema) {
  try {
    const data = await obtenerCuerpo(request);
    const { error, value } = esquema.validate(data, { abortEarly: false });

    if (error) {
      const erroresDetallados = error.details.map((d) => ({
        campo: d.context.key,
        mensaje: d.message,
      }));

      // GENERA LOG
      logOperacion(
        method,
        pathname,
        400,
        `Fallo de validación Joi: ${erroresDetallados
          .map((e) => e.campo)
          .join(", ")}`,
        true
      );

      enviarJSON(
        response,
        {
          error: "Error de validación de datos",
          detalles: erroresDetallados,
        },
        400
      );
      return null;
    }

    return value;
  } catch (error) {
    if (error.message === "JSON inválido") {
      enviarJSON(
        response,
        { error: "Formato de cuerpo de solicitud inválido (JSON)" },
        400
      );
    } else {
      enviarJSON(
        response,
        {
          error: "Error al leer el cuerpo de la solicitud",
          detalle: error.message,
        },
        400
      );
    }
    // GENERA LOG
    logOperacion(method, pathname, statusCode, mensajeLog, true);
    return null;
  }
}

// Middleware de Autenticación
function autenticarAPIKey(request, response, parsedUrl) {
  const { method, headers } = request;
  const { pathname, query } = parsedUrl;

  if (method === "OPTIONS") {
    enviarJSON(response, null, 204); // No Content
    return false;
  }

  const esRutaPublica =
    pathname === "/" ||
    (pathname === "/api/tareas" &&
      !query.completada &&
      !query.prioridad &&
      !query.q);

  if (esRutaPublica) {
    return true;
  }

  const apiKey = headers["x-api-key"] || query["api-key"];

  if (apiKey === API_KEY_SECRETA) {
    return true;
  } else {
    // GENERA LOG
    logOperacion(
      method,
      pathname,
      401,
      "Acceso no autorizado (API Key inválida)",
      true
    );

    enviarJSON(
      response,
      { error: "Acceso no autorizado. Se requiere una 'X-API-Key' válida." },
      401
    );
    return false;
  }
}

// Servidor principal
const servidor = http.createServer(async (request, response) => {
  const { method } = request;
  const parsedUrl = url.parse(request.url, true);
  const { pathname, query } = parsedUrl;

  try {
    // Aplicar Middleware de Autenticación
    const autenticado = autenticarAPIKey(request, response, parsedUrl);
    if (!autenticado) {
      return;
    }
    // Rutas de la API REST

    // GET /api/tareas - Listar tareas
    if (method === "GET" && pathname === "/api/tareas") {
      let resultados = [...tareas];

      // Filtros
      if (query.completada !== undefined) {
        const completada = query.completada === "true";
        resultados = resultados.filter((t) => t.completada === completada);
      }

      if (query.prioridad) {
        resultados = resultados.filter((t) => t.prioridad === query.prioridad);
      }

      // Búsqueda
      if (query.q) {
        const termino = query.q.toLowerCase();
        resultados = resultados.filter(
          (t) =>
            t.titulo.toLowerCase().includes(termino) ||
            t.descripcion.toLowerCase().includes(termino)
        );
      }

      enviarJSON(response, {
        total: resultados.length,
        tareas: resultados,
      });

      // GENERA LOG
      logOperacion(
        method,
        pathname,
        200,
        `Listando ${resultados.length} tareas (Filtros: ${
          Object.keys(query).length > 0 ? JSON.stringify(query) : "Ninguno"
        })`
      );
      return;
    }

    // GET /api/tareas/:id - Obtener tarea específica
    if (method === "GET" && pathname.startsWith("/api/tareas/")) {
      const id = parseInt(pathname.split("/")[3]);
      const tarea = tareas.find((t) => t.id === id);

      if (!tarea) {
        // GENERA LOG
        logOperacion(
          method,
          pathname,
          404,
          `Tarea con ID ${id} no encontrada`,
          true
        );

        enviarJSON(response, { error: "Tarea no encontrada" }, 404);
        return;
      }

      enviarJSON(response, tarea);

      // GENERA LOG
      logOperacion(method, pathname, 200, `Tarea con ID ${id} recuperada`);
      return;
    }

    // POST /api/tareas - Crear nueva tarea (¡VALIDACIÓN AÑADIDA!)
    if (method === "POST" && pathname === "/api/tareas") {
      const data = await validarEsquema(request, response, EsquemaTareaPOST);
      if (!data) return;

      const nuevaTarea = {
        id: siguienteId++,
        titulo: data.titulo,
        descripcion: data.descripcion || "",
        completada: false,
        prioridad: data.prioridad,
        fechaCreacion: new Date().toISOString(),
      };

      tareas.push(nuevaTarea);
      enviarJSON(response, nuevaTarea, 201);

      // GENERA LOG
      logOperacion(
        method,
        pathname,
        201,
        `Tarea creada con ID ${nuevaTarea.id}`
      );
      return;
    }

    // PUT /api/tareas/:id - Actualizar tarea (¡VALIDACIÓN AÑADIDA!)
    if (method === "PUT" && pathname.startsWith("/api/tareas/")) {
      const id = parseInt(pathname.split("/")[3]);

      const data = await validarEsquema(request, response, EsquemaTareaPUT);
      if (!data) return;

      const indice = tareas.findIndex((t) => t.id === id);
      if (indice === -1) {
        // GENERA LOG
        logOperacion(
          method,
          pathname,
          404,
          `Tarea con ID ${id} no encontrada para actualizar`,
          true
        );

        enviarJSON(response, { error: "Tarea no encontrada" }, 404);
        return;
      }

      // Si el esquema está vacío, Joi.min(1) debería haber fallado
      // Pero para mayor seguridad:
      if (Object.keys(data).length === 0) {
        // GENERA LOG
        logOperacion(
          method,
          pathname,
          400,
          "Solicitud de actualización sin campos",
          true
        );

        enviarJSON(
          response,
          { error: "Debe proporcionar al menos un campo para actualizar" },
          400
        );
        return;
      }

      // Actualizar solo los campos proporcionados y validados
      const tareaActualizada = { ...tareas[indice], ...data };
      tareas[indice] = tareaActualizada;

      enviarJSON(response, tareaActualizada);

      // GENERA LOG
      logOperacion(
        method,
        pathname,
        200,
        `Tarea con ID ${id} actualizada. Campos: ${Object.keys(data).join(
          ", "
        )}`
      );
      return;
    }

    // DELETE /api/tareas/:id - Eliminar tarea
    if (method === "DELETE" && pathname.startsWith("/api/tareas/")) {
      const id = parseInt(pathname.split("/")[3]);
      const indice = tareas.findIndex((t) => t.id === id);

      if (indice === -1) {
        // GENERA LOG
        logOperacion(
          method,
          pathname,
          404,
          `Tarea con ID ${id} no encontrada para eliminar`,
          true
        );

        enviarJSON(response, { error: "Tarea no encontrada" }, 404);
        return;
      }

      const tareaEliminada = tareas.splice(indice, 1)[0];
      enviarJSON(response, {
        mensaje: "Tarea eliminada",
        tarea: tareaEliminada,
      });
      // GENERA LOG
      logOperacion(method, pathname, 200, `Tarea con ID ${id} eliminada`);

      return;
    }

    // GET / - Interfaz web
    if (method === "GET" && pathname === "/") {
      const html = `
<!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>API de Tareas - Node.js</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            .endpoint { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; }
            .method { font-weight: bold; color: #007acc; }
            code { background: #e8e8e8; padding: 2px 4px; border-radius: 3px; }
            pre { background: #f8f8f8; padding: 10px; border-radius: 5px; overflow-x: auto; }
          </style>
        </head>
        <body>
          <h1>🚀 API de Gestión de Tareas</h1>
          <p>Servidor HTTP creado con Node.js puro</p>

          <h2>🔒 Autenticación</h2>
          <p><strong>Clave de ejemplo:</strong> <code>${API_KEY_SECRETA}</code></p>

          <h2>📋 Endpoints Disponibles</h2>

          <div class="endpoint">
            <span class="method">GET</span> <code>/api/tareas</code>
            <p>Listar todas las tareas. Parámetros opcionales: <code>completada</code>, <code>prioridad</code>, <code>q</code> (búsqueda)</p>
          </div>

          <div class="endpoint">
            <span class="method">GET</span> <code>/api/tareas/:id</code>
            <p>Obtener tarea específica por ID</p>
          </div>

          <div class="endpoint">
            <span class="method">POST</span> <code>/api/tareas</code>
            <p>Crear nueva tarea (<strong>Validación:</strong> <code>titulo</code> requerido, <code>prioridad</code> debe ser alta|media|baja)</p>
            <pre>{
  "titulo": "Mi nueva tarea",
  "descripcion": "Descripción opcional",
  "prioridad": "alta|media|baja"
}</pre>
          </div>

          <div class="endpoint">
            <span class="method">PUT</span> <code>/api/tareas/:id</code>
            <p>Actualizar tarea existente (<strong>Validación:</strong> requiere al menos un campo válido. <code>completada</code> debe ser booleano, <code>prioridad</code> debe ser alta|media|baja)</p>
          </div>

          <div class="endpoint">
            <span class="method">DELETE</span> <code>/api/tareas/:id</code>
            <p>Eliminar tarea</p>
          </div>

          <h2>🧪 Ejemplos de Uso (con API Key)</h2>
          <h3>Listar tareas con filtro (requiere API Key):</h3>
          <pre>curl -H "X-API-Key: ${API_KEY_SECRETA}" "http://localhost:3000/api/tareas?completada=false"</pre>

          <h3>Crear tarea (requiere API Key):</h3>
          <pre>curl -X POST -H "Content-Type: application/json" -H "X-API-Key: ${API_KEY_SECRETA}" -d '{"titulo":"Aprender HTTP","descripcion":"Estudiar protocolos web"}' http://localhost:3000/api/tareas</pre>

          <h3>Buscar tareas (requiere API Key):</h3>
          <pre>curl "http://localhost:3000/api/tareas?q=aprender&api-key=${API_KEY_SECRETA}"</pre>

          <h3>Filtrar por estado:</h3>
          <pre>curl "http://localhost:3000/api/tareas?completada=false"</pre>

          <p><strong>Estado actual:</strong> ${tareas.length} tareas registradas</p>
        </body>
        </html>
      `;

      enviarHTML(response, html);

      // GENERA LOG
      logOperacion(method, pathname, 200, "Interfaz web servida");
      return;
    }

    // 404 - Ruta no encontrada
    enviarJSON(
      response,
      {
        error: "Ruta no encontrada",
        metodo: method,
        ruta: pathname,
        disponibles: [
          "GET /",
          "GET /api/tareas",
          "POST /api/tareas",
          "GET /api/tareas/:id",
          "PUT /api/tareas/:id",
          "DELETE /api/tareas/:id",
        ],
      },
      404
    );

    // GENERA LOG
    logOperacion(method, pathname, 404, "Ruta no encontrada", true);
  } catch (error) {
    console.error("Error en el servidor:", error);

    // GENERA LOG
    logOperacion(
      method,
      pathname,
      500,
      `Error interno del servidor: ${error.message}`,
      true
    );

    enviarJSON(
      response,
      { error: "Error interno del servidor", detalle: error.message },
      500
    );
  }
});

servidor.listen(3000, () => {
  console.log("🚀 API REST de Tareas ejecutándose en http://localhost:3000");
  console.log("📖 Documentación en http://localhost:3000");
  console.log("🔧 Prueba los endpoints con curl o tu navegador");
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 Cerrando servidor...");
  servidor.close(() => {
    console.log("✅ Servidor cerrado correctamente");
    process.exit(0);
  });
});
