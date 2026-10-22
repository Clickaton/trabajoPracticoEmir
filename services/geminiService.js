import { parseLocalDateTime } from '../utils/dateUtils.js';
import dotenv from "dotenv";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Inscripcion from "../models/Inscripcion.js";
import PeriodoInscripcion from "../models/PeriodoInscripcion.js";
import Alumno from "../models/Alumno.js";
import { cargarContextoAcademico } from "./contextoAcademicoService.js";
import { estadoAcademicoDelAlumno } from "./reglasAcademicasService.js";
import { tipoDePeriodo, periodoVigente as estaVigente } from "../utils/periodoUtils.js";
import { crearRespaldo } from "./respaldoIA.js";

dotenv.config();

const baseUrl = (process.env.KOBOLDCPP_BASE_URL || "http://127.0.0.1:5001/v1").replace(/\/$/, "");
const apiKey = process.env.KOBOLDCPP_API_KEY || "local-koboldcpp";
const modelName = process.env.KOBOLDCPP_MODEL || "gemma-4";
const TIEMPO_MAXIMO_KOBOLD_MS = 120000; // un modelo local en CPU puede tardar, pero no infinito
const PAUSA_TRAS_FALLAR_KOBOLD_MS = 60000; // si falló, durante un minuto se lo prueba al final (ver respaldoIA.js)
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_APIKEY;
const clienteGemini = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;
// Cuando Google satura un modelo contesta 503 ("high demand") y suele pasar solo; el segundo modelo tiene su propia capacidad
const MODELOS_GEMINI = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];

const convertirMensaje = (mensaje) => ({
  role: mensaje.role === "model" ? "assistant" : mensaje.role,
  content: mensaje.parts?.map((parte) => parte.text || "").join("") || ""
});

const ETIQUETA_SEMAFORO = {
  verde: "verde (al día)",
  amarillo: "amarillo (promoción condicional: debe el final de una correlativa)",
  rojo: "rojo (perdió la regularidad de alguna materia: debe recursarla)",
  gris: "gris (todavía no cursó ninguna materia)"
};

// Arma, con las MISMAS reglas que usa el sistema (reglasAcademicasService), la situación del alumno que consulta.
// Así el asistente no dice "Regular" de una materia cuya regularidad ya venció.
const obtenerContextoAcademico = async (usuario) => {
  const rol = (usuario?.tipoPerfil || usuario?.rol || "").toString().toLowerCase();
  if (rol !== "alumno" || !usuario?.id) return "";

  const alumnoId = Number(usuario.id);
  const alumno = await Alumno.findOne({ id: alumnoId }).lean();
  if (!alumno) return "";

  const ahora = new Date();
  const [{ plan, materias, ctx, intentosFinal }, inscripciones, periodosActivos] = await Promise.all([
    cargarContextoAcademico(alumno, { ahora }),
    Inscripcion.find({ alumno_id: alumnoId }).lean(),
    PeriodoInscripcion.find({ activo: true }).lean()
  ]);

  const estado = estadoAcademicoDelAlumno(materias, ctx); // materias del plan de su cohorte, ordenadas por año y nombre
  const nombresMaterias = new Map(materias.map((materia) => [materia.id, materia.nombre]));
  const periodoVigente = periodosActivos.find((periodo) => tipoDePeriodo(periodo) === "Cursada" && estaVigente(periodo, ahora));
  const periodoFinalVigente = periodosActivos.find((periodo) => tipoDePeriodo(periodo) === "Final" && estaVigente(periodo, ahora));

  const situacionAcademica = estado.materias.map((materia) => {
    const nota = materia.nota !== null && materia.nota !== undefined ? ` (nota: ${materia.nota})` : "";
    return `${materia.nombre} (${materia.anio}° año): ${materia.estado}${nota} - ${materia.semaforo.mensaje}`;
  });
  const inscripcionesActuales = inscripciones.map((inscripcion) => {
    const materia = nombresMaterias.get(inscripcion.materia_id) || "Materia desconocida";
    return `${materia} (período ID: ${inscripcion.periodo_id})`;
  });
  const finalesAnotado = intentosFinal
    .filter((intento) => intento.estado === "Inscripto")
    .map((intento) => `${nombresMaterias.get(intento.materia_id) || "Materia desconocida"} (período ID: ${intento.periodo_id})`);

  const formatoFecha = (fecha) => `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
  return `
Datos académicos del alumno autenticado (fuente: base de datos, no inventar ni modificar):
- Plan de estudios: ${plan?.nombre || "sin plan asignado"}
- Semáforo general: ${ETIQUETA_SEMAFORO[estado.semaforo.color] || estado.semaforo.color}
- Materias aprobadas: ${estado.materiasAprobadas} de ${estado.totalMaterias} (${estado.porcentaje}%)
- Inscripción a finales abierta ahora: ${periodoFinalVigente ? `sí, período "${periodoFinalVigente.nombre}"` : "no"}
- Finales a los que está anotado y todavía no rindió: ${finalesAnotado.join(", ") || "ninguno"}
- Inscripciones a cursada habilitadas ahora: ${periodoVigente ? `sí, período "${periodoVigente.nombre}" (del ${formatoFecha(parseLocalDateTime(periodoVigente.fechaInicio, "00:00"))} al ${formatoFecha(parseLocalDateTime(periodoVigente.fechaFin, "00:00"))})` : "no, no hay un período vigente"}
- Materias actualmente inscriptas: ${inscripcionesActuales.join(", ") || "ninguna"}
- Situación académica y notas actuales:
${situacionAcademica.map((situacion) => `  - ${situacion}`).join("\n") || "  - No hay materias cargadas"}
`;
};

const leerPromptBase = async () => {
  // Ruta relativa a este archivo (no a la carpeta desde la que se arranca el servidor)
  return fs.readFile(fileURLToPath(new URL("../prompts/asistente.txt", import.meta.url)), "utf-8");
};

const construirPromptSegunRol = async (pregunta, rolUsuario, pantallaActual = "sistema general", usuario = null) => {
  const contextoBase = await leerPromptBase();
  const rolNormalizado = (rolUsuario || "").toString().toLowerCase();
  const contextoAcademico = await obtenerContextoAcademico(usuario);

  let instruccionRol = "";

  if (rolNormalizado === "alumno") {
    instruccionRol = `
Eres el asistente de soporte para alumnos del ISFT 225.
Puedes responder preguntas relacionadas con:
- cómo inscribirme en materias (período de Cursada) y en finales (período de Final)
- cómo ver mi historial académico, mi regularidad y mi semáforo
- cómo pedir una constancia de alumno regular o de porcentaje de materias
- cómo modificar mi perfil: puedo cambiar mi nombre, mi email y mi contraseña desde "Mi Perfil"; el DNI, el legajo y el estado los modifica el personal administrativo
También puedes responder consultas sobre sus datos académicos cuando aparezcan en el contexto de la base de datos, por ejemplo cuántas materias aprobó, qué regularidad le queda o por qué no puede inscribirse a un final.
Si el usuario pregunta por otros temas, responde de forma breve indicando que solo puedes ayudar con esas materias.
`;
  } else if (["administrativo", "direccion", "secretario"].includes(rolNormalizado)) {
    instruccionRol = `
Eres el asistente de soporte para administración del ISFT 225.
Puedes responder consultas generales del sistema y del panel administrativo, que tiene estas pestañas:
- Personal Administrativo: alta, edición y baja del personal.
- Cohortes y Alumnos: cohortes (con su plan de estudios), alumnos, ficha académica de cada alumno (estado por materia, actas con libro y folio, inscripciones a finales, historial), tipo de ingreso y pase, semáforo, y la planilla de Google Sheets de la cohorte.
- Materias y Correlatividades: planes de estudio y sus reglas de regularidad, materias por plan y año, y correlatividades.
- Períodos de Inscripción: períodos de Cursada y de Final, y la mesa de cada período de Final para ver inscriptos y cargar resultados.
- Correo ISFT 225: vista previa de correo (no envía mensajes reales).
`;
  } else if (rolNormalizado) {
    instruccionRol = `
Eres el asistente de soporte del ISFT 225.
Puedes responder consultas generales sobre el uso del sistema.
`;
  }

  return `Contexto de la pantalla: ${pantallaActual}\n\n${contextoBase}\n\n${instruccionRol}\n${contextoAcademico}\n\nCliente:\n${pregunta}`;
};

const consultarConGemini = async (modelo, prompt, historial) => {
  if (!clienteGemini) {
    throw new Error("No se encontró GEMINI_API_KEY ni GEMINI_APIKEY para usar el respaldo de Google");
  }

  const contenido = [
    ...historial.slice(0, -1).map((mensaje) => ({
      role: mensaje.role === "model" ? "model" : "user",
      parts: mensaje.parts || [{ text: mensaje.content || "" }]
    })),
    {
      role: "user",
      parts: [{ text: prompt }]
    }
  ];

  const resultado = await clienteGemini.getGenerativeModel({ model: modelo }).generateContent({ contents: contenido });
  return resultado.response.text();
};

// KoboldCpp (modelo local). Si el equipo que lo corre está apagado o en otra red, esta consulta falla y se prueba con Gemini.
const consultarConKobold = async (prompt, historial) => {
  const mensajes = [
    ...historial.slice(0, -1).map(convertirMensaje),
    { role: "user", content: prompt }
  ];

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelName,
      messages: mensajes,
      temperature: 0.7
    }),
    // Sin límite, un servidor que acepta la conexión y no contesta dejaría el chat esperando para siempre
    signal: AbortSignal.timeout(TIEMPO_MAXIMO_KOBOLD_MS)
  });

  // Una página de error (HTML) no es JSON: se informa el código HTTP en lugar de "Unexpected token <"
  const resultado = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`respondió ${response.status}: ${resultado.error?.message || "error desconocido"}`);
  }

  return resultado.choices?.[0]?.message?.content;
};

// Orden: KoboldCpp (modelo local) y, si falla, Gemini. Sin clave de Gemini basta un intento para que el error lo diga.
const consultarConRespaldo = crearRespaldo([
  { nombre: `KoboldCpp (${baseUrl})`, consultar: consultarConKobold, pausaTrasFallarMs: PAUSA_TRAS_FALLAR_KOBOLD_MS },
  ...(clienteGemini ? MODELOS_GEMINI : MODELOS_GEMINI.slice(0, 1)).map((modelo) => ({
    nombre: `Gemini (${modelo})`,
    consultar: (prompt, historial) => consultarConGemini(modelo, prompt, historial)
  }))
]);

// Devuelve el texto de la respuesta. Si ninguno responde, lanza un error que cuenta por qué falló cada uno
// (chatService se lo avisa a la persona sin guardar nada en el historial).
export const consultarIAConHistorial = async (pregunta, rolUsuario, pantallaActual = "sistema general", historial = [], usuario = null) => {
  const prompt = await construirPromptSegunRol(pregunta, rolUsuario, pantallaActual, usuario);

  const { texto, proveedor, fallos } = await consultarConRespaldo(prompt, historial);

  if (fallos.length > 0) console.warn(`[asistente] Respondió ${proveedor}. Antes falló: ${fallos.join(" | ")}`);
  return texto;
};
