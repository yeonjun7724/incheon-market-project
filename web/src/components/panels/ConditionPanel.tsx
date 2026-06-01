"use client";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { optimizeBasket } from "@/lib/api";
import type { BasketResult } from "@/lib/types";

const RADII = [
  { lbl: "500m", v: 500 }, { lbl: "1km", v: 1000 }, { lbl: "2km", v: 2000 },
  { lbl: "3km", v: 3000 }, { lbl: "5km", v: 5000 },
];
const PREFS = ["균형", "저단백", "고단백", "채식"];

export function ConditionPanel() {
  const { radiusM, setRadius, budget, household, pref, useMarket, setCondition } = useApp();
  const [result, setResult] = useState<BasketResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const r = await optimizeBasket({ budget, household, pref, use_market: useMarket });
      setResult(r);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 text-ink1">
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink3">탐색 반경</p>
        <div className="flex gap-2">
          {RADII.map(({ lbl, v }) => (
            <button key={v} onClick={() => setRadius(v)}
              className={`flex-1 rounded-lg border px-2 py-2 text-xs transition
                ${radiusM === v ? "border-accent/50 bg-accent/10 text-accent" : "border-white/10 text-ink2"}`}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink3">예산</p>
        <input type="range" min={10000} max={200000} step={5000} value={budget}
          onChange={(e) => setCondition({ budget: Number(e.target.value) })}
          className="w-full accent-[#63b7ff]" />
        <p className="mt-1 font-mono text-2xl font-bold text-accent2">{budget.toLocaleString()}원</p>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink3">가구</p>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((n) => (
              <button key={n} onClick={() => setCondition({ household: n })}
                className={`flex-1 rounded-lg border py-2 text-xs
                  ${household === n ? "border-accent/50 bg-accent/10 text-accent" : "border-white/10 text-ink2"}`}>
                {n}인
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink3">가격 기준</p>
          <button onClick={() => setCondition({ useMarket: !useMarket })}
            className="w-full rounded-lg border border-white/10 py-2 text-xs text-ink2">
            {useMarket ? "시장가" : "평균가"}
          </button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink3">식단</p>
        <div className="flex gap-1.5">
          {PREFS.map((p) => (
            <button key={p} onClick={() => setCondition({ pref: p })}
              className={`flex-1 rounded-lg border py-2 text-xs
                ${pref === p ? "border-accent/50 bg-accent/10 text-accent" : "border-white/10 text-ink2"}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      <button onClick={run} disabled={loading}
        className="w-full rounded-xl border border-accent/40 bg-accent/15 py-3 font-bold text-accent
                   hover:bg-accent/25 disabled:opacity-50">
        {loading ? "분석 중..." : "🔍  이 조건으로 장바구니 추천"}
      </button>

      {result && (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[11px] uppercase tracking-wide text-ink3">추천 장바구니 ({result.summary.n_items}개)</p>
          <p className="font-mono text-xl font-bold text-accent2">{result.summary.total.toLocaleString()}원</p>
          <div className="mt-2 space-y-1">
            {result.items.map((it) => (
              <div key={it.code} className="flex items-center justify-between text-[13px]">
                <span>{it.emoji} {it.name} <span className="text-ink3">×{it.qty}</span></span>
                <span className="font-mono text-ink2">{it.line_total.toLocaleString()}원</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
