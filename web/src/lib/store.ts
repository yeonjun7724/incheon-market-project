import { create } from "zustand";
import type { PanelKey, RoutePlans, RouteWithMapbox, Store } from "./types";

interface AppState {
  // 위치/지도
  lat: number;
  lng: number;
  radiusM: number;
  setLoc: (lat: number, lng: number) => void;
  setRadius: (r: number) => void;

  // 지도 스타일
  mapStyle: string;
  toggleMapStyle: () => void;

  // 선택된 상점 (StoreInfoCard용)
  selectedStore: Store | null;
  setSelectedStore: (s: Store | null) => void;

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
  picked: string[];
  favItems: string[];
  favStores: string[];
  togglePick: (n: string) => void;
  toggleFavItem: (n: string) => void;
  toggleFavStore: (id: string) => void;
  clearCart: () => void;

  // AI 에이전트 / 경로
  recipeDish: string | null;
  recipeIngs: string[];
  setRecipe: (dish: string | null, ings: string[]) => void;
  routePlans: RoutePlans;
  routeChoice: string | null;
  setRoutePlans: (p: RoutePlans) => void;
  setRouteChoice: (k: string | null) => void;

  // 이동 모드
  travelMode: 'walking' | 'driving';
  setTravelMode: (m: 'walking' | 'driving') => void;

  // Mapbox 실제 경로
  mapboxRoute: RouteWithMapbox | null;
  setMapboxRoute: (r: RouteWithMapbox | null) => void;
  allMapboxRoutes: Record<string, RouteWithMapbox>;
  setAllMapboxRoutes: (r: Record<string, RouteWithMapbox>) => void;

  // 영수증 포인트
  receiptPoints: number;
  addReceiptPoints: (p: number) => void;
}

export const useApp = create<AppState>((set) => ({
  lat: 37.4563,
  lng: 126.7052,
  radiusM: 3000,
  setLoc: (lat, lng) => set({ lat, lng }),
  setRadius: (radiusM) => set({ radiusM }),

  mapStyle: "mapbox://styles/mapbox/streets-v12",
  toggleMapStyle: () => set((s) => ({
    mapStyle: s.mapStyle.includes("streets")
      ? "mapbox://styles/mapbox/light-v11"
      : "mapbox://styles/mapbox/streets-v12",
  })),

  selectedStore: null,
  setSelectedStore: (selectedStore) => set({ selectedStore }),

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
  clearCart: () => set({ picked: [], routePlans: {}, routeChoice: null, mapboxRoute: null, allMapboxRoutes: {}, recipeDish: null, recipeIngs: [] }),

  recipeDish: null,
  recipeIngs: [],
  setRecipe: (recipeDish, recipeIngs) => set({ recipeDish, recipeIngs }),
  routePlans: {},
  routeChoice: null,
  setRoutePlans: (routePlans) => set({ routePlans }),
  setRouteChoice: (routeChoice) => set({ routeChoice }),

  travelMode: 'walking',
  setTravelMode: (travelMode) => set({ travelMode, mapboxRoute: null, allMapboxRoutes: {} }),

  mapboxRoute: null,
  setMapboxRoute: (mapboxRoute) => set({ mapboxRoute }),
  allMapboxRoutes: {},
  setAllMapboxRoutes: (allMapboxRoutes) => set({ allMapboxRoutes }),

  receiptPoints: 0,
  addReceiptPoints: (p) => set((s) => ({ receiptPoints: s.receiptPoints + p })),
}));
