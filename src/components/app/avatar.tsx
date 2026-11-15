import Image from "next/image";

export function Avatar({ src, name, size = 32 }: { src: string | null; name: string; size?: number }) {
  return src ? (
    <Image src={src} alt="" width={size} height={size} className="shrink-0 rounded-full bg-[var(--bin-3)]" style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden
      className="font-display flex shrink-0 items-center justify-center rounded-full bg-[var(--bin-3)] font-bold text-[var(--muted)]"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
