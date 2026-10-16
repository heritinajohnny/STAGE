"use client";
import React, { useState, useEffect } from "react";
import { Sidebar } from "../components/layout/Sidebar";
import { Header } from "../components/layout/Header";
import { PdfExportButton } from "../components/pdf/PdfExportButton";

interface Patient {
  id: number;
  lastName: string;
  firstName: string;
  birthDate: string;
  gender: string;
  phone?: string;
  address?: string;
}

interface Appointment {
  id: number;
  patientName: string;
  doctorName: string;
  status: string;
}

export default function ReportsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [resPatients, resAppts] = await Promise.all([
          fetch('/api/patients'),
          fetch('/api/appointments'),
        ]);

        if (resPatients.ok && resAppts.ok) {
          const patientsData = await resPatients.json();
          const apptsData = await resAppts.json();

          if (isMounted) {
            setPatients(patientsData);
            setAppointments(apptsData);
            if (patientsData.length > 0) {
              setSelectedPatientId(patientsData[0].id);
            }
          }
        }
      } catch (error) {
        console.error("Erreur chargement rapports:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-workspace">
        <Header title="Génération de Rapports PDF" />
        <main className="page-content space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              Documents & Impressions
            </h1>
            <p className="text-sm text-gray-600">
              Générez et téléchargez des synthèses dynamiques basées sur les
              données réelles de la base.
            </p>
          </div>

          {loading ? (
            <p className="text-gray-500 text-sm">
              Chargement des données pour l&apos;exportation...
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Carte 1 : Fiche Patient Sélectionnable */}
              <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  Fiche de Patient
                </h3>
                <p className="text-sm text-gray-500">
                  Sélectionnez un patient pour exporter sa fiche individuelle au
                  format PDF.
                </p>

                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Choisir un patient :
                  </label>
                  <select
                    className="w-full border rounded p-2 text-sm"
                    value={selectedPatientId || ""}
                    onChange={(e) =>
                      setSelectedPatientId(Number(e.target.value))
                    }
                  >
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.lastName} {p.firstName}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedPatient && (
                  <PdfExportButton
                    title={`Télécharger Fiche (${selectedPatient.lastName})`}
                    filename={`fiche_${selectedPatient.lastName.toLowerCase()}.pdf`}
                    getData={() => ({
                      headerTitle: "FICHE D'IDENTIFICATION PATIENT",
                      items: [
                        {
                          label: "Nom & Prénom",
                          value: `${selectedPatient.lastName} ${selectedPatient.firstName}`,
                        },
                        {
                          label: "Date de Naissance",
                          value: selectedPatient.birthDate,
                        },
                        { label: "Sexe", value: selectedPatient.gender },
                        {
                          label: "Téléphone",
                          value: selectedPatient.phone || "Non renseigné",
                        },
                        {
                          label: "Adresse",
                          value: selectedPatient.address || "Non renseignée",
                        },
                      ],
                    })}
                  />
                )}
              </div>

              {/* Carte 2 : Synthèse Statistique Réelle */}
              <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  Bilan des Consultations
                </h3>
                <p className="text-sm text-gray-500">
                  Exportez les statistiques cumulées issues des rendez-vous
                  enregistrés.
                </p>

                <PdfExportButton
                  title="Télécharger Bilan Global"
                  filename="bilan_consultations.pdf"
                  getData={() => ({
                    headerTitle: "SYNTHÈSE GLOBALE DE LA POLYCLINIQUE",
                    items: [
                      {
                        label: "Nombre Total de Patients",
                        value: patients.length.toString(),
                      },
                      {
                        label: "Total Rendez-vous Programmés",
                        value: appointments.length.toString(),
                      },
                      {
                        label: "En Attente",
                        value: appointments
                          .filter((a) => a.status === "EN_ATTENTE")
                          .length.toString(),
                      },
                      {
                        label: "Pris en Charge",
                        value: appointments
                          .filter((a) => a.status === "PRISE_EN_CHARGE")
                          .length.toString(),
                      },
                    ],
                  })}
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
