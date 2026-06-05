// FastAPI 응답과 1:1 매칭되는 타입

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
export type RoutePlans = Record<string, RoutePlan>;  // 전략명 → plan

export interface Report {
  item: string; price: number; store: string; lat: number; lng: number; date?: string;
}

export type PanelKey =
  | null | "search" | "cart" | "stores" | "checklist" | "report" | "favorites";

export interface DailyPrice {
  gds_lclsf_nm: string;
  item_key: string;
  중앙값: number | null;
  소매가: number | null;
  kamis_unit: string | null;
}
