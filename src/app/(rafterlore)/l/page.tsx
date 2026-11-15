import { AppNav } from "@/components/app/chrome";
import { Finder } from "@/components/app/finder";

export default function FindPage() {
  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-6xl px-5 pt-32 pb-24 md:px-10 md:pt-44">
        <h1 className="font-display max-w-[14ch] text-[clamp(3.4rem,11vw,8.5rem)] leading-[0.84] font-black">
          Hang your league&apos;s history in the rafters
        </h1>
        <p className="mt-6 max-w-[54ch] text-lg text-[var(--muted)]">
          Every season of your Sleeper NBA league in one place: champions, all-time records, every trade graded and
          every lineup replayed from the box scores. Head-to-head points leagues for now.
        </p>
        <div className="mt-10">
          <Finder />
        </div>
      </main>
    </>
  );
}
