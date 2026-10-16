"use client";
import React, { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Sidebar } from "../components/layout/Sidebar";
import { Header } from "../components/layout/Header";
import { Button } from "../components/ui/Button";
import {
  AppointmentList,
  Appointment,
} from "../components/appointments/AppointmentList";
import { AppointmentModal } from "../components/appointments/AppointmentModal";

interface SelectOption {
  id: number;
  name: string;
  firstName?: string;
  lastName?: string;
  phone?: string | null;
}
interface WaitlistEntry {
  id: number;
  firstName: string;
  lastName: string;
  phone: string | null;
  specialty: string | null;
  status: string;
  requestedFrom: string;
  requestedTo: string;
  offeredAppointmentDate: string | null;
  position: number | null;
}

export default function AppointmentsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-gray-500">Chargement du planning...</p>}>
      <AppointmentsContent />
    </Suspense>
  );
}

function AppointmentsContent() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patientsOptions, setPatientsOptions] = useState<SelectOption[]>([]);
  const [doctorsOptions, setDoctorsOptions] = useState<SelectOption[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [actionError, setActionError] = useState("");
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const searchParams = useSearchParams();
  const requestedAppointmentId = Number(searchParams.get("appointment"));
  const highlightedAppointmentId = Number.isInteger(requestedAppointmentId) && requestedAppointmentId > 0
    ? requestedAppointmentId
    : null;

  // Fonction pour rafraîchir la liste des rendez-vous
  const refreshAppointments = async () => {
    try {
      const response = await fetch("/api/appointments");
      if (response.ok) {
        const data = await response.json();
        setAppointments(data);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des rendez-vous:", error);
    }
  };

  // Chargement initial des rendez-vous, patients et médecins
  useEffect(() => {
    let isMounted = true;

    async function initData() {
      try {
        const [resAppts, resPatients, resDoctors, resWaitlist] = await Promise.all([
          fetch('/api/appointments'),
          fetch('/api/patients'),
          fetch('/api/doctors'),
          fetch('/api/waitlist'),
        ]);

        if (resAppts.ok && resPatients.ok && resDoctors.ok && resWaitlist.ok) {
          const apptsData = await resAppts.json();
          const patientsData = await resPatients.json();
          const doctorsData = await resDoctors.json();
          const waitlistData = await resWaitlist.json();

          if (isMounted) {
            setAppointments(apptsData);
            setWaitlist(waitlistData as WaitlistEntry[]);
            setPatientsOptions(
              patientsData.map(
                (p: { id: number; firstName: string; lastName: string; phone: string | null }) => ({
                  id: p.id,
                  name: `${p.firstName} ${p.lastName}`,
                  firstName: p.firstName,
                  lastName: p.lastName,
                  phone: p.phone,
                }),
              ),
            );
            setDoctorsOptions(
              doctorsData.map(
                (d: {
                  id: number;
                  firstName: string;
                  lastName: string;
                  specialty: string;
                }) => ({
                  id: d.id,
                  name: `Dr. ${d.firstName} ${d.lastName} (${d.specialty})`,
                }),
              ),
            );
          }
        }
      } catch (error) {
        console.error("Erreur lors du chargement des données:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    initData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!highlightedAppointmentId || appointments.length === 0) return;
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(`appointment-${highlightedAppointmentId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [appointments, highlightedAppointmentId]);

  // Changement de statut (PUT /api/appointments/[id])
  const handleStatusChange = async (
    id: number,
    status: Appointment["status"],
  ) => {
    try {
      setActionError("");
      const response = await fetch(`/api/appointments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        await refreshAppointments();
        const waitlistResponse = await fetch("/api/waitlist");
        if (waitlistResponse.ok) setWaitlist(await waitlistResponse.json() as WaitlistEntry[]);
      } else {
        const result = await response.json() as { error?: string };
        setActionError(result.error || "La mise à jour du rendez-vous a échoué.");
      }
    } catch (error) {
      console.error("Erreur lors du changement de statut:", error);
      setActionError("Impossible de contacter le serveur pour modifier ce rendez-vous.");
    }
  };

  // Création d'un rendez-vous (POST /api/appointments)
  const handleCreateAppointment = async (data: {
    patientId: number;
    doctorId: number;
    appointmentDate: string;
    reason: string;
  }): Promise<boolean> => {
    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        await refreshAppointments();
        return true;
      }
      const result = await response.json() as { error?: string };
      setActionError(result.error || "La création du rendez-vous a échoué.");
    } catch (error) {
      console.error("Erreur lors de la création du rendez-vous:", error);
      setActionError("Impossible de contacter le serveur pour créer ce rendez-vous.");
    }
    return false;
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-workspace">
        <Header title="Rendez-vous & Consultations" />
        <main className="page-content space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">
              Planning des Rendez-vous
            </h1>
            <Button variant="primary" onClick={() => setIsModalOpen(true)}>
              + Nouveau Rendez-vous
            </Button>
          </div>

          {loading ? (
            <p className="text-gray-500 text-sm">Chargement du planning...</p>
          ) : (
            <AppointmentList
              appointments={appointments}
              highlightedAppointmentId={highlightedAppointmentId}
              onStatusChange={handleStatusChange}
              onOpenConsultation={(apt) => {
                alert(`Ouverture de la consultation pour le RDV #${apt.id}`);
              }}
            />
          )}
          {actionError && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{actionError}</p>}

          <section className="rounded-lg border bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-gray-800">Liste d’attente des patients</h2>
            {waitlist.filter((entry) => ["WAITING", "PROPOSED"].includes(entry.status)).length === 0 ? (
              <p className="text-sm text-gray-500">Aucun patient en attente.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr className="border-b text-gray-500"><th className="p-2">Position</th><th className="p-2">Patient</th><th className="p-2">Téléphone</th><th className="p-2">Spécialité</th><th className="p-2">Période demandée</th><th className="p-2">État</th></tr></thead>
                  <tbody>{waitlist.filter((entry) => ["WAITING", "PROPOSED"].includes(entry.status)).map((entry, index) => (
                    <tr className="border-b last:border-0" key={entry.id}>
                      <td className="p-2">{entry.position ?? index + 1}</td>
                      <td className="p-2">{entry.firstName} {entry.lastName}</td>
                      <td className="p-2">{entry.phone || "—"}</td>
                      <td className="p-2">{entry.specialty || "Toutes"}</td>
                      <td className="p-2">{new Date(entry.requestedFrom).toLocaleDateString("fr-FR")} – {new Date(entry.requestedTo).toLocaleDateString("fr-FR")}</td>
                      <td className="p-2">{entry.status === "PROPOSED" ? `Proposition envoyée${entry.offeredAppointmentDate ? ` · ${new Date(entry.offeredAppointmentDate).toLocaleString("fr-FR")}` : ""}` : "En attente"}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>

          <AppointmentModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            patients={patientsOptions}
            doctors={doctorsOptions}
            onSubmit={handleCreateAppointment}
          />
        </main>
      </div>
    </div>
  );
}
