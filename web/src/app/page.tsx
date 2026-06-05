"use client";
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
import { useState } from "react";

const MapCanvas = dynamic(() => import("@/components/map/MapCanvas"), { ssr: false });

const TITLES: Record<string, string> = {
  search:    "⚙️ 장보기 조건 설정",
  cart:      "🛍️ 장바구니 · AI 에이전트",
  checklist: "🧾 상점별 체크리스트",
  report:    "📝 가격 제보",
  favorites: "⭐ 자주 가는 가게 · 자주 사는 품목",
};

export default function Home() {
  const { panel, setPanel, routePlans, routeChoice, setRouteChoice, setRoutePlans } = useApp();
  const [priceLayerOn, setPriceLayerOn] = useState(false);

  // 추천 경로가 있고, (경로 패널이 열렸거나 경로가 선택된 경우) → 왼쪽 사이드바
  const hasRoutes = Object.keys(routePlans).length > 0;
  const showLeftPanel = hasRoutes && (panel === "stores" || routeChoice !== null);

  // 바텀 시트: stores 패널은 왼쪽 사이드바로 이동했으므로 제외
  const showBottomSheet = panel !== null && panel !== "stores";

  function closeLeftPanel() {
    setRouteChoice(null);
    setRoutePlans({});
    if (panel === "stores") setPanel(null);
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

        {/* ── 왼쪽 사이드바 (추천 경로 / 장보기 중) ── */}
        <div
          className={`fixed left-3 top-16 bottom-[88px] z-[500] w-72 flex flex-col
                      rounded-3xl shadow-2xl overflow-hidden
                      transition-all duration-300
                      ${showLeftPanel
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
            <h2 className="text-[14px] font-bold text-ink1">🏪 추천 경로</h2>
            <button
              onClick={closeLeftPanel}
              className="text-xl text-ink2 hover:text-ink1 leading-none"
            >×</button>
          </div>

          {/* 내용 */}
          <div className="flex-1 overflow-y-auto px-4 py-3 [scrollbar-width:thin]">
            <RoutePanel />
          </div>
        </div>

        {/* ── 바텀 시트 (조건설정·장바구니·체크리스트 등) ── */}
        <BottomSheet
          open={showBottomSheet}
          title={panel && panel !== "stores" ? (TITLES[panel] ?? "") : ""}
          onClose={() => setPanel(panel)}
        >
          {panel === "search"    && <ConditionPanel />}
          {panel === "cart"      && <CartPanel />}
          {panel === "checklist" && <ChecklistPanel />}
          {panel === "report"    && <ReportPanel />}
          {panel === "favorites" && <FavoritesPanel />}
        </BottomSheet>
      </main>
    </MapProvider>
  );
}
