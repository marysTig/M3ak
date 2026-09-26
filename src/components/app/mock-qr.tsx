import { cn } from "@/lib/utils";

/** Purely decorative QR placeholder — no real QR encoding. */
export function MockQr({ className, label }: { className?: string; label?: string }) {
  return (
    <div
      className={cn(
        "relative flex aspect-square w-full max-w-[280px] items-center justify-center rounded-2xl border border-border bg-surface p-4",
        className,
      )}
    >
      <div className="mock-qr size-full rounded-lg opacity-90" aria-hidden />
      <span className="absolute left-1/2 top-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl border-4 border-surface bg-primary text-xs font-semibold text-primary-foreground">
        {label ?? "QR"}
      </span>
    </div>
  );
}
