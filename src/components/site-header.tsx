import Link from "next/link";

const LINKS = [
  { href: "/", label: "Investigate" },
  { href: "/architecture", label: "Architecture" },
  { href: "/corpus", label: "Corpus" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <KestrelMark />
          </span>
          <span className="leading-tight">
            <span className="block font-serif text-xl tracking-tight text-foreground">Kestrel</span>
            <span className="block text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
              Helios Grid dispatch
            </span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-2.5 py-1.5 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground sm:px-3"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

function KestrelMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        d="M4 16c4-1 6-5 7-9 1 3 3 6 8 8-4 1-7 2-9 5-1-3-3-4-6-4Z"
        fill="currentColor"
      />
      <circle cx="16.5" cy="7" r="1.4" className="fill-lime text-lime" fill="var(--lime)" />
    </svg>
  );
}
