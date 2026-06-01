"use client";
import { useApp } from "@/lib/store";
import type { PanelKey } from "@/lib/types";

const NAV: Array<{ label: string; key: Exclude<PanelKey, null> }> = [
  { label: "⚙️ 조건설정", key: "search" },
  { label: "🛍️ 장바구니", key: "cart" },
  { label: "🏪 추천상점", key: "stores" },
  { label: "📝 제보", key: "report" },
  { label: "⭐ 즐겨찾기", key: "favorites" },
];

export function BottomNav() {
  const { panel, setPanel, picked } = useApp();
  return (
    <nav className="fixed bottom-4 left-1/2 z-[1001] flex -translate-x-1/2 gap-1
                    glass rounded-full p-1.5 shadow-2xl">
      {NAV.map(({ label, key }) => {
        const active = panel === key;
        const badge = key === "cart" && picked.length ? ` (${picked.length})` : "";
        return (
          <button
            key={key}
            onClick={() => setPanel(key)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition
                        ${active ? "text-accent bg-white/5" : "text-ink2 hover:text-ink1"}`}
          >
            {label}{badge}
          </button>
        );
      })}
    </nav>
  );
}
