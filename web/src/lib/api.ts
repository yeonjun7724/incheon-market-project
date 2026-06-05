import type {
  Store, Item, Recipe, BasketResult, RoutePlans, Report, DailyPrice, ItemSuggestion,
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

export const getCenter = () =>
  api<{ lat: number; lng: number }>("/stores/center");

export const getStores = (lat?: number, lng?: number, radius = 3000, gu?: string) => {
  const q = new URLSearchParams();
  if (lat != null) q.set("lat", String(lat));
  if (lng != null) q.set("lng", String(lng));
  q.set("radius", String(radius));
  if (gu) q.set("gu", gu);
  return api<Store[]>(`/stores?${q.toString()}`);
};

export const getItems = () => api<Item[]>("/items");

export const getRecipe = (dish: string) =>
  api<Recipe>(`/recipes/${encodeURIComponent(dish)}`);

export const getBuyingTip = (name: string) =>
  api<{ name: string; tips: string[] }>(`/recipes/tip/${encodeURIComponent(name)}`);

export const optimizeBasket = (body: {
  budget: number; household: number; pref?: string; use_market?: boolean;
}) => api<BasketResult>("/basket/optimize", {
  method: "POST", body: JSON.stringify(body),
});

export const recommendRoutes = (body: {
  ingredients: string[]; lat: number; lng: number; radius?: number;
}) => api<RoutePlans>("/routes/recommend", {
  method: "POST", body: JSON.stringify(body),
});

export const getReports = () => api<Report[]>("/reports");
export const addReport = (body: Report) =>
  api<Report>("/reports", { method: "POST", body: JSON.stringify(body) });

export const getDailyPrices = () => api<DailyPrice[]>("/prices/daily");

export const searchItems = (q: string) =>
  api<ItemSuggestion[]>(`/items/search?q=${encodeURIComponent(q)}`);
