"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { recommendRoutes, getMapboxRoute } from "@/lib/api";
import type { RouteWithMapbox } from "@/lib/types";

const STRAT: Record<string, { icon: string; label: string; desc: string; color: string }> = {
  최저예산: { icon: "💰", label: "최저예산", desc: "전통시장 우선 • 가장 저렴하게", color: "#f5a623" },
  최소거리: { icon: "📍", label: "최소거리", desc: "가까운 가게 순 • 동선 최소화",  color: "#63b7ff" },
  최소경유: { icon: "🧭", label: "최소경유", desc: "한 가게에서 최대한 • 경유지 최소", color: "#4ade80" },
};

const STOP_PALETTE = ["#f5a623", "#a855f7", "#ec4899", "#14b8a6", "#f97316", "#eab308", "#ef4444", "#06b6d4"];

export function RoutePanel() {
  const {
    lat, lng, radiusM, picked, routePlans, routeChoice,
    setRoutePlans, setRouteChoice, setPanel, setMapboxRoute,
    budget, household, pref, useMarket,
  } = useApp();

  const [mbRoutes, setMbRoutes] = useState<Record<string, RouteWithMapbox | null>>({});
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [loadingMb, setLoadingMb] = useState(false);

  // 경로 추천
  useEffect(() => {
    if (picked.length && Object.keys(routePlans).length === 0) {
      setLoadingPlan(true);
      recommendRoutes({ ingredients: picked, lat, lng, radius: radiusM, budget, household, pref, use_market: useMarket })
        .then(setRoutePlans)
        .catch(console.error)
        .finally(() => setLoadingPlan(false));
    }
  }, [picked, routePlans, lat, lng, radiusM, setRoutePlans]);

  // Mapbox 실제 거리
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
    if (!token || !Object.keys(routePlans).length) return;
    setLoadingMb(true);
    Promise.all(
      Object.entries(routePlans).map(async ([key, plan]) => {
        if (!plan?.stops?.length) return [key, null] as const;
        const wp: [number, number][] = plan.stops.map((s) => [s.lng, s.lat]);
        const r = await getMapboxRoute([lng, lat], wp, token).catch(() => null);
        return [key, r] as const;
      })
    ).then((results) => {
      setMbRoutes(Object.fromEntries(results));
      setLoadingMb(false);
    });
  }, [routePlans, lat, lng]);

  function handleChoose(key: string) {
    const sel = routeChoice === key;
    setRouteChoice(sel ? null : key);
    setMapboxRoute(sel ? null : (mbRoutes[key] ?? null));
  }

  const strategies = Object.keys(routePlans);

  if (!picked.length) return (
    <p className="py-6 text-center text-[13px] text-white/40">
      장바구니에 재료를 먼저 담아주세요.
    </p>
  );

  if (loadingPlan) return (
    <div className="flex flex-col items-center gap-3 py-8">
      <div className="text-4xl animate-spin">⚙️</div>
      <p className="text-[13px] text-[#63b7ff] animate-pulse">경로 계산 중…</p>
    </div>
  );

  if (!strategies.length) return (
    <p className="py-6 text-center text-[13px] text-white/40">
      반경 내 해당 재료를 취급하는 가게가 없어요.<br/>
      반경을 늘려보세요.
    </p>
  );

  return (
    <div className="space-y-3">
      {loadingMb && (
        <p className="text-[11px] text-[#63b7ff] animate-pulse text-center">
          실제 거리 계산 중…
        </p>
      )}

      {strategies.map((k) => {
        const p = routePlans[k];
        if (!p?.stops?.length) return null;
        const mb  = mbRoutes[k];
        const sel = routeChoice === k;
        const walkMin  = mb ? Math.round(mb.duration_s / 60) : Math.round(p.distance_m / 80);
        const shopMin  = p.n_stops * 10;
        const totalMin = walkMin + shopMin;
        const distKm   = mb ? (mb.distance_m / 1000).toFixed(1) : (p.distance_m / 1000).toFixed(1);
        const s   = STRAT[k] ?? { icon: "🗺️", label: k, desc: "", color: "#63b7ff" };
        const col = s.color;  // 전략별 고유 색상

        return (
          <button key={k} onClick={() => handleChoose(k)}
            className="w-full rounded-2xl border p-4 text-left transition active:scale-[0.98]"
            style={sel
              ? { borderColor: `${col}50`, background: `${col}10` }
              : { borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }
            }>

            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {/* 전략 색상 인디케이터 점 */}
                <span
                  className="text-[20px] relative"
                  style={{ filter: `drop-shadow(0 0 4px ${col}80)` }}
                >{s.icon}</span>
                <div>
                  <div className="text-[14px] font-extrabold text-white">{s.label}</div>
                  <div className="text-[10px] text-white/40">{s.desc}</div>
                </div>
              </div>
              {sel && (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{ background: `${col}25`, border: `1px solid ${col}40`, color: col }}
                >선택</span>
              )}
            </div>

            {/* 지표 4개 */}
            <div className="grid grid-cols-4 gap-1">
              {[
                { v: `${p.budget.toLocaleString()}원`, l: "예산" },
                { v: `${distKm}km`, l: "거리" },
                { v: `${walkMin}분`, l: mb ? "실측" : "추정" },
                { v: `${totalMin}분`, l: `총(구입포함)` },
              ].map(({ v, l }) => (
                <div key={l} className="rounded-xl bg-white/5 px-1 py-2 text-center min-w-0">
                  <div
                    className="text-[11px] font-bold font-mono leading-tight break-all"
                    style={{ color: col }}
                  >{v}</div>
                  <div className="text-[8px] text-white/35 leading-tight mt-0.5 truncate">{l}</div>
                </div>
              ))}
            </div>

            {/* 선택 시 경유지 */}
            {sel && (
              <div className="mt-3 space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wide text-white/30">경유 상점</div>
                {p.stops.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <div
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white"
                      style={{ background: STOP_PALETTE[i % STOP_PALETTE.length] }}
                    >{i+1}</div>
                    <span className="text-[12px] text-white/80 truncate">{s.name}</span>
                    <span className="text-[10px] text-white/30 shrink-0">{s.type}</span>
                  </div>
                ))}
              </div>
            )}
          </button>
        );
      })}

      <button
        disabled={!routeChoice}
        onClick={() => setPanel("checklist")}
        className="w-full rounded-2xl bg-[#4ade80]/15 border border-[#4ade80]/30
                   py-3.5 text-[14px] font-bold text-[#4ade80]
                   hover:bg-[#4ade80]/25 disabled:opacity-30 transition active:scale-[0.98]"
      >
        🚶 이 경로로 장보기 시작
      </button>
    </div>
  );
}
