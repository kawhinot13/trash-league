import type { Metadata } from "next";
import { Suspense } from "react";
import { YahooGate, YahooLoading } from "@/components/app/yahoo-gate";
import { ManagerProfileView } from "@/components/trash/profile";
import { yearsOf } from "@/lib/core/extras";

export const metadata: Metadata = { title: "Manager", robots: { index: false } };

export default function YahooManager({ params }: PageProps<"/y/[key]/managers/[id]">) {
  return (
    <Suspense fallback={<YahooLoading />}>
      {params.then(({ key, id }) => {
        const k = decodeURIComponent(key);
        return (
          <YahooGate id={k} path={`/managers/${id}`}>
            {(d) => <ManagerProfileView d={d} id={decodeURIComponent(id)} label={yearsOf(d)} base={`/y/${k}`} lineup="weekly" />}
          </YahooGate>
        );
      })}
    </Suspense>
  );
}
