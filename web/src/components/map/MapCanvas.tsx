"use client";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import Map, { Marker, Source, Layer, type MapMouseEvent, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { useApp } from "@/lib/store";
import { getStores } from "@/lib/api";
import type { Store } from "@/lib/types";
import PriceLayer from "./PriceLayer";
import type { GeoJSONSource } from "maplibre-gl";

type Tooltip = { name: string; address: string; desc?: string; x: number; y: number };

const STRAT_COLOR: Record<string, string> = {
  최저예산: "#f5a623",
  최소거리: "#63b7ff",
  최소경유: "#4ade80",
};
const STOP_PALETTE = ["#f5a623", "#a855f7", "#ec4899", "#14b8a6", "#f97316", "#eab308", "#ef4444", "#06b6d4"];

export default function MapCanvas({ priceLayerOn }: { priceLayerOn: boolean }) {
  const {
    lat, lng, radiusM, routePlans, routeChoice, mapboxRoute, mapStyle,
    setMapboxRoute, setSelectedStore, setLoc,
  } = useApp();

  const mapRef      = useRef<MapRef | null>(null);
  const gpsReadyRef = useRef<{ lat: number; lng: number } | null>(null);
  const [stores, setStores]     = useState<Store[]>([]);
  const [tooltip, setTooltip]   = useState<Tooltip | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const isDark = mapStyle.includes("dark") || mapStyle.includes("night");

  const loadStores = useCallback(async () => {
    try {
      const data = await getStores(lat, lng, radiusM);
      setStores(Array.isArray(data) ? data.filter((s) => s.lat && s.lng && !isNaN(s.lat) && !isNaN(s.lng)) : []);
    } catch {
      setTimeout(async () => {
        try {
          const retry = await getStores(lat, lng, radiusM);
          setStores(Array.isArray(retry) ? retry.filter((s) => s.lat && s.lng) : []);
        } catch { setStores([]); }
      }, 3000);
    }
  }, [lat, lng, radiusM]);

  useEffect(() => { loadStores(); }, [loadStores, fetchKey]);

  // GPS 초기화
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLoc(latitude, longitude);
        gpsReadyRef.current = { lat: latitude, lng: longitude };
        mapRef.current?.flyTo({ center: [longitude, latitude], zoom: 14, duration: 1000 });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 경로 GeoJSON (mapboxRoute 또는 직선)
  const routeGeoData = useMemo(() => {
    if (mapboxRoute) return { type: "Feature" as const, geometry: mapboxRoute.geometry, properties: {} };
    const plan = routeChoice ? routePlans[routeChoice] : null;
    if (!plan) return null;
    return {
      type: "Feature" as const,
      geometry: {
        type: "LineString" as const,
        coordinates: [[lng, lat], ...plan.stops.map((s) => [s.lng, s.lat])],
      },
      properties: {},
    };
  }, [mapboxRoute, routeChoice, routePlans, lat, lng]);

  const geojson = useMemo(() => ({
    type: "FeatureCollection" as const,
    features: stores.map((s) => ({
      type: "Feature" as const,
      properties: { id: s.id, name: s.name, type: s.type, gu: s.gu, address: s.address ?? "", desc: s.desc ?? "" },
      geometry: { type: "Point" as const, coordinates: [s.lng, s.lat] },
    })),
  }), [stores]);

  const plan       = routeChoice ? routePlans[routeChoice] : null;
  const routeColor = routeChoice ? (STRAT_COLOR[routeChoice] ?? "#ff5470") : "#ff5470";

  function handleMouseMove(e: MapMouseEvent) {
    const map = mapRef.current;
    if (!map) return;
    const feats = map.queryRenderedFeatures(e.point, { layers: ["unclustered"] });
    if (feats.length > 0) {
      const f = feats[0];
      setTooltip({ name: f.properties?.name ?? "", address: f.properties?.address ?? "",
        desc: f.properties?.desc ?? "", x: e.point.x, y: e.point.y });
      map.getCanvas().style.cursor = "pointer";
    } else {
      setTooltip(null);
      map.getCanvas().style.cursor = "";
    }
  }

  function handleMouseLeave() {
    setTooltip(null);
    if (mapRef.current) mapRef.current.getCanvas().style.cursor = "";
  }

  async function handleClick(e: MapMouseEvent) {
    const map = mapRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const feats = (e as any).features as any[] | undefined;

    // 클러스터 클릭 → 줌인
    const cl = feats?.find((f) => f.layer?.id === "clusters");
    if (cl && map) {
      const src = map.getSource("stores") as GeoJSONSource;
      try {
        const zoom = await src.getClusterExpansionZoom(cl.properties?.cluster_id);
        map.easeTo({ center: (cl.geometry as { coordinates: [number, number] }).coordinates, zoom });
      } catch { /* ignore */ }
      return;
    }

    // 개별 마커 클릭 → StoreInfoCard
    const marker = feats?.find((f) => f.layer?.id === "unclustered");
    if (marker) {
      const storeId = marker.properties?.id;
      const store = stores.find((s) => s.id === storeId);
      if (store) setSelectedStore(store);
      return;
    }

    // 빈 지도 클릭 → 아무것도 안 함 (위치 변경 X)
  }

  return (
    <>
      <Map
        id="main"
        ref={mapRef}
        initialViewState={{ longitude: lng, latitude: lat, zoom: 13 }}
        mapStyle={mapStyle}
        style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh" }}
        interactiveLayerIds={["clusters", "unclustered"]}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onLoad={() => {
          setFetchKey((k) => k + 1);
          if (gpsReadyRef.current) {
            mapRef.current?.flyTo({ center: [gpsReadyRef.current.lng, gpsReadyRef.current.lat], zoom: 14 });
          }
        }}
        attributionControl={false}
      >
        {/* 내 위치 */}
        <Marker longitude={lng} latitude={lat} anchor="center">
          <div style={{
            width: 38, height: 38,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(99,183,255,0.18)", borderRadius: "50%",
            border: "2.5px solid #63b7ff", boxShadow: "0 0 0 7px rgba(99,183,255,0.12)",
            fontSize: 22,
          }}>🚶</div>
        </Marker>

        <PriceLayer visible={priceLayerOn} />

        {/* 상점 클러스터 */}
        <Source id="stores" type="geojson" data={geojson} cluster clusterMaxZoom={14} clusterRadius={50}>
          <Layer id="clusters" type="circle" filter={["has", "point_count"]}
            paint={{
              "circle-color": ["step", ["get", "point_count"], "#4ade80", 10, "#63b7ff", 30, "#f5a623"],
              "circle-opacity": 0.92,
              "circle-radius": ["step", ["get", "point_count"], 18, 10, 26, 30, 36],
              "circle-stroke-width": 3,
              "circle-stroke-color": ["step", ["get", "point_count"],
                "rgba(74,222,128,0.3)", 10, "rgba(99,183,255,0.3)", 30, "rgba(245,166,35,0.3)"],
            }}
          />
          <Layer id="cluster-count" type="symbol" filter={["has", "point_count"]}
            layout={{
              "text-field": ["get", "point_count_abbreviated"],
              "text-size": 13,
              "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
            }}
            paint={{ "text-color": "#04101f" }}
          />
          <Layer id="unclustered" type="circle" filter={["!", ["has", "point_count"]]}
            paint={{
              "circle-color": ["match", ["get", "type"],
                "전통시장", "#63b7ff", "골목상권", "#4ade80",
                "동네식품점", "#f5a623", "대형유통", "#a882ff", "#888"],
              "circle-radius": 7,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#fff",
            }}
          />
        </Source>

        {/* 경로 라인 */}
        {routeGeoData && (
          <Source id="route" type="geojson" data={routeGeoData}>
            <Layer id="route-line" type="line"
              paint={{
                "line-color": routeColor, "line-width": 5, "line-opacity": 0.88,
                "line-dasharray": mapboxRoute ? [1] : [2, 2],
              }}
              layout={{ "line-cap": "round", "line-join": "round" }}
            />
          </Source>
        )}

        {/* 경유지 번호 마커 */}
        {plan?.stops.map((s, i) => (
          <Marker key={`stop-${s.id}`} longitude={s.lng} latitude={s.lat} anchor="center">
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: STOP_PALETTE[i % STOP_PALETTE.length], color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, fontSize: 13,
              border: "2.5px solid #fff", boxShadow: "0 2px 6px rgba(0,0,0,.45)",
            }}>{i + 1}</div>
          </Marker>
        ))}
      </Map>

      {/* 툴팁 */}
      {tooltip && (
        <div style={{
          position: "fixed", left: tooltip.x + 14, top: tooltip.y - 10,
          pointerEvents: "none", zIndex: 999, padding: "8px 12px",
          borderRadius: 8, maxWidth: 220,
          border: isDark ? "1px solid rgba(255,255,255,0.13)" : "1px solid #ddd",
          background: isDark ? "#111827" : "#fff",
          color: isDark ? "#fff" : "#000",
          boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
        }}>
          <p style={{ fontWeight: 700, fontSize: 13, margin: 0 }}>{tooltip.name}</p>
          {tooltip.desc    && <p style={{ fontSize: 10, marginTop: 2, opacity: 0.5 }}>{tooltip.desc}</p>}
          {tooltip.address && <p style={{ fontSize: 11, marginTop: 4, opacity: 0.65, lineHeight: 1.4 }}>{tooltip.address}</p>}
        </div>
      )}

      {/* 경로 정보 뱃지 */}
      {mapboxRoute && plan && (
        <div style={{
          position: "fixed", bottom: 100, left: "50%", transform: "translateX(-50%)",
          zIndex: 600, background: "rgba(10,18,35,0.9)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 20, padding: "6px 18px",
          display: "flex", gap: 16,
          backdropFilter: "blur(12px)", color: "#fff", fontSize: 12,
        }}>
          <span>🗺️ <b>{(mapboxRoute.distance_m / 1000).toFixed(1)}km</b></span>
          <span>🚶 <b>{Math.round(mapboxRoute.duration_s / 60)}분</b></span>
          <span>🛒 구입 <b>{plan.n_stops * 10}분</b></span>
          <span>⏱ <b>{Math.round(mapboxRoute.duration_s / 60) + plan.n_stops * 10}분</b></span>
        </div>
      )}
    </>
  );
}
