export type Metal = "gold" | "silver" | "platinum" | "palladium";
export type Purity = "18K" | "20K" | "22K" | "24K" | "995" | "999";
export type DealDirection = "buy" | "sell";
export type DealStatus = "pending" | "in_refinery" | "in_transit" | "in_hk" | "sold" | "locked";
export type Location = "uae" | "hong_kong";
export type Currency = "USD" | "HKD" | "AED" | "USDT";
export type PaymentDirection = "sent" | "received";
export type PaymentMode = "bank" | "local_dealer" | "crypto_exchange";
export type PriceSource = "demo" | "live";
export type MetalSymbol = "XAU" | "XAG" | "XPT" | "XPD";

export interface Deal {
  id: string;
  metal: Metal;
  purity: Purity;
  is_pure: boolean;
  quantity_grams: number;
  pure_equivalent_grams: number;
  price_per_oz: number;
  direction: DealDirection;
  location: Location;
  status: DealStatus;
  date: string;
  created_by: "simulator" | "manual" | "whatsapp";
}

export interface Payment {
  id: string;
  amount: number;
  currency: Currency;
  direction: PaymentDirection;
  mode: PaymentMode;
  from_location: string;
  to_location: string;
  linked_deal_id: string | null;
  date: string;
}

export interface Price {
  metal: MetalSymbol;
  price_usd: number;
  prev_close: number;
  change: number;
  change_pct: number;
  source: PriceSource;
  fetched_at: string;
}

export interface StockSummary {
  metal: Metal;
  total_grams: number;
  avg_cost_per_oz: number;
  market_value_usd: number;
  unrealized_pnl: number;
  in_uae: number;
  in_refinery: number;
  in_transit: number;
  in_hk: number;
}

export const PURE_PURITIES: Purity[] = ["24K", "999", "995"];

export const YIELD_TABLE: Record<Purity, number> = {
  "18K": 0.75,
  "20K": 0.833,
  "22K": 0.917,
  "24K": 1.0,
  "995": 1.0,
  "999": 1.0,
};

export const METAL_SYMBOLS: Record<Metal, MetalSymbol> = {
  gold: "XAU",
  silver: "XAG",
  platinum: "XPT",
  palladium: "XPD",
};

export const GRAMS_PER_TROY_OZ = 31.1035;

export interface WhatsAppMessage {
  id: string;
  contact_name: string;
  contact_location: string;
  direction: "incoming" | "outgoing";
  message: string;
  is_lock: boolean;
  linked_deal_id: string | null;
  timestamp: string;
}

export interface WhatsAppContact {
  contact_name: string;
  contact_location: string;
  lastMessage: string;
  lastTimestamp: string;
  unread: number;
  has_lock: number;
}
