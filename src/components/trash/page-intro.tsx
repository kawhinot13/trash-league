/** The calm top of every inner page: one title, one line, room to breathe under the nav. */
export function PageIntro({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <header className="mx-auto max-w-6xl px-5 pt-32 pb-6 md:px-10 md:pt-40">
      <h1 className="font-display text-[clamp(3.6rem,11vw,8rem)] leading-[0.82] font-black">
        {title}
      </h1>
      <p className="mt-5 max-w-[56ch] text-lg leading-relaxed text-[var(--muted)]">
        {children}
      </p>
    </header>
  );
}
