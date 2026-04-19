import { useState, useEffect } from 'react';
import { getAllInitialPrices } from '../services/marketService';
import { CROPS } from '../constants';

export function useMarketPrices() {
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    // Initialize with today's date (mocked to match our history data)
    const today = "2026-04-03";
    const initialPrices = getAllInitialPrices(today);
    
    // For crops not in history, provide a base price
    const fullPrices: Record<string, number> = { ...initialPrices };
    CROPS.forEach(crop => {
      if (!fullPrices[crop]) {
        // Generate a stable base price for crops not in history
        let hash = 0;
        for (let i = 0; i < crop.length; i++) {
          hash = crop.charCodeAt(i) + ((hash << 5) - hash);
        }
        fullPrices[crop] = 50 + (Math.abs(hash) % 150);
      }
    });
    
    setPrices(fullPrices);

    // Set up interval for "real-time" updates
    const interval = setInterval(() => {
      setPrices(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(crop => {
          // Small random fluctuation (-2% to +2%)
          const fluctuation = 1 + (Math.random() * 0.04 - 0.02);
          next[crop] = Math.round(next[crop] * fluctuation * 10) / 10;
          
          // Keep prices within reasonable bounds
          if (next[crop] < 20) next[crop] = 20;
          if (next[crop] > 500) next[crop] = 450;
        });
        return next;
      });
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  return prices;
}
