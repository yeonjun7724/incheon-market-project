"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { getStores, getItems, recommendRoutes } from "@/lib/api";
import type { Store, Item } from "@/lib/types";

export function FavoritesPanel() {
  const {
    lat, lng, radiusM, favStores, favItems, toggleFavStore,
    setRoutePlans, setRouteChoice, setPanel, picked,
  } = useApp();
  const [stores, setStores] = useState<Store[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [addSel, setAddSel] = useState("");

  useEffect(() => {
    getStores(lat, lng, radiusM).then(setStores).catch(console.error);
    getItems().then(setItems).catch(console.error);
  }, [lat, lng, radiusM]);

  const storeById = (id: string) => stores.find((s) => s.id === id);
  const itemMeta = (n: string) => items.find((i) => i.name === n);
  const addable = stores.filter((s) => !favStores.includes(s.id));

  async function routeFromFavItems() {
    const ings = favItems.length ? favItems : picked;
    if (!ings.length) return;
    const plans = await recommendRoutes({ ingredients: ings, lat, lng, radius: radiusM });
    setRoutePlans(plans); setRouteChoice(null); setPanel("stores");
  }

  return (
    <div className="space-y-5 text-ink1">
      {/* 자주 가는 가게 */}
      <section>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink3">📌 자주 가는 가게</p>
        <div className="mb-2 flex gap-2">
          <select value={addSel} onChange={(e) => setAddSel(e.target.value)}
            className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-ink1 outline-none">
            <option value="">가게 추가…</option>
            {addable.slice(0, 40).map((s) => <option key={s.id} value={s.id}>{s.name} · {s.gu}</option>)}
          </select>
          <button onClick={() => { if (addSel) { toggleFavStore(addSel); setAddSel(""); } }}
            className="rounded-lg border border-white/10 px-4 text-sm text-ink2">등록</button>
        </div>
        {favStores.length === 0 ? (
          <p className="text-[12px] text-ink3">아직 자주 가는 가게가 없어요. 위에서 추가하거나 체크리스트에서 📌로 등록하세요.</p>
        ) : (
          <div className="space-y-1.5">
            {favStores.map((id) => {
              const s = storeById(id);
              return (
                <div key={id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
                  <span className="text-[#f5c84b]">★</span>
                  <span className="flex-1 text-[13px] font-bold">{s?.name ?? id}</span>
                  <span className="text-[11px] text-ink3">{s?.gu} · {s?.type}</span>
                  <button onClick={() => toggleFavStore(id)} className="text-ink3 hover:text-red-400 text-xs">해제</button>
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
                  <div key={n} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
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
