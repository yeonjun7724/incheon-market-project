"use client";
import dynamic from "next/dynamic";
import { MapProvider } from "react-map-gl/mapbox";
import { useApp } from "@/lib/store";
import { MapTools } from "@/components/map/MapTools";
import { BottomNav } from "@/components/panels/BottomNav";
import { SearchBar } from "@/components/panels/SearchBar";
import { ConditionPanel } from "@/components/panels/ConditionPanel";
import { CartPanel } from "@/components/panels/CartPanel";
import { RoutePanel } from "@/components/panels/RoutePanel";
import { ChecklistPanel } from "@/components/panels/ChecklistPanel";
import { FavoritesPanel } from "@/components/panels/FavoritesPanel";
import { ReportPanel } from "@/components/panels/ReportPanel";
import { useState } from "react";

const MapCanvas = dynamic(() => import("@/components/map/MapCanvas"), { ssr: false });

const TITLES: Record<string, string> = {
  stores:    "🏪 추천 경로",
  search:    "⚙️ 장보기 조건 설정",
  cart:      "🛍️ 장바구니 · AI 에이전트",
  checklist: "🧾 상점별 체크리스트",
  report:    "📝 가격 제보",
  favorites: "⭐ 자주 가는 가게 · 자주 사는 품목",
};

export default function Home() {
  const { panel, setPanel, routePlans, routeChoice, setRouteChoice, setRoutePlans } = useApp();
  const [priceLayerOn, setPriceLayerOn] = useState(false);

  const hasRoutes = Object.keys(routePlans).length > 0;
  // 사이드바: 패널이 열렸거나 장보기 중(경로 선택됨)일 때 표시
  const showSidebar = panel !== null || (hasRoutes && routeChoice !== null);
  const sidebarTitle = panel ? (TITLES[panel] ?? "") : "🏪 추천 경로";

  function closeSidebar() {
    // 경로 패널이거나 장보기 중 상태에서 닫으면 경로도 초기화
    if (panel === "stores" || panel === null) {
      setRouteChoice(null);
      setRoutePlans({});
    }
    setPanel(null);
  }

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

        {/* ── 왼쪽 사이드바 (모든 패널 통합 — 지도가 항상 오른쪽에서 인터랙티브) ── */}
        <div
          className={`fixed left-3 top-16 bottom-[88px] z-[500] w-80 flex flex-col
                      rounded-3xl shadow-2xl overflow-hidden
                      transition-all duration-300
                      ${showSidebar
                        ? "translate-x-0 opacity-100"
                        : "-translate-x-4 opacity-0 pointer-events-none"
                      }`}
          style={{
            background: "rgba(10,18,35,0.82)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
            <h2 className="text-[14px] font-bold text-ink1">{sidebarTitle}</h2>
            <button
              onClick={closeSidebar}
              className="text-xl text-ink2 hover:text-ink1 leading-none"
            >×</button>
          </div>

          {/* 패널 내용 */}
          <div className="flex-1 overflow-y-auto px-4 py-3 [scrollbar-width:thin]">
            {panel === "stores"    && <RoutePanel />}
            {panel === "search"    && <ConditionPanel />}
            {panel === "cart"      && <CartPanel />}
            {panel === "checklist" && <ChecklistPanel />}
            {panel === "report"    && <ReportPanel />}
            {panel === "favorites" && <FavoritesPanel />}
            {/* 장보기 중(경로 선택됨)이고 패널이 닫혀있으면 경로 요약 유지 */}
            {panel === null && hasRoutes && routeChoice !== null && <RoutePanel />}
          </div>
        </div>
      </main>
    </MapProvider>
  );
}
