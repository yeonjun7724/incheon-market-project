"use client";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { getRecipe, getItems, getStores } from "@/lib/api";

export function SearchBar() {
  const { setRecipe, setPanel, togglePick, picked, setLoc, clearCart } = useApp();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  async function run() {
    const query = q.trim();
    if (!query) return;
    setBusy(true);
    setHint(null);
    try {
      const rc = await getRecipe(query);
      if (rc.dish) {
        clearCart();
        setHint(`🍳 ${rc.dish} 재료 ${rc.ingredients.length}종`);
        setRecipe(rc.dish, rc.ingredients);
        setPanel("cart");
        setQ("");
        return;
      }
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
    <div
      className="fixed left-0 right-0 top-0 z-[1000] px-3"
      style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
    >
      {/* 한 줄 유지: LocalCart 로고 숨기지 않고 input만 truncate */}
      <div
        className="flex items-center gap-2"
        style={{
          background: "rgba(255,255,255,0.97)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(26,34,51,0.12)",
          borderRadius: 999,
          padding: "7px 8px 7px 14px",
          boxShadow: "0 2px 12px rgba(26,34,51,0.10)",
          minWidth: 0,
        }}
      >
        {/* 로고 — 항상 한 줄 */}
        <span className="shrink-0 text-[13px] font-black text-[#0077b6] tracking-tight whitespace-nowrap">
          🛒
        </span>

        <div className="shrink-0 h-4 w-px bg-[#1a2233]/15" />

        {/* input — 남은 공간 전부 쓰되 넘치면 잘림 */}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="음식·재료 검색"
          className="flex-1 min-w-0 bg-transparent text-[13px] text-[#1a2233]
                     placeholder:text-[#8a96b0] outline-none truncate"
        />

        {/* 버튼 — 항상 고정 */}
        <button
          onClick={run}
          disabled={busy}
          className="shrink-0 rounded-full px-4 py-1.5 text-[12px] font-bold
                     whitespace-nowrap disabled:opacity-50 transition active:scale-95"
          style={{ background: "#0077b6", color: "#fff" }}
        >
          {busy ? "…" : "검색"}
        </button>
      </div>

      {hint && (
        <div
          className="mt-1.5 mx-2 rounded-full px-4 py-1 text-[12px] w-fit"
          style={{
            background: "rgba(0,119,182,0.10)",
            border: "1px solid rgba(0,119,182,0.25)",
            color: "#0077b6",
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}
