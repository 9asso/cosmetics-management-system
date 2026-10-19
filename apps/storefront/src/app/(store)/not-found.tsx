import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <section className="section">
      <div className="catalog-empty">
        <SearchX size={34} />
        <h1>Page introuvable</h1>
        <p>Cette page n’existe pas ou plus. Retrouvez toutes nos marques ou revenez à la boutique.</p>
        <div className="not-found-actions">
          <Link className="button button-dark" href="/marques">
            Toutes les marques
          </Link>
          <Link className="button button-ghost" href="/">
            Retour à la boutique
          </Link>
        </div>
      </div>
    </section>
  );
}
