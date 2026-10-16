"use client";
import React, { useState, useEffect } from "react";
import { Download } from "lucide-react";
import { Sidebar } from "../components/layout/Sidebar";
import { Header } from "../components/layout/Header";
import { Button } from "../components/ui/Button";
import { PatientList, Patient } from "../components/patients/PatientList";
import { PatientFormModal } from "../components/patients/PatientFormModal";
import { AppointmentHistory, ConsultationHistory, PatientDetails } from "../components/patients/PatientDetails";

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientAppointments, setPatientAppointments] = useState<AppointmentHistory[]>([]);
  const [consultations, setConsultations] = useState<ConsultationHistory[]>([]);
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  // Fonction pour recharger manuellement la liste
  const refreshPatients = async () => {
    try {
      const response = await fetch("/api/patients");
      if (response.ok) {
        const data = await response.json();
        setPatients(data);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des patients:", error);
    }
  };

  // Chargement initial sécurisé dans le useEffect
  useEffect(() => {
    let isMounted = true;

    async function initPatients() {
      try {
        const response = await fetch("/api/patients");
        if (response.ok) {
          const data = await response.json();
          if (isMounted) {
            setPatients(data);
          }
        }
      } catch (error) {
        console.error("Erreur lors du chargement des patients:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    initPatients();

    return () => {
      isMounted = false;
    };
  }, []);

  // Créer (POST) ou Modifier (PUT) un patient
  const handleCreateOrUpdate = async (data: Omit<Patient, "id"> | Patient) => {
    try {
      if ("id" in data) {
        // Modification : PUT /api/patients/[id]
        const response = await fetch(`/api/patients/${data.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (response.ok) {
          await refreshPatients();
        }
      } else {
        // Création : POST /api/patients
        const response = await fetch("/api/patients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (response.ok) {
          await refreshPatients();
        }
      }
    } catch (error) {
      console.error("Erreur lors de l’enregistrement:", error);
    }
  };

  // Supprimer un patient (DELETE /api/patients/[id])
  const handleDelete = async (id: number) => {
    if (!confirm("Voulez-vous vraiment supprimer ce patient ?")) return;

    try {
      const response = await fetch(`/api/patients/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setPatients((prev) => prev.filter((p) => p.id !== id));
      }
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
    }
  };

  const handleOpenEdit = (patient: Patient) => {
    setSelectedPatient(patient);
    setIsFormOpen(true);
  };

  const handleOpenCreate = () => {
    setSelectedPatient(null);
    setIsFormOpen(true);
  };

  const handleOpenDetails = async (patient: Patient) => {
    setSelectedPatient(patient);
    setIsDetailsOpen(true);
    try {
      const response = await fetch(`/api/patients/${patient.id}/history`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Impossible de charger l’historique.");
      setPatientAppointments(data.appointments);
      setConsultations(data.consultations);
    } catch (error) {
      console.error("Erreur lors du chargement de l’historique du patient:", error);
      setPatientAppointments([]);
      setConsultations([]);
    }
  };

  const exportPatients = async () => {
    setExportError("");
    if (exportFrom && exportTo && exportFrom > exportTo) {
      setExportError("La date de début doit précéder la date de fin.");
      return;
    }
    setExporting(true);
    try {
      const query = new URLSearchParams();
      if (exportFrom) query.set("from", exportFrom);
      if (exportTo) query.set("to", exportTo);
      const response = await fetch(`/api/patients/export?${query}`);
      if (!response.ok) {
        const result = await response.json() as { error?: string };
        throw new Error(result.error || "Le téléchargement a échoué.");
      }
      const file = await response.blob();
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = `patients${exportFrom || exportTo ? `-${exportFrom || "debut"}-${exportTo || "fin"}` : ""}.csv`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Impossible de télécharger la liste des patients.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-workspace">
        <Header title="Gestion des Patients" />
        <main className="page-content space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-2xl font-bold text-gray-800">Liste des Patients</h1>
            <Button variant="primary" onClick={handleOpenCreate}>
              + Nouveau Patient
            </Button>
          </div>

          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="export-from">Inscrits depuis</label>
                <input id="export-from" className="mt-1 rounded-md border p-2 text-sm" type="date" value={exportFrom} onChange={(event) => setExportFrom(event.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="export-to">Jusqu’au</label>
                <input id="export-to" className="mt-1 rounded-md border p-2 text-sm" type="date" min={exportFrom || undefined} value={exportTo} onChange={(event) => setExportTo(event.target.value)} />
              </div>
              <Button variant="secondary" onClick={() => void exportPatients()} disabled={exporting}>
                <Download size={16} /> {exporting ? "Préparation..." : "Télécharger la liste"}
              </Button>
            </div>
            <p className="mt-2 text-xs text-gray-500">Les dates sont facultatives et filtrent la date d’inscription. Sans dates, tous les patients sont exportés.</p>
            {exportError && <p className="mt-2 text-sm text-red-700" role="alert">{exportError}</p>}
          </section>

          {loading ? (
            <p className="text-gray-500 text-sm">Chargement des patients...</p>
          ) : (
            <PatientList
              patients={patients}
              onEdit={handleOpenEdit}
              onDelete={handleDelete}
              onView={(patient) => void handleOpenDetails(patient)}
            />
          )}

          <PatientFormModal
            isOpen={isFormOpen}
            onClose={() => setIsFormOpen(false)}
            onSubmit={handleCreateOrUpdate}
            initialData={selectedPatient}
          />

          <PatientDetails
            isOpen={isDetailsOpen}
            onClose={() => setIsDetailsOpen(false)}
            patient={selectedPatient}
            appointments={patientAppointments}
            consultations={consultations}
          />
        </main>
      </div>
    </div>
  );
}
