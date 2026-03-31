export interface MarketEntry {
  date: string;
  market: string;
  crop: string;
  price_per_kg: number;
  demand_index: number;
}

export interface PredictionResult {
  crop: string;
  todayPrice: number;
  tomorrowPrice: number;
  advice: string;
  difference: number;
  market: string;
}

export interface ExtractionResult {
  crop: string;
  quantity: number;
  unit: string;
  date: string;
  market?: string;
}
