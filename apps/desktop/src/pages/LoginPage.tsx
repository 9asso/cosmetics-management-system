import { ui } from "../lib/ui";
import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Boxes, LockKeyhole, ShoppingBag } from "lucide-react";
import type { LoginResult } from "@cosmetics/contracts";
import { api, ApiRequestError } from "../lib/api";

export function LoginPage({
  onLogin,
}: {
  onLogin: (result: LoginResult) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useMutation({ mutationFn: api.login, onSuccess: onLogin });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate({ email, password });
  };

  return (
    <main className={ui("login-page")}>
      <section className={ui("login-story")}>
        <img src="http://162.35.107.230/images/beauty-hero.png" alt="" className="absolute inset-0 size-full object-cover object-center" />
        <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-white/95 via-white/65 to-transparent" />
        <div className={ui("login-brand")}>
          <img src={`${import.meta.env.BASE_URL}brand-onight.png`} alt="" />{" "}
          ONight Dashboard
        </div>
        <div>
          <p className={ui("eyebrow")}>Commerce cosmétique unifié</p>
          <h1>Votre stock, vos achats et vos ventes dans un seul espace.</h1>
          <p>
            Chaque produit acheté alimente le même stock pour les ventes
            grossistes et la boutique retail.
          </p>
          <div className={ui("login-benefits")}>
            <span>
              <Boxes size={18} /> Stock partagé en temps réel
            </span>
            <span>
              <ShoppingBag size={18} /> Grossiste et boutique réunis
            </span>
          </div>
        </div>
        <span className={ui("text-sm")}>
          Plateforme sécurisée · Accès réservé à l’équipe
        </span>
      </section>
      <section className={ui("login-panel")}>
        <form className={ui("login-card")} onSubmit={submit}>
          <span className={ui("login-icon")}>
            <LockKeyhole size={23} />
          </span>
          <p className={ui("eyebrow")}>Espace de gestion</p>
          <h2>Bon retour parmi nous</h2>
          <p>
            Connectez-vous avec votre compte administrateur ou membre d’équipe.
          </p>
          <label>
            <span>Adresse email</span>
            <input
              autoFocus
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="vous@entreprise.ma"
            />
          </label>
          <label>
            <span>Mot de passe</span>
            <input
              required
              minLength={8}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••••"
            />
          </label>
          {login.isError && (
            <p className={ui("form-error")}>
              {login.error instanceof ApiRequestError
                ? login.error.message
                : "Connexion impossible."}
            </p>
          )}
          <button
            className={ui("primary-button login-submit")}
            disabled={login.isPending}
          >
            {login.isPending ? "Connexion…" : "Se connecter"}{" "}
            <ArrowRight size={17} />
          </button>
        </form>
      </section>
    </main>
  );
}
