import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TenantPublicSite, buildTenantPublicMetadata, getTenantPublicSite } from "@/components/tenant-public-site";

const PUBLIC_ORIGIN = "https://www.verificasolutions.com.br/verifica";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return (await buildTenantPublicMetadata(slug, PUBLIC_ORIGIN)) ?? {};
}

export const dynamic = "force-dynamic";

export default async function TenantPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getTenantPublicSite(slug);

  if (!site || !site.tenantSettings?.landing_enabled || (site.landing && !site.landing.is_published)) {
    notFound();
  }

  return <TenantPublicSite slug={slug} origin={PUBLIC_ORIGIN} />;
}
