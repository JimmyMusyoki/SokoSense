import marketHistory from "../data/marketHistory.json";
import { MarketEntry } from "../types";

export function getPrice(crop: string, date: string, market: string = "Wakulima"): number | null {
  const entry = (marketHistory as MarketEntry[]).find(
    (e) => e.crop.toLowerCase() === crop.toLowerCase() && e.date === date && e.market === market
  );
  return entry ? entry.price_per_kg : null;
}

export function predictPrice(crop: string, todayDate: string, market: string = "Wakulima"): number | null {
  // Simple "prediction": look up tomorrow's date in our mock history
  const today = new Date(todayDate);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const entry = (marketHistory as MarketEntry[]).find(
    (e) => e.crop.toLowerCase() === crop.toLowerCase() && e.date === tomorrowStr && e.market === market
  );
  
  // If not found, simulate a small increase based on demand index if available
  if (!entry) {
    const todayEntry = (marketHistory as MarketEntry[]).find(
      (e) => e.crop.toLowerCase() === crop.toLowerCase() && e.date === todayDate && e.market === market
    );
    if (todayEntry) {
      return todayEntry.price_per_kg * (1 + (todayEntry.demand_index * 0.1));
    }
    return null;
  }

  return entry.price_per_kg;
}
