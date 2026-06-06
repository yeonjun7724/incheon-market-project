"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { getStoreItems } from "@/lib/api";

const TYPE_LABEL: Record<string, string> = {
  전통시장:   "시장",
  골목상권:   "골목",
  동네식품점: "동네",
  대형유통:   "마트",
};

export function StoreInfoCard() {
  const { selectedStore, setSelectedStore } = useApp();
  const [items, setItems]   = useState<string[]>([]);
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedStore) { setItems([]); setSource(""); return; }
    setLoading(true);
    getStoreItems(selectedStore.id, selectedStore.name, selectedStore.type)
      .then((r) => { setItems(r.items.slice(0, 5)); setSource(r.source); })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [selectedStore]);

  if (!selectedStore) return null;

  return (
    <div
      className="fixed left-1/2 z-[800] w-[calc(100vw-96px)] max-w-sm"
      style={{
        top: "calc(max(12px, env(safe-area-inset-top)) + 52px)",
        transform: "translateX(-50%)",
        background: "rgba(8,15,30,0.92)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 20,
        padding: "14px 16px 12px",
      }}
    >
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[13px] font-bold text-white truncate">{selectedStore.name}</span>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ background: "rgba(99,183,255,0.18)", color: "#63b7ff" }}
            >
              {TYPE_LABEL[selectedStore.type] ?? selectedStore.type}
            </span>
          </div>
          {selectedStore.address && (
            <p className="text-[11px] text-white/35 mt-0.5 truncate">{selectedStore.address}</p>
          )}
        </div>
        <button
          onClick={() => setSelectedStore(null)}
          className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/50 hover:bg-white/20 text-sm leading-none"
        >×</button>
      </div>

      {/* 품목 */}
      {loading ? (
        <div className="flex gap-1.5 flex-wrap">
          {[1,2,3].map((i) => (
            <div key={i} className="h-6 w-14 rounded-full bg-white/10 animate-pulse" />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="flex gap-1.5 flex-wrap">
          {items.map((item) => (
            <span key={item}
              className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-white/70">
              {item}
            </span>
          ))}
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: "rgba(99,183,255,0.12)", color: "#63b7ff66" }}
          >
            {source}
          </span>
        </div>
      ) : (
        <p className="text-[11px] text-white/30">품목 정보 없음</p>
      )}
    </div>
  );
}
