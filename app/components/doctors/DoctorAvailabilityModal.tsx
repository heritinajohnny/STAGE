"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { confirmAction } from "../../lib/confirm";

const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

interface WorkingHour {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}
interface Unavailability {
  id: number;
  startAt: string;
  endAt: string;
  kind: string;
  reason: string | null;
}
interface DoctorAvailability {
  id: number;
  firstName: string;
  lastName: string;
  consultationDurationMinutes: number;
  maxPatientsPerSlot: number;
}

const emptyWeek = () => days.map((_, dayOfWeek) => ({
  dayOfWeek,
  enabled: false,
  startTime: "08:00",
  endTime: "17:00",
}));

export function DoctorAvailabilityModal({
  doctor,
  onClose,
}: {
  doctor: Pick<DoctorAvailability, "id" | "firstName" | "lastName"> | null;
  onClose: () => void;
}) {
  const [hours, setHours] = useState(emptyWeek);
  const [duration, setDuration] = useState(30);
  const [capacity, setCapacity] = useState(1);
  const [periods, setPeriods] = useState<Unavailability[]>([]);
  const [periodForm, setPeriodForm] = useState({ startAt: "", endAt: "", kind: "ABSENCE", reason: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!doctor) return;
    let active = true;
    fetch(`/api/doctors/${doctor.id}/availability`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Impossible de charger les disponibilités.");
        if (!active) return;
        setDuration(data.doctor.consultationDurationMinutes);
        setCapacity(data.doctor.maxPatientsPerSlot);
        setHours(emptyWeek().map((day) => {
          const rule = data.workingHours.find((item: WorkingHour) => item.dayOfWeek === day.dayOfWeek);
          return rule ? { ...day, enabled: true, startTime: rule.startTime.slice(0, 5), endTime: rule.endTime.slice(0, 5) } : day;
        }));
        setPeriods(data.unavailability as Unavailability[]);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Erreur de chargement.");
      });
    return () => { active = false; };
  }, [doctor]);

  async function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!doctor) return;
    if (!await confirmAction({
      title: "Confirmer la modification",
      text: "Enregistrer les nouveaux horaires et capacités de consultation ?",
      confirmButtonText: "Enregistrer",
      icon: "question",
    })) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/doctors/${doctor.id}/availability`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consultationDurationMinutes: duration,
          maxPatientsPerSlot: capacity,
          workingHours: hours.filter((day) => day.enabled),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Impossible d’enregistrer les horaires.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erreur d’enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  async function addPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!doctor) return;
    setError("");
    try {
      const response = await fetch(`/api/doctors/${doctor.id}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...periodForm,
          startAt: new Date(periodForm.startAt).toISOString(),
          endAt: new Date(periodForm.endAt).toISOString(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Impossible d’ajouter cette période.");
      setPeriods((items) => [...items, data]);
      setPeriodForm({ startAt: "", endAt: "", kind: "ABSENCE", reason: "" });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erreur d’enregistrement.");
    }
  }

  async function removePeriod(periodId: number) {
    if (!doctor) return;
    const confirmed = await confirmAction({
      title: "Supprimer cette période ?",
      text: "Cette absence ou ce créneau bloqué sera supprimé.",
      confirmButtonText: "Supprimer",
    });
    if (!confirmed) return;
    const response = await fetch(`/api/doctors/${doctor.id}/availability`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodId }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Impossible de supprimer cette période.");
      return;
    }
    setPeriods((items) => items.filter((period) => period.id !== periodId));
  }

  return (
    <Modal isOpen={Boolean(doctor)} onClose={onClose} title={doctor ? `Disponibilités — Dr. ${doctor.firstName} ${doctor.lastName}` : ""} size="wide">
      <div className="space-y-6">
        <form className="space-y-4" onSubmit={saveSchedule}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-sm font-medium" htmlFor="consultation-duration">Durée d’une consultation (minutes)</label>
              <input id="consultation-duration" className="w-full border rounded-md p-2" type="number" min={5} max={240} step={5} value={duration} onChange={(event) => setDuration(Number(event.target.value))} required />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium" htmlFor="slot-capacity">Nombre de patients par créneau</label>
              <input id="slot-capacity" className="w-full border rounded-md p-2" type="number" min={1} max={20} value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} required />
            </div>
          </div>
          <h3 className="font-semibold">Horaires hebdomadaires</h3>
          {hours.map((day) => (
            <div className="grid grid-cols-[minmax(5.5rem,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 sm:gap-3" key={day.dayOfWeek}>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={day.enabled} onChange={(event) => setHours((items) => items.map((item) => item.dayOfWeek === day.dayOfWeek ? { ...item, enabled: event.target.checked } : item))} />{days[day.dayOfWeek]}</label>
              <input aria-label={`Début ${days[day.dayOfWeek]}`} type="time" disabled={!day.enabled} className="w-full min-w-0 rounded border p-2" value={day.startTime} onChange={(event) => setHours((items) => items.map((item) => item.dayOfWeek === day.dayOfWeek ? { ...item, startTime: event.target.value } : item))} />
              <input aria-label={`Fin ${days[day.dayOfWeek]}`} type="time" disabled={!day.enabled} className="w-full min-w-0 rounded border p-2" value={day.endTime} onChange={(event) => setHours((items) => items.map((item) => item.dayOfWeek === day.dayOfWeek ? { ...item, endTime: event.target.value } : item))} />
            </div>
          ))}
          <Button type="submit" variant="primary" disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer les horaires"}</Button>
        </form>

        <section className="space-y-3 border-t pt-4">
          <h3 className="font-semibold">Absences et créneaux bloqués</h3>
          <form className="grid gap-3" onSubmit={addPeriod}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm">Début<input className="mt-1 w-full border rounded p-2" type="datetime-local" required value={periodForm.startAt} onChange={(event) => setPeriodForm({ ...periodForm, startAt: event.target.value })} /></label>
              <label className="text-sm">Fin<input className="mt-1 w-full border rounded p-2" type="datetime-local" required value={periodForm.endAt} onChange={(event) => setPeriodForm({ ...periodForm, endAt: event.target.value })} /></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select className="border rounded p-2" value={periodForm.kind} onChange={(event) => setPeriodForm({ ...periodForm, kind: event.target.value })}><option value="ABSENCE">Absence / congé</option><option value="BLOCKED">Bloquer un créneau</option></select>
              <input className="border rounded p-2" maxLength={500} placeholder="Motif (facultatif)" value={periodForm.reason} onChange={(event) => setPeriodForm({ ...periodForm, reason: event.target.value })} />
            </div>
            <Button type="submit" variant="secondary">Ajouter la période</Button>
          </form>
          <ul className="space-y-2">
            {periods.map((period) => (
              <li className="flex items-center justify-between gap-3 border rounded p-2 text-sm" key={period.id}>
                <span>{period.kind === "ABSENCE" ? "Absence" : "Créneau bloqué"} · {new Date(period.startAt).toLocaleString("fr-FR")} – {new Date(period.endAt).toLocaleString("fr-FR")} {period.reason && `· ${period.reason}`}</span>
                <button className="text-red-700" type="button" onClick={() => void removePeriod(period.id)}>Supprimer</button>
              </li>
            ))}
            {periods.length === 0 && <li className="text-sm text-gray-500">Aucune absence ou période bloquée.</li>}
          </ul>
        </section>
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
