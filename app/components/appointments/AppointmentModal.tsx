"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";

interface PatientOption {
  id: number;
  name: string;
  phone?: string | null;
}
interface DoctorOption {
  id: number;
  name: string;
}
interface SlotOption {
  doctorId: number;
  doctorName: string;
  specialty: string;
  appointmentDate: string;
  durationMinutes: number;
}

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: PatientOption[];
  doctors: DoctorOption[];
  onSubmit: (data: {
    patientId: number;
    doctorId: number;
    appointmentDate: string;
    reason: string;
  }) => Promise<boolean>;
}

const AppointmentFormContent: React.FC<{
  patients: PatientOption[];
  doctors: DoctorOption[];
  onClose: () => void;
  onSubmit: AppointmentModalProps["onSubmit"];
}> = ({ patients, doctors, onClose, onSubmit }) => {
  const [patientId, setPatientId] = useState(patients[0]?.id || 0);
  const [doctorId, setDoctorId] = useState(doctors[0]?.id || 0);
  const [patientSearch, setPatientSearch] = useState("");
  const [reason, setReason] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<SlotOption | null>(null);
  const [nextAppointment, setNextAppointment] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const filteredPatients = useMemo(() => {
    const query = patientSearch.trim().toLocaleLowerCase("fr");
    return patients.filter((patient) =>
      `${patient.name} ${patient.phone || ""}`.toLocaleLowerCase("fr").includes(query),
    );
  }, [patientSearch, patients]);

  useEffect(() => {
    if (!patientId) return;
    let active = true;
    fetch(`/api/patients/${patientId}/history`)
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        const upcoming = (data.appointments as Array<{
          appointmentDate: string;
          status: string;
          doctorFirstName: string;
          doctorName: string;
          specialty: string;
        }>)
          .filter((appointment) =>
            new Date(appointment.appointmentDate) > new Date() &&
            ["EN_ATTENTE", "CONFIRME", "PRISE_EN_CHARGE"].includes(appointment.status),
          )
          .sort((left, right) => left.appointmentDate.localeCompare(right.appointmentDate))[0];
        if (active && upcoming) {
          setNextAppointment(`${new Date(upcoming.appointmentDate).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })} · Dr. ${upcoming.doctorFirstName} ${upcoming.doctorName} · ${upcoming.specialty}`);
        } else if (active) {
          setNextAppointment(null);
        }
      })
      .catch(() => { if (active) setNextAppointment(null); });
    return () => { active = false; };
  }, [patientId]);

  async function searchSlots() {
    setError("");
    setSlots([]);
    setSelectedSlot(null);
    if (!from || !to || from > to || !doctorId) {
      setError("Choisissez un médecin et une période valide.");
      return;
    }
    setSearching(true);
    try {
      const query = new URLSearchParams({
        doctorId: String(doctorId),
        from,
        to,
      });
      const response = await fetch(`/api/availability?${query}`);
      const data = await response.json() as SlotOption[] | { error?: string };
      if (!response.ok || !Array.isArray(data)) {
        setError(!Array.isArray(data) ? data.error || "Recherche impossible." : "Recherche impossible.");
        return;
      }
      setSlots(data);
      if (data.length === 0) setError("Aucun créneau disponible pour ce médecin dans cette période.");
    } catch {
      setError("Impossible de rechercher les créneaux.");
    } finally {
      setSearching(false);
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedSlot || !patientId) {
      setError("Sélectionnez un patient et un créneau disponible.");
      return;
    }
    setSubmitting(true);
    try {
      if (await onSubmit({
        patientId,
        doctorId: selectedSlot.doctorId,
        appointmentDate: selectedSlot.appointmentDate,
        reason,
      })) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Rechercher un patient</label>
        <input className="mt-1 w-full border rounded-md p-2" placeholder="Nom, prénom ou téléphone" value={patientSearch} onChange={(event) => setPatientSearch(event.target.value)} />
        <select required className="mt-1 w-full border rounded-md p-2 bg-white" value={patientId} onChange={(event) => { setPatientId(Number(event.target.value)); setNextAppointment(null); }}>
          {filteredPatients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name}{patient.phone ? ` · ${patient.phone}` : ""}</option>)}
          {filteredPatients.length === 0 && <option value="" disabled>Aucun patient trouvé</option>}
        </select>
        {nextAppointment && <p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-900">Prochain rendez-vous : {nextAppointment}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Médecin</label>
        <select required className="mt-1 w-full border rounded-md p-2 bg-white" value={doctorId} onChange={(event) => setDoctorId(Number(event.target.value))}>
          {doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">Période du<input type="date" required className="mt-1 w-full border rounded-md p-2" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label className="text-sm">Au<input type="date" required min={from} className="mt-1 w-full border rounded-md p-2" value={to} onChange={(event) => setTo(event.target.value)} /></label>
      </div>
      <Button type="button" variant="secondary" disabled={searching} onClick={() => void searchSlots()}>{searching ? "Recherche..." : "Rechercher les créneaux"}</Button>

      {slots.length > 0 && (
        <fieldset className="grid max-h-52 gap-2 overflow-auto rounded border p-3">
          <legend className="px-1 text-sm font-medium">Créneaux disponibles</legend>
          {slots.map((slot) => (
            <label className="flex items-center gap-2 text-sm" key={slot.appointmentDate}>
              <input type="radio" name="admin-slot" checked={selectedSlot?.appointmentDate === slot.appointmentDate} onChange={() => setSelectedSlot(slot)} />
              {new Date(slot.appointmentDate).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })} · {slot.durationMinutes} min
            </label>
          ))}
        </fieldset>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">Motif de la visite</label>
        <textarea className="mt-1 w-full border rounded-md p-2" rows={2} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
      </div>
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
        <Button type="submit" variant="primary" disabled={!selectedSlot || !patientId || submitting}>{submitting ? "Programmation..." : "Programmer"}</Button>
      </div>
    </form>
  );
};

export const AppointmentModal: React.FC<AppointmentModalProps> = ({
  isOpen,
  onClose,
  patients,
  doctors,
  onSubmit,
}) => (
  <Modal isOpen={isOpen} onClose={onClose} title="Nouveau Rendez-vous">
    <AppointmentFormContent
      key={isOpen ? "open" : "closed"}
      patients={patients}
      doctors={doctors}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  </Modal>
);
