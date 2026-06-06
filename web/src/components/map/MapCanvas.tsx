"use client";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import Map, {
  Marker, Source, Layer, type MapMouseEvent, type MapRef,
} from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { useApp } from "@/lib/store";
import { getStores, getMapboxRoute } from "@/lib/api";
import type { Store } from "@/lib/types";
import PriceLayer from "./PriceLayer";
import type { MapLayerMouseEvent, GeoJSONSource } from "mapbox-gl";

type Tooltip = { name: string; address: string; desc?: string; x: number; y: number };

export default function MapCanvas({ priceLayerOn }: { priceLayerOn: boolean }) {
  const {
    lat, lng, radiusM, routePlans, routeChoice, setLoc,
    mapStyle, mapboxRoute, setMapboxRoute,
  } = useApp();
  const [stores, setStores]   = useState<Store[]>([]);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [fetchKey, setFetchKey] = useState(0);
  const mapRef = useRef<MapRef | null>(null);
  const isDark = mapStyle.includes("dark");

  // ── 상점 로드 (버그 수정: retry + 방어) ──────────────────────
  const loadStores = useCallback(async () => {
    try {
      const data = await getStores(lat, lng, radiusM);
      setStores(
        Array.isArray(data)
          ? data.filter((s) => s.lat && s.lng && !isNaN(s.lat) && !isNaN(s.lng))
          : []
      );
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

  // ── Mapbox 경로 계산 ─────────────────────────────────────────
  useEffect(() => {
    if (!routeChoice || !routePlans[routeChoice]) { setMapboxRoute(null); return; }
    const plan = routePlans[routeChoice];
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
    if (!token || !plan.stops.length) return;
    const waypoints: [number, number][] = plan.stops.map((s) => [s.lng, s.lat]);
    getMapboxRoute([lng, lat], waypoints, token).then((r) => setMapboxRoute(r));
  }, [routeChoice, routePlans, lat, lng, setMapboxRoute]);

  // ── GeoJSON ─────────────────────────────────────────────────
  const geojson = useMemo(() => ({
    type: "FeatureCollection" as const,
    features: stores.map((s) => ({
      type: "Feature" as const,
      properties: {
        id: s.id, name: s.name, type: s.type,
        gu: s.gu, address: s.address ?? "", desc: s.desc ?? "",
      },
      geometry: { type: "Point" as const, coordinates: [s.lng, s.lat] },
    })),
  }), [stores]);

  // ── 경로 geometry ─────────────────────────────────────────────
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

  const plan = routeChoice ? routePlans[routeChoice] : null;

  // 전략별 색상 (경로 라인 + 경유지 마커)
  const STRAT_COLOR: Record<string, string> = {
    최저예산: "#f5a623",   // 주황 — 💰 예산 절약
    최소거리: "#63b7ff",   // 파랑 — 📍 가까운 거리
    최소경유: "#4ade80",   // 초록 — 🧭 경유 최소
  };
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
  function handleClick(e: MapMouseEvent) {
    const map = mapRef.current;
    const feats = (e as unknown as MapLayerMouseEvent).features;
    const cl = feats?.find((f) => f.layer?.id === "clusters");
    if (cl && map) {
      const src = map.getSource("stores") as GeoJSONSource;
      // @ts-expect-error mapbox typing
      src.getClusterExpansionZoom(cl.properties?.cluster_id, (err: unknown, zoom: number) => {
        if (err) return;
        // @ts-expect-error geometry coords
        map.easeTo({ center: cl.geometry.coordinates, zoom });
      });
      return;
    }
    if (!feats?.length) setLoc(e.lngLat.lat, e.lngLat.lng);
  }

  return (
    <>
      <Map
        id="main"
        ref={mapRef}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{ longitude: lng, latitude: lat, zoom: 13 }}
        mapStyle={mapStyle}
        style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh" }}
        interactiveLayerIds={["clusters", "unclustered"]}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onLoad={() => setFetchKey((k) => k + 1)}
      >
        {/* 내 위치 — 사람 아이콘 */}
        <Marker longitude={lng} latitude={lat} anchor="center">
          <div style={{
            width: 38, height: 38,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(99,183,255,0.18)",
            borderRadius: "50%",
            border: "2.5px solid #63b7ff",
            boxShadow: "0 0 0 7px rgba(99,183,255,0.12)",
            fontSize: 22,
          }}>🚶</div>
        </Marker>

        <PriceLayer visible={priceLayerOn} />

        {/* 상점 — 원형 클러스터만 사용 */}
        <Source id="stores" type="geojson" data={geojson}
          cluster clusterMaxZoom={14} clusterRadius={50}>
          {/* 클러스터 원 */}
          <Layer id="clusters" type="circle" filter={["has", "point_count"]}
            paint={{
              "circle-color": [
                "step", ["get", "point_count"],
                "#4ade80", 10,
                "#63b7ff", 30,
                "#f5a623",
              ],
              "circle-opacity": 0.92,
              "circle-radius": ["step", ["get", "point_count"], 18, 10, 26, 30, 36],
              "circle-stroke-width": 3,
              "circle-stroke-color": [
                "step", ["get", "point_count"],
                "rgba(74,222,128,0.3)", 10,
                "rgba(99,183,255,0.3)", 30,
                "rgba(245,166,35,0.3)",
              ],
            }}
          />
          {/* 클러스터 숫자 */}
          <Layer id="cluster-count" type="symbol" filter={["has", "point_count"]}
            layout={{
              "text-field": ["get", "point_count_abbreviated"],
              "text-size": 13,
              "text-font": ["DIN Offc Pro Bold", "Arial Unicode MS Bold"],
            }}
            paint={{ "text-color": "#04101f" }}
          />
          {/* 개별 상점 */}
          <Layer id="unclustered" type="circle" filter={["!", ["has", "point_count"]]}
            paint={{
              "circle-color": ["match", ["get", "type"],
                "전통시장", "#63b7ff",
                "골목상권", "#4ade80",
                "동네식품점", "#f5a623",
                "대형유통", "#a882ff",
                "#888"],
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
            />
          </Source>
        )}

        {/* 경유지 번호 마커 */}
        {plan?.stops.map((s, i) => (
          <Marker key={`stop-${s.id}`} longitude={s.lng} latitude={s.lat} anchor="center">
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: routeColor, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, fontSize: 13,
              border: "2.5px solid #fff",
              boxShadow: "0 2px 6px rgba(0,0,0,.45)",
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
          {tooltip.desc && <p style={{ fontSize: 10, marginTop: 2, opacity: 0.5 }}>{tooltip.desc}</p>}
          {tooltip.address && <p style={{ fontSize: 11, marginTop: 4, opacity: 0.65, lineHeight: 1.4 }}>{tooltip.address}</p>}
        </div>
      )}

      {/* Mapbox 경로 뱃지 */}
      {mapboxRoute && plan && (
        <div style={{
          position: "fixed", bottom: 100, left: "50%", transform: "translateX(-50%)",
          zIndex: 600,
          background: "rgba(10,18,35,0.9)",
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
