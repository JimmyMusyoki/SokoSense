
export interface KilimoData {
  id: number;
  slug: string;
  area_name: string;
  indicator_name: string;
  item_name: string;
  unit_symbol: string;
  time_period: string;
  data_value: number;
}

export interface KilimoResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: KilimoData[];
}

const BASE_URL = '/api/kilimo';

export const fetchKilimoData = async (indicatorId?: number, itemId?: number): Promise<KilimoData[]> => {
  const params = new URLSearchParams();
  if (indicatorId) params.append('indicator', indicatorId.toString());
  if (itemId) params.append('item', itemId.toString());
  
  const query = params.toString();
  const url = `${BASE_URL}/data${query ? '?' + query : ''}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data: KilimoResponse = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('Error fetching Kilimo data:', error);
    return [];
  }
};

export const fetchIndicators = async () => {
  try {
    const response = await fetch(`${BASE_URL}/indicators`);
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('Error fetching indicators:', error);
    return [];
  }
};

export const fetchItems = async () => {
  try {
    const response = await fetch(`${BASE_URL}/items`);
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('Error fetching items:', error);
    return [];
  }
};
