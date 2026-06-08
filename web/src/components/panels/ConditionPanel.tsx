"use client";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { optimizeBasket, recommendMeals } from "@/lib/api";
import type { BasketResult, MealRecommendationResult } from "@/lib/types";

const RADII = [
  { lbl: "500m", v: 500 }, { lbl: "1km", v: 1000 }, { lbl: "2km", v: 2000 },
  { lbl: "3km", v: 3000 }, { lbl: "5km", v: 5000 },
];
const PREFS = ["균형", "저단백", "고단백", "채식"];

const activeBtn = "border-[#0077b6]/50 bg-[#0077b6]/10 text-[#0077b6]";
const inactiveBtn = "border-[#1a2233]/12 text-[#4a5a78] hover:border-[#0077b6]/30";

export function ConditionPanel() {
  const { radiusM, setRadius, budget, household, pref, useMarket, setCondition, picked, togglePick } = useApp();
  const [basketResult, setBasketResult] = useState<BasketResult | null>(null);
  const [mealResult, setMealResult]     = useState<MealRecommendationResult | null>(null);
  const [loadingBasket, setLoadingBasket] = useState(false);
  const [loadingMeal, setLoadingMeal]     = useState(false);

  async function runBasket() {
    setLoadingBasket(true);
    try {
      const r = await optimizeBasket({ budget, household, pref, use_market: useMarket });
      setBasketResult(r);
      setMealResult(null);
    } finally { setLoadingBasket(false); }
  }

  async function runMeal() {
    setLoadingMeal(true);
    try {
      const r = await recommendMeals({ pref, budget, household });
      setMealResult(r);
      setBasketResult(null);
    } finally { setLoadingMeal(false); }
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

      {/* 버튼 2개 */}
      <div className="flex gap-2">
        <button onClick={runBasket} disabled={loadingBasket}
          className="flex-1 rounded-xl py-3 text-[13px] font-bold transition hover:opacity-90 disabled:opacity-50"
          style={{ background: "#0077b6", color: "#fff" }}>
          {loadingBasket ? "분석 중…" : "🔍 장바구니 추천"}
        </button>
        <button onClick={runMeal} disabled={loadingMeal}
          className="flex-1 rounded-xl py-3 text-[13px] font-bold transition hover:opacity-90 disabled:opacity-50"
          style={{ background: "rgba(0,119,182,0.08)", color: "#0077b6", border: "1px solid rgba(0,119,182,0.25)" }}>
          {loadingMeal ? "추천 중…" : "✨ AI 식단 추천"}
        </button>
      </div>

      {/* 장바구니 추천 결과 */}
      {basketResult && (
        <div className="rounded-xl p-3" style={{ border: "1px solid rgba(26,34,51,0.10)", background: "rgba(26,34,51,0.03)" }}>
          <p className="text-[11px] uppercase tracking-wide text-[#8a96b0]">추천 장바구니 ({basketResult.summary.n_items}개)</p>
          <p className="font-mono text-xl font-bold text-[#e63946]">{basketResult.summary.total.toLocaleString()}원</p>
          <div className="mt-2 space-y-1">
            {basketResult.items.map((it) => {
              const inCart = picked.includes(it.name);
              return (
                <div key={it.code} className="flex items-center justify-between text-[13px]">
                  <span>{it.emoji} {it.name} <span className="text-[#8a96b0]">×{it.qty}</span></span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[#4a5a78]">{it.line_total.toLocaleString()}원</span>
                    <button onClick={() => togglePick(it.name)}
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

      {/* AI 식단 추천 결과 */}
      {mealResult && (
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#8a96b0]">AI 추천 식단 — {pref}</p>
          {mealResult.meals.map((meal) => (
            <div key={meal.dish} className="rounded-xl overflow-hidden"
              style={{ border: "1px solid rgba(0,119,182,0.20)" }}>
              <div className="px-3 py-2.5"
                style={{ background: "rgba(0,119,182,0.08)", borderBottom: "1px solid rgba(0,119,182,0.12)" }}>
                <p className="text-[14px] font-extrabold text-[#0077b6]">🍽 {meal.dish}</p>
              </div>
              <div className="px-3 py-2 space-y-1.5">
                {meal.ingredients.map((ing) => {
                  const inCart = picked.includes(ing.name);
                  return (
                    <div key={ing.name} className="flex items-center justify-between">
                      <span className="text-[13px]">
                        {ing.emoji} {ing.name}
                        {ing.unit && <span className="text-[11px] text-[#8a96b0] ml-1">{ing.unit}</span>}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[12px] text-[#4a5a78]">{ing.price.toLocaleString()}원</span>
                        <button onClick={() => togglePick(ing.name)}
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
          ))}
        </div>
      )}
    </div>
  );
}
