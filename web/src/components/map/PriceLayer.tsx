"use client";
import { useEffect, useState } from "react";
import { Source, Layer } from "react-map-gl/maplibre";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export default function PriceLayer({ visible }: { visible: boolean }) {
  const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    if (!visible) return;
    fetch(`${BASE}/admin/prices/geojson`)
      .then((r) => r.json())
      .then(setGeojson)
      .catch(console.error);
  }, [visible]);

  if (!visible || !geojson) return null;

  return (
    <Source id="prices" type="geojson" data={geojson}>
      {/* 히트맵 — 가격 밀도 */}
      <Layer
        id="price-heat"
        type="heatmap"
        paint={{
          "heatmap-weight": ["interpolate", ["linear"], ["get", "평균가"], 0, 0, 50000, 1],
          "heatmap-intensity": 1.2,
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0,   "rgba(0,0,255,0)",
            0.3, "#00c6ff",
            0.6, "#48ff82",
            0.9, "#ffe600",
            1,   "#ff3b00",
          ],
          "heatmap-radius": 28,
          "heatmap-opacity": 0.72,
        }}
      />
      {/* 개별 마커 (줌 13 이상) */}
      <Layer
        id="price-point"
        type="circle"
        minzoom={13}
        paint={{
          "circle-radius": 6,
          "circle-color": "#ffe600",
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#fff",
          "circle-opacity": 0.9,
        }}
      />
    </Source>
  );
}
