import type { Paginated, ProductListItem } from "@cosmetics/contracts";
import { StoreShell } from "./StoreShell";

const apiUrl = process.env.API_URL ?? "http://localhost:4000/api/v1";

async function getProducts(): Promise<ProductListItem[]> {
  try {
    const response = await fetch(`${apiUrl}/store/products?page=1&pageSize=100`, { cache: "no-store" });
    if (!response.ok) return [];
    return ((await response.json()) as Paginated<ProductListItem>).items;
  } catch {
    return [];
  }
}

export default async function Home() {
  return <StoreShell products={await getProducts()} />;
}
