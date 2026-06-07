export type StoreType = "전통시장" | "골목상권" | "동네식품점" | "대형유통";

export interface Store {
  id: string;
  name: string;
  type: StoreType;
  gu: string;
  lat: number;
  lng: number;
  certified?: boolean;
  desc?: string;
  address?: string;
  distance_m?: number;
}

export interface Item {
  code: string;
  name: string;
  category: string;
  unit: string;
  emoji: string;
  avg_price: number;
  market_price: number;
  supermarket_price: number;
}

export interface DbItem {
  item_key: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  price_type: string;
  emoji?: string;
}

export interface Recipe {
  query: string;
  dish: string | null;
  ingredients: string[];
}

export interface BasketResult {
  summary: { total: number; n_items: number; by_category: Record<string, number> };
  items: Array<{
    code: string; name: string; category: string; unit: string;
    emoji: string; unit_price: number; qty: number; line_total: number;
  }>;
}

export interface RouteStop {
  id: string; name: string; type: StoreType; gu: string; lat: number; lng: number;
}
export interface RoutePlan {
  stops: RouteStop[];
  by_store: Record<string, {
    store: RouteStop;
    items: Array<{ name: string; price: number; emoji: string; unit: string }>;
  }>;
  budget: number;
  distance_m: number;
  minutes: number;
  n_stops: number;
}
export type RoutePlans = Record<string, RoutePlan>;

export interface MealIngredient {
  name: string;
  price: number;
  unit: string;
  emoji: string;
}

export interface MealCard {
  dish: string;
  ingredients: MealIngredient[];
}

export interface MealRecommendationResult {
  meals: MealCard[];
}

export interface Report {
  item: string; price: number; store: string; lat: number; lng: number; date?: string;
}

export type PanelKey =
  | null | "search" | "cart" | "stores" | "checklist" | "report" | "favorites" | "receipt";

// ── Mapbox 실제 경로 ──────────────────────────────────────────
export interface RouteWithMapbox {
  geometry: { type: "LineString"; coordinates: [number, number][] };
  distance_m: number;
  duration_s: number;
}

// ── 영수증 ────────────────────────────────────────────────────
export interface ReceiptItem {
  name: string;
  price: number;
  qty: number;
}

export interface ReceiptScanResult {
  store_name: string;
  store_id: string;
  items: ReceiptItem[];
  total: number;
  reward_points: number;
  message: string;
}
