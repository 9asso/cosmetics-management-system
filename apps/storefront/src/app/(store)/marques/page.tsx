import type { Metadata } from "next";
import { BrandDirectory } from "@/components/BrandDirectory";

export const metadata: Metadata = {
  title: "Marques de A à Z | Yamoura",
  description: "Toutes les marques beauté chez Yamoura : soin, maquillage, parfums et K-beauty, 100% authentiques et livrés partout au Maroc.",
};

export default function BrandsPage() {
  return <BrandDirectory />;
}
