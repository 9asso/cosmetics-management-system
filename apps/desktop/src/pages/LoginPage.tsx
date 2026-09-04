import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ArrowRight, Boxes, LockKeyhole, ShoppingBag, Sparkles } from 'lucide-react';
import type { LoginResult } from '@cosmetics/contracts';
import { api, ApiRequestError } from '../lib/api';

export function LoginPage({ onLogin }: { onLogin: (result: LoginResult) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useMutation({ mutationFn: api.login, onSuccess: onLogin });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate({ email, password });
  };

  return (
    <main className="login-page">
      <section className="login-story">
        <div className="login-brand"><span><Sparkles size={22} /></span> GlowCare Business</div>
        <div>
          <p className="eyebrow">Commerce cosmétique unifié</p>
          <h1>Votre stock, vos achats et vos ventes dans un seul espace.</h1>
          <p>Chaque produit acheté alimente le même stock pour les ventes grossistes et la boutique retail.</p>
          <div className="login-benefits">
            <span><Boxes size={18} /> Stock partagé en temps réel</span>
            <span><ShoppingBag size={18} /> Grossiste et boutique réunis</span>
          </div>
        </div>
        <small>Plateforme sécurisée · Accès réservé à l’équipe</small>
      </section>
      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <span className="login-icon"><LockKeyhole size={23} /></span>
          <p className="eyebrow">Espace de gestion</p>
          <h2>Bon retour parmi nous</h2>
          <p>Connectez-vous avec votre compte administrateur ou membre d’équipe.</p>
          <label><span>Adresse email</span><input autoFocus required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="vous@entreprise.ma" /></label>
          <label><span>Mot de passe</span><input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••••" /></label>
          {login.isError && <p className="form-error">{login.error instanceof ApiRequestError ? login.error.message : 'Connexion impossible.'}</p>}
          <button className="primary-button login-submit" disabled={login.isPending}>
            {login.isPending ? 'Connexion…' : 'Se connecter'} <ArrowRight size={17} />
          </button>
        </form>
      </section>
    </main>
  );
}
