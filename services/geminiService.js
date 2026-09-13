import dotenv from "dotenv";
import fs from "fs/promises";
import { GoogleGenerativeAI } from "@google/generative-ai";
import HistorialAcademico from "../models/HistorialAcademico.js";
import Materia from "../models/Materia.js";
import Inscripcion from "../models/Inscripcion.js";
import PeriodoInscripcion from "../models/PeriodoInscripcion.js";

dotenv.config();

const baseUrl = (process.env.KOBOLDCPP_BASE_URL || "http://127.0.0.1:5001/v1").replace(/\/$/, "");
const apiKey = process.env.KOBOLDCPP_API_KEY || "local-koboldcpp";
const modelName = process.env.KOBOLDCPP_MODEL || "gemma-4";
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_APIKEY;
const geminiModel = geminiApiKey
  ? new GoogleGenerativeAI(geminiApiKey).getGenerativeModel({ model: "gemini-2.5-flash" })
  : null;

const convertirMensaje = (mensaje) => ({
  role: mensaje.role === "model" ? "assistant" : mensaje.role,
  content: mensaje.parts?.map((parte) => parte.text || "").join("") || ""
});

const obtenerContextoAcademico = async (usuario) => {
  const rol = (usuario?.tipoPerfil || usuario?.rol || "").toString().toLowerCase();
  if (rol !== "alumno" || !usuario?.id) return "";

  const alumnoId = Number(usuario.id);
  const [registros, materias, inscripciones, periodosActivos] = await Promise.all([
    HistorialAcademico.find({ alumno_id: alumnoId }).lean(),
    Materia.find().lean(),
    Inscripcion.find({ alumno_id: alumnoId }).lean(),
    PeriodoInscripcion.find({ activo: true }).lean()
  ]);
  const materiasPorId = new Map(materias.map((materia) => [materia.id, materia.nombre]));
  const aprobadas = registros.filter((registro) => registro.estado === "Aprobada");
  const ahora = new Date();
  const periodoVigente = periodosActivos.find((periodo) => {
    const inicio = new Date(periodo.fechaInicio);
    const [horaInicio, minutoInicio] = periodo.horaInicio.split(":");
    inicio.setHours(Number(horaInicio), Number(minutoInicio), 0, 0);

    const fin = new Date(periodo.fechaFin);
    const [horaFin, minutoFin] = periodo.horaFin.split(":");
    fin.setHours(Number(horaFin), Number(minutoFin), 0, 0);

    return ahora >= inicio && ahora <= fin;
  });
  const estadoPorMateria = new Map(registros.map((registro) => [registro.materia_id, registro]));
  const situacionAcademica = materias.map((materia) => {
    const registro = estadoPorMateria.get(materia.id);
    return `${materia.nombre}: ${registro?.estado || "Pendiente"}${registro?.nota !== null && registro?.nota !== undefined ? ` (nota: ${registro.nota})` : ""}`;
  });
  const inscripcionesActuales = inscripciones.map((inscripcion) => {
    const materia = materiasPorId.get(inscripcion.materia_id) || "Materia desconocida";
    return `${materia} (período ID: ${inscripcion.periodo_id})`;
  });

  return `
Datos académicos del alumno autenticado (fuente: base de datos, no inventar ni modificar):
- Materias aprobadas: ${aprobadas.length}
- Total de registros académicos: ${registros.length}
- Detalle de aprobadas: ${aprobadas.map((registro) => materiasPorId.get(registro.materia_id) || "Materia desconocida").join(", ") || "ninguna"}
- Inscripciones habilitadas ahora: ${periodoVigente ? `sí, período "${periodoVigente.nombre}" (del ${periodoVigente.fechaInicio.toISOString().slice(0, 10)} al ${periodoVigente.fechaFin.toISOString().slice(0, 10)})` : "no, no hay un período vigente"}
- Materias actualmente inscriptas: ${inscripcionesActuales.join(", ") || "ninguna"}
- Situación académica y notas actuales:
${situacionAcademica.map((situacion) => `  - ${situacion}`).join("\n") || "  - No hay materias cargadas"}
`;
};

const leerPromptBase = async () => {
  return fs.readFile("./prompts/asistente.txt", "utf-8");
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
- cómo inscribirme en materias
- cómo ver mi historial académico
- cómo modificar mi usuario
  También puedes responder consultas sobre sus datos académicos cuando aparezcan en el contexto de la base de datos, por ejemplo cuántas materias aprobó.
  Si el usuario pregunta por otros temas, responde de forma breve indicando que solo puedes ayudar con esas materias.
`;
  } else if (rolNormalizado === "administrativo" || rolNormalizado === "direccion") {
    instruccionRol = `
Eres el asistente de soporte para administración del ISFT 225.
Puedes responder consultas generales del sistema y del panel administrativo.
`;
  }

  return `Contexto de la pantalla: ${pantallaActual}\n\n${contextoBase}\n\n${instruccionRol}\n${contextoAcademico}\n\nCliente:\n${pregunta}`;
};

const consultarConGemini = async (prompt, historial) => {
  if (!geminiModel) {
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

  const resultado = await geminiModel.generateContent({ contents: contenido });
  return resultado.response.text();
};

export const consultarIAConHistorial = async (pregunta, rolUsuario, pantallaActual = "sistema general", historial = [], usuario = null) => {
  const prompt = await construirPromptSegunRol(pregunta, rolUsuario, pantallaActual, usuario);

  try {
    const mensajes = [
      ...historial.slice(0, -1).map(convertirMensaje),
      {
        role: "user",
        content: prompt
      }
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
      })
    });

    const resultado = await response.json();

    if (!response.ok) {
      throw new Error(`KoboldCpp respondió ${response.status}: ${resultado.error?.message || "error desconocido"}`);
    }

    const respuesta = resultado.choices?.[0]?.message?.content;
    if (!respuesta) {
      throw new Error("KoboldCpp no devolvió contenido en choices[0].message.content");
    }

    return respuesta;
  } catch (error) {
    console.error("KoboldCpp no disponible; intentando Gemini como respaldo:", error);

    try {
      const respuestaGemini = await consultarConGemini(prompt, historial);
      console.log("Respuesta generada por Gemini como respaldo");
      return respuestaGemini;
    } catch (errorGemini) {
      console.error("Error también en Gemini como respaldo:", errorGemini);
      return "Lo siento, tuve un problema al procesar tu consulta.";
    }
  }
};

export const consultarIA = async (pregunta, rolUsuario) => {
  return consultarIAConHistorial(pregunta, rolUsuario, "sistema general", []);
};

export default { consultarIA, consultarIAConHistorial };