const BASE_URL = "http://localhost:3000/api/tareas";

function getApiKey() {
  return document.getElementById("api-key-input").value.trim();
}

async function cargarTareas() {
  const apiKey = getApiKey();
  if (!apiKey) {
    alert("Por favor, ingresa la API Key.");
    document.getElementById("tareas-lista").innerHTML =
      "<p>Ingresa la API Key para cargar las tareas.</p>";
    return;
  }

  const q = document.getElementById("busqueda").value.trim();
  const completada = document.getElementById("filtro-completada").value;
  const prioridad = document.getElementById("filtro-prioridad").value;

  const params = new URLSearchParams();
  if (q) params.append("q", q);
  if (completada) params.append("completada", completada);
  if (prioridad) params.append("prioridad", prioridad);

  const url = `${BASE_URL}?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: { "X-API-Key": apiKey },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Error ${response.status}: ${
          errorData.error || "Fallo al cargar tareas"
        }`
      );
    }

    const data = await response.json();
    mostrarTareas(data.tareas);
  } catch (error) {
    console.error("Error al cargar las tareas:", error);
    document.getElementById(
      "tareas-lista"
    ).innerHTML = `<p style="color: red;">Error: ${error.message}. Verifica tu API Key y que el servidor esté corriendo.</p>`;
  }
}

function mostrarTareas(tareas) {
  const lista = document.getElementById("tareas-lista");
  lista.innerHTML = "";

  if (tareas.length === 0) {
    lista.innerHTML =
      "<p>No se encontraron tareas con los filtros/búsqueda aplicados.</p>";
    return;
  }

  tareas.forEach((tarea) => {
    const item = document.createElement("div");
    item.className = `tarea-item ${tarea.completada ? "completada" : ""}`;
    item.id = `tarea-${tarea.id}`;

    const detalles = document.createElement("div");
    detalles.className = "tarea-details";

    detalles.innerHTML = `
                    <h3>${tarea.titulo} (ID: ${tarea.id})</h3>
                    <p><strong>Descripción:</strong> ${
                      tarea.descripcion || "Sin descripción"
                    }</p>
                    <p><strong>Prioridad:</strong> <span class="prioridad-${
                      tarea.prioridad
                    }">${tarea.prioridad.toUpperCase()}</span></p>
                    <p><strong>Estado:</strong> ${
                      tarea.completada ? "✅ Completada" : "⏳ Pendiente"
                    }</p>
                    ${
                      tarea.fechaFinalizacion
                        ? `<p><strong>Completada en:</strong> ${new Date(
                            tarea.fechaFinalizacion
                          ).toLocaleString()}</p>`
                        : ""
                    }
                `;

    const acciones = document.createElement("div");
    acciones.className = "tarea-actions";

    // Botón Completar/Pendiente
    const botonCompletar = document.createElement("button");
    botonCompletar.textContent = tarea.completada
      ? "Marcar Pendiente"
      : "Marcar Completada";
    botonCompletar.onclick = () =>
      toggleCompletada(tarea.id, !tarea.completada);

    // Botón Eliminar
    const botonEliminar = document.createElement("button");
    botonEliminar.textContent = "❌ Eliminar";
    botonEliminar.style.backgroundColor = "#d9534f";
    botonEliminar.onclick = () => eliminarTarea(tarea.id);

    acciones.appendChild(botonCompletar);
    acciones.appendChild(botonEliminar);

    item.appendChild(detalles);
    item.appendChild(acciones);
    lista.appendChild(item);
  });
}

// Manejador para la creación de tareas
document
  .getElementById("form-crear")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const apiKey = getApiKey();
    if (!apiKey) {
      alert("Por favor, ingresa la API Key.");
      return;
    }

    const nuevaTarea = {
      titulo: document.getElementById("titulo").value,
      descripcion: document.getElementById("descripcion").value,
      prioridad: document.getElementById("prioridad").value,
    };

    try {
      const response = await fetch(BASE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify(nuevaTarea),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.detalles
          ? data.detalles.map((d) => `${d.campo}: ${d.mensaje}`).join(", ")
          : data.error;
        throw new Error(`Fallo al crear tarea: ${errorMsg}`);
      }

      alert(`Tarea creada exitosamente: ${data.titulo} (ID: ${data.id})`);
      this.reset(); // Limpia el formulario
      cargarTareas(); // Recarga la lista
    } catch (error) {
      console.error("Error al crear la tarea:", error);
      alert(`Error al crear la tarea: ${error.message}`);
    }
  });

async function toggleCompletada(id, completada) {
  const apiKey = getApiKey();
  if (!apiKey) {
    alert("Por favor, ingresa la API Key.");
    return;
  }

  try {
    const response = await fetch(`${BASE_URL}/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({ completada: completada }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Error ${response.status}: ${errorData.error || "Fallo al actualizar"}`
      );
    }

    alert(
      `Tarea ${id} actualizada a ${completada ? "Completada" : "Pendiente"}`
    );
    cargarTareas();
  } catch (error) {
    console.error("Error al actualizar la tarea:", error);
    alert(`Error al actualizar la tarea: ${error.message}`);
  }
}

async function eliminarTarea(id) {
  const apiKey = getApiKey();
  if (!apiKey) {
    alert("Por favor, ingresa la API Key.");
    return;
  }

  if (
    !confirm(`¿Estás seguro de que quieres eliminar la tarea con ID ${id}?`)
  ) {
    return;
  }

  try {
    const response = await fetch(`${BASE_URL}/${id}`, {
      method: "DELETE",
      headers: { "X-API-Key": apiKey },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Error ${response.status}: ${errorData.error || "Fallo al eliminar"}`
      );
    }

    alert(`Tarea ${id} eliminada.`);
    cargarTareas();
  } catch (error) {
    console.error("Error al eliminar la tarea:", error);
    alert(`Error al eliminar la tarea: ${error.message}`);
  }
}
