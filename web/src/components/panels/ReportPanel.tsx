"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { getReports, addReport, getItems, getStores } from "@/lib/api";
import type { Report, Item, Store } from "@/lib/types";

export function ReportPanel() {
  const { lat, lng, routePlans, routeChoice, setPanel, clearCart, picked } = useApp();
  const [reports, setReports]   = useState<Report[]>([]);
  const [items, setItems]       = useState<Item[]>([]);
  const [stores, setStores]     = useState<Store[]>([]);
  const [saving, setSaving]     = useState<string | null>(null); // 저장 중인 item key
  const [saved, setSaved]       = useState<Set<string>>(new Set());
  const [manualMode, setManualMode] = useState(false);
  // 수동 입력
  const [mItem, setMItem]   = useState("");
  const [mPrice, setMPrice] = useState("");
  const [mStore, setMStore] = useState("");
  const [mUnit, setMUnit]   = useState("");
  const [mSaving, setMSaving] = useState(false);
  const [uncoveredPrices, setUncoveredPrices] = useState<Record<string, string>>({});
  const [uncoveredSaved, setUncoveredSaved]   = useState<Set<string>>(new Set());
  const [toast, setToast] = useState(false);

  useEffect(() => {
    getReports().then(setReports).catch(console.error);
    getItems().then(setItems).catch(console.error);
    getStores(lat, lng, 5000).then(setStores).catch(console.error);
  }, [lat, lng]);

  // 선택된 경로의 구입 목록 추출
  const plan = routeChoice ? routePlans[routeChoice] : null;
  const coveredNames = new Set(
    plan ? Object.values(plan.by_store).flatMap((s: any) => s.items.map((it: any) => it.name)) : []
  );
  const uncovered = picked.filter((name) => !coveredNames.has(name));
  const purchaseList: { item: string; price: number; store: string; unit: string; emoji: string; key: string }[] = [];

  if (plan?.by_store) {
    Object.values(plan.by_store).forEach((storeData: any) => {
      const storeName = storeData.row?.name ?? storeData.name ?? "";
      storeData.items?.forEach((it: any) => {
        const key = `${storeName}::${it.name}`;
        purchaseList.push({
          item:  it.name,
          price: it.price,
          store: storeName,
          unit:  it.unit ?? "",
          emoji: it.emoji ?? "🛒",
          key,
        });
      });
    });
  }

  async function reportItem(entry: typeof purchaseList[0]) {
    if (saving === entry.key) return;
    setSaving(entry.key);
    try {
      await addReport({ item: entry.item, price: entry.price, store: entry.store, unit: entry.unit, lat, lng });
      setSaved((prev) => {
        const next = new Set([...prev, entry.key]);
        // 모든 항목 제보 완료 시 자동 닫기
        if (next.size >= purchaseList.length) {
          setTimeout(() => { clearCart(); setPanel(null); }, 800);
        }
        return next;
      });
      setReports(await getReports());
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(null);
    }
  }

  async function submitManual() {
    if (!mItem || !mPrice) return;
    setMSaving(true);
    try {
      await addReport({ item: mItem, price: Number(mPrice), store: mStore, unit: mUnit, lat, lng });
      setReports(await getReports());
      setMItem(""); setMPrice(""); setMStore(""); setMUnit("");
      setToast(true);
      setTimeout(() => setToast(false), 2000);
    } finally { setMSaving(false); }
  }

  async function reportUncovered(name: string) {
    const price = Number(uncoveredPrices[name] ?? "");
    if (!price) return;
    try {
      await addReport({ item: name, price, store: "", lat, lng });
      setUncoveredSaved((prev) => new Set([...prev, name]));
      setReports(await getReports());
    } catch (e) { console.error(e); }
  }

  // 제보 상태 초기화 — 제보완료 표시·수동 입력·모드 모두 리셋
  function reset() {
    setSaved(new Set());
    setSaving(null);
    setManualMode(false);
    setMItem(""); setMPrice(""); setMStore(""); setMUnit("");
    setUncoveredPrices({});
    setUncoveredSaved(new Set());
    setToast(false);
  }

  return (
    <div className="space-y-4">

      {/* ── 초기화 바 — 제보완료 항목이나 작성 중 입력이 있을 때만 노출 ── */}
      {(saved.size > 0 || manualMode || mItem || mPrice || mStore) && (
        <div className="flex items-center justify-between">
          <span className="text-[11px]" style={{ color: "#8a96b0" }}>
            {saved.size > 0 ? `제보완료 ${saved.size}건` : "작성 중"}
          </span>
          <button
            onClick={reset}
            className="rounded-full px-3 py-1 text-[11px] font-bold"
            style={{ background: "rgba(26,34,51,0.06)", color: "#4a5a78", border: "1px solid rgba(26,34,51,0.10)" }}
          >
            ↺ 초기화
          </button>
        </div>
      )}

      {/* ── 등록 완료 토스트 ── */}
      {toast && (
        <div
          className="flex items-center justify-center gap-2 rounded-2xl py-2.5 px-4"
          style={{ background: "rgba(45,158,95,0.10)", border: "1px solid rgba(45,158,95,0.28)", color: "#2d9e5f", fontSize: 13, fontWeight: 700 }}
        >
          ✓ 제보가 등록되었어요
        </div>
      )}

      {/* ── 구입 목록 자동 제보 ── */}
      {purchaseList.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-bold" style={{ color: "#1a2233" }}>
              🧾 구입한 재료 — 탭해서 가격 제보
            </p>
            <button
              onClick={() => setManualMode((v) => !v)}
              className="text-[11px] underline"
              style={{ color: "#8a96b0" }}
            >
              {manualMode ? "자동 목록 보기" : "직접 입력"}
            </button>
          </div>

          {!manualMode ? (
            <div className="space-y-2">
              {purchaseList.map((entry) => {
                const isDone    = saved.has(entry.key);
                const isLoading = saving === entry.key;
                return (
                  <button
                    key={entry.key}
                    onClick={() => !isDone && reportItem(entry)}
                    disabled={isDone || isLoading}
                    className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition active:scale-[0.98]"
                    style={{
                      background: isDone
                        ? "rgba(45,158,95,0.08)"
                        : "rgba(26,34,51,0.03)",
                      border: isDone
                        ? "1px solid rgba(45,158,95,0.25)"
                        : "1px solid rgba(26,34,51,0.09)",
                    }}
                  >
                    <span className="text-[20px]">{entry.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold truncate" style={{ color: "#1a2233" }}>
                        {entry.item}
                      </div>
                      <div className="text-[11px]" style={{ color: "#8a96b0" }}>
                        {entry.store}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[14px] font-black font-mono" style={{ color: "#e85d04" }}>
                        {entry.price.toLocaleString()}원
                      </div>
                      <div className="text-[11px] font-bold" style={{
                        color: isDone ? "#2d9e5f" : "#0077b6"
                      }}>
                        {isLoading ? "등록 중…" : isDone ? "✓ 제보완료" : "탭해서 제보 →"}
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* 전체 한번에 제보 */}
              {purchaseList.some((e) => !saved.has(e.key)) && (
                <button
                  onClick={async () => {
                    const targets = purchaseList.filter((e) => !saved.has(e.key));
                    await Promise.all(targets.map(reportItem));
                    // 모두 완료 후 패널 닫기
                    setTimeout(() => { clearCart(); setPanel(null); }, 600);
                  }}
                  className="w-full rounded-2xl py-3 text-[13px] font-bold"
                  style={{ background: "#0077b6", color: "#fff" }}
                >
                  📝 전체 한번에 제보하기
                </button>
              )}
            </div>
          ) : (
            <ManualForm
              items={items} stores={stores} lat={lat} lng={lng}
              mItem={mItem} setMItem={setMItem}
              mPrice={mPrice} setMPrice={setMPrice}
              mStore={mStore} setMStore={setMStore}
              mUnit={mUnit} setMUnit={setMUnit}
              mSaving={mSaving} onSubmit={submitManual}
            />
          )}
        </div>
      ) : (
        /* 경로 미선택 시 수동 입력 */
        <div className="space-y-2">
          <p className="text-[12px] font-bold" style={{ color: "#1a2233" }}>
            실제 산 가격을 제보해 주세요
          </p>
          <ManualForm
            items={items} stores={stores} lat={lat} lng={lng}
            mItem={mItem} setMItem={setMItem}
            mPrice={mPrice} setMPrice={setMPrice}
            mStore={mStore} setMStore={setMStore}
            mUnit={mUnit} setMUnit={setMUnit}
            mSaving={mSaving} onSubmit={submitManual}
          />
        </div>
      )}

      {/* ── 그 외 항목 제보 ── */}
      {uncovered.length > 0 && (
        <div className="space-y-2">
          <p className="text-[12px] font-bold" style={{ color: "#1a2233" }}>
            🛒 그 외 항목 — 구입 가격 제보
          </p>
          <p className="text-[11px]" style={{ color: "#8a96b0" }}>
            경로에 포함되지 않은 항목이에요. 가격을 입력해 제보해 주세요.
          </p>
          {uncovered.map((name) => {
            const isDone = uncoveredSaved.has(name);
            return (
              <div key={name} className="flex items-center gap-2 rounded-2xl px-4 py-3"
                style={{
                  background: isDone ? "rgba(45,158,95,0.08)" : "rgba(26,34,51,0.03)",
                  border: isDone ? "1px solid rgba(45,158,95,0.25)" : "1px solid rgba(26,34,51,0.09)",
                }}>
                <span className="flex-1 text-[13px] font-semibold" style={{ color: isDone ? "#8a96b0" : "#1a2233" }}>
                  🛒 {name}
                </span>
                {isDone ? (
                  <span className="text-[11px] font-bold" style={{ color: "#2d9e5f" }}>✓ 제보완료</span>
                ) : (
                  <>
                    <input
                      value={uncoveredPrices[name] ?? ""}
                      onChange={(e) => setUncoveredPrices((p) => ({ ...p, [name]: e.target.value.replace(/[^0-9]/g, "") }))}
                      inputMode="numeric" placeholder="가격 (원)"
                      className="w-24 rounded-xl px-2 py-1.5 text-[12px] outline-none text-right"
                      style={{ border: "1px solid rgba(26,34,51,0.12)", background: "#fff", color: "#1a2233" }}
                    />
                    <button
                      onClick={() => reportUncovered(name)}
                      disabled={!uncoveredPrices[name]}
                      className="rounded-xl px-3 py-1.5 text-[12px] font-bold disabled:opacity-40"
                      style={{ background: "rgba(0,119,182,0.12)", color: "#0077b6", border: "1px solid rgba(0,119,182,0.25)" }}
                    >
                      제보
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── 최근 제보 ── */}
      {reports.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide" style={{ color: "#8a96b0" }}>
            최근 제보 ({reports.length})
          </p>
          <div className="space-y-1.5">
            {reports.map((r, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl px-3 py-2"
                style={{ background: "rgba(26,34,51,0.03)", border: "1px solid rgba(26,34,51,0.08)" }}>
                <div className="flex-1">
                  <div className="text-[13px] font-bold" style={{ color: "#1a2233" }}>{r.item}</div>
                  <div className="text-[11px]" style={{ color: "#8a96b0" }}>
                    {r.store || "위치 미상"}{r.date ? ` · ${r.date}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[15px] font-bold" style={{ color: "#f77f00" }}>
                    {r.price.toLocaleString()}원
                  </div>
                  {r.unit && <div className="text-[11px]" style={{ color: "#8a96b0" }}>{r.unit}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ManualForm({ items, stores, lat, lng, mItem, setMItem, mPrice, setMPrice, mStore, setMStore, mUnit, setMUnit, mSaving, onSubmit }: {
  items: Item[]; stores: Store[]; lat: number; lng: number;
  mItem: string; setMItem: (v: string) => void;
  mPrice: string; setMPrice: (v: string) => void;
  mStore: string; setMStore: (v: string) => void;
  mUnit: string; setMUnit: (v: string) => void;
  mSaving: boolean; onSubmit: () => void;
}) {
  return (
    <div className="space-y-2">
      <input
        value={mItem}
        onChange={(e) => setMItem(e.target.value)}
        list="report-item-autocomplete"
        placeholder="품목 입력… (자동완성)"
        className="w-full rounded-xl px-3 py-2.5 text-[13px] outline-none"
        style={{ border: "1px solid rgba(26,34,51,0.12)", background: "rgba(26,34,51,0.02)", color: "#1a2233" }}
      />
      <datalist id="report-item-autocomplete">
        {items.map((i) => <option key={i.code} value={i.name} />)}
      </datalist>
      <div className="flex gap-2">
        <input value={mPrice} onChange={(e) => setMPrice(e.target.value.replace(/[^0-9]/g, ""))}
          inputMode="numeric" placeholder="가격 (원)"
          className="flex-1 rounded-xl px-3 py-2.5 text-[13px] outline-none"
          style={{ border: "1px solid rgba(26,34,51,0.12)", background: "rgba(26,34,51,0.02)", color: "#1a2233" }} />
        <input value={mUnit} onChange={(e) => setMUnit(e.target.value)}
          placeholder="중량 (선택)"
          className="w-28 rounded-xl px-3 py-2.5 text-[13px] outline-none"
          style={{ border: "1px solid rgba(26,34,51,0.12)", background: "rgba(26,34,51,0.02)", color: "#1a2233" }} />
      </div>
      <input value={mStore} onChange={(e) => setMStore(e.target.value)}
        list="report-store-autocomplete" placeholder="상점명 (선택, 자동완성)"
        className="w-full rounded-xl px-3 py-2.5 text-[13px] outline-none"
        style={{ border: "1px solid rgba(26,34,51,0.12)", background: "rgba(26,34,51,0.02)", color: "#1a2233" }} />
      <datalist id="report-store-autocomplete">
        {stores.map((s) => <option key={s.id} value={s.name} />)}
      </datalist>
      <button onClick={onSubmit} disabled={mSaving || !mItem || !mPrice}
        className="w-full rounded-xl py-3 text-[13px] font-bold disabled:opacity-40"
        style={{ background: "rgba(0,119,182,0.12)", color: "#0077b6", border: "1px solid rgba(0,119,182,0.25)" }}>
        {mSaving ? "등록 중…" : "📝 제보 등록"}
      </button>
      <p className="text-[11px]" style={{ color: "#8a96b0" }}>
        현위치 ({lat.toFixed(4)}, {lng.toFixed(4)}) 기준으로 등록돼요
      </p>
    </div>
  );
}
