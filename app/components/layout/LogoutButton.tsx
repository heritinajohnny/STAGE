"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { confirmAction, showActionError } from "../../lib/confirm";

export function LogoutButton({ location }: { location: "sidebar" | "header" | "portal" }) {
  const router = useRouter();

  async function confirmLogout() {
    const confirmed = await confirmAction({
      title: "Confirmer la déconnexion",
      text: "Voulez-vous vraiment vous déconnecter de votre compte ?",
      confirmButtonText: "Se déconnecter",
      cancelButtonText: "Rester connecté",
    });
    if (!confirmed) return;
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("La déconnexion a échoué. Veuillez réessayer.");
      router.replace("/login");
      router.refresh();
    } catch (reason) {
      await showActionError(
        "Déconnexion impossible",
        reason instanceof Error ? reason.message : "Impossible de vous déconnecter.",
      );
    }
  }

  return (
      <button
        type="button"
        className={location === "sidebar" ? "sidebar-logout" : location === "portal" ? "portal-logout" : "header-logout"}
        onClick={() => void confirmLogout()}
        title="Déconnexion"
        aria-label="Déconnexion"
      >
        <LogOut size={location === "sidebar" ? 18 : 17} aria-hidden="true" />
        {location !== "header" && <span>Déconnexion</span>}
      </button>
  );
}
