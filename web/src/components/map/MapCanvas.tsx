"use client";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Map, {
  Marker, Source, Layer, type MapMouseEvent, type MapRef,
} from "react-map-gl/mapbox";
import type { MapLayerMouseEvent } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useApp } from "@/lib/store";
import { getStores, getDailyPrices } from "@/lib/api";
import type { Store, DailyPrice } from "@/lib/types";
import { useRef } from "react";
import PriceLayer from "./PriceLayer";

type StoreInfo = { name: string; address: string; x: number; y: number };

const TOOLTIP_W = 240;
const PANEL_W   = 270;

export default function MapCanvas({ priceLayerOn }: { priceLayerOn: boolean }) {
  const { lat, lng, radiusM, routePlans, routeChoice, setLoc, mapStyle } = useApp();
  const [stores, setStores]           = useState<Store[]>([]);
  const [hoveredStore, setHoveredStore] = useState<StoreInfo | null>(null);
  const [pinnedStore,  setPinnedStore]  = useState<StoreInfo | null>(null);
  const [priceData,    setPriceData]    = useState<DailyPrice[]>([]);
  const [priceLoading, setPriceLoading] = useState(false);
  const mapRef = useRef<MapRef | null>(null);
  const isDark = mapStyle.includes("dark");

  useEffect(() => {
    getStores(lat, lng, radiusM).then(setStores).catch(console.error);
  }, [lat, lng, radiusM]);

  // 상점 → 클러스터용 GeoJSON
  const geojson = useMemo(() => ({
    type: "FeatureCollection" as const,
    features: stores.map((s) => ({
      type: "Feature" as const,
      properties: { id: s.id, name: s.name, type: s.type, gu: s.gu, address: s.address ?? "" },
      geometry: { type: "Point" as const, coordinates: [s.lng, s.lat] },
    })),
  }), [stores]);

  const plan = routeChoice ? routePlans[routeChoice] : null;
  const routeGeo = plan && {
    type: "Feature" as const,
    geometry: {
      type: "LineString" as const,
      coordinates: [[lng, lat], ...plan.stops.map((s) => [s.lng, s.lat])],
    },
    properties: {},
  };

  function handleMouseMove(e: MapMouseEvent) {
    const feats = (e as unknown as MapLayerMouseEvent).features;
    const pt = feats?.find((f) => f.layer?.id === "unclustered");
    if (pt) {
      setHoveredStore({
        name: pt.properties?.name ?? "",
        address: pt.properties?.address ?? "",
        x: e.point.x,
        y: e.point.y,
      });
      if (mapRef.current) mapRef.current.getCanvas().style.cursor = "pointer";
    } else {
      setHoveredStore(null);
      if (mapRef.current) mapRef.current.getCanvas().style.cursor = "";
    }
  }

  function handleMouseLeave() {
    setHoveredStore(null);
    if (mapRef.current) mapRef.current.getCanvas().style.cursor = "";
  }

  function handleClick(e: MapMouseEvent) {
    const map = mapRef.current;
    const feats = (e as unknown as MapLayerMouseEvent).features;

    // 클러스터 클릭 → 줌인
    const cl = feats?.find((f) => f.layer?.id === "clusters");
    if (cl && map) {
      const clusterId = cl.properties?.cluster_id;
      const src = map.getSource("stores") as mapboxgl.GeoJSONSource;
      // @ts-expect-error mapbox typing
      src.getClusterExpansionZoom(clusterId, (err: unknown, zoom: number) => {
        if (err) return;
        // @ts-expect-error geometry coords
        map.easeTo({ center: cl.geometry.coordinates, zoom });
      });
      return;
    }

    // 상점 클릭 → 핀 토글
    const pt = feats?.find((f) => f.layer?.id === "unclustered");
    if (pt) {
      const info: StoreInfo = {
        name:    pt.properties?.name    ?? "",
        address: pt.properties?.address ?? "",
        x: e.point.x,
        y: e.point.y,
      };
      if (pinnedStore?.name === info.name) {
        setPinnedStore(null);
        setPriceData([]);
      } else {
        setPinnedStore(info);
        setPriceLoading(true);
        getDailyPrices()
          .then(setPriceData)
          .catch(() => setPriceData([]))
          .finally(() => setPriceLoading(false));
      }
      return;
    }

    // 빈 지도 클릭 → 핀 해제 + 위치 이동
    setPinnedStore(null);
    setPriceData([]);
    setLoc(e.lngLat.lat, e.lngLat.lng);
  }

  return (
    <>
    <Map
      id="main"
      ref={mapRef}
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
      initialViewState={{ longitude: lng, latitude: lat, zoom: 12 }}
      mapStyle={mapStyle}
      style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh" }}
      interactiveLayerIds={["clusters", "unclustered"]}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* 내 위치(집) */}
      <Marker longitude={lng} latitude={lat} anchor="center">
        <div style={{ fontSize: 26, filter: "drop-shadow(0 2px 3px rgba(0,0,0,.5))" }}>🏠</div>
      </Marker>

      {/* 가격 히트맵 레이어 (토글) */}
      <PriceLayer visible={priceLayerOn} />

      {/* 상점 클러스터 */}
      <Source
        id="stores"
        type="geojson"
        data={geojson}
        cluster
        clusterMaxZoom={14}
        clusterRadius={50}
      >
        <Layer
          id="clusters"
          type="circle"
          filter={["has", "point_count"]}
          paint={{
            "circle-color": "#4ade80",
            "circle-opacity": 0.9,
            "circle-radius": ["step", ["get", "point_count"], 16, 5, 22, 10, 30],
            "circle-stroke-width": 4,
            "circle-stroke-color": "rgba(74,222,128,0.25)",
          }}
        />
        <Layer
          id="cluster-count"
          type="symbol"
          filter={["has", "point_count"]}
          layout={{
            "text-field": ["get", "point_count_abbreviated"],
            "text-size": 13,
            "text-font": ["DIN Offc Pro Bold", "Arial Unicode MS Bold"],
          }}
          paint={{ "text-color": "#04101f" }}
        />
        <Layer
          id="unclustered"
          type="circle"
          filter={["!", ["has", "point_count"]]}
          paint={{
            "circle-color": [
              "match", ["get", "type"],
              "전통시장",   "#63b7ff",
              "골목상권",   "#4ade80",
              "동네식품점", "#f5a623",
              "대형유통",   "#a882ff",
              "#888",
            ],
            "circle-radius": 7,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#fff",
          }}
        />
      </Source>

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

    {/* 상점 툴팁 (hover 중 또는 핀된 상태) */}
    {(hoveredStore || pinnedStore) && (() => {
      const s = pinnedStore ?? hoveredStore!;
      const tooltipStyle: CSSProperties = {
        position: "fixed",
        left: s.x + 14,
        top: s.y - 10,
        pointerEvents: "none",
        zIndex: 999,
        padding: "8px 12px",
        borderRadius: 6,
        width: TOOLTIP_W,
        border: isDark ? "1px solid #fff" : "1px solid #000",
        background: isDark ? "#111827" : "#fff",
        color: isDark ? "#fff" : "#000",
        boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
      };
      return (
        <div style={tooltipStyle}>
          <p style={{ fontWeight: 700, fontSize: 13, margin: 0 }}>{s.name}</p>
          {s.address && (
            <p style={{ fontSize: 11, marginTop: 4, opacity: 0.7, lineHeight: 1.4 }}>
              {s.address}
            </p>
          )}
        </div>
      );
    })()}

    {/* 가격 패널 (핀된 상태에서만) */}
    {pinnedStore && (() => {
      const panelLeft = Math.min(
        pinnedStore.x + 14 + TOOLTIP_W + 8,
        window.innerWidth - PANEL_W - 8,
      );
      const panelTop = Math.max(8, Math.min(pinnedStore.y - 10, window.innerHeight - 420));

      // 대분류별 그룹화
      const groups: Record<string, DailyPrice[]> = {};
      for (const row of priceData) {
        const cat = row.gds_lclsf_nm ?? "기타";
        (groups[cat] ??= []).push(row);
      }

      const borderColor = isDark ? "#fff" : "#000";
      const bg          = isDark ? "#111827" : "#fff";
      const fg          = isDark ? "#fff" : "#000";
      const subFg       = isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)";
      const dividerClr  = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";

      return (
        <div
          style={{
            position: "fixed",
            left: panelLeft,
            top: panelTop,
            width: PANEL_W,
            maxHeight: 400,
            overflowY: "auto",
            zIndex: 998,
            borderRadius: 6,
            border: `1px solid ${borderColor}`,
            background: bg,
            color: fg,
            boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
            padding: "10px 14px",
          }}
        >
          {priceLoading && (
            <p style={{ fontSize: 12, opacity: 0.6, textAlign: "center" }}>가격 불러오는 중…</p>
          )}
          {!priceLoading && priceData.length === 0 && (
            <p style={{ fontSize: 12, opacity: 0.6, textAlign: "center" }}>가격 데이터 없음</p>
          )}
          {Object.entries(groups).map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: 12 }}>
              <p style={{ fontWeight: 700, fontSize: 13, margin: "0 0 4px" }}>{cat}</p>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <tbody>
                  {items.map((item, i) => (
                    <tr
                      key={i}
                      style={{ borderTop: i === 0 ? `1px solid ${dividerClr}` : undefined }}
                    >
                      <td style={{ padding: "3px 0", color: fg }}>{item.item_key}</td>
                      <td style={{ padding: "3px 0", textAlign: "right", color: subFg }}>
                        {item.중앙값 != null
                          ? `${Math.round(item.중앙값).toLocaleString()}원/kg`
                          : item.소매가 != null
                          ? `${Math.round(item.소매가).toLocaleString()}원${item.kamis_unit ? ` / ${item.kamis_unit}` : ""}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      );
    })()}
    </>
  );
}
