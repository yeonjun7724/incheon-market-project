"use client";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { getBuyingTip } from "@/lib/api";

export function ChecklistPanel() {
  const { routePlans, routeChoice, setRouteChoice, setPanel, toggleFavStore, favStores, setRoutePlans } = useApp();
  const [bought, setBought] = useState<Record<string, boolean>>({});
  const [open, setOpen]     = useState<Record<string, boolean>>({});
  const [tip, setTip]       = useState<{ name: string; tips: string[] } | null>(null);
  const [tipLoading, setTipLoading] = useState<string | null>(null);
  const [done, setDone]     = useState(false);

  /* ── 경로 미선택 ── */
  if (!routeChoice || !routePlans[routeChoice]) {
    return (
      <div className="py-6 text-center text-sm text-ink3">
        먼저 <button onClick={() => setPanel("stores")} className="text-accent underline">추천 경로</button>에서 경로를 선택해 주세요.
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {Object.keys(routePlans).map((k) => (
            <button key={k} onClick={() => setRouteChoice(k)}
              className="rounded-full border border-[#1a2233]/10 px-3 py-1 text-xs text-ink2 hover:text-accent">{k}</button>
          ))}
        </div>
      </div>
    );
  }

  const plan = routePlans[routeChoice];
  const grandTotal  = Object.values(plan.by_store).flatMap((s) => s.items).reduce((sum, it) => sum + it.price, 0);
  const boughtTotal = Object.entries(plan.by_store)
    .flatMap(([sid, s]) => s.items.map((it) => ({ key: `${sid}::${it.name}`, p: it.price })))
    .filter((x) => bought[x.key]).reduce((sum, x) => sum + x.p, 0);
  const allChecked = grandTotal > 0 && boughtTotal === grandTotal;

  async function showTip(name: string) {
    setTipLoading(name);
    try   { setTip(await getBuyingTip(name)); }
    catch { setTip({ name, tips: ["팁 정보를 불러오지 못했어요."] }); }
    finally { setTipLoading(null); }
  }

  function finish() { setDone(true); }

  function restart() {
    setBought({});
    setRouteChoice(null);
    setRoutePlans({});
    setDone(false);
    setPanel(null);
  }

  /* ── 장보기 완료 화면 ── */
  if (done) {
    return (
      <div className="flex flex-col items-center gap-5 py-8 px-2 text-center">
        {/* 축하 아이콘 */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full text-[44px]"
          style={{ background: "rgba(0,119,182,0.10)" }}>
          🛍️
        </div>

        <div>
          <h2 className="text-[20px] font-extrabold text-[#1a2233]">장보기 완료!</h2>
          <p className="mt-1 text-[13px]" style={{ color: "#8a96b0" }}>
            총 <span className="font-bold text-[#0077b6]">{boughtTotal.toLocaleString()}원</span> 사용했어요
          </p>
        </div>

        {/* 절약 메시지 */}
        {grandTotal - boughtTotal > 0 && (
          <div className="w-full rounded-2xl px-4 py-3"
            style={{ background: "rgba(45,158,95,0.08)", border: "1px solid rgba(45,158,95,0.20)" }}>
            <p className="text-[13px] font-semibold" style={{ color: "#2d9e5f" }}>
              💚 예산보다 <strong>{(grandTotal - boughtTotal).toLocaleString()}원</strong> 절약했어요
            </p>
          </div>
        )}

        {/* 방문 상점 요약 */}
        <div className="w-full space-y-2">
          {plan.stops.map((store, i) => {
            const entry = plan.by_store[store.id];
            if (!entry) return null;
            const storeTotal = entry.items.reduce((s, it) => s + it.price, 0);
            return (
              <div key={store.id} className="flex items-center justify-between rounded-xl px-4 py-3"
                style={{ background: "rgba(26,34,51,0.04)", border: "1px solid rgba(26,34,51,0.08)" }}>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black text-white"
                    style={{ background: "#0077b6" }}>{i + 1}</span>
                  <span className="text-[13px] font-semibold text-[#1a2233]">{store.name}</span>
                </div>
                <span className="text-[13px] font-bold" style={{ color: "#e85d04" }}>
                  {storeTotal.toLocaleString()}원
                </span>
              </div>
            );
          })}
        </div>

        {/* 버튼들 */}
        <div className="w-full space-y-2.5 pt-2">
          <button
            onClick={() => setPanel("receipt")}
            className="w-full rounded-2xl py-3.5 text-[14px] font-bold"
            style={{ background: "rgba(0,119,182,0.10)", color: "#0077b6", border: "1px solid rgba(0,119,182,0.20)" }}
          >
            🧾 영수증 적립하기
          </button>
          <button
            onClick={() => setPanel("report")}
            className="w-full rounded-2xl py-3.5 text-[14px] font-bold"
            style={{ background: "rgba(167,139,250,0.10)", color: "#7c3aed", border: "1px solid rgba(167,139,250,0.20)" }}
          >
            📝 가격 제보하기
          </button>
          <button
            onClick={restart}
            className="w-full rounded-2xl py-3.5 text-[14px] font-bold text-white"
            style={{ background: "#1a2233" }}
          >
            🔄 새로운 장보기 시작
          </button>
        </div>
      </div>
    );
  }

  /* ── 체크리스트 본체 ── */
  return (
    <div className="space-y-3 text-ink1">

      {/* 진행률 */}
      <div className="flex items-center justify-between rounded-xl px-4 py-3"
        style={{ background: "rgba(26,34,51,0.03)", border: "1px solid rgba(26,34,51,0.08)" }}>
        <div>
          <div className="text-[10px] uppercase tracking-wide" style={{ color: "#8a96b0" }}>담은 금액 / 예상 합계</div>
          <div className="mt-0.5 font-mono text-[18px]">
            <span className="font-black" style={{ color: "#f77f00" }}>{boughtTotal.toLocaleString()}</span>
            <span style={{ color: "#8a96b0" }}> / {grandTotal.toLocaleString()}원</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[12px] font-bold" style={{ color: grandTotal ? "#0077b6" : "#8a96b0" }}>
            {grandTotal ? Math.round((boughtTotal / grandTotal) * 100) : 0}%
          </span>
          <div className="h-2 w-24 overflow-hidden rounded-full" style={{ background: "rgba(26,34,51,0.10)" }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${grandTotal ? (boughtTotal / grandTotal) * 100 : 0}%`, background: "#f77f00" }} />
          </div>
        </div>
      </div>

      {/* 상점별 아코디언 */}
      {plan.stops.map((store, i) => {
        const entry    = plan.by_store[store.id];
        if (!entry) return null;
        const storeTotal = entry.items.reduce((s, it) => s + it.price, 0);
        const isFav    = favStores.includes(store.id);
        const expanded = open[store.id] ?? i === 0;
        return (
          <div key={store.id} className="rounded-xl overflow-hidden"
            style={{ border: "1px solid rgba(26,34,51,0.09)" }}>
            <button onClick={() => setOpen((o) => ({ ...o, [store.id]: !expanded }))}
              className="flex w-full items-center gap-2.5 px-4 py-3 text-left"
              style={{ background: expanded ? "rgba(0,119,182,0.04)" : "#fff" }}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
                style={{ background: "#0077b6" }}>{i + 1}</span>
              <span className="flex-1 text-[14px] font-extrabold text-[#1a2233]">{store.name}</span>
              <span className="text-[12px]" style={{ color: "#8a96b0" }}>{storeTotal.toLocaleString()}원</span>
              <span style={{ color: "#8a96b0" }}>{expanded ? "∧" : "∨"}</span>
            </button>

            {expanded && (
              <div className="px-4 pb-3 pt-1">
                <div className="mb-2 flex items-center justify-between text-[11px]" style={{ color: "#8a96b0" }}>
                  <span>{store.gu} · {store.type}</span>
                  <button onClick={() => toggleFavStore(store.id)}
                    className={isFav ? "font-semibold" : ""}
                    style={{ color: isFav ? "#f5c84b" : "#8a96b0" }}>
                    📌 {isFav ? "등록됨" : "즐겨찾기"}
                  </button>
                </div>
                {entry.items.map((it) => {
                  const key  = `${store.id}::${it.name}`;
                  const isDone = !!bought[key];
                  return (
                    <div key={key} className="flex items-center gap-2 py-2"
                      style={{ borderTop: "1px solid rgba(26,34,51,0.05)" }}>
                      <span>{it.emoji}</span>
                      <span className={`flex-1 text-[13px] ${isDone ? "line-through" : ""}`}
                        style={{ color: isDone ? "#8a96b0" : "#1a2233" }}>
                        {it.name} <span style={{ color: "#8a96b0" }}>{it.unit}</span>
                      </span>
                      <button onClick={() => showTip(it.name)}
                        className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold"
                        style={{ background: "rgba(0,119,182,0.12)", color: "#0077b6" }}>
                        {tipLoading === it.name ? "…" : "?"}
                      </button>
                      <span className="font-mono text-[13px] font-bold" style={{ color: "#e63946" }}>
                        {it.price.toLocaleString()}원
                      </span>
                      <button onClick={() => setBought((b) => ({ ...b, [key]: !b[key] }))}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[13px] font-bold transition"
                        style={isDone
                          ? { background: "rgba(45,158,95,0.15)", color: "#2d9e5f", border: "1px solid rgba(45,158,95,0.30)" }
                          : { background: "rgba(26,34,51,0.05)", color: "#8a96b0", border: "1px solid rgba(26,34,51,0.12)" }
                        }>
                        {isDone ? "✓" : "○"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* 장보기 완료 버튼 */}
      <button
        onClick={finish}
        className="w-full rounded-2xl py-4 text-[15px] font-bold text-white"
        style={{
          background: allChecked ? "#2d9e5f" : "#0077b6",
          transition: "background 400ms ease",
        }}
      >
        {allChecked ? "✅ 모두 완료! 장보기 마무리" : "🛍️ 장보기 마무리하기"}
      </button>

      {/* 팁 팝업 */}
      {tip && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 px-4"
          onClick={() => setTip(null)}>
          <div className="w-full max-w-sm rounded-2xl p-5"
            style={{ background: "#fff", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-[#1a2233]">💡 좋은 {tip.name} 고르는 법</h3>
              <button onClick={() => setTip(null)} style={{ color: "#4a5a78", fontSize: 20 }}>×</button>
            </div>
            <ol className="list-decimal space-y-2 pl-5 text-[13px]" style={{ color: "#4a5a78" }}>
              {tip.tips.map((t, idx) => <li key={idx}>{t}</li>)}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
