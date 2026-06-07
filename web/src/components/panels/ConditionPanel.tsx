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

const activeBtn = "border-[#0077b6]/50 bg-[#0077b6]/10 text-[#0077b6]";
const inactiveBtn = "border-[#1a2233]/12 text-[#4a5a78] hover:border-[#0077b6]/30";

export function ConditionPanel() {
  const { radiusM, setRadius, budget, household, pref, useMarket, setCondition, picked, togglePick } = useApp();
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
    <div className="space-y-4 text-[#1a2233]">
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#8a96b0]">탐색 반경</p>
        <div className="flex gap-2">
          {RADII.map(({ lbl, v }) => (
            <button key={v} onClick={() => setRadius(v)}
              className={`flex-1 rounded-lg border px-2 py-2 text-xs transition ${radiusM === v ? activeBtn : inactiveBtn}`}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#8a96b0]">예산</p>
        <input type="range" min={10000} max={200000} step={5000} value={budget}
          onChange={(e) => setCondition({ budget: Number(e.target.value) })}
          className="w-full accent-[#0077b6]" />
        <p className="mt-1 font-mono text-2xl font-bold text-[#e63946]">{budget.toLocaleString()}원</p>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#8a96b0]">가구</p>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((n) => (
              <button key={n} onClick={() => setCondition({ household: n })}
                className={`flex-1 rounded-lg border py-2 text-xs transition ${household === n ? activeBtn : inactiveBtn}`}>
                {n}인
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#8a96b0]">가격 기준</p>
          <button onClick={() => setCondition({ useMarket: !useMarket })}
            className={`w-full rounded-lg border py-2 text-xs transition ${inactiveBtn}`}>
            {useMarket ? "시장가" : "평균가"}
          </button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#8a96b0]">식단</p>
        <div className="flex gap-1.5">
          {PREFS.map((p) => (
            <button key={p} onClick={() => setCondition({ pref: p })}
              className={`flex-1 rounded-lg border py-2 text-xs transition ${pref === p ? activeBtn : inactiveBtn}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      <button onClick={run} disabled={loading}
        className="w-full rounded-xl py-3 font-bold transition hover:opacity-90 disabled:opacity-50"
        style={{ background: "#0077b6", color: "#fff" }}>
        {loading ? "분석 중..." : "🔍  이 조건으로 장바구니 추천"}
      </button>

      {result && (
        <div className="rounded-lg p-3" style={{ border: "1px solid rgba(26,34,51,0.10)", background: "rgba(26,34,51,0.03)" }}>
          <p className="text-[11px] uppercase tracking-wide text-[#8a96b0]">추천 장바구니 ({result.summary.n_items}개)</p>
          <p className="font-mono text-xl font-bold text-[#e63946]">{result.summary.total.toLocaleString()}원</p>
          <div className="mt-2 space-y-1">
            {result.items.map((it) => {
              const inCart = picked.includes(it.name);
              return (
                <div key={it.code} className="flex items-center justify-between text-[13px]">
                  <span>{it.emoji} {it.name} <span className="text-[#8a96b0]">×{it.qty}</span></span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[#4a5a78]">{it.line_total.toLocaleString()}원</span>
                    <button
                      onClick={() => togglePick(it.name)}
                      className={`rounded px-1.5 py-0.5 text-[11px] border transition ${
                        inCart
                          ? "border-[#f77f00]/40 bg-[#f77f00]/10 text-[#f77f00]"
                          : "border-[#1a2233]/12 text-[#8a96b0] hover:border-[#f77f00]/40 hover:text-[#f77f00]"
                      }`}>
                      {inCart ? "✓ 담김" : "+ 담기"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
