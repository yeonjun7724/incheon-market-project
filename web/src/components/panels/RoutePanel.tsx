"use client";
import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { recommendRoutes } from "@/lib/api";

const STRAT_LABEL: Record<string, string> = {
  최저예산: "💰 최저예산",
  최소거리: "📍 최소거리",
  최소경유: "🧭 최소경유",
};

export function RoutePanel() {
  const {
    lat, lng, radiusM, picked, routePlans, routeChoice,
    setRoutePlans, setRouteChoice, setPanel,
  } = useApp();

  // 패널 열렸는데 경로가 없으면(직접 진입) 자동 계산
  useEffect(() => {
    if (picked.length && Object.keys(routePlans).length === 0) {
      recommendRoutes({ ingredients: picked, lat, lng, radius: radiusM })
        .then(setRoutePlans).catch(console.error);
    }
  }, [picked, routePlans, lat, lng, radiusM, setRoutePlans]);

  const strategies = Object.keys(routePlans);

  if (!picked.length) {
    return <p className="py-6 text-center text-sm text-ink3">장바구니에 재료를 먼저 담아주세요.</p>;
  }
  if (!strategies.length) {
    return <p className="py-6 text-center text-sm text-ink3">경로를 계산하는 중…</p>;
  }

  return (
    <div className="space-y-3 text-ink1">
      <p className="text-[11px] font-bold uppercase tracking-wide text-ink3">매개변수별 추천 경로</p>
      {strategies.map((k) => {
        const p = routePlans[k];
        if (!p || !p.stops?.length) return null;
        const sel = routeChoice === k;
        return (
          <button key={k} onClick={() => setRouteChoice(sel ? null : k)}
            className={`w-full rounded-2xl border p-4 text-left transition
              ${sel ? "border-accent/50 bg-accent/[0.07] shadow-[0_0_0_1px_rgba(99,183,255,.25)]" : "border-white/10 bg-white/[0.03]"}`}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[15px] font-extrabold">{STRAT_LABEL[k] ?? k}</span>
              {sel && <span className="rounded-full border border-accent/30 bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">선택됨</span>}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Metric label="예상 예산" val={`${p.budget.toLocaleString()}원`} />
              <Metric label="소요 시간" val={`${p.minutes}분`} />
              <Metric label="경유 상점" val={`${p.n_stops}곳`} />
            </div>
          </button>
        );
      })}

      <button disabled={!routeChoice} onClick={() => setPanel("checklist")}
        className="mt-1 w-full rounded-xl border border-accent3/40 bg-accent3/15 py-3 font-bold text-accent3 hover:bg-accent3/25 disabled:opacity-40">
        🚶  이 경로로 장보기 시작
      </button>
    </div>
  );
}

function Metric({ label, val }: { label: string; val: string }) {
  return (
    <div>
      <div className="font-mono text-[16px] font-bold text-accent2">{val}</div>
      <div className="text-[10px] text-ink3">{label}</div>
    </div>
  );
}
