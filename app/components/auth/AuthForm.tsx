"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, HeartPulse, LockKeyhole, Mail, Phone, UserRound } from "lucide-react";

interface AuthFormProps {
  mode: "login" | "register";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const isRegister = mode === "register";
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/auth/${mode === "login" ? "login" : "register"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, phone, birthDate, gender, email, password }),
      });
      const result = (await response.json()) as {
        destination?: string;
        error?: string;
      };
      if (!response.ok || !result.destination) {
        setError(result.error || "La connexion n’a pas abouti.");
        return;
      }
      router.replace(result.destination);
      router.refresh();
    } catch {
      setError("Impossible de joindre le serveur. Réessayez.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-aside" aria-label="PSFA">
        <Link href="/login" className="auth-brand">
          <span className="brand-mark"><HeartPulse size={23} strokeWidth={2.2} /></span>
          <span>PSFA<span className="brand-period">.</span></span>
        </Link>
        <div className="auth-aside-copy">
          <span className="eyebrow">CENTRE DE SANTÉ</span>
          <h1>Le soin commence par une bonne écoute.</h1>
          <p>Un espace serein pour accompagner chaque étape de votre parcours de santé.</p>
        </div>
        <div className="auth-aside-foot"><span className="status-dot" /> Votre espace de santé, en toute simplicité</div>
        <div className="auth-ring auth-ring-one" aria-hidden="true" />
        <div className="auth-ring auth-ring-two" aria-hidden="true" />
      </section>

      <section className="auth-main">
        <div className="auth-mobile-brand auth-brand">
          <span className="brand-mark"><HeartPulse size={22} /></span>
          <span>PSFA<span className="brand-period">.</span></span>
        </div>
        <div className="auth-form-wrap">
          <span className="eyebrow">{isRegister ? "NOUVEAU COMPTE" : "ESPACE SÉCURISÉ"}</span>
          <h2>{isRegister ? "Créer votre compte" : "Ravi de vous revoir"}</h2>
          <p className="auth-subtitle">
            {isRegister
              ? "Inscrivez-vous pour accéder à votre espace personnel."
              : "Connectez-vous pour retrouver votre espace de santé."}
          </p>

          <form className="auth-form" onSubmit={submit}>
            {isRegister && (
              <>
                <label className="auth-field">
                  <span>Prénom</span>
                  <span className="auth-input-wrap"><UserRound size={17} /><input autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} required minLength={2} maxLength={100} placeholder="Votre prénom" /></span>
                </label>
                <label className="auth-field">
                  <span>Nom</span>
                  <span className="auth-input-wrap"><UserRound size={17} /><input autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} required minLength={2} maxLength={100} placeholder="Votre nom" /></span>
                </label>
                <label className="auth-field">
                  <span>Téléphone</span>
                  <span className="auth-input-wrap"><Phone size={17} /><input type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required minLength={6} maxLength={20} placeholder="+261 ..." /></span>
                </label>
                <label className="auth-field">
                  <span>Date de naissance</span>
                  <span className="auth-input-wrap"><CalendarDays size={17} /><input type="date" autoComplete="bday" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} required /></span>
                </label>
                <label className="auth-field">
                  <span>Sexe</span>
                  <select className="auth-select" value={gender} onChange={(event) => setGender(event.target.value)} required>
                    <option value="">Choisir</option>
                    <option value="F">Féminin</option>
                    <option value="M">Masculin</option>
                    <option value="AUTRE">Autre</option>
                  </select>
                </label>
              </>
            )}
            <label className="auth-field">
              <span>Adresse e-mail</span>
              <span className="auth-input-wrap"><Mail size={17} /><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="vous@exemple.com" /></span>
            </label>
            <label className="auth-field">
              <span>Mot de passe</span>
              <span className="auth-input-wrap"><LockKeyhole size={17} /><input type="password" autoComplete={isRegister ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={isRegister ? 8 : 1} placeholder={isRegister ? "8 caractères minimum" : "Votre mot de passe"} /></span>
            </label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Patientez..." : isRegister ? "Créer mon compte" : "Se connecter"}
              {!isSubmitting && <ArrowRight size={18} />}
            </button>
          </form>

          <p className="auth-switch">
            {isRegister ? "Vous avez déjà un compte ? " : "Pas encore de compte ? "}
            <Link href={isRegister ? "/login" : "/register"}>
              {isRegister ? "Se connecter" : "Créer un compte"}
            </Link>
          </p>
          <p className="auth-privacy">Accès chiffré · Vos données restent confidentielles</p>
        </div>
      </section>
    </main>
  );
}
