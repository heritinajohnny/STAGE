"use client";

import { FormEvent, useState } from "react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

export interface ConsultationFormValues {
  diagnosis: string;
  prescription: string;
  notes: string;
}

export interface ConsultationAppointment {
  id: number;
  patientName: string;
  doctorName: string;
  appointmentDate: string;
}

export function ConsultationFormModal({
  appointment,
  onClose,
  onSubmit,
}: {
  appointment: ConsultationAppointment | null;
  onClose: () => void;
  onSubmit: (values: ConsultationFormValues) => Promise<string | null>;
}) {
  const [values, setValues] = useState<ConsultationFormValues>({
    diagnosis: "",
    prescription: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!appointment) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await onSubmit(values);
      if (result) setError(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d’enregistrer cette consultation.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen onClose={() => !saving && onClose()} title="Terminer la consultation" size="wide">
      <form className="space-y-4" onSubmit={(event) => void submit(event)}>
        <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-700">
          <p><strong>Patient :</strong> {appointment.patientName}</p>
          <p><strong>Médecin :</strong> {appointment.doctorName}</p>
          <p><strong>Rendez-vous :</strong> {new Date(appointment.appointmentDate).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</p>
        </div>
        <label className="block text-sm font-medium text-gray-700">
          Diagnostic / compte rendu <span aria-hidden="true">*</span>
          <textarea
            className="mt-1 w-full rounded-md border p-2"
            rows={4}
            required
            maxLength={4000}
            value={values.diagnosis}
            onChange={(event) => setValues((current) => ({ ...current, diagnosis: event.target.value }))}
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Traitement / prescription
          <textarea
            className="mt-1 w-full rounded-md border p-2"
            rows={3}
            maxLength={4000}
            value={values.prescription}
            onChange={(event) => setValues((current) => ({ ...current, prescription: event.target.value }))}
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Notes complémentaires
          <textarea
            className="mt-1 w-full rounded-md border p-2"
            rows={3}
            maxLength={4000}
            value={values.notes}
            onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))}
          />
        </label>
        {error && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
        <p className="text-xs text-gray-500">L’enregistrement clôture le rendez-vous et ajoute le compte rendu à l’historique médical du patient.</p>
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer et consulter"}</Button>
        </div>
      </form>
    </Modal>
  );
}
