"use client";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { getRecipe, getItems, getStores } from "@/lib/api";

export function SearchBar() {
  const { setRecipe, setPanel, togglePick, picked, setLoc } = useApp();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    const query = q.trim();
    if (!query) return;
    setBusy(true);
    try {
      // 1) 요리 → 재료 (AI 에이전트)
      const rc = await getRecipe(query);
      if (rc.dish) { setRecipe(rc.dish, rc.ingredients); setPanel("cart"); return; }

      // 2) 품목명 → 장바구니 담기
      const items = await getItems();
      const hit = items.find((i) => i.name.replace(/\s/g, "").includes(query.replace(/\s/g, "")));
      if (hit) { if (!picked.includes(hit.name)) togglePick(hit.name); setPanel("cart"); return; }

      // 3) 상점/구 → 지도 이동
      const stores = await getStores(undefined, undefined, 999999, query);
      if (stores.length) { setLoc(stores[0].lat, stores[0].lng); setPanel(null); return; }

      alert(`'${query}' 검색 결과가 없어요. 요리·품목·상점명으로 검색해보세요.`);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed left-1/2 top-4 z-[1000] flex w-[min(640px,calc(100vw-32px))] -translate-x-1/2 items-center gap-2">
      <div className="glass flex items-center gap-2 rounded-full px-4 py-2.5">
        <span className="text-lg">🛒</span>
        <span className="text-[15px] font-extrabold tracking-tight text-accent">LocalCart</span>
      </div>
      <div className="glass flex flex-1 items-center gap-2 rounded-full px-4 py-2">
        <span className="text-ink3">🔍</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="동네, 시장, 품목 검색… (예: 찜닭, 양파)"
          className="flex-1 bg-transparent text-[13px] text-ink1 placeholder:text-ink3 outline-none"
        />
        {busy && <span className="text-xs text-ink3">…</span>}
      </div>
    </div>
  );
}
