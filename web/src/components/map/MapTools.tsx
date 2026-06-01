"use client";
import { useMap } from "react-map-gl/mapbox";
import { useApp } from "@/lib/store";

// 인천 대략 bounds (남서, 북동)
const INCHEON_BOUNDS: [[number, number], [number, number]] = [
  [126.37, 37.38],
  [126.78, 37.58],
];

export function MapTools() {
  const { main } = useMap();
  const { setLoc, setPanel, toggleMapStyle } = useApp();

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

  const btn = "flex h-11 w-11 items-center justify-center rounded-xl glass text-[18px] " +
              "text-ink1 shadow-lg transition hover:bg-white/10";

  return (
    <div className="fixed right-4 top-1/2 z-[1000] flex -translate-y-1/2 flex-col gap-2">
      <button className={btn} title="현위치" onClick={goMyLocation}>◎</button>
      <button className={btn} title="자주 가는 가게 / 즐겨찾기" onClick={() => setPanel("favorites")}>📌</button>
      <button className={btn} title="지도 스타일 전환" onClick={toggleMapStyle}>🗂</button>
      <button className={btn} title="인천 전체 보기" onClick={fitIncheon}>⛶</button>
    </div>
  );
}
