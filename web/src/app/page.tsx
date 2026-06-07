"use client";
import dynamic from "next/dynamic";
import { MapProvider } from "react-map-gl/mapbox";
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

const TITLES: Record<string, string> = {
  search:    "⚙️ 장보기 조건",
  cart:      "🛍️ 장바구니",
  stores:    "🏪 추천 경로",
  checklist: "🧾 체크리스트",
  report:    "📝 가격 제보",
  favorites: "⭐ 즐겨찾기",
  receipt:   "🧾 영수증 적립",
};

/* ── 바텀 시트 ─────────────────────────────────────────────── */
function Sheet({
  open, title, onClose, children, tall = false,
}: {
  open: boolean; title: string; onClose: () => void;
  children: React.ReactNode; tall?: boolean;
}) {
  return (
    <>
      {/* 딤 */}
      <div
        className="fixed inset-0 z-[690]"
        style={{
          background: "rgba(26,34,51,0.28)",
          backdropFilter: "blur(1px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 350ms cubic-bezier(0.4,0,0.2,1)",
        }}
        onClick={onClose}
      />

      {/* 시트 본체 */}
      <div
        className="fixed inset-x-0 bottom-0 z-[700] flex flex-col rounded-t-3xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.99)",
          backdropFilter: "blur(28px)",
          border: "1px solid rgba(26,34,51,0.09)",
          borderBottom: "none",
          boxShadow: "0 -6px 32px rgba(26,34,51,0.12)",
          maxHeight: tall ? "90dvh" : "80dvh",
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 400ms cubic-bezier(0.32,0.72,0,1)",
        }}
      >
        {/* 핸들 */}
        <div className="shrink-0 pt-3 pb-0 flex flex-col items-center">
          <div className="h-[5px] w-10 rounded-full" style={{ background: "rgba(26,34,51,0.13)" }} />
        </div>

        {/* 헤더 */}
        <div
          className="shrink-0 flex items-center justify-between px-5 py-3"
          style={{ borderBottom: "1px solid rgba(26,34,51,0.07)" }}
        >
          <h2 className="text-[17px] font-extrabold tracking-tight" style={{ color: "#1a2233" }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[18px] leading-none"
            style={{ background: "rgba(26,34,51,0.06)", color: "#4a5a78" }}
          >
            ×
          </button>
        </div>

        {/* 내용 */}
        <div
          className="flex-1 overflow-y-auto px-4 [scrollbar-width:thin]"
          style={{ paddingBottom: "calc(72px + env(safe-area-inset-bottom, 12px) + 8px)" }}
        >
          {children}
        </div>
      </div>
    </>
  );
}

/* ── 데스크탑 전용 사이드바 ─────────────────────────────────── */
function RouteSidebar({ show, onClose }: { show: boolean; onClose: () => void }) {
  if (!show) return null;
  return (
    <div
      className="hidden md:flex fixed left-3 top-16 bottom-[88px] z-[500] w-80 flex-col rounded-3xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.97)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(26,34,51,0.10)",
        boxShadow: "0 4px 24px rgba(26,34,51,0.12)",
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: "1px solid rgba(26,34,51,0.08)" }}
      >
        <div>
          <h2 className="text-[15px] font-extrabold" style={{ color: "#1a2233" }}>추천 경로</h2>
          <p className="text-[11px] mt-0.5" style={{ color: "#8a96b0" }}>경로를 선택하면 지도에 표시돼요</p>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none"
          style={{ background: "rgba(26,34,51,0.06)", color: "#4a5a78" }}
        >×</button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 [scrollbar-width:thin]">
        <RoutePanel />
      </div>
    </div>
  );
}

/* ── 사용법 모달 ─────────────────────────────────────────────── */
const STEPS = [
  { icon: "🔍", title: "검색", desc: "상단 검색창에 요리명(김치찌개, 잡채…)을 입력하면 AI가 필요한 재료를 자동 추천해요." },
  { icon: "🛍️", title: "장바구니", desc: "담고 싶은 재료를 선택하거나 직접 추가하세요. 예상 금액을 실시간으로 확인할 수 있어요." },
  { icon: "🏪", title: "추천 경로", desc: "최저예산·최소거리·최소경유 3가지 쇼핑 경로를 비교하고 원하는 경로를 선택하세요." },
  { icon: "🗺️", title: "지도", desc: "경로를 선택하면 지도에 동선이 표시돼요. 마커를 누르면 상점 상세 정보를 볼 수 있어요." },
  { icon: "🧾", title: "체크리스트 & 영수증", desc: "장보는 중 체크리스트로 항목을 확인하고, 영수증을 찍어 포인트를 적립하세요." },
  { icon: "📝", title: "가격 제보", desc: "시장·마트에서 실제 가격을 발견하면 제보해 주세요. 데이터가 더 정확해져요." },
];

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[1002] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-[#1a2233]/20 backdrop-blur-[2px]" />
      <div
        className="relative w-full max-w-lg rounded-t-3xl flex flex-col"
        style={{
          background: "rgba(255,255,255,0.98)",
          border: "1px solid rgba(26,34,51,0.10)",
          borderBottom: "none",
          boxShadow: "0 -4px 32px rgba(26,34,51,0.12)",
          maxHeight: "calc(88dvh - 64px)",
          marginBottom: 64,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pt-3 pb-1 flex flex-col items-center shrink-0">
          <div className="h-1 w-10 rounded-full" style={{ background: "rgba(26,34,51,0.15)" }} />
        </div>
        <div
          className="flex items-center justify-between px-5 py-3 shrink-0"
          style={{ borderBottom: "1px solid rgba(26,34,51,0.08)" }}
        >
          <div>
            <h2 className="text-[16px] font-extrabold" style={{ color: "#1a2233" }}>🛒 LocalCart 사용법</h2>
            <p className="text-[11px] mt-0.5" style={{ color: "#8a96b0" }}>인천 동네 장보기 길잡이</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-lg leading-none"
            style={{ background: "rgba(26,34,51,0.06)", color: "#4a5a78" }}
          >×</button>
        </div>
        <div
          className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3 [scrollbar-width:thin]"
          style={{ paddingBottom: 16 }}
        >
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-start gap-3 rounded-2xl p-3"
              style={{ background: "rgba(26,34,51,0.03)", border: "1px solid rgba(26,34,51,0.07)" }}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[20px]"
                style={{ background: "rgba(0,119,182,0.10)" }}>{s.icon}</div>
              <div>
                <p className="text-[13px] font-bold mb-0.5" style={{ color: "#1a2233" }}>
                  <span className="mr-1.5 font-black text-[11px]" style={{ color: "#0077b6" }}>0{i + 1}</span>
                  {s.title}
                </p>
                <p className="text-[12px] leading-relaxed" style={{ color: "#4a5a78" }}>{s.desc}</p>
              </div>
            </div>
          ))}
          <div className="rounded-2xl p-3 space-y-2"
            style={{ background: "rgba(26,34,51,0.03)", border: "1px solid rgba(26,34,51,0.07)" }}>
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#8a96b0" }}>지도 마커 색상</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { color: "#0077b6", label: "전통시장", symbol: "M" },
                { color: "#f77f00", label: "골목상권", symbol: "G" },
                { color: "#7b2d8b", label: "동네식품점", symbol: "N" },
                { color: "#2d9e5f", label: "대형유통", symbol: "S" },
              ].map(({ color, label, symbol }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full shrink-0 text-[12px] font-black text-white"
                    style={{ background: color, border: "2.5px solid white", boxShadow: `0 0 0 1.5px ${color}55` }}>
                    {symbol}
                  </span>
                  <span className="text-[12px]" style={{ color: "#4a5a78" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 메인 ────────────────────────────────────────────────────── */
export default function Home() {
  const { panel, setPanel, routePlans, routeChoice, setRouteChoice, setRoutePlans } = useApp();
  const [priceLayerOn, setPriceLayerOn] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const hasRoutes   = Object.keys(routePlans).length > 0;
  // 데스크탑 사이드바: 경로가 있고 stores 탭이 아닐 때
  const showSidebar = hasRoutes && panel !== "stores";
  // 바텀 시트: panel이 있는 모든 경우 (stores 포함)
  const showSheet   = panel !== null;

  function closeRoutes() {
    setRouteChoice(null);
    setRoutePlans({});
    if (panel === "stores") setPanel(null);
  }

  function closeSheet() {
    setPanel(null);
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

        {/* 도움말 버튼 */}
        <button
          onClick={() => setShowHelp(true)}
          className="fixed z-[1000] flex items-center justify-center rounded-full shadow-md"
          style={{
            right: "14px",
            bottom: "calc(env(safe-area-inset-bottom, 8px) + 72px)",
            width: 36, height: 36,
            background: "rgba(255,255,255,0.95)",
            border: "1px solid rgba(26,34,51,0.12)",
            color: "#0077b6",
            fontSize: 16,
            fontWeight: 900,
            transition: "transform 300ms ease",
          }}
        >?</button>

        {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

        {/* 데스크탑 사이드바 (md 이상만 렌더) */}
        <RouteSidebar show={showSidebar} onClose={closeRoutes} />

        {/* 바텀 시트 — 모바일에서 모든 패널 + 경로 */}
        <Sheet
          open={showSheet}
          title={panel ? (TITLES[panel] ?? "") : ""}
          onClose={closeSheet}
          tall={panel === "stores" || panel === "checklist"}
        >
          {panel === "search"    && <ConditionPanel />}
          {panel === "cart"      && <CartPanel />}
          {panel === "stores"    && <RoutePanel />}
          {panel === "checklist" && <ChecklistPanel />}
          {panel === "report"    && <ReportPanel />}
          {panel === "favorites" && <FavoritesPanel />}
          {panel === "receipt"   && <ReceiptPanel />}
        </Sheet>
      </main>
    </MapProvider>
  );
}
