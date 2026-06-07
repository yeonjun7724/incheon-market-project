"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { getStoreItems } from "@/lib/api";

const TYPE_COLOR: Record<string, { bg: string; text: string }> = {
  전통시장:   { bg: "rgba(0,119,182,0.12)",   text: "#0077b6" },
  골목상권:   { bg: "rgba(247,127,0,0.12)",   text: "#f77f00" },
  동네식품점: { bg: "rgba(123,45,139,0.12)",  text: "#7b2d8b" },
  대형유통:   { bg: "rgba(230,57,70,0.12)",   text: "#e63946" },
};
const TYPE_LABEL: Record<string, string> = {
  전통시장: "시장", 골목상권: "골목", 동네식품점: "동네", 대형유통: "마트",
};

export function StoreInfoCard() {
  const { selectedStore, setSelectedStore } = useApp();
  const [items, setItems]     = useState<string[]>([]);
  const [source, setSource]   = useState("");
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

  const col = TYPE_COLOR[selectedStore.type] ?? { bg: "rgba(26,34,51,0.08)", text: "#4a5a78" };

  return (
    <div
      className="fixed left-1/2 z-[800] w-[calc(100vw-96px)] max-w-sm"
      style={{
        top: "calc(max(12px, env(safe-area-inset-top)) + 52px)",
        transform: "translateX(-50%)",
        background: "rgba(255,255,255,0.97)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(26,34,51,0.12)",
        borderRadius: 20,
        padding: "14px 16px 12px",
        boxShadow: "0 4px 20px rgba(26,34,51,0.12)",
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[13px] font-bold text-[#1a2233] truncate">{selectedStore.name}</span>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ background: col.bg, color: col.text }}
            >
              {TYPE_LABEL[selectedStore.type] ?? selectedStore.type}
            </span>
          </div>
          {selectedStore.address && (
            <p className="text-[11px] text-[#8a96b0] mt-0.5 truncate">{selectedStore.address}</p>
          )}
        </div>
        <button
          onClick={() => setSelectedStore(null)}
          className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-sm leading-none transition hover:bg-[#e63946]/10"
          style={{ background: "rgba(26,34,51,0.06)", color: "#4a5a78" }}
        >×</button>
      </div>

      {loading ? (
        <div className="flex gap-1.5 flex-wrap">
          {[1,2,3].map((i) => (
            <div key={i} className="h-6 w-14 rounded-full animate-pulse"
              style={{ background: "rgba(26,34,51,0.08)" }} />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="flex gap-1.5 flex-wrap">
          {items.map((item) => (
            <span key={item}
              className="rounded-full px-2.5 py-0.5 text-[11px]"
              style={{ background: "rgba(26,34,51,0.06)", border: "1px solid rgba(26,34,51,0.10)", color: "#4a5a78" }}>
              {item}
            </span>
          ))}
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: col.bg, color: col.text + "99" }}
          >
            {source}
          </span>
        </div>
      ) : (
        <p className="text-[11px] text-[#8a96b0]">품목 정보 없음</p>
      )}
    </div>
  );
}
