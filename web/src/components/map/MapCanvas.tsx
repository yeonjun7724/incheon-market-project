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
    mapStyle, mapboxRoute, setMapboxRoute, allMapboxRoutes,
  } = useApp();
  const [stores, setStores]   = useState<Store[]>([]);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [fetchKey, setFetchKey] = useState(0);
  const mapRef = useRef<MapRef | null>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const dashOffsetRef = useRef(0);
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

  // 경로 이동 애니메이션 — 각 구간 위를 점이 흘러가는 효과
  const [animDots, setAnimDots] = useState<{ id: number; lng: number; lat: number; color: string }[]>([]);

  useEffect(() => {
    if (!plan) {
      setAnimDots([]);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }
    // routeSegments가 실제 경로 좌표 배열을 가짐 — 그 위를 따라 이동
    const SPEED = 0.005;
    // 구간마다 위상 다르게
    const phases = routeSegments.map((_, i) => i / Math.max(routeSegments.length, 1));

    function animate() {
      const dots = routeSegments.map((seg, i) => {
        phases[i] = (phases[i] + SPEED) % 1;
        const t = phases[i];
        const coords = seg.coords as [number, number][];
        // 전체 coords 중 t 비율 위치 보간
        const totalSeg = coords.length - 1;
        const pos = t * totalSeg;
        const idx = Math.min(Math.floor(pos), totalSeg - 1);
        const frac = pos - idx;
        const [x0, y0] = coords[idx];
        const [x1, y1] = coords[Math.min(idx + 1, totalSeg)];
        return {
          id: i,
          lng: x0 + (x1 - x0) * frac,
          lat: y0 + (y1 - y0) * frac,
          color: seg.color,
        };
      });
      setAnimDots(dots);
      animFrameRef.current = requestAnimationFrame(animate);
    }
    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      setAnimDots([]);
    };
  }, [plan, lat, lng]);

  // 전략별 색상 (경로 라인 + 경유지 마커)
  const STRAT_COLOR: Record<string, string> = {
    최저예산: "#e85d04",   // 오렌지레드
    최소거리: "#0077b6",   // 블루 (마커 색과 통일)
    최소경유: "#2d9e5f",   // 그린 (대형유통 마커 색과 통일)
  };
  const routeColor = routeChoice ? (STRAT_COLOR[routeChoice] ?? "#0077b6") : "#0077b6";

  // 구간별 색상 팔레트 (1→2 파랑, 2→3 오렌지, 3→4 그린, 4→5 퍼플...)
  const SEG_COLORS = ["#0077b6", "#e85d04", "#2d9e5f", "#7b2d8b", "#c1121f", "#f77f00"];

  // 선택된 경로를 구간별로 분리 — Mapbox geometry를 경유지 기준으로 쪼갬
  const routeSegments = useMemo(() => {
    if (!plan) return [];
    const mb = routeChoice ? allMapboxRoutes[routeChoice] : null;

    if (mb?.geometry?.coordinates?.length) {
      // Mapbox 실제 경로: 경유지 좌표와 가장 가까운 점으로 구간 분리
      const coords = mb.geometry.coordinates as [number, number][];
      const waypoints: [number, number][] = [
        [lng, lat],
        ...plan.stops.map((s: {lng: number; lat: number}) => [s.lng, s.lat] as [number, number]),
      ];

      // 각 경유지에서 가장 가까운 coords 인덱스 찾기
      const splitIdxs = waypoints.map((wp) => {
        let minDist = Infinity, idx = 0;
        coords.forEach(([cx, cy], i) => {
          const d = Math.hypot(cx - wp[0], cy - wp[1]);
          if (d < minDist) { minDist = d; idx = i; }
        });
        return idx;
      });

      return splitIdxs.slice(0, -1).map((startIdx, i) => ({
        id: i,
        color: SEG_COLORS[i % SEG_COLORS.length],
        coords: coords.slice(startIdx, splitIdxs[i + 1] + 1),
      })).filter(seg => seg.coords.length >= 2);
    }

    // fallback: 직선
    const points: [number, number][] = [[lng, lat], ...plan.stops.map((s: {lng: number; lat: number}) => [s.lng, s.lat] as [number, number])];
    return points.slice(0, -1).map((pt, i) => ({
      id: i,
      color: SEG_COLORS[i % SEG_COLORS.length],
      coords: [pt, points[i + 1]] as [number, number][],
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, routeChoice, allMapboxRoutes, lat, lng]);

  // 미선택 경로들 — Mapbox 실제 geometry 우선, 없으면 직선
  const unselectedRoutes = useMemo(() => {
    return Object.entries(routePlans)
      .filter(([key]) => key !== routeChoice)
      .map(([key, p]) => {
        const mb = allMapboxRoutes[key];
        return {
          key,
          color: STRAT_COLOR[key] ?? "#888",
          geoData: mb
            ? { type: "Feature" as const, geometry: mb.geometry, properties: {} }
            : {
                type: "Feature" as const,
                geometry: {
                  type: "LineString" as const,
                  coordinates: [[lng, lat], ...p.stops.map((s: {lng: number; lat: number}) => [s.lng, s.lat])],
                },
                properties: {},
              },
        };
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routePlans, routeChoice, allMapboxRoutes, lat, lng]);

  function handleMouseMove(e: MapMouseEvent) {
    const map = mapRef.current;
    if (!map) return;
    const feats = map.queryRenderedFeatures(e.point, { layers: ["unclustered", "unclustered-bg"] });
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
    }
  }

  function handleDblClick(e: MapMouseEvent) {
    e.preventDefault();
    setLoc(e.lngLat.lat, e.lngLat.lng);
  }

  // 모바일 더블탭 → 위치이동 (touchend 기반)
  function handleTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    const touch = e.changedTouches[0];
    if (!touch) return;
    const now = Date.now();
    const last = lastTapRef.current;
    if (last && now - last.time < 350 &&
        Math.abs(touch.clientX - last.x) < 30 &&
        Math.abs(touch.clientY - last.y) < 30) {
      // 더블탭 확인 → 지도 좌표로 변환
      const map = mapRef.current?.getMap();
      if (!map) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const lngLat = map.unproject([touch.clientX - rect.left, touch.clientY - rect.top]);
      setLoc(lngLat.lat, lngLat.lng);
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };
    }
  }

  return (
    <>
      <div
        style={{ position: "fixed", inset: 0 }}
        onTouchEnd={handleTouchEnd}
      >
      <Map
        id="main"
        ref={mapRef}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{ longitude: lng, latitude: lat, zoom: 13 }}
        mapStyle={mapStyle}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        interactiveLayerIds={["clusters", "cluster-ring", "unclustered-bg", "unclustered"]}
        onClick={handleClick}
        onDblClick={handleDblClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onLoad={(e) => {
          const map = e.target;
          // 업종별 SVG 마커 이미지 등록
          const MARKER_DEFS = [
            { id: "marker-market",   color: "#0077b6", symbol: "M" },  // 전통시장
            { id: "marker-alley",    color: "#f77f00", symbol: "G" },  // 골목상권
            { id: "marker-local",    color: "#7b2d8b", symbol: "N" },  // 동네식품점
            { id: "marker-mart",     color: "#2d9e5f", symbol: "S" },  // 대형유통
          ];
          MARKER_DEFS.forEach(({ id, color, symbol }) => {
            if (map.hasImage(id)) return;
            const size = 48;
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="21" fill="${color}" opacity="0.30"/>
              <circle cx="24" cy="24" r="15" fill="${color}"/>
              <circle cx="24" cy="24" r="15" fill="none" stroke="white" stroke-width="1.5"/>
              <text x="24" y="29" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="14" fill="white">${symbol}</text>
            </svg>`;
            const img = new Image(size, size);
            img.onload = () => { if (!map.hasImage(id)) map.addImage(id, img, { sdf: false }); };
            img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
          });
          setFetchKey((k) => k + 1);
        }}
      >
        {/* 내 위치 — 사람 아이콘 */}
        <Marker longitude={lng} latitude={lat} anchor="center">
          <div style={{
            width: 38, height: 38,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,119,182,0.15)",
            borderRadius: "50%",
            border: "2.5px solid #0077b6",
            boxShadow: "0 0 0 7px rgba(0,119,182,0.12)",
            fontSize: 22,
          }}>🚶</div>
        </Marker>

        <PriceLayer visible={priceLayerOn} />

        {/* 상점 — 도넛 클러스터 + 이모지 마커 */}
        <Source id="stores" type="geojson" data={geojson}
          cluster clusterMaxZoom={14} clusterRadius={50}>

          {/* ── 클러스터 ── */}
          {/* 헤일로 링 */}
          <Layer id="cluster-ring" type="circle" filter={["has", "point_count"]}
            paint={{
              "circle-color": "rgba(0,119,182,0.22)",
              "circle-radius": ["step", ["get", "point_count"], 30, 10, 39, 30, 50],
              "circle-stroke-width": 1,
              "circle-stroke-color": "rgba(0,119,182,0.45)",
            }}
          />
          {/* 채움 원 — 개수에 따라 밝은→진한 블루 */}
          <Layer id="clusters" type="circle" filter={["has", "point_count"]}
            paint={{
              "circle-color": [
                "step", ["get", "point_count"],
                "#0096c7", 5,
                "#0077b6", 10,
                "#03045e", 30,
                "#03045e",
              ],
              "circle-radius": ["step", ["get", "point_count"], 20, 5, 26, 10, 32, 30, 40],
              "circle-stroke-width": 3,
              "circle-stroke-color": "#ffffff",
            }}
          />
          {/* 숫자 레이블 */}
          <Layer id="cluster-count" type="symbol" filter={["has", "point_count"]}
            layout={{
              "text-field": ["get", "point_count_abbreviated"],
              "text-size": ["step", ["get", "point_count"], 13, 10, 15, 30, 17],
              "text-font": ["DIN Offc Pro Bold", "Arial Unicode MS Bold"],
              "text-allow-overlap": true,
            }}
            paint={{
              "text-color": "#ffffff",
              "text-halo-color": "rgba(0,0,0,0.20)",
              "text-halo-width": 1,
            }}
          />

          {/* ── 개별 마커 ── */}
          {/* 헤일로 (클러스터 링과 동일한 느낌) */}
          <Layer id="unclustered-shadow" type="circle" filter={["!", ["has", "point_count"]]}
            paint={{
              "circle-color": ["match", ["get", "type"],
                "전통시장",   "rgba(0,119,182,0.28)",
                "골목상권",   "rgba(247,127,0,0.28)",
                "동네식품점", "rgba(123,45,139,0.28)",
                "대형유통",   "rgba(45,158,95,0.28)",
                "rgba(80,80,80,0.25)"],
              "circle-radius": 16,
              "circle-stroke-width": 1,
              "circle-stroke-color": ["match", ["get", "type"],
                "전통시장",   "rgba(0,119,182,0.50)",
                "골목상권",   "rgba(247,127,0,0.50)",
                "동네식품점", "rgba(123,45,139,0.50)",
                "대형유통",   "rgba(45,158,95,0.50)",
                "rgba(80,80,80,0.40)"],
            }}
          />
          {/* 마커 본체 — SVG 이미지 (M/G/N/S 알파벳으로 업종 표시) */}
          <Layer id="unclustered-bg" type="symbol" filter={["!", ["has", "point_count"]]}
            layout={{
              "icon-image": ["match", ["get", "type"],
                "전통시장",   "marker-market",
                "골목상권",   "marker-alley",
                "동네식품점", "marker-local",
                "대형유통",   "marker-mart",
                "marker-market"],
              "icon-size": 0.65,
              "icon-allow-overlap": true,
              "icon-ignore-placement": true,
            }}
          />
          {/* 인터랙션용 히트 영역 (투명) */}
          <Layer id="unclustered" type="circle" filter={["!", ["has", "point_count"]]}
            paint={{
              "circle-color": "rgba(0,0,0,0)",
              "circle-radius": 18,
            }}
          />
        </Source>

        {/* 미선택 경로 — 흐린 점선 */}
        {unselectedRoutes.map(({ key, color, geoData }) => (
          <Source key={`route-bg-${key}`} id={`route-bg-${key}`} type="geojson" data={geoData}>
            <Layer id={`route-bg-line-${key}`} type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{
                "line-color": color,
                "line-width": 3,
                "line-opacity": 0.45,
                "line-dasharray": [2, 3],
              }}
            />
          </Source>
        ))}

        {/* 선택된 경로 — 구간별 다른 색, 외곽선 효과 */}
        {routeSegments.map(({ id, color, coords }) => coords.length >= 2 ? (
          <Source key={`seg-${id}`} id={`seg-${id}`} type="geojson" data={{
            type: "Feature" as const,
            geometry: { type: "LineString" as const, coordinates: coords },
            properties: {},
          }}>
            {/* 흰 외곽선 — 지도 배경과 분리 */}
            <Layer id={`seg-line-outline-${id}`} type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{
                "line-color": "#ffffff",
                "line-width": 9,
                "line-opacity": 0.85,
              }}
            />
            {/* 색상 라인 */}
            <Layer id={`seg-line-${id}`} type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{
                "line-color": color,
                "line-width": 6,
                "line-opacity": 1,
              }}
            />
          </Source>
        ) : null)}

        {/* 경유지 번호 마커 — 구간 색과 동일 */}
        {plan?.stops.map((s, i) => (
          <Marker key={`stop-${s.id}`} longitude={s.lng} latitude={s.lat} anchor="center">
            <div style={{
              width: 30, height: 30, borderRadius: "50%",
              background: SEG_COLORS[i % SEG_COLORS.length], color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, fontSize: 13,
              border: "2.5px solid #fff",
              boxShadow: "0 2px 8px rgba(0,0,0,.35)",
            }}>{i + 1}</div>
          </Marker>
        ))}

        {/* 이동 애니메이션 점 — 각 구간 위를 흘러감 */}
        {animDots.map(({ id, lng: dLng, lat: dLat, color }) => (
          <Marker key={`dot-${id}`} longitude={dLng} latitude={dLat} anchor="center">
            <div style={{
              width: 12, height: 12, borderRadius: "50%",
              background: color,
              border: "2px solid #fff",
              boxShadow: `0 0 6px ${color}aa`,
              pointerEvents: "none",
            }} />
          </Marker>
        ))}
      </Map>

      {/* 툴팁 */}
      {tooltip && (
        <div style={{
          position: "fixed", left: tooltip.x + 14, top: tooltip.y - 10,
          pointerEvents: "none", zIndex: 999, padding: "8px 12px",
          borderRadius: 8, maxWidth: 220,
          border: "1px solid rgba(26,34,51,0.12)",
          background: "#fff",
          color: "#1a2233",
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
          background: "rgba(255,255,255,0.96)",
          border: "1px solid rgba(26,34,51,0.12)",
          borderRadius: 20, padding: "6px 18px",
          display: "flex", gap: 16,
          backdropFilter: "blur(12px)", color: "#1a2233", fontSize: 12,
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
