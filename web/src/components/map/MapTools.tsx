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
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  function goMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLoc(latitude, longitude);
        main?.flyTo({ center: [longitude, latitude], zoom: 14, duration: 800 });
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
    setSyncResult(null);
    try {
      const res = await fetch(`${BASE}/admin/sync-prices`, { method: "POST" });
      const data = await res.json();
      setSyncResult(data.ok ? `✅ ${data.rows}행 갱신` : `❌ ${data.error}`);
    } catch {
      setSyncResult("❌ 연결 실패");
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(null), 3000);
    }
  }

  const btn = "flex h-11 w-11 items-center justify-center rounded-xl glass text-[18px] " +
              "text-ink1 shadow-lg transition hover:bg-white/10";
  const btnActive = btn + " ring-2 ring-yellow-400";

  return (
    <div className="fixed right-4 top-1/2 z-[1000] flex -translate-y-1/2 flex-col gap-2">
      <button className={btn} title="현위치" onClick={goMyLocation}>◎</button>
      <button className={btn} title="자주 가는 가게 / 즐겨찾기" onClick={() => setPanel("favorites")}>📌</button>
      <button className={btn} title="지도 스타일 전환" onClick={toggleMapStyle}>🗂</button>
      <button className={btn} title="인천 전체 보기" onClick={fitIncheon}>⛶</button>
      <button
        className={priceLayerOn ? btnActive : btn}
        title="가격 히트맵 ON/OFF"
        onClick={onTogglePriceLayer}
      >💰</button>
      <a
        href={`${BASE}/admin/prices/download-zip`}
        download="daily_prices.zip"
        className={btn}
        title="가격 데이터 ZIP 다운로드"
      >⬇︎</a>

      {/* 가격 데이터 수동 갱신 */}
      <div className="relative">
        <button
          className={btn + (syncing ? " opacity-60 cursor-not-allowed" : "")}
          title="가격 데이터 갱신"
          onClick={handleSync}
          disabled={syncing}
        >
          {syncing ? "⏳" : "🔄"}
        </button>
        {syncResult && (
          <div className="absolute right-14 top-1/2 -translate-y-1/2 whitespace-nowrap
                          rounded-lg bg-black/80 px-3 py-1.5 text-xs text-white shadow-lg">
            {syncResult}
          </div>
        )}
      </div>
    </div>
  );
}
