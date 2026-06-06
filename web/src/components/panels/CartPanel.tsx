"use client";
import { useEffect, useState, useMemo } from "react";
import { useApp } from "@/lib/store";
import { getRecipe, getDbItems, recommendRoutes } from "@/lib/api";
import type { DbItem } from "@/lib/types";

export function CartPanel() {
  const {
    lat, lng, radiusM, picked, favItems, togglePick, toggleFavItem,
    recipeDish, recipeIngs, setRecipe, setRoutePlans, setRouteChoice, setPanel,
    budget, household, pref, useMarket,
  } = useApp();

  const [dbItems, setDbItems]     = useState<DbItem[]>([]);
  const [dishQ, setDishQ]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [noRecipe, setNoRecipe]   = useState(false);
  const [search, setSearch]       = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [routeLoading, setRouteLoading] = useState(false);

  useEffect(() => { getDbItems().then(setDbItems).catch(console.error); }, []);

  const meta = (key: string) =>
    dbItems.find((i) => i.item_key === key || i.name === key);

  const qty = (key: string) => quantities[key] ?? 1;
  const changeQty = (key: string, delta: number) =>
    setQuantities((prev) => ({ ...prev, [key]: Math.max(1, Math.min(20, (prev[key] ?? 1) + delta)) }));

  const addable = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dbItems
      .filter((i) => !picked.includes(i.item_key))
      .filter((i) => !q || i.name.includes(q) || i.item_key.includes(q) || i.category.includes(q));
  }, [dbItems, picked, search]);

  const totalPrice = picked.reduce((s, key) => s + (meta(key)?.price ?? 0) * qty(key), 0);

  async function searchRecipe() {
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
    setRouteLoading(true);
    try {
      const plans = await recommendRoutes({
        ingredients: picked, lat, lng, radius: radiusM,
        budget, household, pref, use_market: useMarket,
      });
      setRoutePlans(plans);
      setRouteChoice(null);
      setPanel("stores");
    } finally {
      setRouteLoading(false);
    }
  }

  return (
    <div className="space-y-5 pb-2">

      {/* AI 요리 검색 */}
      <section>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-white/35">
          🤖 AI 재료 추천
        </p>
        <div className="flex gap-2">
          <input
            value={dishQ}
            onChange={(e) => setDishQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchRecipe()}
            placeholder="찜닭, 김치찌개, 잡채…"
            className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5
                       text-[14px] text-white placeholder:text-white/25 outline-none
                       focus:border-[#63b7ff]/40"
          />
          <button
            onClick={searchRecipe}
            disabled={loading}
            className="rounded-2xl bg-[#63b7ff]/20 border border-[#63b7ff]/30 px-5
                       text-[13px] font-bold text-[#63b7ff] disabled:opacity-40
                       active:scale-95 transition"
          >
            {loading ? "…" : "찾기"}
          </button>
        </div>
      </section>

      {/* 매칭 없음 */}
      {noRecipe && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[13px] text-white/50">
          아직 그 레시피는 없어요. 다른 요리로 검색하거나 아래서 직접 담아보세요 🙂
        </div>
      )}

      {/* 레시피 버블 */}
      {recipeDish && (
        <section className="space-y-2">
          <div className="rounded-2xl rounded-bl-sm border border-[#63b7ff]/20 bg-[#63b7ff]/8
                          px-4 py-3 text-[13px] text-white">
            <b className="text-[#63b7ff]">{recipeDish}</b> 재료예요. 담을 재료를 선택하세요 👇
          </div>
          {/* 재료 칩 */}
          <div className="flex flex-wrap gap-2">
            {recipeIngs.map((ing) => {
              const on  = picked.includes(ing);
              const m   = meta(ing);
              return (
                <button
                  key={ing}
                  onClick={() => togglePick(ing)}
                  className={`rounded-full border px-3 py-1.5 text-[13px] transition active:scale-95
                    ${on
                      ? "border-[#4ade80]/40 bg-[#4ade80]/15 text-[#4ade80]"
                      : "border-white/10 bg-white/5 text-white/60"}`}
                >
                  {on ? "✓ " : "+ "}{ing}
                  {m && <span className="ml-1 text-[11px] opacity-50">{m.price.toLocaleString()}원</span>}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 품목 추가 검색 */}
      <section>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-white/35">
          ➕ 직접 담기
        </p>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="품목명 검색 (대파, 배추, 고등어…)"
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5
                     text-[14px] text-white placeholder:text-white/25 outline-none
                     focus:border-[#63b7ff]/40 mb-2"
        />
        {search.trim() && (
          <div className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden max-h-44 overflow-y-auto [scrollbar-width:thin]">
            {addable.length === 0 ? (
              <p className="px-4 py-3 text-[13px] text-white/35">검색 결과 없음</p>
            ) : addable.slice(0, 30).map((item) => (
              <button key={item.item_key}
                onClick={() => { togglePick(item.item_key); setSearch(""); }}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left
                           hover:bg-white/5 border-b border-white/5 last:border-0 transition">
                <div>
                  <span className="text-[13px] font-medium text-white">{item.name}</span>
                  <span className="ml-2 text-[11px] text-white/30">{item.category}</span>
                </div>
                <span className="text-[12px] font-bold text-[#4ade80] font-mono shrink-0 ml-2">
                  {item.price.toLocaleString()}원
                  <span className="text-[10px] text-white/30 ml-1">/{item.unit}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 담은 재료 */}
      {picked.length > 0 && (
        <section>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-white/35">
            🧺 담은 재료
          </p>
          <div className="space-y-2">
            {picked.map((key) => {
              const m   = meta(key);
              const fav = favItems.includes(key);
              const q   = qty(key);
              const lineTotal = (m?.price ?? 0) * q;

              return (
                <div key={key}
                  className="flex items-center gap-2 rounded-2xl border border-white/8 bg-white/3 px-3 py-2.5">
                  {/* 이름 */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-[13px] font-semibold text-white leading-tight">
                      {fav && <span className="text-yellow-400 text-[11px]">★</span>}
                      <span className="truncate">{m?.name ?? key}</span>
                    </div>
                    <div className="text-[10px] text-white/30 mt-0.5">
                      {m ? `${m.unit} · ${m.category}` : "DB 미등록"}
                    </div>
                  </div>
                  {/* 수량 */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => changeQty(key, -1)}
                      className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10
                                 text-white/50 hover:bg-white/8 text-[14px] leading-none">−</button>
                    <span className="w-5 text-center text-[13px] font-mono text-white">{q}</span>
                    <button onClick={() => changeQty(key, +1)}
                      className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10
                                 text-white/50 hover:bg-white/8 text-[14px] leading-none">+</button>
                  </div>
                  {/* 가격 */}
                  <div className="text-right shrink-0 min-w-[60px]">
                    {m ? (
                      <div className="text-[13px] font-bold text-[#4ade80] font-mono">
                        {lineTotal.toLocaleString()}원
                      </div>
                    ) : (
                      <div className="text-[11px] text-white/25">정보없음</div>
                    )}
                  </div>
                  <button onClick={() => toggleFavItem(key)}
                    className="text-[15px] text-white/25 hover:text-yellow-400 shrink-0">{fav ? "★" : "☆"}</button>
                  <button onClick={() => togglePick(key)}
                    className="text-white/25 hover:text-red-400 text-[13px] shrink-0">✕</button>
                </div>
              );
            })}

            {/* 합계 */}
            <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-white/30">예상 합계</div>
                <div className="text-[10px] text-white/20 mt-0.5">소매가 기준</div>
              </div>
              <div className="text-[20px] font-black font-mono text-[#4ade80]">
                {totalPrice.toLocaleString()}원
              </div>
            </div>

            <button
              onClick={goRoute}
              disabled={routeLoading}
              className="w-full rounded-2xl bg-[#63b7ff]/20 border border-[#63b7ff]/30
                         py-4 text-[15px] font-bold text-[#63b7ff]
                         hover:bg-[#63b7ff]/30 disabled:opacity-40 transition active:scale-[0.98]"
            >
              {routeLoading ? "⏳ 경로 계산 중…" : "🧭 추천 경로 보기"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
