
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Message, Role, GroundingSource } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

export const streamGeminiResponse = async (
  history: Message[],
  currentMessage: Message,
  onChunk: (text: string, sources?: GroundingSource[]) => void
) => {
  const model = "gemini-3-pro-preview"; // Используем Pro для лучшего поиска

  const contents = history.map(msg => ({
    role: msg.role,
    parts: msg.parts.map(p => {
      if (p.inlineData) return { inlineData: p.inlineData };
      return { text: p.text };
    })
  }));

  contents.push({
    role: currentMessage.role,
    parts: currentMessage.parts.map(p => {
      if (p.inlineData) return { inlineData: p.inlineData };
      return { text: p.text };
    })
  });

  try {
    const result = await ai.models.generateContentStream({
      model,
      contents,
      config: {
        systemInstruction: "Ты — Telegram-бот 'Gemini Pro'. Используй эмодзи. Отвечай на языке пользователя. Если используешь поиск, предоставляй точные данные. Форматируй код и списки с помощью Markdown.",
        tools: [{ googleSearch: {} }]
      }
    });

    let fullText = "";
    let sources: GroundingSource[] = [];

    for await (const chunk of result) {
      const chunkText = chunk.text;
      
      // Извлечение источников заземления (grounding)
      const groundingMetadata = chunk.candidates?.[0]?.groundingMetadata;
      if (groundingMetadata?.groundingChunks) {
        sources = groundingMetadata.groundingChunks
          .filter(c => c.web)
          .map(c => ({
            title: c.web.title,
            uri: c.web.uri
          }));
      }

      if (chunkText) {
        fullText += chunkText;
        onChunk(fullText, sources.length > 0 ? sources : undefined);
      }
    }
    return { fullText, sources };
  } catch (error) {
    console.error("Gemini Streaming Error:", error);
    throw error;
  }
};
