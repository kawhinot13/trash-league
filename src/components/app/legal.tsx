import { AppNav } from "@/components/app/chrome";
import { CONTACT_EMAIL } from "@/lib/app/brand";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-3xl px-5 pt-32 pb-16 md:px-10 md:pt-40 md:pb-24">
        <h1 className="font-display text-6xl leading-[0.9] font-black md:text-8xl">{title}</h1>
        <p className="mt-4 text-sm text-[var(--muted)]">Last updated {updated}</p>
        <div className="mt-10 space-y-10 text-lg leading-relaxed [&_h2]:font-display [&_h2]:text-3xl [&_h2]:font-black [&_li]:mt-2 [&_p]:mt-3 [&_p]:text-[var(--paper)]/85 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:text-[var(--paper)]/85">
          {children}
        </div>
      </main>
    </>
  );
}

/** How to reach a person, or the self-serve removal page if no address is configured. */
export function Contact() {
  return CONTACT_EMAIL ? (
    <>
      email{" "}
      <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold underline underline-offset-4">
        {CONTACT_EMAIL}
      </a>
    </>
  ) : (
    <>use the &ldquo;Remove it from Rafterlore&rdquo; link at the bottom of your league&apos;s page</>
  );
}
