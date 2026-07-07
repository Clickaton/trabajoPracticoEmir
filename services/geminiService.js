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

export const consultarIAConHistorial = async (pantallaActual = "sistema general", historial = []) => {
  try {
    const contexto = await fs.readFile("./prompts/asistente.txt", "utf-8");

    const contenido = [
      {
        role: "user",
        parts: [{ text: `Contexto de la pantalla: ${pantallaActual}\n\n${contexto}` }]
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

export const consultarIA = async (pregunta) => {
  return consultarIAConHistorial("sistema general", [
    {
      role: "user",
      parts: [{ text: pregunta }]
    }
  ]);
};

export default { consultarIA, consultarIAConHistorial };