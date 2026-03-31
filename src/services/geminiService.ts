import { GoogleGenAI, Type } from "@google/genai";
import { ExtractionResult } from "../types";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not defined in environment variables.");
    }
    aiInstance = new GoogleGenAI({ apiKey: apiKey || "" });
  }
  return aiInstance;
}

export async function extractMarketInfo(userInput: string): Promise<ExtractionResult> {
  const ai = getAI();
  try {
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
        maxOutputTokens: 256,
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

    const text = response.text;
    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }

    // Clean up the response text in case it contains markdown code blocks
    const jsonString = text.replace(/```json\n?|\n?```/g, "").trim();
    
    try {
      return JSON.parse(jsonString);
    } catch (parseError) {
      console.error("Failed to parse JSON from Gemini:", text);
      // Attempt to find JSON-like structure if parsing the whole string failed
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw parseError;
    }
  } catch (error) {
    console.error("Error in extractMarketInfo:", error);
    // Return a sensible default to prevent the app from crashing
    return {
      crop: "nyanya", // Default to tomatoes as it's common
      quantity: 1,
      unit: "gunia",
      date: "2026-03-31",
      market: "Wakulima"
    };
  }
}

export async function generateAdvice(
  userInput: string,
  crop: string,
  todayPrice: number,
  tomorrowPrice: number,
  market: string
): Promise<string> {
  const ai = getAI();
  const diff = tomorrowPrice - todayPrice;
  
  try {
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
        maxOutputTokens: 512,
      },
    });

    return response.text || "Samahani, sijapata jibu kwa sasa. Hebu jaribu tena.";
  } catch (error) {
    console.error("Error in generateAdvice:", error);
    return "Pole sana, nimepata shida kidogo kuunganisha na soko. Jaribu tena baada ya muda mfupi.";
  }
}
