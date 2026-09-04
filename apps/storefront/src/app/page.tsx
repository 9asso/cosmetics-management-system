import type { Paginated, ProductListItem } from "@cosmetics/contracts";
import { ArrowRight, Sparkles } from "lucide-react";
import { StoreShell } from "./StoreShell";

const apiUrl = process.env.API_URL ?? "http://localhost:4000/api/v1";

async function getProducts(): Promise<ProductListItem[]> {
  try {
    const response = await fetch(`${apiUrl}/store/products?page=1&pageSize=8`, {
      cache: "no-store",
    });
    if (!response.ok) return [];
    return ((await response.json()) as Paginated<ProductListItem>).items;
  } catch {
    return [];
  }
}

export default async function Home() {
  const products = await getProducts();
  return (
    <main>
      <StoreShell products={products}>
        <section className="hero" id="nouveautes">
          <div className="hero-copy">
            <p>La beauté dans chaque détail</p>
            <h1>
              Votre rituel,
              <br />
              <em>réinventé.</em>
            </h1>
            <span>
              Une sélection de soins et de parfums choisis pour leur qualité,
              leur efficacité et le plaisir qu’ils procurent.
            </span>
            <a href="#catalogue">
              Découvrir la collection <ArrowRight size={17} />
            </a>
          </div>
          <div className="hero-art">
            <div className="sun" />
            <div className="bottle">
              <i>ÉLAN</i>
              <span>
                ESSENCE
                <br />
                RADIANCE
              </span>
            </div>
            <Sparkles className="sparkle one" />
            <Sparkles className="sparkle two" />
          </div>
        </section>
      </StoreShell>
    </main>
  );
}
