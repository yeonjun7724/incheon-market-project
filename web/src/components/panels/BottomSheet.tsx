"use client";

export function BottomSheet({
  open, title, onClose, children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`fixed inset-x-0 bottom-[78px] z-[1000] px-3 transition-all duration-300
                  ${open ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0 pointer-events-none"}`}
    >
      <div className="glass mx-auto max-w-[840px] rounded-3xl shadow-2xl
                      max-h-[calc(100vh-160px)] overflow-y-auto">
        <div className="mx-auto mt-2.5 h-1 w-9 rounded bg-white/15" />
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <h2 className="text-[15px] font-bold text-ink1">{title}</h2>
          <button onClick={onClose} className="text-ink2 hover:text-ink1 text-lg leading-none">×</button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
