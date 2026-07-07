import dotenv from "dotenv";
import fs from "fs/promises";
import { GoogleGenerativeAI } from "@google/generative-ai";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export const consultarIA = async (pregunta) => {
  try {
    const contexto = await fs.readFile("./prompts/asistente.txt", "utf-8");
    const prompt = `${contexto}\n\nCliente:\n${pregunta}`;
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Error en Gemini:", error);
    return "Lo siento, tuve un problema al procesar tu consulta.";
  }
};