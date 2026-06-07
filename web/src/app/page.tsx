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

// 패널 제목
const TITLES: Record<string, string> = {
  search:    "⚙️ 장보기 조건",
  cart:      "🛍️ 장바구니",
  stores:    "🏪 추천 경로",
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
          background: "rgba(255,255,255,0.98)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(26,34,51,0.10)",
          borderBottom: "none",
          maxHeight: "82dvh",
          boxShadow: "0 -4px 24px rgba(26,34,51,0.10)",
        }}
      >
        {/* 핸들 + 헤더 */}
        <div className="shrink-0 px-5 pt-3 pb-2">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: "rgba(26,34,51,0.15)" }} />
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-extrabold text-[#1a2233]">{title}</h2>
            <button onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full text-lg leading-none transition hover:bg-[#e63946]/10"
              style={{ background: "rgba(26,34,51,0.06)", color: "#4a5a78" }}>
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
          background: collapsed ? "#0077b6" : "rgba(255,255,255,0.95)",
          color: collapsed ? "#fff" : "#0077b6",
          border: "1px solid #0077b6",
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
          background: "rgba(255,255,255,0.97)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(26,34,51,0.10)",
          boxShadow: "0 4px 24px rgba(26,34,51,0.12)",
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ borderBottom: "1px solid rgba(26,34,51,0.08)" }}>
          <div>
            <h2 className="text-[15px] font-extrabold text-[#1a2233]">추천 경로</h2>
            <p className="text-[11px] text-[#8a96b0]">경로를 선택하면 지도에 표시돼요</p>
          </div>
          <button onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none transition"
            style={{ background: "rgba(26,34,51,0.06)", color: "#4a5a78" }}>×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 [scrollbar-width:thin]">
          <RoutePanel />
        </div>
      </div>
    </>
  );
}

// ── 사용법 모달 ────────────────────────────────────────────────
const STEPS = [
  {
    icon: "🔍",
    title: "검색",
    desc: "상단 검색창에 요리명(김치찌개, 잡채…)을 입력하면 AI가 필요한 재료를 자동 추천해요.",
  },
  {
    icon: "🛍️",
    title: "장바구니",
    desc: "담고 싶은 재료를 선택하거나 직접 추가하세요. 예상 금액을 실시간으로 확인할 수 있어요.",
  },
  {
    icon: "🏪",
    title: "추천 경로",
    desc: "최저예산·최소거리·최소경유 3가지 쇼핑 경로를 비교하고 원하는 경로를 선택하세요.",
  },
  {
    icon: "🗺️",
    title: "지도",
    desc: "경로를 선택하면 지도에 동선이 표시돼요. 마커를 누르면 상점 상세 정보를 볼 수 있어요.",
  },
  {
    icon: "🧾",
    title: "체크리스트 & 영수증",
    desc: "장보는 중 체크리스트로 항목을 확인하고, 영수증을 찍어 포인트를 적립하세요.",
  },
  {
    icon: "📝",
    title: "가격 제보",
    desc: "시장·마트에서 실제 가격을 발견하면 제보해 주세요. 데이터가 더 정확해져요.",
  },
];

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[1002] flex items-end justify-center"
      onClick={onClose}>
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
        {/* 핸들 */}
        <div className="pt-3 pb-1 flex flex-col items-center shrink-0">
          <div className="h-1 w-10 rounded-full" style={{ background: "rgba(26,34,51,0.15)" }} />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0"
          style={{ borderBottom: "1px solid rgba(26,34,51,0.08)" }}>
          <div>
            <h2 className="text-[16px] font-extrabold text-[#1a2233]">🛒 LocalCart 사용법</h2>
            <p className="text-[11px] text-[#8a96b0] mt-0.5">인천 동네 장보기 길잡이</p>
          </div>
          <button onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-lg leading-none transition"
            style={{ background: "rgba(26,34,51,0.06)", color: "#4a5a78" }}>
            ×
          </button>
        </div>

        {/* 스텝 목록 */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3 [scrollbar-width:thin]"
          style={{ paddingBottom: 16 }}>
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-start gap-3 rounded-2xl p-3"
              style={{ background: "rgba(26,34,51,0.03)", border: "1px solid rgba(26,34,51,0.07)" }}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[20px]"
                style={{ background: "rgba(0,119,182,0.10)" }}>
                {s.icon}
              </div>
              <div>
                <p className="text-[13px] font-bold text-[#1a2233] mb-0.5">
                  <span className="text-[#0077b6] mr-1.5 font-black text-[11px]">0{i + 1}</span>
                  {s.title}
                </p>
                <p className="text-[12px] leading-relaxed text-[#4a5a78]">{s.desc}</p>
              </div>
            </div>
          ))}

          {/* 마커 범례 */}
          <div className="rounded-2xl p-3 space-y-2"
            style={{ background: "rgba(26,34,51,0.03)", border: "1px solid rgba(26,34,51,0.07)" }}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#8a96b0]">지도 마커 색상</p>
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
                  <span className="text-[12px] text-[#4a5a78]">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 메인 ──────────────────────────────────────────────────────
export default function Home() {
  const {
    panel, setPanel, routePlans, routeChoice, setRouteChoice, setRoutePlans,
  } = useApp();
  const [priceLayerOn, setPriceLayerOn] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const hasRoutes = Object.keys(routePlans).length > 0;
  const showRoutes = hasRoutes && (panel === "stores" || panel === null || routeChoice !== null);
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

        {/* 도움말 버튼 */}
        <button
          onClick={() => setShowHelp(true)}
          className="fixed z-[1000] flex items-center justify-center rounded-full shadow-md transition active:scale-90"
          style={{
            right: "14px",
            bottom: "calc(env(safe-area-inset-bottom, 8px) + 72px)",
            width: 36, height: 36,
            background: "rgba(255,255,255,0.95)",
            border: "1px solid rgba(26,34,51,0.12)",
            color: "#0077b6",
            fontSize: 16,
            fontWeight: 900,
          }}
          title="사용법"
        >
          ?
        </button>

        {/* 사용법 모달 */}
        {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

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
