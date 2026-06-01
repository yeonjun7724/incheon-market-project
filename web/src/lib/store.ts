import { create } from "zustand";
import type { PanelKey, RoutePlans } from "./types";

interface AppState {
  // 위치/지도
  lat: number;
  lng: number;
  radiusM: number;
  setLoc: (lat: number, lng: number) => void;
  setRadius: (r: number) => void;

  // 조건
  budget: number;
  household: number;
  pref: string;
  useMarket: boolean;
  setCondition: (c: Partial<Pick<AppState, "budget" | "household" | "pref" | "useMarket">>) => void;

  // 패널
  panel: PanelKey;
  setPanel: (p: PanelKey) => void;

  // 장바구니
  picked: string[];          // 담은 재료명(순서 유지)
  favItems: string[];        // ⭐ 자주 사는 품목
  favStores: string[];       // 📌 자주 가는 가게 id
  togglePick: (n: string) => void;
  toggleFavItem: (n: string) => void;
  toggleFavStore: (id: string) => void;

  // AI 에이전트 / 경로
  recipeDish: string | null;
  recipeIngs: string[];
  setRecipe: (dish: string | null, ings: string[]) => void;
  routePlans: RoutePlans;
  routeChoice: string | null;
  setRoutePlans: (p: RoutePlans) => void;
  setRouteChoice: (k: string | null) => void;
}

export const useApp = create<AppState>((set) => ({
  lat: 37.4844,
  lng: 126.6569,
  radiusM: 3000,
  setLoc: (lat, lng) => set({ lat, lng }),
  setRadius: (radiusM) => set({ radiusM }),

  budget: 50000,
  household: 2,
  pref: "균형",
  useMarket: true,
  setCondition: (c) => set(c),

  panel: null,
  setPanel: (panel) => set((s) => ({ panel: s.panel === panel ? null : panel })),

  picked: [],
  favItems: [],
  favStores: [],
  togglePick: (n) => set((s) => ({
    picked: s.picked.includes(n) ? s.picked.filter((x) => x !== n) : [...s.picked, n],
  })),
  toggleFavItem: (n) => set((s) => ({
    favItems: s.favItems.includes(n) ? s.favItems.filter((x) => x !== n) : [...s.favItems, n],
  })),
  toggleFavStore: (id) => set((s) => ({
    favStores: s.favStores.includes(id) ? s.favStores.filter((x) => x !== id) : [...s.favStores, id],
  })),

  recipeDish: null,
  recipeIngs: [],
  setRecipe: (recipeDish, recipeIngs) => set({ recipeDish, recipeIngs }),
  routePlans: {},
  routeChoice: null,
  setRoutePlans: (routePlans) => set({ routePlans }),
  setRouteChoice: (routeChoice) => set({ routeChoice }),
}));
