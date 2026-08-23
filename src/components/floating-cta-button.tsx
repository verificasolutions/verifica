import Link from "next/link";

export function FloatingCtaButton() {
  return (
    <Link
      href="/quero"
      className="fixed bottom-5 right-5 z-40 inline-flex min-h-14 items-center justify-center rounded-full border border-[var(--accent)]/35 bg-[var(--accent)] px-6 text-sm font-semibold text-slate-950 shadow-[0_18px_48px_rgba(0,245,212,0.28)] transition hover:scale-[1.02] hover:shadow-[0_22px_56px_rgba(0,245,212,0.34)]"
    >
      Eu quero!
    </Link>
  );
}
