"use client";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { getRecipe, getItems, getDailyPrices, searchItems, recommendRoutes } from "@/lib/api";
import type { Item, ItemSuggestion } from "@/lib/types";

type PriceEntry = { 소매가: number | null; 중앙값: number | null };

export function CartPanel() {
  const {
    lat, lng, radiusM, picked, favItems, togglePick, toggleFavItem,
    recipeDish, recipeIngs, setRecipe, setRoutePlans, setRouteChoice, setPanel,
  } = useApp();

  const [items, setItems]             = useState<Item[]>([]);
  const [priceMap, setPriceMap]       = useState<Record<string, PriceEntry>>({});
  const [dishQ, setDishQ]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [noRecipe, setNoRecipe]       = useState(false);

  // 자동완성
  const [searchQ, setSearchQ]         = useState("");
  const [suggestions, setSuggestions] = useState<ItemSuggestion[]>([]);
  const [showSug, setShowSug]         = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // 시드 품목 메타데이터 (이모지·단위·카테고리용)
  useEffect(() => { getItems().then(setItems).catch(console.error); }, []);

  // DB 가격 맵 로드
  useEffect(() => {
    getDailyPrices().then((rows) => {
      const map: Record<string, PriceEntry> = {};
      for (const r of rows) {
        if (!map[r.item_key]) map[r.item_key] = { 소매가: null, 중앙값: null };
        if (r.소매가  != null && map[r.item_key].소매가  == null) map[r.item_key].소매가  = r.소매가;
        if (r.중앙값  != null && map[r.item_key].중앙값  == null) map[r.item_key].중앙값  = r.중앙값;
      }
      setPriceMap(map);
    }).catch(() => {});
  }, []);

  // 자동완성 debounce
  useEffect(() => {
    if (!searchQ.trim()) { setSuggestions([]); return; }
    const t = setTimeout(() => {
      searchItems(searchQ.trim()).then(setSuggestions).catch(() => setSuggestions([]));
    }, 200);
    return () => clearTimeout(t);
  }, [searchQ]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSug(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const meta = (name: string) => items.find((i) => i.name === name);

  function getDbPrice(name: string): { price: number; label: string } | null {
    const p = priceMap[name];
    if (!p) return null;
    if (p.소매가 != null) return { price: p.소매가, label: "소매가" };
    if (p.중앙값 != null) return { price: p.중앙값, label: "도매가" };
    return null;
  }

  // 시드 폴백용 가격 범위
  function seedRange(name: string): [number, number] {
    const m = meta(name);
    if (!m) return [0, 0];
    return [Math.min(m.market_price, m.supermarket_price),
            Math.max(m.market_price, m.supermarket_price)];
  }

  const total = picked.reduce((s, n) => {
    const db = getDbPrice(n);
    if (db) return s + db.price;
    return s + seedRange(n)[0];
  }, 0);

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

  function selectSuggestion(key: string) {
    if (!picked.includes(key)) togglePick(key);
    setSearchQ("");
    setSuggestions([]);
    setShowSug(false);
  }

  return (
    <div className="space-y-4 text-ink1">
      {/* 요리 검색 */}
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

      {/* 품목 검색 자동완성 */}
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink3">➕ 추가로 담을 품목</p>
        <div ref={searchRef} className="relative">
          <input
            value={searchQ}
            onChange={(e) => { setSearchQ(e.target.value); setShowSug(true); }}
            onFocus={() => { if (suggestions.length) setShowSug(true); }}
            placeholder="품목 검색… (예: 사과, 배추, 고등어)"
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-ink1 placeholder:text-ink3 outline-none focus:border-accent/50"
          />
          {showSug && suggestions.length > 0 && (
            <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-white/10 bg-[#1a2233] shadow-lg">
              {suggestions.map((s) => (
                <li
                  key={s.item_key}
                  onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s.item_key); }}
                  className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm text-ink1 hover:bg-white/[0.06]"
                >
                  <span>{s.item_key}</span>
                  <span className="text-[11px] text-ink3">{s.category}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 담은 재료 */}
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink3">🧺 담은 재료</p>
        {picked.length === 0 ? (
          <p className="text-[13px] text-ink3">아직 담은 재료가 없어요. 위에서 요리를 검색하거나 직접 담아보세요.</p>
        ) : (
          <div className="space-y-1.5">
            {picked.map((n) => {
              const m = meta(n);
              const db = getDbPrice(n);
              const [lo, hi] = seedRange(n);
              const fav = favItems.includes(n);
              return (
                <div key={n} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
                  <span className="text-xl">{m?.emoji ?? "🛒"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[13px] font-bold">
                      {fav && <span className="text-[#f5c84b]">★</span>}{n}
                    </div>
                    <div className="text-[11px] text-ink3">{m?.unit ?? ""} {m?.category ? `· ${m.category}` : ""}</div>
                  </div>
                  <div className="text-right font-mono">
                    {db ? (
                      <>
                        <div className="text-[14px] font-bold text-accent3">{db.price.toLocaleString()}원</div>
                        <div className="text-[11px] text-ink3">({db.label})</div>
                      </>
                    ) : lo > 0 ? (
                      <>
                        <div className="text-[14px] font-bold text-accent3">{lo.toLocaleString()}원</div>
                        <div className="text-[11px] text-ink3">~ {hi.toLocaleString()}원</div>
                      </>
                    ) : (
                      <div className="text-[13px] text-ink3">가격 없음</div>
                    )}
                  </div>
                  <button onClick={() => toggleFavItem(n)} title="자주 사는 품목"
                    className="text-lg text-ink3 hover:text-[#f5c84b]">{fav ? "★" : "☆"}</button>
                  <button onClick={() => togglePick(n)} className="text-ink3 hover:text-red-400">✕</button>
                </div>
              );
            })}

            <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <div className="text-[10px] uppercase tracking-wide text-ink3">예상 합계</div>
              <div className="font-mono text-2xl font-bold text-accent2">{total.toLocaleString()}원</div>
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
