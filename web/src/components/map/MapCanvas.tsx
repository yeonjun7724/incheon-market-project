"use client";

import {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
  type TouchEvent,
} from "react";
import Map, {
  Marker,
  Source,
  Layer,
  type MapMouseEvent,
  type MapRef,
} from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { useApp } from "@/lib/store";
import { getStores, getMapboxRoute } from "@/lib/api";
import type { Store } from "@/lib/types";
import PriceLayer from "./PriceLayer";
import type { MapLayerMouseEvent, GeoJSONSource } from "mapbox-gl";

type Tooltip = {
  name: string;
  address: string;
  desc?: string;
  x: number;
  y: number;
};

export default function MapCanvas({ priceLayerOn }: { priceLayerOn: boolean }) {
  const {
    lat,
    lng,
    radiusM,
    routePlans,
    routeChoice,
    setLoc,
    mapStyle,
    mapboxRoute,
    setMapboxRoute,
    allMapboxRoutes,
    travelMode,
    setTravelMode,
  } = useApp();

  const [stores, setStores] = useState<Store[]>([]);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [fetchKey, setFetchKey] = useState(0);
  const [animDots, setAnimDots] = useState<
    { id: number; lng: number; lat: number; color: string }[]
  >([]);

  const mapRef = useRef<MapRef | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const plan = routeChoice ? routePlans[routeChoice] : null;

  const STRAT_COLOR: Record<string, string> = {
    최저예산: "#e85d04",
    최소거리: "#0077b6",
    최소경유: "#2d9e5f",
  };

  const SEG_COLORS = [
    "#0077b6",
    "#e85d04",
    "#2d9e5f",
    "#7b2d8b",
    "#c1121f",
    "#f77f00",
  ];

  const loadStores = useCallback(async () => {
    try {
      const data = await getStores(lat, lng, radiusM);

      setStores(
        Array.isArray(data)
          ? data.filter(
              (s) =>
                s.lat &&
                s.lng &&
                !Number.isNaN(s.lat) &&
                !Number.isNaN(s.lng)
            )
          : []
      );
    } catch {
      setTimeout(async () => {
        try {
          const retry = await getStores(lat, lng, radiusM);
          setStores(
            Array.isArray(retry)
              ? retry.filter((s) => s.lat && s.lng)
              : []
          );
        } catch {
          setStores([]);
        }
      }, 3000);
    }
  }, [lat, lng, radiusM]);

  useEffect(() => {
    loadStores();
  }, [loadStores, fetchKey]);

  useEffect(() => {
    if (!routeChoice || !routePlans[routeChoice]) {
      setMapboxRoute(null);
      return;
    }

    const currentPlan = routePlans[routeChoice];
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

    if (!token || !currentPlan.stops.length) return;

    const waypoints: [number, number][] = currentPlan.stops.map((s) => [
      s.lng,
      s.lat,
    ]);

    getMapboxRoute([lng, lat], waypoints, token, travelMode).then((r) =>
      setMapboxRoute(r)
    );
  }, [routeChoice, routePlans, lat, lng, setMapboxRoute, travelMode]);

  const geojson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: stores.map((s) => ({
        type: "Feature" as const,
        properties: {
          id: s.id,
          name: s.name,
          type: s.type,
          gu: s.gu,
          address: s.address ?? "",
          desc: s.desc ?? "",
        },
        geometry: {
          type: "Point" as const,
          coordinates: [s.lng, s.lat],
        },
      })),
    }),
    [stores]
  );

  const routeSegments = useMemo(() => {
    if (!plan) return [];

    const mb = routeChoice ? allMapboxRoutes[routeChoice] : null;

    if (mb?.geometry?.coordinates?.length) {
      const coords = mb.geometry.coordinates as [number, number][];

      const waypoints: [number, number][] = [
        [lng, lat],
        ...plan.stops.map(
          (s: { lng: number; lat: number }) =>
            [s.lng, s.lat] as [number, number]
        ),
      ];

      const splitIdxs = waypoints.map((wp) => {
        let minDist = Infinity;
        let idx = 0;

        coords.forEach(([cx, cy], i) => {
          const d = Math.hypot(cx - wp[0], cy - wp[1]);
          if (d < minDist) {
            minDist = d;
            idx = i;
          }
        });

        return idx;
      });

      return splitIdxs
        .slice(0, -1)
        .map((startIdx, i) => ({
          id: i,
          color: SEG_COLORS[i % SEG_COLORS.length],
          coords: coords.slice(startIdx, splitIdxs[i + 1] + 1),
        }))
        .filter((seg) => seg.coords.length >= 2);
    }

    const points: [number, number][] = [
      [lng, lat],
      ...plan.stops.map(
        (s: { lng: number; lat: number }) =>
          [s.lng, s.lat] as [number, number]
      ),
    ];

    return points.slice(0, -1).map((pt, i) => ({
      id: i,
      color: SEG_COLORS[i % SEG_COLORS.length],
      coords: [pt, points[i + 1]] as [number, number][],
    }));
  }, [plan, routeChoice, allMapboxRoutes, lat, lng]);

  const unselectedRoutes = useMemo(() => {
    return Object.entries(routePlans)
      .filter(([key]) => key !== routeChoice)
      .map(([key, p]) => {
        const mb = allMapboxRoutes[key];

        return {
          key,
          color: STRAT_COLOR[key] ?? "#888",
          geoData: mb
            ? {
                type: "Feature" as const,
                geometry: mb.geometry,
                properties: {},
              }
            : {
                type: "Feature" as const,
                geometry: {
                  type: "LineString" as const,
                  coordinates: [
                    [lng, lat],
                    ...p.stops.map(
                      (s: { lng: number; lat: number }) => [s.lng, s.lat]
                    ),
                  ],
                },
                properties: {},
              },
        };
      });
  }, [routePlans, routeChoice, allMapboxRoutes, lat, lng]);

  useEffect(() => {
    if (!plan || routeSegments.length === 0) {
      setAnimDots([]);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const speed = 0.005;
    const phases = routeSegments.map(
      (_, i) => i / Math.max(routeSegments.length, 1)
    );

    function animate() {
      const dots = routeSegments.map((seg, i) => {
        phases[i] = (phases[i] + speed) % 1;

        const t = phases[i];
        const coords = seg.coords as [number, number][];
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
  }, [plan, routeSegments]);

  function handleMouseMove(e: MapMouseEvent) {
    const map = mapRef.current;
    if (!map) return;

    const feats = map.queryRenderedFeatures(e.point, {
      layers: ["unclustered", "unclustered-bg"],
    });

    if (feats.length > 0) {
      const f = feats[0];

      setTooltip({
        name: f.properties?.name ?? "",
        address: f.properties?.address ?? "",
        desc: f.properties?.desc ?? "",
        x: e.point.x,
        y: e.point.y,
      });

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
      src.getClusterExpansionZoom(
        cl.properties?.cluster_id,
        (err: unknown, zoom: number) => {
          if (err) return;

          // @ts-expect-error geometry coords
          map.easeTo({ center: cl.geometry.coordinates, zoom });
        }
      );
    }
  }

  function handleDblClick(e: MapMouseEvent) {
    e.preventDefault();
    setLoc(e.lngLat.lat, e.lngLat.lng);
  }

  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    const touch = e.touches[0];
    if (!touch) return;

    longPressStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
    };

    longPressTimerRef.current = setTimeout(() => {
      const map = mapRef.current?.getMap();
      const start = longPressStartRef.current;

      if (!map || !start) return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const lngLat = map.unproject([start.x - rect.left, start.y - rect.top]);

      if (navigator.vibrate) navigator.vibrate(40);

      setLoc(lngLat.lat, lngLat.lng);
    }, 600);
  }

  function handleTouchEnd() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    longPressStartRef.current = null;
  }

  function handleTouchMove(e: TouchEvent<HTMLDivElement>) {
    const touch = e.touches[0];
    const start = longPressStartRef.current;

    if (!touch || !start) return;

    if (
      Math.abs(touch.clientX - start.x) > 10 ||
      Math.abs(touch.clientY - start.y) > 10
    ) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  }

  return (
    <>
      <div
        style={{ position: "fixed", inset: 0 }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
      >
        <Map
          id="main"
          ref={mapRef}
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
          initialViewState={{ longitude: lng, latitude: lat, zoom: 13 }}
          mapStyle={mapStyle}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
          }}
          interactiveLayerIds={[
            "clusters",
            "cluster-ring",
            "unclustered-bg",
            "unclustered",
          ]}
          onClick={handleClick}
          onDblClick={handleDblClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onLoad={(e) => {
            const map = e.target;

            const MARKER_DEFS = [
              { id: "marker-market", color: "#0077b6", symbol: "M" },
              { id: "marker-alley", color: "#f77f00", symbol: "G" },
              { id: "marker-local", color: "#7b2d8b", symbol: "N" },
              { id: "marker-mart", color: "#2d9e5f", symbol: "S" },
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

              img.onload = () => {
                if (!map.hasImage(id)) map.addImage(id, img, { sdf: false });
              };

              img.src =
                "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
            });

            setFetchKey((k) => k + 1);
          }}
        >
          <Marker longitude={lng} latitude={lat} anchor="center">
            <div
              style={{
                width: 38,
                height: 38,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0,119,182,0.15)",
                borderRadius: "50%",
                border: "2.5px solid #0077b6",
                boxShadow: "0 0 0 7px rgba(0,119,182,0.12)",
                fontSize: 22,
              }}
            >
              🚶
            </div>
          </Marker>

          <PriceLayer visible={priceLayerOn} />

          <Source
            id="stores"
            type="geojson"
            data={geojson}
            cluster
            clusterMaxZoom={14}
            clusterRadius={50}
          >
            <Layer
              id="cluster-ring"
              type="circle"
              filter={["has", "point_count"]}
              paint={{
                "circle-color": "rgba(0,119,182,0.22)",
                "circle-radius": [
                  "step",
                  ["get", "point_count"],
                  30,
                  10,
                  39,
                  30,
                  50,
                ],
                "circle-stroke-width": 1,
                "circle-stroke-color": "rgba(0,119,182,0.45)",
              }}
            />

            <Layer
              id="clusters"
              type="circle"
              filter={["has", "point_count"]}
              paint={{
                "circle-color": [
                  "step",
                  ["get", "point_count"],
                  "#0096c7",
                  5,
                  "#0077b6",
                  10,
                  "#03045e",
                  30,
                  "#03045e",
                ],
                "circle-radius": [
                  "step",
                  ["get", "point_count"],
                  20,
                  5,
                  26,
                  10,
                  32,
                  30,
                  40,
                ],
                "circle-stroke-width": 3,
                "circle-stroke-color": "#ffffff",
              }}
            />

            <Layer
              id="cluster-count"
              type="symbol"
              filter={["has", "point_count"]}
              layout={{
                "text-field": ["get", "point_count_abbreviated"],
                "text-size": [
                  "step",
                  ["get", "point_count"],
                  13,
                  10,
                  15,
                  30,
                  17,
                ],
                "text-font": ["DIN Offc Pro Bold", "Arial Unicode MS Bold"],
                "text-allow-overlap": true,
              }}
              paint={{
                "text-color": "#ffffff",
                "text-halo-color": "rgba(0,0,0,0.20)",
                "text-halo-width": 1,
              }}
            />

            <Layer
              id="unclustered-shadow"
              type="circle"
              filter={["!", ["has", "point_count"]]}
              paint={{
                "circle-color": [
                  "match",
                  ["get", "type"],
                  "전통시장",
                  "rgba(0,119,182,0.28)",
                  "골목상권",
                  "rgba(247,127,0,0.28)",
                  "동네식품점",
                  "rgba(123,45,139,0.28)",
                  "대형유통",
                  "rgba(45,158,95,0.28)",
                  "rgba(80,80,80,0.25)",
                ],
                "circle-radius": 16,
                "circle-stroke-width": 1,
                "circle-stroke-color": [
                  "match",
                  ["get", "type"],
                  "전통시장",
                  "rgba(0,119,182,0.50)",
                  "골목상권",
                  "rgba(247,127,0,0.50)",
                  "동네식품점",
                  "rgba(123,45,139,0.50)",
                  "대형유통",
                  "rgba(45,158,95,0.50)",
                  "rgba(80,80,80,0.40)",
                ],
              }}
            />

            <Layer
              id="unclustered-bg"
              type="symbol"
              filter={["!", ["has", "point_count"]]}
              layout={{
                "icon-image": [
                  "match",
                  ["get", "type"],
                  "전통시장",
                  "marker-market",
                  "골목상권",
                  "marker-alley",
                  "동네식품점",
                  "marker-local",
                  "대형유통",
                  "marker-mart",
                  "marker-market",
                ],
                "icon-size": 0.65,
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
              }}
            />

            <Layer
              id="unclustered"
              type="circle"
              filter={["!", ["has", "point_count"]]}
              paint={{
                "circle-color": "rgba(0,0,0,0)",
                "circle-radius": 18,
              }}
            />
          </Source>

          {unselectedRoutes.map(({ key, color, geoData }) => (
            <Source
              key={`route-bg-${key}`}
              id={`route-bg-${key}`}
              type="geojson"
              data={geoData}
            >
              <Layer
                id={`route-bg-line-${key}`}
                type="line"
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

          {routeSegments.map(({ id, color, coords }) =>
            coords.length >= 2 ? (
              <Source
                key={`seg-${id}`}
                id={`seg-${id}`}
                type="geojson"
                data={{
                  type: "Feature" as const,
                  geometry: {
                    type: "LineString" as const,
                    coordinates: coords,
                  },
                  properties: {},
                }}
              >
                <Layer
                  id={`seg-line-outline-${id}`}
                  type="line"
                  layout={{ "line-cap": "round", "line-join": "round" }}
                  paint={{
                    "line-color": "#ffffff",
                    "line-width": 9,
                    "line-opacity": 0.85,
                  }}
                />

                <Layer
                  id={`seg-line-${id}`}
                  type="line"
                  layout={{ "line-cap": "round", "line-join": "round" }}
                  paint={{
                    "line-color": color,
                    "line-width": 6,
                    "line-opacity": 1,
                  }}
                />
              </Source>
            ) : null
          )}

          {plan?.stops.map((s, i) => (
            <Marker
              key={`stop-${s.id}`}
              longitude={s.lng}
              latitude={s.lat}
              anchor="center"
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: SEG_COLORS[i % SEG_COLORS.length],
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: 13,
                  border: "2.5px solid #fff",
                  boxShadow: "0 2px 8px rgba(0,0,0,.35)",
                }}
              >
                {i + 1}
              </div>
            </Marker>
          ))}

          {animDots.map(({ id, lng: dLng, lat: dLat, color }) => (
            <Marker
              key={`dot-${id}`}
              longitude={dLng}
              latitude={dLat}
              anchor="center"
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: color,
                  border: "2px solid #fff",
                  boxShadow: `0 0 6px ${color}aa`,
                  pointerEvents: "none",
                }}
              />
            </Marker>
          ))}
        </Map>

        {tooltip && (
          <div
            style={{
              position: "fixed",
              left: tooltip.x + 14,
              top: tooltip.y - 10,
              pointerEvents: "none",
              zIndex: 999,
              padding: "8px 12px",
              borderRadius: 8,
              maxWidth: 220,
              border: "1px solid rgba(26,34,51,0.12)",
              background: "#fff",
              color: "#1a2233",
              boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            }}
          >
            <p style={{ fontWeight: 700, fontSize: 13, margin: 0 }}>
              {tooltip.name}
            </p>

            {tooltip.desc && (
              <p style={{ fontSize: 10, marginTop: 2, opacity: 0.5 }}>
                {tooltip.desc}
              </p>
            )}

            {tooltip.address && (
              <p
                style={{
                  fontSize: 11,
                  marginTop: 4,
                  opacity: 0.65,
                  lineHeight: 1.4,
                }}
              >
                {tooltip.address}
              </p>
            )}
          </div>
        )}

        {plan && (
          <div
            style={{
              position: "fixed",
              bottom: 100,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 600,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
            }}
          >
            {/* 도보/차량 토글 */}
            <div
              style={{
                display: "flex",
                borderRadius: 999,
                overflow: "hidden",
                border: "1px solid rgba(26,34,51,0.12)",
                background: "rgba(255,255,255,0.96)",
                backdropFilter: "blur(12px)",
                boxShadow: "0 2px 12px rgba(26,34,51,0.10)",
              }}
            >
              {(["walking", "driving"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setTravelMode(m)}
                  style={{
                    padding: "5px 14px",
                    fontSize: 12,
                    fontWeight: 700,
                    background: travelMode === m ? "#0077b6" : "transparent",
                    color: travelMode === m ? "#fff" : "#4a5a78",
                    border: "none",
                    cursor: "pointer",
                    transition: "background 0.15s, color 0.15s",
                  }}
                >
                  {m === "walking" ? "🚶 도보" : "🚗 차량"}
                </button>
              ))}
            </div>

            {/* 거리/시간 뱃지 */}
            {mapboxRoute && (() => {
              const moveM = Math.round(mapboxRoute.duration_s / 60);
              const shopM = plan.n_stops * 10;
              const modeIcon = travelMode === "walking" ? "🚶" : "🚗";
              const modeLabel = travelMode === "walking" ? "도보" : "차량";
              const items = [
                { icon: "🗺️", val: `${(mapboxRoute.distance_m / 1000).toFixed(1)}km` },
                { icon: modeIcon, val: `${moveM}분 (${modeLabel})` },
                { icon: "🛒", val: `${shopM}분` },
                { icon: "⏱", val: `${moveM + shopM}분` },
              ];
              return (
                <div
                  style={{
                    background: "rgba(255,255,255,0.96)",
                    border: "1px solid rgba(26,34,51,0.12)",
                    borderRadius: 20,
                    padding: "8px 16px",
                    display: "flex",
                    gap: 14,
                    alignItems: "center",
                    backdropFilter: "blur(12px)",
                    boxShadow: "0 2px 12px rgba(26,34,51,0.10)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {items.map(({ icon, val }) => (
                    <div
                      key={val}
                      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}
                    >
                      <span style={{ fontSize: 14 }}>{icon}</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#1a2233", whiteSpace: "nowrap" }}>
                        {val}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </>
  );
}
