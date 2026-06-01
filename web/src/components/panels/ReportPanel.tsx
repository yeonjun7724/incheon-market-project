"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { getReports, addReport, getItems } from "@/lib/api";
import type { Report, Item } from "@/lib/types";

export function ReportPanel() {
  const { lat, lng } = useApp();
  const [reports, setReports] = useState<Report[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [item, setItem] = useState("");
  const [price, setPrice] = useState("");
  const [store, setStore] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getReports().then(setReports).catch(console.error);
    getItems().then(setItems).catch(console.error);
  }, []);

  async function submit() {
    if (!item || !price) return;
    setSaving(true);
    try {
      await addReport({ item, price: Number(price), store, lat, lng });
      setReports(await getReports());
      setItem(""); setPrice(""); setStore("");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4 text-ink1">
      <p className="text-[11px] font-bold uppercase tracking-wide text-ink3">실제 산 가격을 제보해 주세요</p>

      <div className="space-y-2">
        <select value={item} onChange={(e) => setItem(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-ink1 outline-none">
          <option value="">품목 선택…</option>
          {items.map((i) => <option key={i.code} value={i.name}>{i.emoji} {i.name}</option>)}
        </select>
        <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))}
          inputMode="numeric" placeholder="가격 (원)"
          className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-ink1 placeholder:text-ink3 outline-none" />
        <input value={store} onChange={(e) => setStore(e.target.value)} placeholder="상점명 (선택)"
          className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-ink1 placeholder:text-ink3 outline-none" />
        <button onClick={submit} disabled={saving || !item || !price}
          className="w-full rounded-xl border border-accent/40 bg-accent/15 py-3 font-bold text-accent hover:bg-accent/25 disabled:opacity-40">
          {saving ? "등록 중…" : "📝  제보 등록"}
        </button>
        <p className="text-[11px] text-ink3">현위치({lat.toFixed(4)}, {lng.toFixed(4)}) 기준으로 등록돼요.</p>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink3">최근 제보 ({reports.length})</p>
        <div className="space-y-1.5">
          {reports.map((r, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
              <div className="flex-1">
                <div className="text-[13px] font-bold">{r.item}</div>
                <div className="text-[11px] text-ink3">{r.store || "위치 미상"}{r.date ? ` · ${r.date}` : ""}</div>
              </div>
              <div className="font-mono text-[15px] font-bold text-accent3">{r.price.toLocaleString()}원</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
