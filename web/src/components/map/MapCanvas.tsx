"use client";
import { useEffect, useState } from "react";
import Map, { Marker, Source, Layer, type MapMouseEvent } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { useApp } from "@/lib/store";
import { getStores } from "@/lib/api";
import type { Store } from "@/lib/types";

const TYPE_COLOR: Record<string, string> = {
  전통시장: "#63b7ff",
  골목상권: "#4ade80",
  동네식품점: "#f5a623",
  대형유통: "#a882ff",
};

export default function MapCanvas() {
  const { lat, lng, radiusM, routePlans, routeChoice, setLoc } = useApp();
  const [stores, setStores] = useState<Store[]>([]);

  useEffect(() => {
    getStores(lat, lng, radiusM).then(setStores).catch(console.error);
  }, [lat, lng, radiusM]);

  const plan = routeChoice ? routePlans[routeChoice] : null;
  const routeGeo = plan && {
    type: "Feature" as const,
    geometry: {
      type: "LineString" as const,
      coordinates: [[lng, lat], ...plan.stops.map((s) => [s.lng, s.lat])],
    },
    properties: {},
  };

  return (
    <Map
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
      initialViewState={{ longitude: lng, latitude: lat, zoom: 12 }}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh" }}
      onClick={(e: MapMouseEvent) => setLoc(e.lngLat.lat, e.lngLat.lng)}
    >
      {/* 내 위치 */}
      <Marker longitude={lng} latitude={lat} anchor="center">
        <div style={{ fontSize: 26 }}>📍</div>
      </Marker>

      {/* 상점 마커 */}
      {stores.map((s) => (
        <Marker key={s.id} longitude={s.lng} latitude={s.lat} anchor="bottom">
          <div title={`${s.name} · ${s.gu}`} style={{
            width: 16, height: 16, borderRadius: "50% 50% 50% 0",
            transform: "rotate(-45deg)",
            background: TYPE_COLOR[s.type] ?? "#888",
            border: "2px solid #fff", boxShadow: "0 2px 6px rgba(0,0,0,.5)",
          }} />
        </Marker>
      ))}

      {/* 추천 경로 */}
      {routeGeo && (
        <Source id="route" type="geojson" data={routeGeo}>
          <Layer id="route-line" type="line"
            paint={{ "line-color": "#ff5470", "line-width": 5, "line-opacity": 0.85 }} />
        </Source>
      )}
      {plan?.stops.map((s, i) => (
        <Marker key={`stop-${s.id}`} longitude={s.lng} latitude={s.lat} anchor="center">
          <div style={{
            width: 26, height: 26, borderRadius: "50%", background: "#ff5470",
            color: "#fff", display: "flex", alignItems: "center",
            justifyContent: "center", fontWeight: 800, fontSize: 13,
            border: "2px solid #fff",
          }}>{i + 1}</div>
        </Marker>
      ))}
    </Map>
  );
}
