"use client";
import dynamic from "next/dynamic";
import { MapProvider } from "react-map-gl/maplibre";
import { useApp } from "@/lib/store";
import { MapTools } from "@/components/map/MapTools";
import { StoreInfoCard } from "@/components/map/StoreInfoCard";
import { BottomNav } from "@/components/panels/BottomNav";
import { SearchBar } from "@/components/panels/SearchBar";
import { ConditionPanel } from "@/components/panels/ConditionPanel";
import { CartPanel } from "@/components/panels/CartPanel";
import { RoutePanel } from "@/components/panels/RoutePanel";
import { ChecklistPanel } from "@/components/panels/ChecklistPanel";
import { FavoritesPanel } from "@/components/panels/FavoritesPanel";
import { ReportPanel } from "@/components/panels/ReportPanel";
import { ReceiptPanel } from "@/components/panels/ReceiptPanel";
import { useState } from "react";

const MapCanvas = dynamic(() => import("@/components/map/MapCanvas"), { ssr: false });

// 패널 제목
const TITLES: Record<string, string> = {
  search:    "⚙️ 장보기 조건",
  cart:      "🛍️ 장바구니",
  checklist: "🧾 체크리스트",
  report:    "📝 가격 제보",
  favorites: "⭐ 즐겨찾기",
  receipt:   "🧾 영수증 적립",
};

// ── 바텀 시트 ──────────────────────────────────────────────────
function Sheet({
  open, title, onClose, children,
}: {
  open: boolean; title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-[700] transition-transform duration-300 ease-out
        ${open ? "translate-y-0" : "translate-y-full"}`}
      style={{ maxHeight: "82dvh" }}
    >
      <div
        className="flex flex-col rounded-t-3xl overflow-hidden"
        style={{
          background: "rgba(8,15,30,0.96)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderBottom: "none",
          maxHeight: "82dvh",
        }}
      >
        {/* 핸들 + 헤더 */}
        <div className="shrink-0 px-5 pt-3 pb-2">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-extrabold text-white">{title}</h2>
            <button onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/60 hover:bg-white/20 text-lg leading-none">
              ×
            </button>
          </div>
        </div>
        {/* 내용 — 하단에 BottomNav(약 64px) + safe-area 만큼 패딩 확보 */}
        <div
          className="flex-1 overflow-y-auto px-4 [scrollbar-width:thin]"
          style={{ paddingBottom: "calc(72px + env(safe-area-inset-bottom, 12px) + 8px)" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

// ── 추천경로 사이드바 (모바일: 토글 가능) ─────────────────────
function RouteSidebar({
  show, onClose,
}: {
  show: boolean; onClose: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  if (!show) return null;

  return (
    <>
      {/* 모바일 토글 버튼 (지도 가릴 때 숨길 수 있게) */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="fixed left-3 z-[600] flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-bold shadow-lg md:hidden"
        style={{
          top: collapsed ? "4.5rem" : "calc(4.5rem + 4px)",
          background: collapsed ? "#63b7ff" : "rgba(10,18,35,0.85)",
          color: collapsed ? "#04101f" : "#63b7ff",
          border: "1px solid #63b7ff",
          backdropFilter: "blur(8px)",
        }}
      >
        {collapsed ? "🏪 경로 보기" : "🗺️ 지도만 보기"}
      </button>

      {/* 사이드바 본체 */}
      <div
        className={`fixed left-3 top-16 bottom-[88px] z-[500] w-72 flex flex-col
                    rounded-3xl shadow-2xl overflow-hidden
                    transition-all duration-300
                    ${collapsed
                      ? "-translate-x-full opacity-0 pointer-events-none"
                      : "translate-x-0 opacity-100"
                    }`}
        style={{
          background: "rgba(10,18,35,0.88)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <h2 className="text-[14px] font-bold text-white">🏪 추천 경로</h2>
          <button onClick={onClose} className="text-xl text-white/40 hover:text-white leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 [scrollbar-width:thin]">
          <RoutePanel />
        </div>
      </div>
    </>
  );
}

// ── 메인 ──────────────────────────────────────────────────────
export default function Home() {
  const {
    panel, setPanel, routePlans, routeChoice, setRouteChoice, setRoutePlans,
  } = useApp();
  const [priceLayerOn, setPriceLayerOn] = useState(false);

  const hasRoutes = Object.keys(routePlans).length > 0;
  const showRoutes = hasRoutes && (panel === "stores" || routeChoice !== null);
  const showSheet  = panel !== null && panel !== "stores";

  function closeRoutes() {
    setRouteChoice(null);
    setRoutePlans({});
    if (panel === "stores") setPanel(null);
  }

  return (
    <MapProvider>
      <main>
        <MapCanvas priceLayerOn={priceLayerOn} />
        <SearchBar />
        <StoreInfoCard />
        <MapTools
          priceLayerOn={priceLayerOn}
          onTogglePriceLayer={() => setPriceLayerOn((v) => !v)}
        />
        <BottomNav />

        {/* 추천경로 사이드바 (토글 가능) */}
        <RouteSidebar show={showRoutes} onClose={closeRoutes} />

        {/* 바텀 시트 */}
        <Sheet
          open={showSheet}
          title={panel && panel !== "stores" ? (TITLES[panel] ?? "") : ""}
          onClose={() => setPanel(panel)}
        >
          {panel === "search"    && <ConditionPanel />}
          {panel === "cart"      && <CartPanel />}
          {panel === "checklist" && <ChecklistPanel />}
          {panel === "report"    && <ReportPanel />}
          {panel === "favorites" && <FavoritesPanel />}
          {panel === "receipt"   && <ReceiptPanel />}
        </Sheet>

        {/* 배경 딤 */}
        {showSheet && (
          <div
            className="fixed inset-0 z-[650] bg-black/30"
            onClick={() => setPanel(panel)}
          />
        )}
      </main>
    </MapProvider>
  );
}
