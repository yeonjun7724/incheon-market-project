"use client";
import { useApp } from "@/lib/store";
import type { PanelKey } from "@/lib/types";

/* SVG 아이콘 컴포넌트 */
function IconCondition({ active }: { active: boolean }) {
  const c = active ? "#0077b6" : "#8a96b0";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="8" y1="12" x2="20" y2="12" />
      <line x1="12" y1="18" x2="20" y2="18" />
      <circle cx="4" cy="12" r="1.5" fill={c} stroke="none" />
      <circle cx="8" cy="18" r="1.5" fill={c} stroke="none" />
    </svg>
  );
}

function IconCart({ active, badge }: { active: boolean; badge?: number }) {
  const c = active ? "#0077b6" : "#8a96b0";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  );
}

function IconRoute({ active }: { active: boolean }) {
  const c = active ? "#0077b6" : "#8a96b0";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* 출발점 */}
      <circle cx="6" cy="19" r="2.2" />
      {/* 도착점 */}
      <path d="M18 4.5c0 3-3.5 6-3.5 6S11 7.5 11 4.5a3.5 3.5 0 017 0z" />
      <circle cx="14.5" cy="4.5" r="1.2" fill={c} stroke="none" />
      {/* 경유지 */}
      <circle cx="12" cy="13" r="1.5" fill={c} stroke="none" />
      {/* 경로선 */}
      <path d="M6 17 C6 14 9 14 12 13 C15 12 15 8 14.5 6.7" strokeDasharray="2 2" />
    </svg>
  );
}

function IconReport({ active }: { active: boolean }) {
  const c = active ? "#0077b6" : "#8a96b0";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function IconFavorite({ active }: { active: boolean }) {
  const c = active ? "#0077b6" : "#8a96b0";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? c : "none"} stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function IconReceipt({ active }: { active: boolean }) {
  const c = active ? "#0077b6" : "#8a96b0";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z" />
      <line x1="8" y1="9" x2="16" y2="9" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="12" y2="17" />
    </svg>
  );
}

type NavItem = {
  key: Exclude<PanelKey, null>;
  label: string;
  Icon: React.FC<{ active: boolean }>;
};

const NAV: NavItem[] = [
  { key: "search",    label: "조건",    Icon: IconCondition },
  { key: "cart",      label: "장바구니", Icon: IconCart },
  { key: "stores",    label: "경로",    Icon: IconRoute },
  { key: "report",    label: "제보",    Icon: IconReport },
  { key: "favorites", label: "즐겨찾기", Icon: IconFavorite },
  { key: "receipt",   label: "영수증",  Icon: IconReceipt },
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
      {NAV.map(({ key, label, Icon }) => {
        const active = panel === key;
        const badge =
          key === "cart" && picked.length ? picked.length
          : key === "receipt" && receiptPoints > 0 ? `${receiptPoints}P`
          : null;

        return (
          <button
            key={key}
            onClick={() => setPanel(key)}
            className="relative flex flex-1 flex-col items-center justify-center gap-0.5 pt-2 pb-1"
            style={{ transition: "opacity 200ms ease" }}
          >
            {/* 활성 상단 인디케이터 */}
            {active && (
              <div className="absolute inset-x-3 top-0 h-[3px] rounded-full"
                style={{ background: "#0077b6" }} />
            )}

            {/* 아이콘 */}
            <div style={{
              transform: active ? "scale(1.12)" : "scale(1)",
              transition: "transform 200ms ease",
            }}>
              <Icon active={active} />
            </div>

            {/* 레이블 */}
            <span className="text-[10px] font-bold tracking-tight"
              style={{ color: active ? "#0077b6" : "#8a96b0" }}>
              {label}
            </span>

            {/* 배지 */}
            {badge && (
              <span className="absolute right-[18%] top-1 min-w-[17px] rounded-full px-1 py-px text-[9px] font-black text-white text-center leading-tight"
                style={{ background: "#e63946" }}>
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
