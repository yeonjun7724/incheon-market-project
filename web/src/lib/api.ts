import type {
  Store, Item, DbItem, Recipe, BasketResult, RoutePlans, Report,
  RouteWithMapbox, ReceiptScanResult, MealRecommendationResult,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export const getCenter  = () => api<{ lat: number; lng: number }>("/stores/center");
export const getStores  = (lat?: number, lng?: number, radius = 3000, gu?: string) => {
  const q = new URLSearchParams();
  if (lat != null) q.set("lat", String(lat));
  if (lng != null) q.set("lng", String(lng));
  q.set("radius", String(radius));
  if (gu) q.set("gu", gu);
  return api<Store[]>(`/stores?${q.toString()}`);
};

// DB 기반 (items_seed.csv 제거됨)
export const getItems   = () => api<Item[]>("/items");
export const getDbItems = () => api<DbItem[]>("/items/db");
export const inferItemPrices = (names: string[]) =>
  api<Record<string, DbItem>>("/items/infer", {
    method: "POST", body: JSON.stringify({ names }),
  });

export const getStoreItems = (storeId: string, storeName = "", storeType = "") =>
  api<{ items: string[]; prices: Record<string, number>; source: string }>(
    `/stores/${encodeURIComponent(storeId)}/items?store_name=${encodeURIComponent(storeName)}&store_type=${encodeURIComponent(storeType)}`
  );

export const getRecipe    = (dish: string) =>
  api<Recipe>(`/recipes/${encodeURIComponent(dish)}`);
export const getBuyingTip = (name: string) =>
  api<{ name: string; tips: string[] }>(`/recipes/tip/${encodeURIComponent(name)}`);

export const optimizeBasket = (body: {
  budget: number; household: number; pref?: string; use_market?: boolean;
}) => api<BasketResult>("/basket/optimize", { method: "POST", body: JSON.stringify(body) });

export const recommendMeals = (body: {
  pref: string; budget: number; household: number;
}) => api<MealRecommendationResult>("/basket/meal-recommendations", {
  method: "POST", body: JSON.stringify(body),
});

export const recommendRoutes = (body: {
  ingredients: string[]; lat: number; lng: number; radius?: number;
  budget?: number; household?: number; pref?: string; use_market?: boolean;
}) => api<RoutePlans>("/routes/recommend", { method: "POST", body: JSON.stringify(body) });

export const getReports = () => api<Report[]>("/reports");
export const addReport  = (body: Report) =>
  api<Report>("/reports", { method: "POST", body: JSON.stringify(body) });

// 영수증
export const scanReceipt = (body: {
  image_base64: string; store_id?: string; store_name?: string;
}) => api<ReceiptScanResult>("/receipts/scan", { method: "POST", body: JSON.stringify(body) });

export const getStoreLearnedItems = (storeId: string, storeName = "") =>
  api<{ items: string[]; prices: Record<string, number>; source: string; learned: boolean }>(
    `/receipts/store/${encodeURIComponent(storeId)}/items?store_name=${encodeURIComponent(storeName)}`
  );

// Mapbox Directions API
export async function getMapboxRoute(
  origin: [number, number],
  waypoints: [number, number][],
  accessToken: string,
): Promise<RouteWithMapbox | null> {
  if (!waypoints.length) return null;
  const coords = [origin, ...waypoints].map(([lng, lat]) => `${lng},${lat}`).join(";");
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/walking/${coords}` +
    `?geometries=geojson&overview=full&steps=false&access_token=${accessToken}`;
  try {
    const res  = await fetch(url);
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) return null;
    return {
      geometry:   route.geometry,
      distance_m: Math.round(route.distance),
      duration_s: Math.round(route.duration),
    };
  } catch { return null; }
}
