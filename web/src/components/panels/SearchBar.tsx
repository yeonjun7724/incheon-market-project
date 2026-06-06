"use client";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { getRecipe, getItems, getStores } from "@/lib/api";

export function SearchBar() {
  const { setRecipe, setPanel, togglePick, picked, setLoc } = useApp();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  async function run() {
    const query = q.trim();
    if (!query) return;
    setBusy(true);
    setHint(null);
    try {
      // 1) 요리 → AI 재료 추론
      const rc = await getRecipe(query);
      if (rc.dish) {
        setHint(`🍳 ${rc.dish} 재료 ${rc.ingredients.length}종`);
        setRecipe(rc.dish, rc.ingredients);
        setPanel("cart");
        setQ("");
        return;
      }
      // 2) 품목 직접 검색
      const items = await getItems();
      const hit = items.find((i) =>
        i.name.replace(/\s/g, "").includes(query.replace(/\s/g, ""))
      );
      if (hit) {
        if (!picked.includes(hit.name)) togglePick(hit.name);
        setPanel("cart");
        setQ("");
        return;
      }
      // 3) 상점/구 이동
      const stores = await getStores(undefined, undefined, 999999, query);
      if (stores.length) {
        setLoc(stores[0].lat, stores[0].lng);
        setPanel(null);
        setQ("");
        return;
      }
      setHint(`'${query}' 결과 없음`);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
      setTimeout(() => setHint(null), 3000);
    }
  }

  return (
    <div className="fixed left-0 right-0 top-0 z-[1000] px-3 pt-[env(safe-area-inset-top,12px)]"
      style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
      <div className="flex items-center gap-2"
        style={{
          background: "rgba(8,15,30,0.9)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 999,
          padding: "6px 8px 6px 14px",
        }}>
        {/* 로고 */}
        <span className="text-[13px] font-black text-[#63b7ff] shrink-0 tracking-tight">
          🛒 LocalCart
        </span>

        <div className="h-4 w-px bg-white/15 shrink-0" />

        {/* 입력창 */}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="음식·재료·상점 검색 (AI 재료 추천)"
          className="flex-1 bg-transparent text-[13px] text-white placeholder:text-white/35 outline-none min-w-0"
        />

        {/* 영수증 버튼 */}
        <button
          onClick={() => setPanel("receipt")}
          className="shrink-0 text-[20px] leading-none opacity-70 hover:opacity-100 px-1"
          title="영수증 적립"
        >🧾</button>

        {/* 검색 버튼 */}
        <button
          onClick={run}
          disabled={busy}
          className="shrink-0 rounded-full bg-[#63b7ff] px-4 py-1.5 text-[12px] font-bold text-[#04101f]
                     disabled:opacity-50 hover:bg-[#82c9ff] transition active:scale-95"
        >
          {busy ? "…" : "검색"}
        </button>
      </div>

      {/* AI 힌트 */}
      {hint && (
        <div className="mt-1.5 mx-2 rounded-full bg-[#63b7ff]/15 border border-[#63b7ff]/25
                        px-4 py-1 text-[12px] text-[#63b7ff] w-fit">
          {hint}
        </div>
      )}
    </div>
  );
}
