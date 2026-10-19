import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandPage } from "@/components/BrandPage";
import { findBrand } from "@/lib/brands";
import { getStoreCatalog } from "@/lib/products";

type Props = { params: Promise<{ slug: string }> };

async function resolveBrand(params: Props["params"]) {
  const { slug } = await params;
  const { products } = await getStoreCatalog();
  return findBrand(slug, products);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const brand = await resolveBrand(params);
  if (!brand) return {};
  return {
    title: `${brand.name} | Yamoura`,
    description: `${brand.name} chez Yamoura : produits 100% authentiques, livrés partout au Maroc avec paiement à la livraison.`,
  };
}

export default async function BrandRoute({ params }: Props) {
  const brand = await resolveBrand(params);
  if (!brand) notFound();
  // Keyed so filters reset when moving from one brand to another.
  return <BrandPage key={brand.slug} slug={brand.slug} name={brand.name} />;
}
