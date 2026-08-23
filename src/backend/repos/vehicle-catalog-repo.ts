import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function listVehicleCatalog() {
  const supabase = await createSupabaseServerClient();

  const [{ data: brands }, { data: models }, { data: colors }] = await Promise.all([
    supabase.from("vehicle_catalog_brands").select("name").eq("is_active", true).order("name", { ascending: true }),
    supabase
      .from("vehicle_catalog_models")
      .select("name, vehicle_catalog_brands!inner(name)")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase.from("vehicle_catalog_colors").select("name").eq("is_active", true).order("name", { ascending: true }),
  ]);

  return {
    brands: (brands ?? []).map((item) => item.name),
    models: (models ?? []).map((item) => ({
      name: item.name,
      brand: Array.isArray((item as { vehicle_catalog_brands?: { name?: string }[] | { name?: string } | null }).vehicle_catalog_brands)
        ? (((item as { vehicle_catalog_brands?: { name?: string }[] | { name?: string } | null }).vehicle_catalog_brands as { name?: string }[])[0]?.name ?? "")
        : (((item as { vehicle_catalog_brands?: { name?: string }[] | { name?: string } | null }).vehicle_catalog_brands as { name?: string } | null)?.name ?? ""),
    })),
    colors: (colors ?? []).map((item) => item.name),
  };
}
