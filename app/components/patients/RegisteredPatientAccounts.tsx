"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Ban, CheckCircle, Eye, Pencil, Search } from "lucide-react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Patient } from "./PatientList";
import { confirmAction, showActionError } from "../../lib/confirm";

interface RegisteredPatientAccount {
  id: number;
  patientId: number | null;
  firstName: string;
  lastName: string;
  name: string;
  birthDate: string;
  gender: string;
  phone: string;
  address: string;
  email: string;
  isActive: boolean;
  createdAt: string;
}

interface AccountFormValues {
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: string;
  phone: string;
  address: string;
  email: string;
}

function AccountForm({
  account,
  onCancel,
  onSave,
}: {
  account: RegisteredPatientAccount;
  onCancel: () => void;
  onSave: (values: AccountFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<AccountFormValues>({
    firstName: account.firstName,
    lastName: account.lastName,
    birthDate: account.birthDate,
    gender: account.gender,
    phone: account.phone,
    address: account.address,
    email: account.email,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const confirmed = await confirmAction({
      title: "Confirmer la modification",
      text: `Enregistrer les nouvelles informations de ${account.firstName} ${account.lastName} ?`,
      confirmButtonText: "Enregistrer",
      icon: "question",
    });
    if (!confirmed) return;
    setSaving(true);
    setError("");
    try {
      await onSave(values);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "La modification a échoué.");
    } finally {
      setSaving(false);
    }
  }

  function setField<K extends keyof AccountFormValues>(key: K, value: AccountFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-gray-700">
          Prénom
          <input className="mt-1 w-full rounded-md border p-2" required minLength={2} maxLength={100} value={values.firstName} onChange={(event) => setField("firstName", event.target.value)} />
        </label>
        <label className="text-sm font-medium text-gray-700">
          Nom
          <input className="mt-1 w-full rounded-md border p-2" required minLength={2} maxLength={100} value={values.lastName} onChange={(event) => setField("lastName", event.target.value)} />
        </label>
        <label className="text-sm font-medium text-gray-700">
          Date de naissance
          <input className="mt-1 w-full rounded-md border p-2" type="date" required max={new Date().toISOString().slice(0, 10)} value={values.birthDate} onChange={(event) => setField("birthDate", event.target.value)} />
        </label>
        <label className="text-sm font-medium text-gray-700">
          Sexe
          <select className="mt-1 w-full rounded-md border bg-white p-2" value={values.gender} onChange={(event) => setField("gender", event.target.value)}>
            <option value="M">Masculin</option>
            <option value="F">Féminin</option>
            <option value="AUTRE">Autre</option>
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">
          Téléphone
          <input className="mt-1 w-full rounded-md border p-2" type="tel" required minLength={6} maxLength={20} value={values.phone} onChange={(event) => setField("phone", event.target.value)} />
        </label>
        <label className="text-sm font-medium text-gray-700">
          Adresse e-mail
          <input className="mt-1 w-full rounded-md border p-2" type="email" required maxLength={255} value={values.email} onChange={(event) => setField("email", event.target.value)} />
        </label>
        <label className="text-sm font-medium text-gray-700 sm:col-span-2">
          Adresse
          <textarea className="mt-1 w-full rounded-md border p-2" rows={2} maxLength={500} value={values.address} onChange={(event) => setField("address", event.target.value)} />
        </label>
      </div>
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>Annuler</Button>
        <Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</Button>
      </div>
    </form>
  );
}

export function RegisteredPatientAccounts({ onViewRecord }: { onViewRecord: (patient: Patient) => void }) {
  const [accounts, setAccounts] = useState<RegisteredPatientAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disabled">("all");
  const [editing, setEditing] = useState<RegisteredPatientAccount | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/patients/accounts")
      .then(async (response) => ({
        ok: response.ok,
        result: await response.json() as RegisteredPatientAccount[] | { error?: string },
      }))
      .then(({ ok, result }) => {
        if (!isMounted) return;
        if (!ok || !Array.isArray(result)) {
          setError(!Array.isArray(result) ? result.error || "Impossible de charger les comptes." : "Impossible de charger les comptes.");
          return;
        }
        setAccounts(result);
      })
      .catch((reason: unknown) => {
        if (isMounted) setError(reason instanceof Error ? reason.message : "Impossible de charger les comptes patients.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => { isMounted = false; };
  }, []);

  const visibleAccounts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("fr");
    return accounts.filter((account) => {
      const matchesStatus = statusFilter === "all" ||
        (statusFilter === "active" ? account.isActive : !account.isActive);
      const haystack = `${account.firstName} ${account.lastName} ${account.email} ${account.phone}`.toLocaleLowerCase("fr");
      return matchesStatus && haystack.includes(normalizedQuery);
    });
  }, [accounts, query, statusFilter]);

  async function saveAccount(values: AccountFormValues) {
    if (!editing) return;
    const response = await fetch(`/api/patients/accounts/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const result = await response.json() as RegisteredPatientAccount | { error?: string };
    if (!response.ok || !("id" in result)) {
      throw new Error("error" in result ? result.error || "La modification a échoué." : "La modification a échoué.");
    }
    setAccounts((current) => current.map((account) => account.id === result.id ? { ...account, ...result } : account));
    setEditing(null);
  }

  async function changeAccountStatus(account: RegisteredPatientAccount) {
    const nextActive = !account.isActive;
    const confirmed = await confirmAction({
      title: nextActive ? "Lever le bannissement ?" : "Bannir ce compte patient ?",
      text: nextActive
        ? `${account.firstName} ${account.lastName} pourra de nouveau se connecter.`
        : `${account.firstName} ${account.lastName} ne pourra plus se connecter. Son dossier médical et ses rendez-vous seront conservés.`,
      confirmButtonText: nextActive ? "Réactiver" : "Bannir",
    });
    if (!confirmed) return;
    setError("");
    try {
      const response = await fetch(`/api/patients/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
      });
      const result = await response.json() as { id?: number; isActive?: boolean; error?: string };
      if (!response.ok || typeof result.isActive !== "boolean") {
        throw new Error(result.error || "Impossible de modifier le statut du compte.");
      }
      setAccounts((current) => current.map((account) => account.id === result.id ? { ...account, isActive: result.isActive! } : account));
    } catch (reason) {
      await showActionError(
        "Modification impossible",
        reason instanceof Error ? reason.message : "Impossible de modifier le statut du compte.",
      );
    }
  }

  const activeCount = accounts.filter((account) => account.isActive).length;

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-white p-4"><p className="text-sm text-gray-500">Comptes inscrits</p><strong className="text-2xl text-gray-900">{accounts.length}</strong></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-sm text-gray-500">Actifs</p><strong className="text-2xl text-green-700">{activeCount}</strong></div>
        <div className="rounded-lg border bg-white p-4"><p className="text-sm text-gray-500">Désactivés</p><strong className="text-2xl text-red-700">{accounts.length - activeCount}</strong></div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-white p-4">
        <label className="flex min-w-56 flex-1 items-center gap-2 rounded-md border px-3 py-2">
          <Search size={16} className="text-gray-400" aria-hidden="true" />
          <input className="w-full outline-none" type="search" placeholder="Rechercher nom, e-mail, téléphone" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <select className="rounded-md border bg-white p-2" aria-label="Filtrer les comptes par statut" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
          <option value="all">Tous les comptes</option>
          <option value="active">Comptes actifs</option>
          <option value="disabled">Comptes bannis</option>
        </select>
      </div>

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      {loading ? <p className="text-sm text-gray-500">Chargement des comptes inscrits...</p> : (
        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
          <table className="w-full min-w-[850px] border-collapse text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr><th className="p-3">Patient</th><th className="p-3">E-mail / téléphone</th><th className="p-3">Naissance</th><th className="p-3">Inscription</th><th className="p-3">Statut</th><th className="p-3">Actions</th></tr>
            </thead>
            <tbody>
              {visibleAccounts.map((account) => (
                <tr key={account.id} className="border-t">
                  <td className="p-3"><strong>{account.lastName} {account.firstName}</strong><span className="block text-xs text-gray-500">{account.gender === "M" ? "Masculin" : account.gender === "F" ? "Féminin" : "Autre"}</span></td>
                  <td className="p-3">{account.email}<span className="block text-xs text-gray-500">{account.phone || "Téléphone non renseigné"}</span></td>
                  <td className="p-3">{account.birthDate || "—"}</td>
                  <td className="p-3">{new Date(account.createdAt).toLocaleDateString("fr-FR")}</td>
                  <td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-medium ${account.isActive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{account.isActive ? "Actif" : "Banni"}</span></td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {account.patientId && (
                        <button type="button" className="table-action table-action-edit" title="Voir le dossier médical" aria-label={`Voir le dossier de ${account.firstName} ${account.lastName}`} onClick={() => onViewRecord({
                          id: account.patientId!,
                          firstName: account.firstName,
                          lastName: account.lastName,
                          birthDate: account.birthDate,
                          gender: account.gender,
                          phone: account.phone || null,
                          address: account.address || null,
                        })}><Eye size={16} aria-hidden="true" /></button>
                      )}
                      <button type="button" className="table-action table-action-edit" title="Modifier les informations" aria-label={`Modifier ${account.firstName} ${account.lastName}`} onClick={() => setEditing(account)}><Pencil size={16} aria-hidden="true" /></button>
                      <button type="button" className={`table-action ${account.isActive ? "table-action-delete" : "table-action-edit"}`} title={account.isActive ? "Bannir le compte" : "Lever le bannissement"} aria-label={`${account.isActive ? "Bannir" : "Lever le bannissement"} le compte de ${account.firstName} ${account.lastName}`} onClick={() => void changeAccountStatus(account)}>
                        {account.isActive ? <Ban size={16} aria-hidden="true" /> : <CheckCircle size={16} aria-hidden="true" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visibleAccounts.length === 0 && <tr><td className="p-8 text-center text-gray-500" colSpan={6}>{accounts.length ? "Aucun compte ne correspond aux filtres." : "Aucun compte patient inscrit."}</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={Boolean(editing)} onClose={() => setEditing(null)} title="Modifier le compte patient" size="wide">
        {editing && <AccountForm key={editing.id} account={editing} onCancel={() => setEditing(null)} onSave={saveAccount} />}
      </Modal>
    </section>
  );
}
