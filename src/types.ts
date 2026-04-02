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

export interface UserProfile {
  uid: string;
  phoneNumber: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  about?: string;
  location?: string;
  rating?: number;
  successfulDeals?: number;
  followersCount?: number;
  followingCount?: number;
  createdAt: any;
  role?: string;
}

export interface Listing {
  id: string;
  uid: string;
  type: 'buy' | 'sell';
  crop: string;
  quantity: number;
  unit: string;
  price: number;
  status: 'active' | 'matched' | 'completed';
  createdAt: any;
}

export interface Chat {
  id: string;
  listingId: string;
  buyerUid: string;
  sellerUid: string;
  lastMessage?: string;
  updatedAt: any;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderUid: string;
  text: string;
  type?: 'text' | 'location' | 'live_location';
  location?: {
    latitude: number;
    longitude: number;
  };
  expiresAt?: any;
  createdAt: any;
}

export interface Notification {
  id: string;
  uid: string;
  text: string;
  read: boolean;
  createdAt: any;
  type?: 'listing' | 'chat' | 'follow';
  sourceUid?: string;
  listingId?: string;
}

export interface Follow {
  followerUid: string;
  followedUid: string;
  createdAt: any;
}
