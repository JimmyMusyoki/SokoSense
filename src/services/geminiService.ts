import { GoogleGenAI, Type } from "@google/genai";
import { ExtractionResult } from "../types";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not defined in environment variables.");
    } else {
      console.log("GEMINI_API_KEY found, length:", apiKey.length, "starts with:", apiKey.substring(0, 4));
    }
    aiInstance = new GoogleGenAI({ apiKey: apiKey || "" });
  }
  return aiInstance;
}

function safeJsonParse(text: string): any {
  if (!text) return null;
  
  // Remove potential markdown blocks
  let cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
  
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Attempt to find the first '{' and last '}'
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    
    if (start !== -1) {
      // If we found a start but no end, it might be truncated
      const jsonSub = end !== -1 ? cleaned.substring(start, end + 1) : cleaned.substring(start);
      
      try {
        return JSON.parse(jsonSub);
      } catch (e2) {
        // Aggressive repair for common AI mistakes
        let repaired = jsonSub
          // Replace single quotes with double quotes (basic)
          .replace(/'/g, '"')
          // Remove trailing commas before closing braces/brackets
          .replace(/,\s*([}\]])/g, "$1")
          // Ensure keys are quoted (very basic check for word: value)
          .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');

        // If it was truncated (no closing brace), try to close it
        if (end === -1 || !jsonSub.includes("}")) {
          let temp = repaired;
          // Try adding up to 3 closing braces
          for (let i = 0; i < 3; i++) {
            temp += "}";
            try { return JSON.parse(temp); } catch (err) {}
          }
        }

        try {
          return JSON.parse(repaired);
        } catch (e3) {
          console.error("Failed to parse JSON even after repair attempts. Original text:", text);
          throw e3;
        }
      }
    }
    throw e;
  }
}

export async function extractMarketInfo(userInput: string): Promise<ExtractionResult> {
  const ai = getAI();
  const today = "2026-03-31";
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extract market info from this message: "${userInput}"`,
      config: {
        systemInstruction: `You are a specialized data extraction engine. 
        Your ONLY output must be a valid JSON object. 
        NO markdown, NO preamble, NO postamble.
        
        Schema:
        {
          "crop": string (e.g., "tomatoes", "onions", "beans", "cabbage", "carrots", "sukuma wiki", "avocado", "maize", "potatoes", "bananas", "mangoes", "watermelon", "pineapple", "capsicum", "garlic", "ginger", "sweet potatoes", "cassava", "coffee", "tea", "macadamia", "passion fruit", "oranges", "lemons", "spinach", "managu", "terere", "sagaa", "kunde", "arrowroots", "wheat", "rice", "sorghum", "millet", "green grams", "cowpeas", "pigeon peas", "groundnuts", "sunflowers", "soya beans", "pumpkin", "cucumber", "eggplant", "broccoli", "cauliflower", "lettuce", "celery", "parsley", "coriander", "mint", "rosemary", "thyme", "basil", "turmeric", "chili", "black pepper", "cardamom", "cinnamon", "cloves", "vanilla", "cocoa", "tobacco", "cotton", "pyrethrum", "sisal", "sugar cane"),
          "quantity": number,
          "unit": string,
          "date": string (YYYY-MM-DD),
          "market": string
        }
        
        Defaults:
        - date: "${today}"
        - market: "Wakulima"
        - crop: "tomatoes"
        - quantity: 1
        - unit: "gunia"`,
        responseMimeType: "application/json",
        maxOutputTokens: 1024,
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
      const candidateText = response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!candidateText) {
        throw new Error("Gemini returned an empty response.");
      }
      return safeJsonParse(candidateText);
    }

    return safeJsonParse(text);
  } catch (error) {
    console.error("Error in extractMarketInfo:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    return {
      crop: "tomatoes",
      quantity: 1,
      unit: "gunia",
      date: today,
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
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    return "Pole sana, nimepata shida kidogo kuunganisha na soko. Jaribu tena baada ya muda mfupi.";
  }
}
