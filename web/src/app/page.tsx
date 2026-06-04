"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { MapProvider } from "react-map-gl/mapbox";
import { useApp } from "@/lib/store";
import { MapTools } from "@/components/map/MapTools";
import { BottomNav } from "@/components/panels/BottomNav";
import { BottomSheet } from "@/components/panels/BottomSheet";
import { SearchBar } from "@/components/panels/SearchBar";
import { ConditionPanel } from "@/components/panels/ConditionPanel";
import { CartPanel } from "@/components/panels/CartPanel";
import { RoutePanel } from "@/components/panels/RoutePanel";
import { ChecklistPanel } from "@/components/panels/ChecklistPanel";
import { FavoritesPanel } from "@/components/panels/FavoritesPanel";
import { ReportPanel } from "@/components/panels/ReportPanel";

const MapCanvas = dynamic(() => import("@/components/map/MapCanvas"), { ssr: false });

const TITLES: Record<string, string> = {
  search:    "⚙️ 장보기 조건 설정",
  cart:      "🛍️ 장바구니 · AI 에이전트",
  stores:    "🏪 추천 경로",
  checklist: "🧾 상점별 체크리스트",
  report:    "📝 가격 제보",
  favorites: "⭐ 자주 가는 가게 · 자주 사는 품목",
};

export default function Home() {
  const { panel, setPanel } = useApp();
  const [priceLayerOn, setPriceLayerOn] = useState(false);

  return (
    <MapProvider>
      <main>
        <MapCanvas priceLayerOn={priceLayerOn} />
        <SearchBar />
        <MapTools
          priceLayerOn={priceLayerOn}
          onTogglePriceLayer={() => setPriceLayerOn((v) => !v)}
        />
        <BottomNav />

        <BottomSheet
          open={panel !== null}
          title={panel ? TITLES[panel] ?? "" : ""}
          onClose={() => setPanel(panel)}
        >
          {panel === "search"    && <ConditionPanel />}
          {panel === "cart"      && <CartPanel />}
          {panel === "stores"    && <RoutePanel />}
          {panel === "checklist" && <ChecklistPanel />}
          {panel === "report"    && <ReportPanel />}
          {panel === "favorites" && <FavoritesPanel />}
        </BottomSheet>
      </main>
    </MapProvider>
  );
}
