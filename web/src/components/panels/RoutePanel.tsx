"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { recommendRoutes, getMapboxRoute } from "@/lib/api";
import type { RouteWithMapbox } from "@/lib/types";

const STRAT: Record<string, { icon: string; label: string; desc: string; color: string; bg: string }> = {
  최저예산: { icon: "💰", label: "최저예산", desc: "전통시장 우선 · 가장 저렴하게", color: "#e85d04", bg: "#fff8f5" },
  최소거리: { icon: "📍", label: "최소거리", desc: "가까운 가게 순 · 동선 최소화",  color: "#0077b6", bg: "#f0f7ff" },
  최소경유: { icon: "🧭", label: "최소경유", desc: "한 곳에서 최대한 · 경유지 최소", color: "#2d9e5f", bg: "#f0fff6" },
};

const SEG_COLORS = ["#0077b6", "#e85d04", "#2d9e5f", "#7b2d8b", "#c1121f", "#f77f00"];

export function RoutePanel() {
  const {
    lat, lng, radiusM, picked, routePlans, routeChoice,
    setRoutePlans, setRouteChoice, setPanel, setMapboxRoute, setAllMapboxRoutes,
    budget, household, pref, useMarket, travelMode,
  } = useApp();

  const [mbRoutes, setMbRoutes] = useState<Record<string, RouteWithMapbox | null>>({});
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState(false);
  const [loadingMb, setLoadingMb] = useState(false);

  useEffect(() => {
    if (picked.length && Object.keys(routePlans).length === 0) {
      setLoadingPlan(true);
      const controller = new AbortController();
      recommendRoutes({ ingredients: picked, lat, lng, radius: radiusM, budget, household, pref, use_market: useMarket })
        .then((plans) => {
          if (!plans || Object.keys(plans).length === 0) { setLoadingPlan(false); return; }
          setRoutePlans(plans);
        })
        .catch((e) => { console.error("경로 추천 실패:", e); setPlanError(true); setLoadingPlan(false); })
        .finally(() => setLoadingPlan(false));
      return () => controller.abort();
    }
  }, [picked, routePlans, lat, lng, radiusM, setRoutePlans]);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
    if (!token || !Object.keys(routePlans).length) return;
    setLoadingMb(true);
    Promise.all(
      Object.entries(routePlans).map(async ([key, plan]) => {
        if (!plan?.stops?.length) return [key, null] as const;
        const wp: [number, number][] = plan.stops.map((s) => [s.lng, s.lat]);
        const r = await getMapboxRoute([lng, lat], wp, token, travelMode).catch(() => null);
        return [key, r] as const;
      })
    ).then((results) => {
      const routeMap = Object.fromEntries(results);
      setMbRoutes(routeMap);
      const validRoutes = Object.fromEntries(
        Object.entries(routeMap).filter(([, v]) => v !== null)
      ) as Record<string, RouteWithMapbox>;
      setAllMapboxRoutes(validRoutes);
      setLoadingMb(false);
    });
  }, [routePlans, lat, lng, travelMode]);

  function handleChoose(key: string) {
    const sel = routeChoice === key;
    setRouteChoice(sel ? null : key);
    setMapboxRoute(sel ? null : (mbRoutes[key] ?? null));
  }

  const strategies = Object.keys(routePlans);

  if (!picked.length) return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <span className="text-4xl">🛒</span>
      <p className="text-[14px] font-semibold text-[#1a2233]">장바구니가 비어있어요</p>
      <p className="text-[12px] text-[#8a96b0]">재료를 먼저 담아주세요</p>
    </div>
  );

  if (loadingPlan) return (
    <div className="flex flex-col items-center gap-4 py-12">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-4 border-[#0077b6]/20 border-t-[#0077b6] animate-spin" />
      </div>
      <p className="text-[14px] font-semibold text-[#1a2233]">경로 계산 중</p>
      <p className="text-[12px] text-[#8a96b0]">잠시만 기다려주세요…</p>
    </div>
  );

  if (planError) return (
    <div className="flex flex-col items-center gap-3 py-10 text-center px-4">
      <span className="text-4xl">⚠️</span>
      <p className="text-[15px] font-bold text-[#1a2233]">경로 계산 실패</p>
      <p className="text-[13px] text-[#8a96b0]">서버 연결을 확인하거나 반경을 늘려보세요</p>
      <button
        onClick={() => { setPlanError(false); setRoutePlans({}); }}
        className="mt-2 rounded-xl px-6 py-2.5 text-[13px] font-bold text-white"
        style={{ background: "#0077b6" }}
      >다시 시도</button>
    </div>
  );

  if (!strategies.length) return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <span className="text-4xl">🔍</span>
      <p className="text-[14px] font-semibold text-[#1a2233]">주변 가게를 찾지 못했어요</p>
      <p className="text-[12px] text-[#8a96b0]">조건 탭에서 반경을 늘려보세요</p>
    </div>
  );

  // 3전략이 동일한 단일 상점으로 수렴했는지 감지
  const allSameStore = strategies.length === 3 && strategies.every((k) => {
    const s = routePlans[k];
    return s?.stops?.length === 1 && s.stops[0].id === routePlans[strategies[0]]?.stops?.[0]?.id;
  });

  return (
    <div className="space-y-3 pb-2">
      {allSameStore && (
        <div className="rounded-xl px-3 py-2.5 text-[12px]"
          style={{ background: "rgba(26,34,51,0.05)", border: "1px solid rgba(26,34,51,0.10)" }}>
          <p className="font-semibold text-[#4a5a78]">ℹ️ 반경 내 모든 재료를 커버하는 가게가 한 곳뿐이에요.</p>
          <p className="text-[#8a96b0] mt-0.5">탐색 반경을 늘리거나 조건 탭에서 반경을 조정하면 더 다양한 경로가 나타납니다.</p>
        </div>
      )}
      {loadingMb && (
        <div className="flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: "rgba(0,119,182,0.07)", border: "1px solid rgba(0,119,182,0.15)" }}>
          <div className="w-3 h-3 rounded-full border-2 border-[#0077b6]/30 border-t-[#0077b6] animate-spin shrink-0" />
          <p className="text-[12px] text-[#0077b6] font-medium">실제 도보 거리 계산 중…</p>
        </div>
      )}

      {strategies.map((k) => {
        const p = routePlans[k];
        if (!p?.stops?.length) return null;
        const mb       = mbRoutes[k];
        const sel      = routeChoice === k;
        const walkMin  = mb ? Math.round(mb.duration_s / 60) : Math.round(p.distance_m / 80);
        const shopMin  = p.n_stops * 10;
        const totalMin = walkMin + shopMin;
        const distKm   = mb ? (mb.distance_m / 1000).toFixed(1) : (p.distance_m / 1000).toFixed(1);
        const s        = STRAT[k] ?? { icon: "🗺️", label: k, desc: "", color: "#0077b6", bg: "#f0f7ff" };

        return (
          <button key={k} onClick={() => handleChoose(k)}
            className="w-full rounded-2xl text-left transition active:scale-[0.99]"
            style={{
              border: sel ? `2px solid ${s.color}` : "1.5px solid rgba(26,34,51,0.10)",
              background: sel ? s.bg : "#fff",
              boxShadow: sel ? `0 2px 12px ${s.color}20` : "0 1px 4px rgba(26,34,51,0.06)",
              padding: "16px",
            }}>

            {/* 헤더 */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[22px]"
                  style={{ background: `${s.color}15` }}>
                  {s.icon}
                </div>
                <div>
                  <div className="text-[16px] font-extrabold" style={{ color: s.color }}>{s.label}</div>
                  <div className="text-[11px] text-[#8a96b0] mt-0.5">{s.desc}</div>
                </div>
              </div>
              {sel
                ? <span className="rounded-full px-3 py-1 text-[11px] font-bold text-white"
                    style={{ background: s.color }}>선택됨</span>
                : <span className="rounded-full px-3 py-1 text-[11px] font-semibold"
                    style={{ background: "rgba(26,34,51,0.06)", color: "#8a96b0" }}>선택</span>
              }
            </div>

            {/* 지표 — 2×2 그리드 */}
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { v: p.budget.toLocaleString(), unit: "원", l: "예상 예산" },
                { v: distKm,                    unit: "km",  l: "총 거리" },
                { v: String(walkMin),           unit: "분",  l: mb ? "도보(실측)" : "도보(추정)" },
                { v: String(totalMin),          unit: "분",  l: "총 소요시간" },
              ].map(({ v, unit, l }) => (
                <div key={l} className="rounded-xl flex items-center gap-2.5 py-2.5 px-3"
                  style={{ background: sel ? `${s.color}10` : "rgba(26,34,51,0.04)" }}>
                  <div>
                    <div className="flex items-baseline gap-[2px]">
                      <span className="text-[15px] font-black font-mono"
                        style={{ color: sel ? s.color : "#1a2233" }}>{v}</span>
                      <span className="text-[11px] font-bold"
                        style={{ color: sel ? s.color : "#8a96b0" }}>{unit}</span>
                    </div>
                    <div className="text-[10px] text-[#8a96b0] mt-0.5">{l}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* 경유지 */}
            {sel && (
              <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${s.color}20` }}>
                <p className="text-[11px] font-bold text-[#8a96b0] uppercase tracking-wider mb-2">경유 상점</p>
                <div className="space-y-1.5">
                  {p.stops.map((stop, i) => (
                    <div key={stop.id} className="flex items-center gap-2.5 rounded-xl px-3 py-2"
                      style={{ background: `${s.color}08` }}>
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
                        style={{ background: SEG_COLORS[i % SEG_COLORS.length] }}>
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[13px] font-semibold text-[#1a2233] truncate block">{stop.name}</span>
                      </div>
                      <span className="text-[10px] font-medium shrink-0 rounded-full px-2 py-0.5"
                        style={{ background: `${s.color}15`, color: s.color }}>
                        {stop.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </button>
        );
      })}

      <button
        disabled={!routeChoice}
        onClick={() => setPanel("checklist")}
        className="w-full rounded-2xl py-4 text-[15px] font-bold text-white transition active:scale-[0.98] disabled:opacity-30"
        style={{ background: routeChoice ? STRAT[routeChoice]?.color ?? "#0077b6" : "#8a96b0" }}
      >
        🚶 이 경로로 장보기 시작
      </button>
    </div>
  );
}
