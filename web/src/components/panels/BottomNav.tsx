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
      className="fixed bottom-0 inset-x-0 z-[1001] flex items-center justify-around
                 px-1 pt-2 pb-[env(safe-area-inset-bottom,8px)]"
      style={{
        background: "rgba(255,255,255,0.96)",
        backdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(26,34,51,0.10)",
        boxShadow: "0 -2px 16px rgba(26,34,51,0.08)",
      }}
    >
      {NAV.map(({ icon, label, key }) => {
        const active = panel === key;
        const badge =
          key === "cart" && picked.length
            ? picked.length
            : key === "receipt" && receiptPoints > 0
            ? `${receiptPoints}P`
            : null;

        return (
          <button
            key={key}
            onClick={() => setPanel(key)}
            className="relative flex flex-1 flex-col items-center gap-0.5 py-1 transition"
          >
            <span className={`text-[22px] leading-none transition-transform ${active ? "scale-110" : ""}`}>
              {icon}
            </span>
            <span className={`text-[10px] font-semibold transition-colors
              ${active ? "text-[#0077b6]" : "text-[#8a96b0]"}`}>
              {label}
            </span>
            {badge && (
              <span className="absolute right-[20%] top-0.5 min-w-[17px] rounded-full
                               bg-[#e63946] px-1 py-px text-[9px] font-black text-white text-center leading-none">
                {badge}
              </span>
            )}
            {active && (
              <span className="absolute bottom-0 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-[#0077b6]" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
