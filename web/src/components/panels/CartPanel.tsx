"use client";
import { useEffect, useState, useMemo } from "react";
import { useApp } from "@/lib/store";
import { getRecipe, getDbItems, recommendRoutes } from "@/lib/api";
import type { DbItem } from "@/lib/types";

export function CartPanel() {
  const {
    lat, lng, radiusM, picked, favItems, togglePick, toggleFavItem,
    recipeDish, recipeIngs, setRecipe, setRoutePlans, setRouteChoice, setPanel,
  } = useApp();

  const [dbItems, setDbItems]     = useState<DbItem[]>([]);
  const [dishQ, setDishQ]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [noRecipe, setNoRecipe]   = useState(false);
  const [search, setSearch]       = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});

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
    const plans = await recommendRoutes({ ingredients: picked, lat, lng, radius: radiusM });
    setRoutePlans(plans);
    setRouteChoice(null);
    setPanel("stores");
  }

  return (
    <div className="space-y-4 text-ink1">

      {/* 요리 검색 */}
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink3">🤖 만들 요리를 검색하세요</p>
        <div className="flex gap-2">
          <input value={dishQ} onChange={(e) => setDishQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchRecipe()}
            placeholder="예: 찜닭, 김치찌개, 잡채…"
            className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-ink1 placeholder:text-ink3 outline-none focus:border-accent/50" />
          <button onClick={searchRecipe} disabled={loading}
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
              const on = picked.includes(ing);
              const m = meta(ing);
              return (
                <button key={ing} onClick={() => togglePick(ing)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-[13px] transition ${on ? "border-accent3/50 bg-accent3/15 text-accent3" : "border-white/10 text-ink2"}`}>
                  {on ? "✓ " : "+ "}{ing}
                  {m && <span className="ml-1 text-[11px] opacity-60">{m.price.toLocaleString()}원</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 품목 검색 */}
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink3">➕ 추가로 담을 품목</p>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="품목명 검색 (예: 대파, 고등어, 배추…)"
          className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-ink1 placeholder:text-ink3 outline-none focus:border-accent/50 mb-2"
        />
        {search.trim() && (
          <div className="max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.03] [scrollbar-width:thin]">
            {addable.length === 0 ? (
              <p className="px-3 py-2 text-[13px] text-ink3">검색 결과 없음</p>
            ) : (
              addable.slice(0, 30).map((item) => (
                <button key={item.item_key}
                  onClick={() => { togglePick(item.item_key); setSearch(""); }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-white/5 border-b border-white/5 last:border-0">
                  <span>
                    <span className="font-medium">{item.name}</span>
                    <span className="ml-2 text-[11px] text-ink3">{item.category}</span>
                  </span>
                  <span className="font-mono text-accent3 shrink-0 ml-2">
                    {item.price.toLocaleString()}원
                    <span className="text-[10px] text-ink3 ml-1">/{item.unit}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* 담은 재료 */}
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink3">🧺 담은 재료</p>
        {picked.length === 0 ? (
          <p className="text-[13px] text-ink3">아직 담은 재료가 없어요. 위에서 요리를 검색하거나 직접 담아보세요.</p>
        ) : (
          <div className="space-y-1.5">
            {picked.map((key) => {
              const m = meta(key);
              const fav = favItems.includes(key);
              const q = qty(key);
              const lineTotal = (m?.price ?? 0) * q;

              return (
                <div key={key} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2">
                  {/* 이름·단위 */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-[13px] font-bold leading-tight">
                      {fav && <span className="text-[#f5c84b] text-[11px]">★</span>}
                      <span className="truncate">{m?.name ?? key}</span>
                    </div>
                    <div className="text-[10px] text-ink3">{m?.unit} · {m?.category}</div>
                  </div>

                  {/* 수량 조절 */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => changeQty(key, -1)}
                      className="flex h-6 w-6 items-center justify-center rounded border border-white/10 text-[14px] text-ink2 hover:bg-white/5 leading-none">
                      −
                    </button>
                    <span className="w-5 text-center text-[13px] font-mono">{q}</span>
                    <button onClick={() => changeQty(key, +1)}
                      className="flex h-6 w-6 items-center justify-center rounded border border-white/10 text-[14px] text-ink2 hover:bg-white/5 leading-none">
                      +
                    </button>
                  </div>

                  {/* 가격 */}
                  <div className="text-right shrink-0 min-w-[64px]">
                    {m ? (
                      <>
                        <div className="text-[13px] font-bold text-accent3 font-mono">{lineTotal.toLocaleString()}원</div>
                        {q > 1 && <div className="text-[10px] text-ink3">{m.price.toLocaleString()}×{q}</div>}
                      </>
                    ) : (
                      <div className="text-[11px] text-ink3">정보없음</div>
                    )}
                  </div>

                  <button onClick={() => toggleFavItem(key)} className="text-[16px] text-ink3 hover:text-[#f5c84b] shrink-0">{fav ? "★" : "☆"}</button>
                  <button onClick={() => togglePick(key)} className="text-ink3 hover:text-red-400 text-sm shrink-0">✕</button>
                </div>
              );
            })}

            {/* 합계 */}
            <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <div className="flex items-baseline justify-between">
                <div className="text-[10px] uppercase tracking-wide text-ink3">예상 합계</div>
                <div className="font-mono text-xl font-bold text-accent2">{totalPrice.toLocaleString()}원</div>
              </div>
              <div className="text-[10px] text-ink3 mt-0.5">소매가 기준 · 없으면 도매 중앙값</div>
            </div>

            <button onClick={goRoute}
              className="mt-1 w-full rounded-xl border border-accent/40 bg-accent/15 py-3 font-bold text-accent hover:bg-accent/25">
              🧭  추천 경로 보기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
