import { redirect } from "next/navigation";

export default async function ShortTrackingRedirectPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  redirect(`/acompanhar/${codigo}`);
}
