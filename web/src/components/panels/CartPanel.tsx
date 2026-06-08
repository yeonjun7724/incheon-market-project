"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import { useApp } from "@/lib/store";
import { getRecipe, getDbItems, recommendRoutes, inferItemPrices } from "@/lib/api";
import type { DbItem } from "@/lib/types";

export function CartPanel() {
  const {
    lat, lng, radiusM, picked, unknownItems, addUnknownItem,
    favItems, togglePick, toggleFavItem,
    recipeDish, recipeIngs, setRecipe, setRoutePlans, setRouteChoice, setPanel,
    budget, household, pref, useMarket,
  } = useApp();

  const [dbItems, setDbItems]           = useState<DbItem[]>([]);
  const [inferredMap, setInferredMap]   = useState<Record<string, DbItem>>({});
  const [inferring, setInferring]       = useState<Set<string>>(new Set());
  const inferredRef                     = useRef<Record<string, DbItem>>({});

  const [dishQ, setDishQ]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [noRecipe, setNoRecipe]         = useState(false);
  const [search, setSearch]             = useState("");
  const [quantities, setQuantities]     = useState<Record<string, number>>({});
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  useEffect(() => { getDbItems().then(setDbItems).catch(console.error); }, []);

  // DB에 없는 재료 → AI 가격 추론
  // dbItems 로드 완료 후 + picked 변경 시 모두 실행
  useEffect(() => {
    if (!picked.length) return;
    // dbItems 로딩 중이면 잠시 대기 (최대 100ms)
    const run = () => {
      const missing = picked.filter((key) => {
        if (unknownItems.includes(key)) return false; // 가격 모름 항목은 추론 스킵
        // 가격 > 0 인 DB 항목만 진짜 DB 등록으로 인정
        const inDb        = dbItems.some((i) => (i.item_key === key || i.name === key) && i.price > 0);
        const inInferred  = key in inferredRef.current;
        const inferredPrice = inferredRef.current[key]?.price ?? -1;
        const isInferring = inferring.has(key);
        // DB에 가격 없고, 추론 안 됐거나 가격 0인 항목 재시도
        return !inDb && (!inInferred || inferredPrice === 0) && !isInferring;
      });
      if (!missing.length) return;

      setInferring((prev) => new Set([...prev, ...missing]));
      inferItemPrices(missing, household)
        .then((res) => {
          inferredRef.current = { ...inferredRef.current, ...res };
          setInferredMap((prev) => ({ ...prev, ...res }));
        })
        .catch(console.error)
        .finally(() => {
          setInferring((prev) => {
            const next = new Set(prev);
            missing.forEach((k) => next.delete(k));
            return next;
          });
        });
    };

    if (dbItems.length > 0) {
      run();
    } else {
      // dbItems 아직 로딩 중 — 300ms 후 재시도
      const t = setTimeout(run, 300);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, dbItems, unknownItems]);

  const meta = (key: string): DbItem | undefined => {
    // 가격 있는 DB 항목 우선, 없으면 추론 결과
    const dbItem = dbItems.find((i) => (i.item_key === key || i.name === key) && i.price > 0);
    return dbItem ?? inferredMap[key];
  };

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
    // 구하기 어려운 재료 경고
    const rareItems = picked.filter((k) => meta(k)?.rare);
    if (rareItems.length > 0) {
      setRouteError(`⚠️ 동네 가게에서 구하기 어려운 재료예요\n${rareItems.join(", ")}\n\n장바구니에서 빼고 경로를 검색하거나, 그대로 진행할 수 있어요.`);
    }
    setRouteLoading(true);
    setRouteError(null);
    try {
      const plans = await recommendRoutes({
        ingredients: picked, lat, lng, radius: radiusM,
        budget, household, pref, use_market: useMarket,
        quantities: Object.fromEntries(picked.map((k) => [k, qty(k)])),
      });
      if (!plans || Object.keys(plans).length === 0) {
        // 주변에서 구할 수 없는 재료 안내
        const unavailable = picked.filter((k) => {
          const m = meta(k);
          return !m || m.price === 0;
        });
        if (unavailable.length > 0) {
          setRouteError(`🔍 주변 가게에서 구하기 어려운 재료가 있어요\n${unavailable.join(", ")}\n\n해당 재료를 장바구니에서 빼거나, 조건 탭에서 반경을 늘려보세요.`);
        } else {
          setRouteError("🏪 반경 내 해당 재료를 취급하는 가게가 없어요.\n조건 탭에서 반경을 늘려보세요.");
        }
        return;
      }
      setRouteChoice(null);
      setRoutePlans(plans);
      setTimeout(() => setPanel("stores"), 0);
    } catch (e) {
      console.error("경로 추천 실패:", e);
      setRouteError("서버 연결 오류예요. Railway 백엔드가 실행 중인지 확인해주세요.");
    } finally { setRouteLoading(false); }
  }

  return (
    <div className="space-y-5 pb-2">

      {/* AI 요리 검색 */}
      <section>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#8a96b0]">
          🤖 AI 재료 추천
        </p>
        <div className="flex gap-2">
          <input
            value={dishQ}
            onChange={(e) => setDishQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchRecipe()}
            placeholder="찜닭, 김치찌개, 잡채…"
            className="flex-1 rounded-2xl border border-[#1a2233]/10 bg-[#1a2233]/4 px-4 py-2.5
                       text-[14px] text-[#1a2233] placeholder:text-[#8a96b0] outline-none
                       focus:border-[#0077b6]/40"
          />
          <button onClick={searchRecipe} disabled={loading}
            className="rounded-2xl bg-[#0077b6]/20 border border-[#0077b6]/30 px-5
                       text-[13px] font-bold text-[#0077b6] disabled:opacity-40 active:scale-95 transition">
            {loading ? "…" : "찾기"}
          </button>
        </div>
      </section>

      {noRecipe && (
        <div className="rounded-2xl border border-[#1a2233]/10 bg-[#1a2233]/4 px-4 py-3 text-[13px] text-[#4a5a78]">
          아직 그 레시피는 없어요. 다른 요리로 검색하거나 아래서 직접 담아보세요 🙂
        </div>
      )}

      {/* 레시피 재료 칩 */}
      {recipeDish && (
        <section className="space-y-2">
          <div className="rounded-2xl rounded-bl-sm border border-[#0077b6]/20 bg-[#0077b6]/8
                          px-4 py-3 text-[13px] text-[#1a2233]">
            <b className="text-[#0077b6]">{recipeDish}</b> 재료예요. 담을 재료를 선택하세요 👇
          </div>
          <div className="flex flex-wrap gap-2">
            {recipeIngs.map((ing) => {
              const on  = picked.includes(ing);
              const m   = meta(ing);
              const isAi = m?.price_type === "AI추론";
              return (
                <button key={ing} onClick={() => togglePick(ing)}
                  className={`rounded-full border px-3 py-1.5 text-[13px] transition active:scale-95
                    ${on ? "border-[#e63946]/40 bg-[#e63946]/15 text-[#e63946]"
                         : "border-[#1a2233]/10 bg-[#1a2233]/4 text-[#4a5a78]"}`}>
                  {on ? "✓ " : "+ "}{ing}
                  {m && m.price > 0 && (
                    <span className={`ml-1 text-[11px] opacity-60 ${isAi ? "text-[#f77f00]" : ""}`}>
                      {m.price.toLocaleString()}원{isAi ? "~" : ""}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 직접 담기 */}
      <section>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#8a96b0]">➕ 직접 담기</p>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="품목명 검색 (대파, 배추, 고등어…)"
          className="w-full rounded-2xl border border-[#1a2233]/10 bg-[#1a2233]/4 px-4 py-2.5
                     text-[14px] text-[#1a2233] placeholder:text-[#8a96b0] outline-none
                     focus:border-[#0077b6]/40 mb-2"
        />
        {search.trim() && (
          <div className="rounded-2xl border border-[#1a2233]/8 bg-[#1a2233]/3 overflow-hidden max-h-44 overflow-y-auto [scrollbar-width:thin]">
            {addable.length === 0 ? (
              <button
                onClick={() => {
                  const name = search.trim();
                  addUnknownItem(name);
                  togglePick(name);
                  setSearch("");
                }}
                className="w-full px-4 py-3 text-left text-[13px] hover:bg-[#1a2233]/4 transition">
                <span className="text-[#8a96b0]">검색 결과 없음</span>
                <span className="ml-2 font-semibold text-[#0077b6]">"{search.trim()}" 추가하기 →</span>
              </button>
            ) : addable.slice(0, 30).map((item) => (
              <button key={item.item_key}
                onClick={() => { togglePick(item.item_key); setSearch(""); }}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left
                           hover:bg-[#1a2233]/4 border-b border-[#1a2233]/5 last:border-0 transition">
                <div>
                  <span className="text-[13px] font-medium text-[#1a2233]">{item.name}</span>
                  <span className="ml-2 text-[11px] text-[#8a96b0]">{item.category}</span>
                </div>
                <span className="text-[12px] font-bold text-[#e63946] font-mono shrink-0 ml-2">
                  {item.price.toLocaleString()}원
                  <span className="text-[10px] text-[#8a96b0] ml-1">/{item.unit}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 담은 재료 */}
      {picked.length > 0 && (
        <section>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#8a96b0]">🧺 담은 재료</p>
          <div className="space-y-2">
            {picked.map((key) => {
              const m           = meta(key);
              const isUnknown   = unknownItems.includes(key);
              const isInferring = !isUnknown && inferring.has(key);
              const isAi        = m?.price_type === "AI추론" || m?.price_type === "AI추론~";
              const isRare      = m?.rare === true;
              const fav         = favItems.includes(key);
              const q           = qty(key);
              const lineTotal   = (m?.price ?? 0) * q;

              return (
                <div key={key}
                  className="flex items-center gap-2 rounded-2xl border border-[#1a2233]/8 bg-[#1a2233]/3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#1a2233] leading-tight">
                      {isRare && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: "rgba(230,57,70,0.12)", color: "#e63946" }}>
                          ⚠️ 구하기 어려움
                        </span>
                      )}
                      {fav && <span className="text-yellow-400 text-[11px]">★</span>}
                      <span className="truncate">{m?.name ?? key}</span>
                      {isAi && (
                        <span className="shrink-0 rounded px-1 py-px text-[9px] font-bold"
                          style={{ background: "rgba(245,166,35,0.2)", color: "#f5a623" }}>AI</span>
                      )}
                    </div>
                    <div className="text-[10px] text-[#8a96b0] mt-0.5">
                      {isUnknown ? "가격 모름 · 제보 후 반영"
                        : isInferring ? "가격 추론 중…"
                        : m ? `${m.unit}${m.unit ? " · " : ""}${m.category}`
                        : "DB 미등록"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => changeQty(key, -1)}
                      className="flex h-6 w-6 items-center justify-center rounded-lg border border-[#1a2233]/10
                                 text-[#4a5a78] hover:bg-[#1a2233]/6 text-[14px] leading-none">−</button>
                    <span className="w-5 text-center text-[13px] font-mono text-[#1a2233]">{q}</span>
                    <button onClick={() => changeQty(key, +1)}
                      className="flex h-6 w-6 items-center justify-center rounded-lg border border-[#1a2233]/10
                                 text-[#4a5a78] hover:bg-[#1a2233]/6 text-[14px] leading-none">+</button>
                  </div>
                  <div className="text-right shrink-0 min-w-[68px]">
                    {isUnknown ? (
                      <div className="text-[11px] text-[#8a96b0]">가격 모름</div>
                    ) : isInferring ? (
                      <div className="text-[11px] text-[#0077b6] animate-pulse">추론 중…</div>
                    ) : m && m.price > 0 ? (
                      <div className={`text-[13px] font-bold font-mono ${isAi ? "text-[#f77f00]" : "text-[#e63946]"}`}>
                        {lineTotal.toLocaleString()}원{isAi ? "~" : ""}
                      </div>
                    ) : (
                      <div className="text-[11px] text-[#8a96b0]">
                        {m?.price === 0 ? "추론 실패" : "가격없음"}
                      </div>
                    )}
                  </div>
                  <button onClick={() => toggleFavItem(key)}
                    className="text-[15px] text-[#8a96b0] hover:text-yellow-400 shrink-0">{fav ? "★" : "☆"}</button>
                  <button onClick={() => togglePick(key)}
                    className="text-[#8a96b0] hover:text-red-400 text-[13px] shrink-0">✕</button>
                </div>
              );
            })}

            <div className="rounded-2xl border border-[#1a2233]/8 bg-[#1a2233]/3 px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-[#8a96b0]">예상 합계</div>
                <div className="text-[10px] text-[#1a2233]/20 mt-0.5">소매가 기준 (AI추론 포함)</div>
              </div>
              <div className="text-[20px] font-black font-mono text-[#e63946]">
                {totalPrice.toLocaleString()}원
              </div>
            </div>

            {routeError && (
              <div className="rounded-2xl px-4 py-3 text-[13px] leading-relaxed"
                style={{ background: "rgba(230,57,70,0.08)", border: "1px solid rgba(230,57,70,0.20)", color: "#e63946" }}>
                <div className="font-bold mb-1">🔍 경로를 찾지 못했어요</div>
                {routeError.split("\n").map((line, i) => <div key={i}>{line}</div>)}
                <button onClick={() => setRouteError(null)}
                  className="mt-2 text-[11px] underline opacity-60">닫기</button>
              </div>
            )}
            <button onClick={goRoute} disabled={routeLoading}
              className="w-full rounded-2xl bg-[#0077b6]/20 border border-[#0077b6]/30
                         py-4 text-[15px] font-bold text-[#0077b6]
                         hover:bg-[#0077b6]/30 disabled:opacity-40 transition active:scale-[0.98]">
              {routeLoading ? "⏳ 경로 계산 중…" : "🧭 추천 경로 보기"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
