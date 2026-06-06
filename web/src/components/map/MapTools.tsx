"use client";
import { useState } from "react";
import { useMap } from "react-map-gl/mapbox";
import { useApp } from "@/lib/store";

const INCHEON_BOUNDS: [[number, number], [number, number]] = [
  [126.37, 37.38],
  [126.78, 37.58],
];

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export function MapTools({ onTogglePriceLayer, priceLayerOn }: {
  onTogglePriceLayer: () => void;
  priceLayerOn: boolean;
}) {
  const { main } = useMap();
  const { setLoc, setPanel, toggleMapStyle } = useApp();
  const [syncing, setSyncing]       = useState(false);
  const [syncMsg, setSyncMsg]       = useState<string | null>(null);
  const [syncOk, setSyncOk]         = useState(true);

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
      const res = await fetch(`${BASE}/admin/sync-prices`, { method: "POST" });
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

  const btn = `flex h-10 w-10 items-center justify-center rounded-2xl text-[18px]
               text-white shadow-lg transition active:scale-90 hover:bg-white/15`;

  return (
    <div
      className="fixed right-3 z-[1000] flex flex-col gap-2"
      style={{
        top: "calc(max(12px, env(safe-area-inset-top)) + 52px)",
        bottom: "calc(72px + env(safe-area-inset-bottom, 0px))",
        justifyContent: "flex-start",
        paddingTop: 4,
      }}
    >
      {[
        { icon: "◎", title: "현위치", onClick: goMyLocation },
        { icon: "📌", title: "즐겨찾기", onClick: () => setPanel("favorites") },
        { icon: "🗂", title: "지도 스타일", onClick: toggleMapStyle },
        { icon: "⛶", title: "인천 전체", onClick: fitIncheon },
      ].map(({ icon, title, onClick }) => (
        <button key={title}
          className={btn}
          style={{ background: "rgba(8,15,30,0.82)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.08)" }}
          title={title}
          onClick={onClick}
        >{icon}</button>
      ))}

      {/* 가격 레이어 */}
      <button
        className={btn}
        style={{
          background: priceLayerOn ? "rgba(245,196,75,0.2)" : "rgba(8,15,30,0.82)",
          backdropFilter: "blur(12px)",
          border: priceLayerOn ? "1px solid rgba(245,196,75,0.5)" : "1px solid rgba(255,255,255,0.08)",
        }}
        title="가격 레이어"
        onClick={onTogglePriceLayer}
      >💰</button>

      {/* 다운로드 */}
      <a
        href={`${BASE}/admin/prices/download-zip`}
        download="daily_prices.zip"
        className={btn}
        style={{ background: "rgba(8,15,30,0.82)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.08)" }}
        title="데이터 다운로드"
      >⬇︎</a>

      {/* 동기화 */}
      <div className="relative">
        <button
          className={btn + (syncing ? " opacity-50 cursor-not-allowed" : "")}
          style={{ background: "rgba(8,15,30,0.82)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.08)" }}
          title="가격 데이터 갱신"
          onClick={handleSync}
          disabled={syncing}
        >{syncing ? "⏳" : "🔄"}</button>

        {syncMsg && (
          <div className={`absolute right-12 top-1/2 -translate-y-1/2 whitespace-nowrap
                           rounded-xl px-3 py-1.5 text-xs text-white shadow-xl
                           ${syncOk ? "bg-green-900/90" : "bg-red-900/90"}`}>
            {syncMsg}
          </div>
        )}
      </div>
    </div>
  );
}
