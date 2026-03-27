import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const generateAIResponse = async (prompt: string, context?: string) => {
  try {
    const model = "gemini-3-flash-preview";
    const systemInstruction = `
      Você é um assistente de IA especializado em gestão de oficinas mecânicas e centros automotivos.
      Seu objetivo é ajudar o usuário a gerenciar melhor o negócio, analisar dados, sugerir serviços e melhorar a comunicação com clientes.
      Responda de forma profissional, direta e útil.
      Contexto atual do sistema: ${context || 'Geral'}
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
      },
    });

    return response.text;
  } catch (error) {
    console.error("Erro na IA:", error);
    throw new Error("Não foi possível processar sua solicitação no momento.");
  }
};
