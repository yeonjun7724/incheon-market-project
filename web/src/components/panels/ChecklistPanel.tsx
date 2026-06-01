"use client";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { getBuyingTip } from "@/lib/api";

export function ChecklistPanel() {
  const { routePlans, routeChoice, setRouteChoice, setPanel, toggleFavStore, favStores } = useApp();
  const [bought, setBought] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});       // 상점 아코디언
  const [tip, setTip] = useState<{ name: string; tips: string[] } | null>(null);
  const [tipLoading, setTipLoading] = useState<string | null>(null);

  if (!routeChoice || !routePlans[routeChoice]) {
    return (
      <div className="py-6 text-center text-sm text-ink3">
        먼저 <button onClick={() => setPanel("stores")} className="text-accent underline">추천 경로</button>에서 경로를 선택해 주세요.
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {Object.keys(routePlans).map((k) => (
            <button key={k} onClick={() => setRouteChoice(k)}
              className="rounded-full border border-white/10 px-3 py-1 text-xs text-ink2 hover:text-accent">{k}</button>
          ))}
        </div>
      </div>
    );
  }

  const plan = routePlans[routeChoice];
  const grandTotal = Object.values(plan.by_store).flatMap((s) => s.items).reduce((sum, it) => sum + it.price, 0);
  const boughtTotal = Object.entries(plan.by_store)
    .flatMap(([sid, s]) => s.items.map((it) => ({ key: `${sid}::${it.name}`, p: it.price })))
    .filter((x) => bought[x.key]).reduce((sum, x) => sum + x.p, 0);

  async function showTip(name: string) {
    setTipLoading(name);
    try { setTip(await getBuyingTip(name)); }
    catch { setTip({ name, tips: ["팁 정보를 불러오지 못했어요."] }); }
    finally { setTipLoading(null); }
  }

  return (
    <div className="space-y-3 text-ink1">
      {/* 진행률 */}
      <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-ink3">담은 금액 / 예상 합계</div>
          <div className="font-mono text-lg">
            <span className="font-bold text-accent3">{boughtTotal.toLocaleString()}</span>
            <span className="text-ink3"> / {grandTotal.toLocaleString()}원</span>
          </div>
        </div>
        <div className="h-2 w-24 overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-accent3" style={{ width: `${grandTotal ? (boughtTotal / grandTotal) * 100 : 0}%` }} />
        </div>
      </div>

      {/* 상점별 아코디언 — 기본: 첫 상점만 펼침 */}
      {plan.stops.map((store, i) => {
        const entry = plan.by_store[store.id];
        if (!entry) return null;
        const storeTotal = entry.items.reduce((s, it) => s + it.price, 0);
        const isFav = favStores.includes(store.id);
        const expanded = open[store.id] ?? i === 0;
        return (
          <div key={store.id} className="rounded-lg border border-white/10 bg-white/[0.03]">
            {/* 헤더 (∧∨ 토글) */}
            <button onClick={() => setOpen((o) => ({ ...o, [store.id]: !expanded }))}
              className="flex w-full items-center gap-2 px-3 py-3 text-left">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-xs font-extrabold text-[#04101f]">{i + 1}</span>
              <span className="flex-1 text-[14px] font-extrabold">{store.name}</span>
              <span className="text-[11px] text-ink3">{storeTotal.toLocaleString()}원</span>
              <span className="text-ink2">{expanded ? "∧" : "∨"}</span>
            </button>

            {expanded && (
              <div className="px-3 pb-3">
                <div className="mb-1.5 flex items-center justify-between text-[11px] text-ink3">
                  <span>{store.gu} · {store.type} · 사야할 항목</span>
                  <button onClick={() => toggleFavStore(store.id)} title="자주 가는 가게로 등록"
                    className={isFav ? "text-[#f5c84b]" : "text-ink3"}>📌 {isFav ? "등록됨" : "등록"}</button>
                </div>
                {entry.items.map((it) => {
                  const key = `${store.id}::${it.name}`;
                  const done = !!bought[key];
                  return (
                    <div key={key} className="flex items-center gap-2 border-t border-white/5 py-2">
                      <span>{it.emoji}</span>
                      <span className={`flex-1 text-[13px] ${done ? "text-ink3 line-through" : ""}`}>
                        {it.name} <span className="text-ink3">{it.unit}</span>
                      </span>
                      {/* ? 재료 팁 */}
                      <button onClick={() => showTip(it.name)} title="좋은 재료 고르는 법"
                        className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 text-[11px] font-bold text-accent">
                        {tipLoading === it.name ? "…" : "?"}
                      </button>
                      <span className="font-mono text-[13px] font-bold text-accent2">{it.price.toLocaleString()}원</span>
                      <button onClick={() => setBought((b) => ({ ...b, [key]: !b[key] }))}
                        title="샀으면 체크"
                        className={`flex h-6 w-6 items-center justify-center rounded-md border text-xs
                          ${done ? "border-accent3/50 bg-accent3/15 text-accent3" : "border-white/15 text-ink3"}`}>
                        {done ? "✓" : "○"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div className="flex gap-2">
        <button onClick={() => setPanel("report")}
          className="flex-1 rounded-xl border border-[#a78bfa]/40 bg-[#a78bfa]/15 py-3 font-bold text-[#a78bfa] hover:bg-[#a78bfa]/25">
          📝 가격 제보하기
        </button>
        <button onClick={() => { setBought({}); setRouteChoice(null); setPanel(null); }}
          className="flex-1 rounded-xl border border-[#ff6bd6]/40 bg-[#ff6bd6]/15 py-3 font-bold text-[#ff6bd6] hover:bg-[#ff6bd6]/25">
          ✅ 장보기 완료
        </button>
      </div>

      {/* ? 팁 팝업 */}
      {tip && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 px-4"
          onClick={() => setTip(null)}>
          <div className="glass w-full max-w-sm rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-ink1">💡 좋은 {tip.name} 고르는 법</h3>
              <button onClick={() => setTip(null)} className="text-ink2">×</button>
            </div>
            <ol className="list-decimal space-y-2 pl-5 text-[13px] text-ink2">
              {tip.tips.map((t, idx) => <li key={idx}>{t}</li>)}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
