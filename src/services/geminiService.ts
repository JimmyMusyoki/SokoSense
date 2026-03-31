import { GoogleGenAI, Type } from "@google/genai";
import { ExtractionResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function extractMarketInfo(userInput: string): Promise<ExtractionResult> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Extract the following information from the user's message about their produce:
    - crop (e.g., tomatoes, potatoes, maize)
    - quantity (number)
    - unit (e.g., gunia, debe, kg)
    - date (YYYY-MM-DD, default to 2026-03-31 if not specified)
    - market (default to "Wakulima" if not specified)

    User message: "${userInput}"`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          crop: { type: Type.STRING },
          quantity: { type: Type.NUMBER },
          unit: { type: Type.STRING },
          date: { type: Type.STRING },
          market: { type: Type.STRING },
        },
        required: ["crop", "quantity", "unit", "date"],
      },
    },
  });

  return JSON.parse(response.text);
}

export async function generateAdvice(
  userInput: string,
  crop: string,
  todayPrice: number,
  tomorrowPrice: number,
  market: string
): Promise<string> {
  const diff = tomorrowPrice - todayPrice;
  const advice = diff > 0 ? "Wait until tomorrow to sell." : "Sell today.";
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `You are SokoSense AI, a market negotiator for farmers in Kenya.
    The user said: "${userInput}"
    
    Market Data for ${crop} at ${market}:
    - Today's Price: KES ${todayPrice}/kg
    - Tomorrow's Predicted Price: KES ${tomorrowPrice}/kg
    - Difference: KES ${diff}/kg
    
    Your goal is to provide advice in a mix of Sheng and English (as a friendly, helpful AI).
    Be clear about the prices and whether they should wait or sell.
    
    Example response style:
    "Soko ya Wakulima kesho bei ya nyanya itakuwa KES 95/kg. Subiri hadi kesho. Leo bei ni KES 70/kg — utapoteza pesa."`,
    config: {
      systemInstruction: "You are a helpful AI market negotiator for Kenyan farmers. You speak a mix of Sheng and English. Your advice is based on real market data and predictions.",
    },
  });

  return response.text;
}
