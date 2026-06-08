"use client";
import { useState } from "react";
import { useMap } from "react-map-gl/mapbox";
import { useApp } from "@/lib/store";

const INCHEON_BOUNDS: [[number, number], [number, number]] = [
  [126.37, 37.38],
  [126.78, 37.58],
];

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export function MapTools({ onTogglePriceLayer: _onTogglePriceLayer, priceLayerOn: _priceLayerOn, onPinMode, pinMode }: {
  onTogglePriceLayer: () => void;
  priceLayerOn: boolean;
  onPinMode: () => void;
  pinMode: boolean;
}) {
  const { main } = useMap();
  const { setLoc, setPanel } = useApp();
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncOk, setSyncOk]   = useState(true);
  const [tooltip, setTooltip] = useState<string | null>(null);
  const [labelsVisible, setLabelsVisible] = useState(false);

  function goMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLoc(latitude, longitude);
        main?.flyTo({ center: [longitude, latitude], zoom: 15, duration: 800 });
      },
      () => alert("위치 권한을 허용해 주세요."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function fitIncheon() {
    main?.fitBounds(INCHEON_BOUNDS, { padding: 60, duration: 800 });
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res  = await fetch(`${BASE}/admin/sync-prices`, { method: "POST" });
      const data = await res.json();
      setSyncOk(!!data.ok);
      setSyncMsg(data.ok
        ? `✅ ${data.rows ?? 0}행 갱신`
        : `❌ ${data.message ?? "실패"}`
      );
    } catch {
      setSyncOk(false);
      setSyncMsg("❌ 연결 실패");
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 4000);
    }
  }

  const TOOLS = [
    { icon: "◎",  label: "현위치",       onClick: goMyLocation },
    { icon: pinMode ? "✕" : "📌", label: pinMode ? "핀 취소" : "위치 이동", onClick: onPinMode },
    { icon: "⭐", label: "즐겨찾기",      onClick: () => setPanel("favorites") },
    { icon: "⛶",  label: "인천 전체보기", onClick: fitIncheon },
  ];

  const btnBase = `
    relative flex h-10 items-center gap-2 rounded-2xl pl-2.5 pr-3
    shadow-md transition active:scale-90
  `;
  const iconOnly = !labelsVisible;
  const btnStyle = {
    background: "rgba(255,255,255,0.93)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(26,34,51,0.12)",
    color: "#1a2233",
  };

  return (
    <div
      className="fixed right-3 z-[1000] flex flex-col gap-2"
      style={{
        top: "calc(max(12px, env(safe-area-inset-top)) + 52px)",
        paddingTop: 4,
      }}
    >
      {/* 라벨 토글 버튼 */}
      <button
        className={btnBase}
        style={btnStyle}
        onClick={() => setLabelsVisible((v) => !v)}
        title={labelsVisible ? "설명 숨기기" : "설명 보기"}
      >
        <span className="text-[18px] leading-none w-5 text-center text-[#0077b6]">
          {labelsVisible ? "◀" : "▶"}
        </span>
        {labelsVisible && (
          <span className="text-[12px] font-semibold text-[#4a5a78] whitespace-nowrap">접기</span>
        )}
      </button>

      {TOOLS.map(({ icon, label, onClick }) => (
        <button
          key={label}
          className={btnBase}
          style={btnStyle}
          onClick={onClick}
          onMouseEnter={() => setTooltip(label)}
          onMouseLeave={() => setTooltip(null)}
        >
          <span className="text-[18px] leading-none w-5 text-center">{icon}</span>
          {!iconOnly && (
            <span className="text-[12px] font-semibold text-[#4a5a78] whitespace-nowrap">{label}</span>
          )}
        </button>
      ))}

      {/* 가격 데이터 갱신 */}
      <div className="relative">
        <button
          className={btnBase + (syncing ? " opacity-50 cursor-not-allowed" : "")}
          style={btnStyle}
          onClick={handleSync}
          disabled={syncing}
          onMouseEnter={() => setTooltip("가격 데이터 갱신")}
          onMouseLeave={() => setTooltip(null)}
        >
          <span className="text-[18px] leading-none w-5 text-center">
            {syncing ? "⏳" : "🔄"}
          </span>
          {!iconOnly && (
            <span className="text-[12px] font-semibold text-[#4a5a78] whitespace-nowrap">
              {syncing ? "갱신 중…" : "가격 갱신"}
            </span>
          )}
        </button>

        {syncMsg && (
          <div className={`absolute right-full mr-2 top-1/2 -translate-y-1/2 whitespace-nowrap
                           rounded-xl px-3 py-1.5 text-xs text-white shadow-xl
                           ${syncOk ? "bg-[#0077b6]" : "bg-[#e63946]"}`}>
            {syncMsg}
          </div>
        )}
      </div>

      {/* 호버 툴팁 */}
      {iconOnly && tooltip && (
        <div
          className="fixed right-14 whitespace-nowrap rounded-xl px-3 py-1.5 text-[12px] shadow-lg pointer-events-none"
          style={{
            top: "calc(max(12px, env(safe-area-inset-top)) + 52px + 4px)",
            background: "rgba(255,255,255,0.96)",
            border: "1px solid rgba(26,34,51,0.12)",
            color: "#1a2233",
          }}
        >
          {tooltip}
        </div>
      )}
    </div>
  );
}
