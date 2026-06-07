"use client";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { recommendMeals } from "@/lib/api";
import type { MealCard } from "@/lib/types";

const RADII = [
  { lbl: "500m", v: 500 }, { lbl: "1km", v: 1000 }, { lbl: "2km", v: 2000 },
  { lbl: "3km", v: 3000 }, { lbl: "5km", v: 5000 },
];
const PREFS = ["균형", "채소", "저단백", "고단백"];

const activeBtn = "border-[#0077b6]/50 bg-[#0077b6]/10 text-[#0077b6]";
const inactiveBtn = "border-[#1a2233]/12 text-[#4a5a78] hover:border-[#0077b6]/30";

export function ConditionPanel() {
  const { radiusM, setRadius, budget, household, pref, useMarket, setCondition, picked, togglePick } = useApp();
  const [meals, setMeals] = useState<MealCard[]>([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setMeals([]);
    try {
      const r = await recommendMeals({ pref, budget, household });
      setMeals(r.meals);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 text-[#1a2233]">
      {/* 탐색 반경 */}
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

      {/* 예산 */}
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#8a96b0]">예산</p>
        <input type="range" min={10000} max={200000} step={5000} value={budget}
          onChange={(e) => setCondition({ budget: Number(e.target.value) })}
          className="w-full accent-[#0077b6]" />
        <p className="mt-1 font-mono text-2xl font-bold text-[#e63946]">{budget.toLocaleString()}원</p>
      </div>

      {/* 가구 + 가격 기준 */}
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

      {/* 식단 */}
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

      {/* AI 식단 추천 버튼 */}
      <button onClick={run} disabled={loading}
        className="w-full rounded-xl py-3 font-bold transition hover:opacity-90 disabled:opacity-50"
        style={{ background: "#0077b6", color: "#fff" }}>
        {loading ? "AI 분석 중…" : "✨  AI 식단 추천"}
      </button>

      {/* 식단 카드 */}
      {meals.map((meal, mi) => (
        <div key={mi} className="rounded-xl overflow-hidden"
          style={{ border: "1px solid rgba(26,34,51,0.10)" }}>
          {/* 음식명 헤더 */}
          <div className="flex items-center justify-between px-4 py-3"
            style={{ background: "rgba(0,119,182,0.06)", borderBottom: "1px solid rgba(26,34,51,0.08)" }}>
            <span className="font-bold text-[14px] text-[#1a2233]">🍳 {meal.dish}</span>
            <button
              onClick={() => meal.ingredients.forEach((it) => { if (!picked.includes(it.name)) togglePick(it.name); })}
              className="rounded-full px-3 py-1 text-[11px] font-bold transition active:scale-95"
              style={{ background: "#0077b6", color: "#fff" }}>
              전체 담기
            </button>
          </div>

          {/* 재료 목록 */}
          <div>
            {meal.ingredients.map((it, ii) => {
              const inCart = picked.includes(it.name);
              return (
                <div key={it.name}
                  className="flex items-center justify-between px-4 py-2.5 text-[13px]"
                  style={{ borderTop: ii > 0 ? "1px solid rgba(26,34,51,0.06)" : undefined }}>
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-[16px]">{it.emoji}</span>
                    <span className="text-[#1a2233] truncate">{it.name}</span>
                    {it.unit && (
                      <span className="text-[11px] text-[#8a96b0] shrink-0">{it.unit}</span>
                    )}
                  </span>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="font-mono text-[13px] text-[#4a5a78]">
                      {it.price.toLocaleString()}원
                    </span>
                    <button
                      onClick={() => togglePick(it.name)}
                      className={`rounded px-2 py-1 text-[11px] border transition active:scale-95 ${
                        inCart
                          ? "border-[#f77f00]/40 bg-[#f77f00]/10 text-[#f77f00]"
                          : "border-[#1a2233]/12 text-[#8a96b0] hover:border-[#0077b6]/40 hover:text-[#0077b6]"
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
  );
}
