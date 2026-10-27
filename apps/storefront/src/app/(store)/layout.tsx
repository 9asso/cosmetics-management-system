import { StoreShell } from "@/components/StoreShell";
import { getStoreCatalog } from "@/lib/products";

/** Header, footer, cart and overlays stay mounted while shoppers move between store pages. */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const { products, demo, shipping, featured } = await getStoreCatalog();
  return (
    <StoreShell products={products} demo={demo} shipping={shipping} featured={featured}>
      {children}
    </StoreShell>
  );
}
