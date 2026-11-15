import { Suspense } from "react";
import { ManagerProfileView } from "@/components/trash/profile";
import { league, seasonLabel } from "@/lib/league";
import { TRASH } from "@/lib/extras";

export function generateStaticParams() {
  return league.managers.map((m) => ({ id: m.id }));
}

export default function ManagerPage({ params }: PageProps<"/managers/[id]">) {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <Profile params={params} />
    </Suspense>
  );
}

async function Profile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ManagerProfileView d={TRASH} id={decodeURIComponent(id)} label={seasonLabel} />;
}
