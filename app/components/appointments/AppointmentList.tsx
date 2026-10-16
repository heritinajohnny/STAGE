"use client";
import React from "react";
import { Check, XCircle } from "lucide-react";
import { Table, Column } from "../ui/Table";
import { Button } from "../ui/Button";

export interface Appointment {
  id: number;
  patientName: string;
  doctorName: string;
  appointmentDate: string;
  status: "EN_ATTENTE" | "CONFIRME" | "PRISE_EN_CHARGE" | "TERMINE" | "ANNULE";
  requestedBy?: number | null;
  reason?: string | null;
}

interface AppointmentListProps {
  appointments: Appointment[];
  onStatusChange: (
    id: number,
    status: Appointment["status"],
    decision?: "request_only",
  ) => void;
  onOpenConsultation: (appointment: Appointment) => void;
  highlightedAppointmentId?: number | null;
}

export const AppointmentList: React.FC<AppointmentListProps> = ({
  appointments,
  onStatusChange,
  onOpenConsultation,
  highlightedAppointmentId = null,
}) => {
  const getStatusBadge = (status: Appointment["status"]) => {
    const styles = {
      EN_ATTENTE: "bg-yellow-100 text-yellow-800",
      CONFIRME: "bg-emerald-100 text-emerald-800",
      PRISE_EN_CHARGE: "bg-blue-100 text-blue-800",
      TERMINE: "bg-green-100 text-green-800",
      ANNULE: "bg-red-100 text-red-800",
    };
    return (
      <span
        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${styles[status]}`}
      >
        {status === "CONFIRME" ? "CONFIRMÉ" : status.replace("_", " ")}
      </span>
    );
  };

  const columns: Column<Appointment>[] = [
    { header: "ID", accessor: "id" },
    { header: "Patient", accessor: "patientName" },
    { header: "Médecin", accessor: "doctorName" },
    {
      header: "Date & Heure",
      accessor: (appointment) => new Date(appointment.appointmentDate).toLocaleString("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
      }),
    },
    { header: "Motif", accessor: (a) => a.reason || "-" },
    { header: "Statut", accessor: (a) => getStatusBadge(a.status) },
    {
      header: "Actions",
      accessor: (apt) => (
        <div className="flex gap-2">
          {apt.requestedBy && apt.status === "EN_ATTENTE" && (
            <Button
              variant="primary"
              onClick={() => onStatusChange(apt.id, "CONFIRME")}
              title="Confirmer la demande et le rendez-vous"
            >
              <Check size={16} className="mr-1 inline" /> Confirmer
            </Button>
          )}
          {apt.status === "EN_ATTENTE" && (
            !apt.requestedBy && (
            <Button
              variant="primary"
              onClick={() => onStatusChange(apt.id, "PRISE_EN_CHARGE")}
            >
              Prendre en charge
            </Button>
            )
          )}
          {apt.status === "CONFIRME" && (
            <Button variant="primary" onClick={() => onStatusChange(apt.id, "PRISE_EN_CHARGE")}>
              Démarrer
            </Button>
          )}
          {apt.status === "PRISE_EN_CHARGE" && (
            <Button variant="primary" onClick={() => onOpenConsultation(apt)}>
              Consulter
            </Button>
          )}
          {["EN_ATTENTE", "CONFIRME"].includes(apt.status) && (
            <Button
              variant="danger"
              onClick={() => {
                if (confirm(`Annuler la demande et le rendez-vous de ${apt.patientName} ?`)) {
                  onStatusChange(apt.id, "ANNULE");
                }
              }}
              title="Annuler la demande et le rendez-vous"
            >
              <XCircle size={16} className="mr-1 inline" /> Annuler
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      data={appointments}
      emptyMessage="Aucun rendez-vous prévu"
      rowId={(appointment) => `appointment-${appointment.id}`}
      rowClassName={(appointment) => appointment.id === highlightedAppointmentId ? "appointment-row-highlight" : ""}
    />
  );
};
