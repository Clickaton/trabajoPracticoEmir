import dotenv from "dotenv";
import fs from "fs/promises";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_APIKEY;

if (!apiKey) {
  console.warn("No se encontró GEMINI_API_KEY ni GEMINI_APIKEY en las variables de entorno.");
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const leerPromptBase = async () => {
  return fs.readFile("./prompts/asistente.txt", "utf-8");
};

const construirPromptSegunRol = async (pregunta, rolUsuario, pantallaActual = "sistema general") => {
  const contextoBase = await leerPromptBase();
  const rolNormalizado = (rolUsuario || "").toString().toLowerCase();

  let instruccionRol = "";

  if (rolNormalizado === "alumno") {
    instruccionRol = `
Eres el asistente de soporte para alumnos del ISFT 225.
Solo puedes responder preguntas relacionadas con:
- cómo inscribirme en materias
- cómo ver mi historial académico
- cómo modificar mi usuario
Si el usuario pregunta por otros temas, responde de forma breve indicando que solo puedes ayudar con esas materias.
`;
  } else if (rolNormalizado === "administrativo" || rolNormalizado === "direccion") {
    instruccionRol = `
Eres el asistente de soporte para administración del ISFT 225.
Puedes responder consultas generales del sistema y del panel administrativo.
`;
  }

  return `Contexto de la pantalla: ${pantallaActual}\n\n${contextoBase}\n\n${instruccionRol}\n\nCliente:\n${pregunta}`;
};

export const consultarIAConHistorial = async (pregunta, rolUsuario, pantallaActual = "sistema general", historial = []) => {
  try {
    const prompt = await construirPromptSegunRol(pregunta, rolUsuario, pantallaActual);
    const contenido = [
      {
        role: "user",
        parts: [{ text: prompt }]
      },
      ...historial
    ];

    const result = await model.generateContent({ contents: contenido });
    return result.response.text();
  } catch (error) {
    console.error("Error en Gemini con historial:", error);
    return "Lo siento, tuve un problema al procesar tu consulta.";
  }
};

export const consultarIA = async (pregunta, rolUsuario) => {
  return consultarIAConHistorial(pregunta, rolUsuario, "sistema general", []);
};

export default { consultarIA, consultarIAConHistorial };