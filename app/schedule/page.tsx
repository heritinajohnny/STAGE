"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { Sidebar } from "../components/layout/Sidebar";
import { Header } from "../components/layout/Header";

interface Doctor { id: number; firstName: string; lastName: string; specialty: string; }
interface Appointment { id: number; doctorId: number; doctorName: string; patientName: string; appointmentDate: string; status: string; reason: string | null; requestedBy: number | null; }

function startOfWeek(date: Date) {
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const statusLabels: Record<string, string> = {
  EN_ATTENTE: "À valider",
  CONFIRME: "Confirmé",
  PRISE_EN_CHARGE: "En consultation",
  TERMINE: "Consulté",
  ANNULE: "Annulé",
};

export default function SchedulePage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctorId, setDoctorId] = useState("all");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetch("/api/doctors"), fetch("/api/appointments")])
      .then(async ([doctorResponse, appointmentResponse]) => {
        if (!doctorResponse.ok || !appointmentResponse.ok) throw new Error("Chargement impossible");
        const [doctorData, appointmentData] = await Promise.all([doctorResponse.json(), appointmentResponse.json()]);
        setDoctors(doctorData as Doctor[]);
        setAppointments(appointmentData as Appointment[]);
      })
      .catch((error: unknown) => console.error("Erreur chargement agenda:", error))
      .finally(() => setLoading(false));
  }, []);

  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    return date;
  }), [weekStart]);

  const visibleAppointments = useMemo(() => appointments.filter((appointment) => {
    if (doctorId !== "all" && appointment.doctorId !== Number(doctorId)) return false;
    const date = new Date(appointment.appointmentDate);
    return date >= weekStart && date < new Date(days[6].getFullYear(), days[6].getMonth(), days[6].getDate() + 1);
  }), [appointments, days, doctorId, weekStart]);

  const weekLabel = `${days[0].toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} – ${days[6].toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`;

  function moveWeek(amount: number) {
    setWeekStart((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + amount * 7);
      return next;
    });
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-workspace">
        <Header title="Emploi du temps des médecins" />
        <main className="page-content schedule-page">
          <div className="schedule-toolbar">
            <div><span className="eyebrow">PLANIFICATION CLINIQUE</span><h1>Agenda hebdomadaire</h1><p>Créneaux et demandes de rendez-vous par médecin.</p></div>
            <label className="schedule-doctor-select">Médecin<select value={doctorId} onChange={(event) => setDoctorId(event.target.value)}><option value="all">Tous les médecins</option>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>Dr. {doctor.firstName} {doctor.lastName}</option>)}</select></label>
          </div>

          <div className="schedule-weekbar">
            <div className="schedule-week-label"><CalendarDays size={19} /><strong>{weekLabel}</strong></div>
            <div className="schedule-week-controls">
              <button type="button" onClick={() => moveWeek(-1)} title="Semaine précédente" aria-label="Semaine précédente"><ChevronLeft size={18} /></button>
              <button type="button" onClick={() => setWeekStart(startOfWeek(new Date()))}>Aujourd’hui</button>
              <button type="button" onClick={() => moveWeek(1)} title="Semaine suivante" aria-label="Semaine suivante"><ChevronRight size={18} /></button>
            </div>
          </div>

          {loading ? <p className="portal-muted">Chargement de l’agenda...</p> : (
            <div className="schedule-grid">
              {days.map((day) => {
                const dayAppointments = visibleAppointments
                  .filter((appointment) => dateKey(new Date(appointment.appointmentDate)) === dateKey(day))
                  .sort((left, right) => left.appointmentDate.localeCompare(right.appointmentDate));
                return (
                  <section className={`schedule-day${dateKey(day) === dateKey(new Date()) ? " today" : ""}`} key={dateKey(day)}>
                    <header><span>{day.toLocaleDateString("fr-FR", { weekday: "short" })}</span><strong>{day.getDate()}</strong></header>
                    <div className="schedule-day-items">
                      {dayAppointments.length === 0 ? <span className="schedule-empty">Libre</span> : dayAppointments.map((appointment) => (
                        <article className={`schedule-event status-${appointment.status.toLowerCase()}`} key={appointment.id}>
                          <strong>{new Date(appointment.appointmentDate).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</strong>
                          <span>{appointment.patientName}</span>
                          {doctorId === "all" && <small>{appointment.doctorName}</small>}
                          <small className="schedule-event-status">{statusLabels[appointment.status] || "Historique"}</small>
                        </article>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          <div className="schedule-summary"><Clock3 size={16} /><span>{visibleAppointments.filter((appointment) => ["EN_ATTENTE", "CONFIRME", "PRISE_EN_CHARGE"].includes(appointment.status)).length} rendez-vous actifs cette semaine</span><span className="schedule-legend"><i className="legend-pending" /> Demande à valider <i className="legend-confirmed" /> Confirmé</span></div>
        </main>
      </div>
    </div>
  );
}
