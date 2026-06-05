"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { getRecipe, getItems, recommendRoutes } from "@/lib/api";
import type { Item } from "@/lib/types";

export function CartPanel() {
  const {
    lat, lng, radiusM, picked, favItems, togglePick, toggleFavItem,
    recipeDish, recipeIngs, setRecipe, setRoutePlans, setRouteChoice, setPanel,
  } = useApp();

  const [items, setItems] = useState<Item[]>([]);
  const [dishQ, setDishQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [noRecipe, setNoRecipe] = useState(false);
  const [manual, setManual] = useState("");

  useEffect(() => { getItems().then(setItems).catch(console.error); }, []);

  const meta = (name: string) => items.find((i) => i.name === name);
  const priceRange = (name: string): [number, number] => {
    const m = meta(name);
    if (!m) return [0, 0];
    return [Math.min(m.market_price, m.supermarket_price),
            Math.max(m.market_price, m.supermarket_price)];
  };

  async function search() {
    if (!dishQ.trim()) return;
    setLoading(true); setNoRecipe(false);
    try {
      const r = await getRecipe(dishQ.trim());
      if (r.dish) setRecipe(r.dish, r.ingredients);
      else { setRecipe(null, []); setNoRecipe(true); }
    } finally { setLoading(false); }
  }

  async function goRoute() {
    if (!picked.length) return;
    const plans = await recommendRoutes({ ingredients: picked, lat, lng, radius: radiusM });
    setRoutePlans(plans);
    setRouteChoice(null);
    setPanel("stores");
  }

  const addable = items.map((i) => i.name).filter((n) => !picked.includes(n));
  const totalLo = picked.reduce((s, n) => s + priceRange(n)[0], 0);
  const totalHi = picked.reduce((s, n) => s + priceRange(n)[1], 0);

  return (
    <div className="space-y-4 text-ink1">
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink3">🤖 만들 요리를 검색하세요</p>
        <div className="flex gap-2">
          <input value={dishQ} onChange={(e) => setDishQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="예: 찜닭, 김치찌개, 잡채…"
            className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-ink1 placeholder:text-ink3 outline-none focus:border-accent/50" />
          <button onClick={search} disabled={loading}
            className="rounded-lg border border-accent/40 bg-accent/15 px-4 text-sm font-semibold text-accent disabled:opacity-50">
            {loading ? "…" : "재료 찾기"}
          </button>
        </div>
      </div>

      {noRecipe && (
        <div className="rounded-2xl rounded-br-sm border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-[13px] text-ink2">
          음… 아직 그 요리 레시피는 없어요. 다른 요리로 검색하거나 아래에서 직접 담아보세요 🙂
        </div>
      )}

      {recipeDish && (
        <div className="space-y-2">
          <div className="max-w-[88%] rounded-2xl rounded-bl-sm border border-accent/20 bg-accent/10 px-3.5 py-2.5 text-[13px]">
            <b>{recipeDish}</b> 만들 거야. 뭐 필요해?
          </div>
          <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-sm border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-[13px] text-ink2">
            <b className="text-accent3">{recipeDish}</b>엔 다음 재료가 들어가요<br />
            {recipeIngs.map((x, i) => `${i + 1}. ${x}`).join("  ")}
            <div className="mt-1 text-ink3">담을 재료를 눌러 ON/OFF 하세요 ↓</div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {recipeIngs.map((ing) => {
              const on = picked.includes(ing); const m = meta(ing);
              return (
                <button key={ing} onClick={() => togglePick(ing)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-[13px] transition ${on ? "border-accent3/50 bg-accent3/15 text-accent3" : "border-white/10 text-ink2"}`}>
                  {on ? "✓ " : "+ "}{m?.emoji ?? ""} {ing}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink3">➕ 추가로 담을 품목</p>
        <div className="flex gap-2">
          <select value={manual} onChange={(e) => setManual(e.target.value)}
            className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-ink1 outline-none">
            <option value="">선택…</option>
            {addable.map((n) => <option key={n} value={n}>{meta(n)?.emoji} {n}</option>)}
          </select>
          <button onClick={() => { if (manual) { togglePick(manual); setManual(""); } }}
            className="rounded-lg border border-white/10 px-4 text-sm text-ink2">담기</button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink3">🧺 담은 재료</p>
        {picked.length === 0 ? (
          <p className="text-[13px] text-ink3">아직 담은 재료가 없어요. 위에서 요리를 검색하거나 직접 담아보세요.</p>
        ) : (
          <div className="space-y-1.5">
            {picked.map((n) => {
              const m = meta(n); const [lo, hi] = priceRange(n); const fav = favItems.includes(n);
              return (
                <div key={n} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
                  <span className="text-xl">{m?.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[13px] font-bold">
                      {fav && <span className="text-[#f5c84b]">★</span>}{n}
                    </div>
                    <div className="text-[11px] text-ink3">{m?.unit} · {m?.category}</div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-[14px] font-bold text-accent3">{lo.toLocaleString()}원</div>
                    <div className="text-[11px] text-ink3">~ {hi.toLocaleString()}원</div>
                  </div>
                  <button onClick={() => toggleFavItem(n)} title="자주 사는 품목"
                    className="text-lg text-ink3 hover:text-[#f5c84b]">{fav ? "★" : "☆"}</button>
                  <button onClick={() => togglePick(n)} className="text-ink3 hover:text-red-400">✕</button>
                </div>
              );
            })}

            <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-ink3">예상 합계 (최저가)</div>
                  <div className="font-mono text-2xl font-bold text-accent2">{totalLo.toLocaleString()}원</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wide text-ink3">최고가 기준</div>
                  <div className="font-mono text-ink2">{totalHi.toLocaleString()}원</div>
                </div>
              </div>
            </div>

            <button onClick={goRoute}
              className="mt-2 w-full rounded-xl border border-accent/40 bg-accent/15 py-3 font-bold text-accent hover:bg-accent/25">
              🧭  추천 경로 보기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
