"use client";
import dynamic from "next/dynamic";
import { useApp } from "@/lib/store";
import { BottomNav } from "@/components/panels/BottomNav";
import { BottomSheet } from "@/components/panels/BottomSheet";
import { ConditionPanel } from "@/components/panels/ConditionPanel";
import { CartPanel } from "@/components/panels/CartPanel";
import { RoutePanel } from "@/components/panels/RoutePanel";
import { ChecklistPanel } from "@/components/panels/ChecklistPanel";
import { FavoritesPanel } from "@/components/panels/FavoritesPanel";
import { ReportPanel } from "@/components/panels/ReportPanel";

const MapCanvas = dynamic(() => import("@/components/map/MapCanvas"), { ssr: false });

const TITLES: Record<string, string> = {
  search: "⚙️ 장보기 조건 설정",
  cart: "🛍️ 장바구니 · AI 에이전트",
  stores: "🏪 추천 경로",
  checklist: "🧾 상점별 체크리스트",
  report: "📝 가격 제보",
  favorites: "⭐ 자주 가는 가게 · 자주 사는 품목",
};

export default function Home() {
  const { panel, setPanel } = useApp();

  return (
    <main>
      <MapCanvas />

      {/* 상단 로고 + 검색바 */}
      <div className="fixed left-1/2 top-4 z-[1000] flex w-[min(580px,calc(100vw-32px))] -translate-x-1/2 items-center gap-2">
        <div className="glass flex items-center gap-2 rounded-full px-4 py-2.5">
          <span className="text-lg">🛒</span>
          <span className="text-[15px] font-extrabold tracking-tight text-accent">LocalCart</span>
        </div>
        <button onClick={() => setPanel("cart")}
          className="glass flex-1 rounded-full px-5 py-3 text-left text-[13px] text-ink3">
          🔍 동네, 시장, 품목 검색…
        </button>
      </div>

      <BottomNav />

      <BottomSheet open={panel !== null} title={panel ? TITLES[panel] ?? "" : ""} onClose={() => setPanel(panel)}>
        {panel === "search" && <ConditionPanel />}
        {panel === "cart" && <CartPanel />}
        {panel === "stores" && <RoutePanel />}
        {panel === "checklist" && <ChecklistPanel />}
        {panel === "report" && <ReportPanel />}
        {panel === "favorites" && <FavoritesPanel />}
      </BottomSheet>
    </main>
  );
}
