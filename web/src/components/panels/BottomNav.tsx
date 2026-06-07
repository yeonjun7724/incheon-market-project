"use client";
import { useApp } from "@/lib/store";
import type { PanelKey } from "@/lib/types";

const NAV: Array<{ icon: string; label: string; key: Exclude<PanelKey, null> }> = [
  { icon: "⚙️", label: "조건",    key: "search" },
  { icon: "🛍️", label: "장바구니", key: "cart" },
  { icon: "🏪", label: "경로",    key: "stores" },
  { icon: "📝", label: "제보",    key: "report" },
  { icon: "⭐", label: "즐겨찾기", key: "favorites" },
  { icon: "🧾", label: "영수증",  key: "receipt" },
];

export function BottomNav() {
  const { panel, setPanel, picked, receiptPoints } = useApp();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-[1001] flex items-stretch justify-around"
      style={{
        background: "rgba(255,255,255,0.98)",
        backdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(26,34,51,0.08)",
        boxShadow: "0 -2px 20px rgba(26,34,51,0.07)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        minHeight: 60,
      }}
    >
      {NAV.map(({ icon, label, key }) => {
        const active = panel === key;
        const badge =
          key === "cart" && picked.length ? picked.length
          : key === "receipt" && receiptPoints > 0 ? `${receiptPoints}P`
          : null;

        return (
          <button
            key={key}
            onClick={() => setPanel(key)}
            className="relative flex flex-1 flex-col items-center justify-center gap-0.5 pt-2 pb-1 transition-all"
          >
            {/* 활성 배경 */}
            {active && (
              <div className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-[#0077b6]" />
            )}
            <span className={`text-[22px] leading-none transition-transform duration-150 ${active ? "scale-110" : "scale-100"}`}>
              {icon}
            </span>
            <span className={`text-[10px] font-bold tracking-tight transition-colors ${active ? "text-[#0077b6]" : "text-[#8a96b0]"}`}>
              {label}
            </span>
            {badge && (
              <span className="absolute right-[18%] top-1 min-w-[17px] rounded-full bg-[#e63946] px-1 py-px text-[9px] font-black text-white text-center leading-tight">
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
