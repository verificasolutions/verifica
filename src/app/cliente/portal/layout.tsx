import { requireCustomer } from "@/backend/auth/guards";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  await requireCustomer();
  return <>{children}</>;
}
