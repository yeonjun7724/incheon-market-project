"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { getStores, getItems, recommendRoutes } from "@/lib/api";
import type { Store, Item, SavedRoute } from "@/lib/types";
import { useState as _useState } from "react";

export function FavoritesPanel() {
  const {
    lat, lng, radiusM, favStores, favItems, toggleFavStore,
    setRoutePlans, setRouteChoice, setPanel, picked,
  } = useApp();
  const [stores, setStores] = useState<Store[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [addSel, setAddSel] = useState("");
  const [openStore, setOpenStore] = useState<string | null>(null);   // 펼친 가게

  useEffect(() => {
    getStores(lat, lng, radiusM).then(setStores).catch(console.error);
    getItems().then(setItems).catch(console.error);
  }, [lat, lng, radiusM]);

  const storeById = (id: string) => stores.find((s) => s.id === id);
  const itemMeta = (n: string) => items.find((i) => i.name === n);
  const addable = stores.filter((s) => !favStores.includes(s.id));

  // 해당 가게에서 살 수 있는 품목 — 자주 사는 품목 먼저, 그 뒤 일반 품목 (최대 6개)
  function storeItems(): Item[] {
    const favFirst = favItems.map(itemMeta).filter(Boolean) as Item[];
    const rest = items.filter((i) => !favItems.includes(i.name));
    return [...favFirst, ...rest].slice(0, 6);
  }

  async function routeFromFavItems() {
    const ings = favItems.length ? favItems : picked;
    if (!ings.length) return;
    const plans = await recommendRoutes({ ingredients: ings, lat, lng, radius: radiusM });
    setRoutePlans(plans); setRouteChoice(null); setPanel("stores");
  }

  const { savedRoutes, deleteSavedRoute } = useApp();

  return (
    <div className="space-y-5 text-ink1">

      {/* 저장된 경로 */}
      {savedRoutes.length > 0 && (
        <section>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink3">🗺️ 저장된 경로</p>
          <div className="space-y-2">
            {savedRoutes.map((r) => (
              <SavedRouteCard key={r.id} r={r} onDelete={() => deleteSavedRoute(r.id)} onReuse={() => { setPanel("cart"); }} />
            ))}
          </div>
        </section>
      )}

      {/* 자주 가는 가게 */}
      <section>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink3">📌 자주 가는 가게</p>
        <div className="mb-2 flex gap-2">
          <select value={addSel} onChange={(e) => setAddSel(e.target.value)}
            className="flex-1 rounded-lg border border-[#1a2233]/10 bg-white/[0.03] px-3 py-2 text-sm text-ink1 outline-none">
            <option value="">가게 추가…</option>
            {addable.slice(0, 40).map((s) => <option key={s.id} value={s.id}>{s.name} · {s.gu}</option>)}
          </select>
          <button onClick={() => { if (addSel) { toggleFavStore(addSel); setAddSel(""); } }}
            className="rounded-lg border border-[#1a2233]/10 px-4 text-sm text-ink2">등록</button>
        </div>
        {favStores.length === 0 ? (
          <p className="text-[12px] text-ink3">아직 자주 가는 가게가 없어요. 위에서 추가하거나 체크리스트에서 📌로 등록하세요.</p>
        ) : (
          <div className="space-y-1.5">
            {favStores.map((id) => {
              const s = storeById(id);
              const expanded = openStore === id;
              return (
                <div key={id} className="rounded-lg border border-[#1a2233]/10 bg-white/[0.03]">
                  <button onClick={() => setOpenStore(expanded ? null : id)}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
                    <span className="text-[#f5c84b]">★</span>
                    <span className="flex-1 text-[13px] font-bold">{s?.name ?? id}</span>
                    <span className="text-[11px] text-ink3">{s?.gu} · {s?.type}</span>
                    <span className="text-ink2">{expanded ? "∧" : "∨"}</span>
                  </button>
                  {expanded && (
                    <div className="border-t border-[#1a2233]/5 px-3 py-2">
                      <p className="mb-1 text-[10px] text-ink3">취급 품목 (자주 사는 품목 우선)</p>
                      {storeItems().map((it) => {
                        const lo = Math.min(it.market_price, it.supermarket_price);
                        const fav = favItems.includes(it.name);
                        return (
                          <div key={it.code} className="flex items-center gap-2 py-1 text-[13px]">
                            <span>{it.emoji}</span>
                            <span className="flex-1">{fav && <span className="text-[#f5c84b]">★ </span>}{it.name}</span>
                            <span className="font-mono text-accent3">{lo.toLocaleString()}원</span>
                          </div>
                        );
                      })}
                      <button onClick={() => toggleFavStore(id)} className="mt-1 text-[11px] text-ink3 hover:text-red-400">해제</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 자주 사는 품목 */}
      <section>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink3">⭐ 자주 사는 품목 — 최저가 기준</p>
        {favItems.length === 0 ? (
          <p className="text-[12px] text-ink3">장바구니에서 품목 옆 ☆를 눌러 자주 사는 품목으로 등록하세요.</p>
        ) : (
          <>
            <div className="space-y-1.5">
              {favItems.map((n) => {
                const m = itemMeta(n);
                const lo = m ? Math.min(m.market_price, m.supermarket_price) : 0;
                return (
                  <div key={n} className="flex items-center gap-2 rounded-lg border border-[#1a2233]/10 bg-white/[0.03] px-3 py-2.5">
                    <span className="text-lg">{m?.emoji}</span>
                    <span className="flex-1 text-[13px] font-bold"><span className="text-[#f5c84b]">★</span> {n}</span>
                    <span className="font-mono text-[13px] text-accent3">최저 {lo.toLocaleString()}원</span>
                  </div>
                );
              })}
            </div>
            <button onClick={routeFromFavItems}
              className="mt-2 w-full rounded-xl border border-accent/40 bg-accent/15 py-3 font-bold text-accent hover:bg-accent/25">
              🧭  자주 사는 품목으로 경로 만들기
            </button>
          </>
        )}
      </section>
    </div>
  );
}

function SavedRouteCard({ r, onDelete, onReuse }: { r: SavedRoute; onDelete: () => void; onReuse: () => void }) {
  const [open, setOpen] = _useState(false);
  const date = new Date(r.savedAt);
  const dateStr = `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2,'0')}`;
  const STRAT_COLOR: Record<string, string> = {
    최저예산: "#e85d04", 최소거리: "#0077b6", 최소경유: "#2d9e5f",
  };
  const color = STRAT_COLOR[r.strategy] ?? "#0077b6";

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${color}22`, background: "#fff" }}>
      {/* 헤더 */}
      <button className="w-full flex items-center gap-3 px-4 py-3 text-left"
        style={{ background: `${color}08` }} onClick={() => setOpen(v => !v)}>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-extrabold truncate" style={{ color }}>{r.name}</div>
          <div className="text-[11px] mt-0.5 flex gap-2 flex-wrap" style={{ color: "#8a96b0" }}>
            <span>{r.travelMode === "driving" ? "🚗" : "🚶"} {r.distKm}km · {r.totalMin}분</span>
            <span className="font-bold" style={{ color: "#e85d04" }}>
              총 {(r.grandTotal || r.budget).toLocaleString()}원
            </span>
          </div>
        </div>
        <span style={{ color: "#8a96b0", fontSize: 14 }}>{open ? "▲" : "▼"}</span>
      </button>

      {/* 거래 내역 상세 */}
      {open && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: `1px solid ${color}15` }}>
          <p className="text-[10px] font-bold uppercase tracking-wider pt-2" style={{ color: "#8a96b0" }}>
            {dateStr} 장보기 기록
          </p>

          {r.purchases?.length > 0 ? r.purchases.map((ps, i) => (
            <div key={i} className="rounded-xl overflow-hidden"
              style={{ border: "1px solid rgba(26,34,51,0.08)" }}>
              {/* 가게 헤더 */}
              <div className="flex items-center justify-between px-3 py-2"
                style={{ background: "rgba(26,34,51,0.04)" }}>
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white"
                    style={{ background: color }}>{i+1}</span>
                  <span className="text-[12px] font-bold text-[#1a2233]">{ps.name}</span>
                  <span className="text-[10px]" style={{ color: "#8a96b0" }}>{ps.type}</span>
                </div>
                <span className="text-[12px] font-black font-mono" style={{ color }}>
                  {ps.subtotal.toLocaleString()}원
                </span>
              </div>
              {/* 품목 목록 */}
              <div className="divide-y divide-[#1a2233]/05">
                {ps.items.map((it, j) => (
                  <div key={j} className="flex items-center gap-2 px-3 py-1.5">
                    <span className="text-[14px]">{it.emoji}</span>
                    <span className="flex-1 text-[12px] text-[#1a2233]">{it.name}</span>
                    <span className="text-[11px]" style={{ color: "#8a96b0" }}>{it.unit}</span>
                    <span className="text-[12px] font-bold font-mono" style={{ color: "#e85d04" }}>
                      {it.price.toLocaleString()}원
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )) : (
            /* 거래 내역 없는 구 버전 경로 — 경유지만 표시 */
            <div className="flex flex-wrap gap-1">
              {r.stops.map((s, i) => (
                <span key={i} className="rounded-full px-2 py-0.5 text-[10px]"
                  style={{ background: "rgba(26,34,51,0.06)", color: "#4a5a78" }}>
                  {i+1}. {s.name}
                </span>
              ))}
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="flex gap-2 pt-1">
            <button onClick={onReuse}
              className="flex-1 rounded-xl py-2 text-[12px] font-bold"
              style={{ background: `${color}15`, color }}>
              🔄 이 재료로 다시 검색
            </button>
            <button onClick={onDelete}
              className="rounded-xl px-3 py-2 text-[12px] font-bold"
              style={{ background: "rgba(230,57,70,0.08)", color: "#e63946" }}>
              삭제
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
