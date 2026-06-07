"use client";
import { useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { scanReceipt } from "@/lib/api";
import type { ReceiptScanResult } from "@/lib/types";

type Step = "idle" | "preview" | "scanning" | "done" | "error";

export function ReceiptPanel() {
  const { receiptPoints, addReceiptPoints, lat, lng } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep]         = useState<Step>("idle");
  const [preview, setPreview]   = useState<string | null>(null);
  const [result, setResult]     = useState<ReceiptScanResult | null>(null);
  const [errMsg, setErrMsg]     = useState("");
  const [storeInput, setStoreInput] = useState("");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = (ev.target?.result as string).split(",")[1];
      setPreview(URL.createObjectURL(file));
      setStep("preview");
      // b64 저장
      (window as unknown as Record<string, string>).__receiptB64 = b64;
    };
    reader.readAsDataURL(file);
  }

  async function handleScan() {
    const b64 = (window as unknown as Record<string, string>).__receiptB64;
    if (!b64) return;
    setStep("scanning");
    setErrMsg("");
    try {
      const res = await scanReceipt({
        image_base64: b64,
        store_name: storeInput.trim() || undefined,
      });
      setResult(res);
      addReceiptPoints(res.reward_points);
      setStep("done");
    } catch (e) {
      setErrMsg(String(e));
      setStep("error");
    }
  }

  function reset() {
    setStep("idle");
    setPreview(null);
    setResult(null);
    setStoreInput("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-4 text-ink1 px-1">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-extrabold">🧾 영수증 인식</h3>
          <p className="text-[11px] text-ink3 mt-0.5">
            영수증 등록 → 포인트 적립 · 가게 품목 자동 학습
          </p>
        </div>
        <div className="rounded-2xl bg-yellow-400/15 border border-yellow-400/30 px-4 py-2 text-center">
          <div className="text-[18px] font-black text-yellow-400">{receiptPoints.toLocaleString()}P</div>
          <div className="text-[10px] text-ink3">누적 포인트</div>
        </div>
      </div>

      {/* 포인트 안내 */}
      <div className="rounded-xl bg-[#1a2233]/4 border border-[#1a2233]/10 p-3 text-[12px] text-ink2 space-y-1">
        <div className="flex gap-2">🎁 <span>1,000원당 <b className="text-yellow-400">10P</b> 적립</span></div>
        <div className="flex gap-2">🛍️ <span>10,000P 달성 시 <b className="text-yellow-400">500원 쿠폰</b> 지급</span></div>
        <div className="flex gap-2">📚 <span>가게 취급 품목 자동 학습 → <b className="text-accent">더 정확한 가게 추천</b></span></div>
      </div>

      {/* step: idle */}
      {step === "idle" && (
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] text-ink3 mb-1">가게 이름 (선택)</label>
            <input
              value={storeInput}
              onChange={(e) => setStoreInput(e.target.value)}
              placeholder="예: 인천종합식품마트"
              className="w-full rounded-xl bg-[#1a2233]/4 border border-[#1a2233]/10 px-3 py-2 text-[13px] text-ink1 placeholder:text-ink3 outline-none"
            />
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full rounded-2xl border-2 border-dashed border-yellow-400/40 bg-yellow-400/5 py-10 flex flex-col items-center gap-3 hover:bg-yellow-400/10 transition"
          >
            <span className="text-5xl">📷</span>
            <span className="text-[14px] font-bold text-yellow-400">영수증 사진 선택</span>
            <span className="text-[11px] text-ink3">JPG · PNG · HEIC 지원</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>
      )}

      {/* step: preview */}
      {step === "preview" && preview && (
        <div className="space-y-3">
          <div className="relative rounded-2xl overflow-hidden border border-[#1a2233]/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="영수증 미리보기" className="w-full max-h-64 object-contain bg-black/20" />
          </div>
          <div className="flex gap-2">
            <button onClick={reset} className="flex-1 rounded-xl border border-[#1a2233]/10 py-2.5 text-[13px] text-ink2 hover:bg-[#1a2233]/4">
              다시 선택
            </button>
            <button onClick={handleScan} className="flex-1 rounded-xl bg-yellow-400/20 border border-yellow-400/40 py-2.5 text-[13px] font-bold text-yellow-400 hover:bg-yellow-400/30">
              AI 분석 시작 🔍
            </button>
          </div>
        </div>
      )}

      {/* step: scanning */}
      {step === "scanning" && (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="text-5xl animate-bounce">🤖</div>
          <p className="text-[14px] font-bold text-accent animate-pulse">AI가 영수증을 분석하고 있어요…</p>
          <p className="text-[11px] text-ink3">품목명·가격 인식 + 가게 학습 중</p>
        </div>
      )}

      {/* step: done */}
      {step === "done" && result && (
        <div className="space-y-3">
          {/* 완료 배너 */}
          <div className="rounded-2xl bg-yellow-400/10 border border-yellow-400/30 p-4 text-center space-y-1">
            <div className="text-3xl">🎉</div>
            <div className="text-[15px] font-extrabold text-yellow-400">{result.message}</div>
            <div className="text-[11px] text-ink3">{result.store_name}</div>
          </div>

          {/* 인식된 품목 */}
          <div className="rounded-xl bg-[#1a2233]/4 border border-[#1a2233]/10 overflow-hidden">
            <div className="px-3 py-2 border-b border-[#1a2233]/10 text-[11px] font-bold text-ink3 uppercase tracking-wide">
              인식된 품목 ({result.items.length}건)
            </div>
            <div className="divide-y divide-white/5 max-h-48 overflow-y-auto [scrollbar-width:thin]">
              {result.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2">
                  <span className="text-[13px] text-ink1">{item.name}</span>
                  <div className="flex items-center gap-3 text-[12px]">
                    {item.qty > 1 && <span className="text-ink3">×{item.qty}</span>}
                    <span className="font-bold text-accent2">{item.price.toLocaleString()}원</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-3 py-2 border-t border-[#1a2233]/10 flex justify-between text-[13px]">
              <span className="text-ink3">합계</span>
              <span className="font-extrabold text-accent">{result.total.toLocaleString()}원</span>
            </div>
          </div>

          {/* 학습 완료 알림 */}
          <div className="rounded-xl bg-accent/5 border border-accent/20 px-3 py-2 text-[12px] text-accent flex items-center gap-2">
            📚 <span><b>{result.store_name}</b> 품목 정보가 학습됐어요. 다음 장보기에 반영됩니다!</span>
          </div>

          <button onClick={reset} className="w-full rounded-xl border border-[#1a2233]/10 py-2.5 text-[13px] text-ink2 hover:bg-[#1a2233]/4">
            다른 영수증 등록하기
          </button>
        </div>
      )}

      {/* step: error */}
      {step === "error" && (
        <div className="space-y-3">
          <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 text-center space-y-2">
            <div className="text-3xl">😢</div>
            <div className="text-[13px] text-red-400">영수증 분석에 실패했어요.</div>
            <div className="text-[11px] text-ink3">{errMsg}</div>
          </div>
          <button onClick={reset} className="w-full rounded-xl border border-[#1a2233]/10 py-2.5 text-[13px] text-ink2 hover:bg-[#1a2233]/4">
            다시 시도
          </button>
        </div>
      )}
    </div>
  );
}
