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
    budget, household, pref, useMarket,
    travelMode, setTravelMode, saveRoute,
  } = useApp();

  const [mbRoutes, setMbRoutes] = useState<Record<string, RouteWithMapbox | null>>({});
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState(false);
  const [loadingMb, setLoadingMb] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

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
      // 현재 선택된 경로도 갱신
      if (routeChoice && routeMap[routeChoice]) {
        setMapboxRoute(routeMap[routeChoice]);
      }
      setLoadingMb(false);
    });
  }, [routePlans, lat, lng, travelMode]);

  function handleChoose(key: string) {
    setRouteChoice(key);
    setMapboxRoute(mbRoutes[key] ?? null);
  }

  const strategies = Object.keys(routePlans);

  /* ── 빈 상태 ── */
  if (!picked.length) return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <span className="text-4xl">🛒</span>
      <p className="text-[15px] font-semibold" style={{ color: "#1a2233" }}>장바구니가 비어있어요</p>
      <p className="text-[13px]" style={{ color: "#8a96b0" }}>재료를 먼저 담아주세요</p>
    </div>
  );

  /* ── 로딩 ── */
  if (loadingPlan) return (
    <div className="flex flex-col items-center gap-4 py-12">
      <div className="w-11 h-11 rounded-full border-[3px] border-[#0077b6]/20 border-t-[#0077b6] animate-spin-slow" />
      <p className="text-[14px] font-semibold" style={{ color: "#1a2233" }}>경로 계산 중</p>
      <p className="text-[12px]" style={{ color: "#8a96b0" }}>잠시만 기다려주세요…</p>
    </div>
  );

  /* ── 에러 ── */
  if (planError) return (
    <div className="flex flex-col items-center gap-3 py-10 text-center px-4">
      <span className="text-4xl">⚠️</span>
      <p className="text-[15px] font-bold" style={{ color: "#1a2233" }}>경로 계산 실패</p>
      <p className="text-[13px]" style={{ color: "#8a96b0" }}>서버 연결을 확인하거나 반경을 늘려보세요</p>
      <button
        onClick={() => { setPlanError(false); setRoutePlans({}); }}
        className="mt-2 rounded-xl px-6 py-2.5 text-[13px] font-bold text-white"
        style={{ background: "#0077b6" }}
      >다시 시도</button>
    </div>
  );

  /* ── 결과 없음 ── */
  if (!strategies.length) return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <span className="text-4xl">🔍</span>
      <p className="text-[15px] font-semibold" style={{ color: "#1a2233" }}>주변 가게를 찾지 못했어요</p>
      <p className="text-[13px]" style={{ color: "#8a96b0" }}>조건 탭에서 반경을 늘려보세요</p>
    </div>
  );

  /* ── 경로 목록 ── */
  return (
    <div className="space-y-3 pb-2">

      {/* 이동 모드 토글 */}
      <div
        className="flex rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(26,34,51,0.10)", background: "rgba(26,34,51,0.03)" }}
      >
        {([
          { key: 'walking' as const, icon: '🚶', label: '도보' },
          { key: 'driving' as const, icon: '🚗', label: '차량' },
        ] as const).map(({ key, icon, label }) => (
          <button
            key={key}
            onClick={() => {
              if (travelMode !== key) {
                setTravelMode(key);
                setMapboxRoute(null);
                setAllMapboxRoutes({});
              }
            }}
            className="flex-1 flex items-center justify-center gap-2 py-3"
            style={{
              background: travelMode === key
                ? (key === 'driving' ? '#e85d04' : '#0077b6')
                : 'transparent',
              color: travelMode === key ? '#fff' : '#8a96b0',
              fontSize: 13,
              fontWeight: 700,
              transition: 'background 300ms ease, color 300ms ease',
            }}
          >
            <span style={{ fontSize: 16 }}>{icon}</span>
            {label}
            {travelMode === key && (
              <span style={{
                fontSize: 10, fontWeight: 600, opacity: 0.85,
                background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: '1px 6px',
              }}>선택됨</span>
            )}
          </button>
        ))}
      </div>

      {/* 실측 로딩 배너 */}
      {loadingMb && (
        <div className="flex items-center gap-2.5 rounded-2xl px-4 py-3"
          style={{ background: "rgba(0,119,182,0.06)", border: "1px solid rgba(0,119,182,0.14)" }}>
          <div className="w-4 h-4 shrink-0 rounded-full border-2 border-[#0077b6]/25 border-t-[#0077b6] animate-spin-slow" />
          <p className="text-[13px] font-medium" style={{ color: "#0077b6" }}>실제 도보 거리 계산 중…</p>
        </div>
      )}

      {strategies.map((k) => {
        const p   = routePlans[k];
        if (!p?.stops?.length) return null;
        const mb       = mbRoutes[k];
        const sel      = routeChoice === k;
        const walkMin  = mb ? Math.round(mb.duration_s / 60) : Math.round(p.distance_m / 80);
        const shopMin  = p.n_stops * 10;
        const totalMin = walkMin + shopMin;
        const distKm   = mb
          ? (mb.distance_m / 1000).toFixed(1)
          : (p.distance_m / 1000).toFixed(1);
        const s = STRAT[k] ?? { icon: "🗺️", label: k, desc: "", color: "#0077b6", bg: "#f0f7ff" };

        return (
          <button
            key={k}
            onClick={() => handleChoose(k)}
            className="w-full text-left"
            style={{
              borderRadius: 20,
              border: sel ? `2px solid ${s.color}` : "1.5px solid rgba(26,34,51,0.09)",
              background: sel ? s.bg : "#fff",
              boxShadow: sel
                ? `0 4px 16px ${s.color}22`
                : "0 1px 4px rgba(26,34,51,0.06)",
              padding: "14px 16px",
              transition: "box-shadow 400ms ease, border-color 350ms ease",
            }}
          >
            {/* ── 헤더 행 ── */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[20px]"
                  style={{ background: `${s.color}18` }}
                >
                  {s.icon}
                </div>
                <div>
                  <div className="text-[16px] font-extrabold leading-tight" style={{ color: s.color }}>
                    {s.label}
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: "#8a96b0" }}>{s.desc}</div>
                </div>
              </div>
              {sel && (
                <span
                  className="flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold"
                  style={{ background: s.color, color: "#fff" }}
                >
                  ✓ 선택됨
                </span>
              )}
            </div>

            {/* ── 지표 4칸 — 절대 줄바꿈 없음 ── */}
            <div
              className="grid grid-cols-4 gap-1.5"
              style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
            >
              {[
                { num: p.budget.toLocaleString(), unit: "원",  label: "예산"  },
                { num: distKm,                    unit: "km",   label: "거리"  },
                { num: String(walkMin),           unit: "분",   label: mb ? "실측" : "추정" },
                { num: String(totalMin),          unit: "분",   label: "총소요" },
              ].map(({ num, unit, label }) => (
                <div
                  key={label}
                  className="rounded-xl text-center"
                  style={{
                    background: sel ? `${s.color}0f` : "rgba(26,34,51,0.04)",
                    padding: "8px 4px 7px",
                  }}
                >
                  {/* 숫자+단위 한 줄 */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "center",
                      gap: 1,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 900,
                        fontVariantNumeric: "tabular-nums",
                        color: sel ? s.color : "#1a2233",
                        lineHeight: 1,
                      }}
                    >
                      {num}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: sel ? s.color : "#8a96b0",
                        lineHeight: 1,
                      }}
                    >
                      {unit}
                    </span>
                  </div>
                  {/* 레이블 */}
                  <div
                    style={{
                      fontSize: 10,
                      color: "#8a96b0",
                      marginTop: 4,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {label}
                  </div>
                </div>
              ))}
            </div>

            {/* ── 경유지 — 선택 시만 ── */}
            {sel && (
              <div
                className="mt-3 pt-3 space-y-1.5"
                style={{ borderTop: `1px solid ${s.color}1a` }}
              >
                <p
                  className="text-[10px] font-bold uppercase tracking-wider mb-2"
                  style={{ color: "#8a96b0" }}
                >
                  경유 상점
                </p>
                {p.stops.map((stop, i) => (
                  <div
                    key={stop.id}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2"
                    style={{ background: `${s.color}09` }}
                  >
                    <div
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
                      style={{ background: SEG_COLORS[i % SEG_COLORS.length] }}
                    >
                      {i + 1}
                    </div>
                    <span
                      className="flex-1 min-w-0 truncate text-[13px] font-semibold"
                      style={{ color: "#1a2233" }}
                    >
                      {stop.name}
                    </span>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{ background: `${s.color}18`, color: s.color }}
                    >
                      {stop.type}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </button>
        );
      })}

      {/* ── 경로 저장 버튼 ── */}
      {routeChoice && (() => {
        const p = routePlans[routeChoice];
        const mb = mbRoutes[routeChoice];
        return (
          <>
          <button
            onClick={() => {
              const now = new Date();
              // by_store에서 거래 내역 추출
              const purchases = p?.stops?.map((stop: any) => {
                const entry = p.by_store?.[stop.id];
                const items = (entry?.items ?? []).map((it: any) => ({
                  name: it.name,
                  emoji: it.emoji ?? "🛒",
                  unit: it.unit ?? "",
                  price: it.price ?? 0,
                  qty: it.qty ?? 1,
                }));
                return {
                  id: stop.id,
                  name: stop.name,
                  type: stop.type,
                  gu: stop.gu ?? "",
                  items,
                  subtotal: items.reduce((s: number, i: any) => s + i.price * i.qty, 0),
                };
              }) ?? [];
              const grandTotal = purchases.reduce((s: number, ps: any) => s + ps.subtotal, 0);

              saveRoute({
                id: `${routeChoice}-${Date.now()}`,
                name: `${routeChoice} · ${now.getMonth()+1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`,
                strategy: routeChoice,
                travelMode,
                budget: p?.budget ?? 0,
                distKm: mb ? (mb.distance_m/1000).toFixed(1) : "0",
                walkMin: mb ? Math.round(mb.duration_s/60) : 0,
                totalMin: mb ? Math.round(mb.duration_s/60) + (p?.n_stops??0)*10 : 0,
                stops: p?.stops?.map((s: any) => ({ name: s.name, type: s.type })) ?? [],
                ingredients: picked,
                purchases,
                grandTotal,
                savedAt: now.toISOString(),
                // 정확 복원용 스냅샷
                plan: p,
                mapbox: mb ?? null,
                origin: { lat, lng },
                radiusM,
              });
              setSavedToast(true);
              setTimeout(() => setSavedToast(false), 2400);
            }}
            className="w-full rounded-2xl py-3 text-[13px] font-bold"
            style={{ background: "rgba(26,34,51,0.06)", color: "#4a5a78", border: "1px solid rgba(26,34,51,0.10)" }}
          >
            ⭐ 이 경로 저장하기
          </button>

          {/* ── 저장 완료 토스트 ── */}
          {savedToast && (
            <div
              className="flex items-center justify-center gap-2 rounded-2xl py-3 px-4"
              style={{
                background: "rgba(45,158,95,0.10)",
                border: "1px solid rgba(45,158,95,0.28)",
                color: "#2d9e5f",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              ⭐ 경로가 추가되어 즐겨찾기에 등록되었어요
            </div>
          )}
          </>
        );
      })()}

      {/* ── 장보기 시작 버튼 ── */}
      {/* 경로 미선택 시 안내 */}
      {!routeChoice && (
        <p className="text-center text-[12px] pb-1" style={{ color: "#8a96b0" }}>
          위 경로 중 하나를 먼저 선택해 주세요
        </p>
      )}
      <button
        disabled={!routeChoice}
        onClick={() => setPanel(null)}
        className="w-full rounded-2xl py-4 text-[15px] font-bold text-white disabled:opacity-30"
        style={{
          background: routeChoice ? STRAT[routeChoice]?.color ?? "#0077b6" : "#8a96b0",
          transition: "background 400ms ease, opacity 350ms ease",
        }}
      >
        {routeChoice ? `🗺️ ${routeChoice} 경로로 장보기 시작 →` : "위 경로 중 하나를 선택하세요"}
      </button>
    </div>
  );
}
