"use client";
import React from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Patient } from "./PatientList";

export interface ConsultationHistory {
  id: number;
  consultationDate: string;
  doctorName: string;
  diagnosis: string;
  prescription?: string | null;
  notes?: string | null;
  doctorFirstName?: string;
  specialty?: string;
}
export interface AppointmentHistory {
  id: number;
  appointmentDate: string;
  status: string;
  reason: string | null;
  doctorName: string;
  doctorFirstName: string;
  specialty: string;
}

interface PatientDetailsProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  consultations?: ConsultationHistory[];
  appointments?: AppointmentHistory[];
  historyLoading?: boolean;
  historyError?: string;
}

export const PatientDetails: React.FC<PatientDetailsProps> = ({
  isOpen,
  onClose,
  patient,
  consultations = [],
  appointments = [],
  historyLoading = false,
  historyError = "",
}) => {
  if (!patient) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Fiche Médicale Patient">
      <div className="space-y-6">
        {/* Informations personnelles */}
        <div className="bg-gray-50 p-4 rounded-lg border space-y-2">
          <h4 className="font-semibold text-gray-700 text-base border-b pb-1">
            Informations Générales
          </h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <p>
              <span className="font-medium text-gray-600">Nom & Prénom:</span>{" "}
              {patient.lastName} {patient.firstName}
            </p>
            <p>
              <span className="font-medium text-gray-600">Sexe:</span>{" "}
              {patient.gender === "M" ? "Masculin" : patient.gender === "F" ? "Féminin" : "Autre"}
            </p>
            <p>
              <span className="font-medium text-gray-600">
                Date de naissance:
              </span>{" "}
              {patient.birthDate}
            </p>
            <p>
              <span className="font-medium text-gray-600">Téléphone:</span>{" "}
              {patient.phone || "Non renseigné"}
            </p>
            <p className="col-span-2">
              <span className="font-medium text-gray-600">Adresse:</span>{" "}
              {patient.address || "Non renseignée"}
            </p>
          </div>
        </div>

        {/* Historique des consultations */}
        <div>
          <h4 className="font-semibold text-gray-700 text-base mb-2">
            Historique des Consultations
          </h4>
          {historyLoading ? (
            <p className="text-sm text-gray-500" role="status">Chargement de l’historique...</p>
          ) : historyError ? (
            <p className="text-sm text-red-700" role="alert">{historyError}</p>
          ) : consultations.length === 0 ? (
            <p className="text-sm text-gray-500 italic">
              Aucune consultation enregistrée pour ce patient.
            </p>
          ) : (
            <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
              {consultations.map((c) => (
                <div
                  key={c.id}
                  className="border rounded-md p-3 text-sm bg-white shadow-sm"
                >
                  <div className="flex justify-between font-medium text-blue-600 mb-1">
                    <span>Dr. {c.doctorFirstName} {c.doctorName}{c.specialty ? ` · ${c.specialty}` : ""}</span>
                    <time className="text-gray-500 text-xs">
                      {new Date(c.consultationDate).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                    </time>
                  </div>
                  <p className="text-gray-800">
                    <strong>Diagnostic:</strong> {c.diagnosis}
                  </p>
                  {c.prescription && (
                    <p className="text-gray-600 text-xs mt-1">
                      <strong>Traitement:</strong> {c.prescription}
                    </p>
                  )}
                  {c.notes && <p className="text-gray-600 text-xs mt-1"><strong>Notes:</strong> {c.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h4 className="font-semibold text-gray-700 text-base mb-2">Historique des rendez-vous</h4>
          {historyLoading ? (
            <p className="text-sm text-gray-500" role="status">Chargement de l’historique...</p>
          ) : historyError ? (
            <p className="text-sm text-red-700" role="alert">{historyError}</p>
          ) : appointments.length === 0 ? (
            <p className="text-sm text-gray-500 italic">Aucun rendez-vous enregistré pour ce patient.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {appointments.map((appointment) => (
                <div key={appointment.id} className="border rounded-md p-3 text-sm bg-white">
                  <div className="flex justify-between gap-2 font-medium">
                    <span>Dr. {appointment.doctorFirstName} {appointment.doctorName} · {appointment.specialty}</span>
                    <span className="text-gray-500">{
                      appointment.status === "TERMINE" ? "Consulté" :
                      appointment.status === "PRISE_EN_CHARGE" ? "En consultation" :
                      appointment.status === "CONFIRME" ? "Confirmé" :
                      appointment.status === "EN_ATTENTE" ? "En attente" :
                      appointment.status === "ANNULE" ? "Annulé" : "Historique"
                    }</span>
                  </div>
                  <p className="text-xs text-gray-500">{new Date(appointment.appointmentDate).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</p>
                  {appointment.reason && <p className="text-xs">{appointment.reason}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-4 border-t">
          <Button variant="primary" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </Modal>
  );
};
