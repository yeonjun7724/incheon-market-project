"use client";
import { useEffect, useMemo, useState } from "react";
import Map, {
  Marker, Source, Layer, type MapMouseEvent, type MapRef,
} from "react-map-gl/mapbox";
import type { MapLayerMouseEvent } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useApp } from "@/lib/store";
import { getStores } from "@/lib/api";
import type { Store } from "@/lib/types";
import { useRef } from "react";
import PriceLayer from "./PriceLayer";

export default function MapCanvas({ priceLayerOn }: { priceLayerOn: boolean }) {
  const { lat, lng, radiusM, routePlans, routeChoice, setLoc, mapStyle } = useApp();
  const [stores, setStores] = useState<Store[]>([]);
  const mapRef = useRef<MapRef | null>(null);

  useEffect(() => {
    getStores(lat, lng, radiusM).then(setStores).catch(console.error);
  }, [lat, lng, radiusM]);

  // 상점 → 클러스터용 GeoJSON
  const geojson = useMemo(() => ({
    type: "FeatureCollection" as const,
    features: stores.map((s) => ({
      type: "Feature" as const,
      properties: { id: s.id, name: s.name, type: s.type, gu: s.gu },
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

  function handleClick(e: MapMouseEvent) {
    const map = mapRef.current;
    const feats = (e as unknown as MapLayerMouseEvent).features;
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
    if (!feats?.length) setLoc(e.lngLat.lat, e.lngLat.lng);
  }

  return (
    <Map
      id="main"
      ref={mapRef}
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
      initialViewState={{ longitude: lng, latitude: lat, zoom: 12 }}
      mapStyle={mapStyle}
      style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh" }}
      interactiveLayerIds={["clusters", "unclustered"]}
      onClick={handleClick}
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
  );
}
