"use client";
import React from "react";
import { Check, ClipboardCheck, XCircle } from "lucide-react";
import { Table, Column } from "../ui/Table";
import { Button } from "../ui/Button";
import { ConsultationFormModal, ConsultationFormValues } from "./ConsultationFormModal";

export interface Appointment {
  id: number;
  patientName: string;
  doctorName: string;
  appointmentDate: string;
  status: string;
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
  onConsult: (id: number, values: ConsultationFormValues) => Promise<string | null>;
  highlightedAppointmentId?: number | null;
}

export const AppointmentList: React.FC<AppointmentListProps> = ({
  appointments,
  onStatusChange,
  onConsult,
  highlightedAppointmentId = null,
}) => {
  const [consultationAppointment, setConsultationAppointment] = React.useState<Appointment | null>(null);
  const getStatusBadge = (status: Appointment["status"]) => {
    const styles: Record<string, string> = {
      EN_ATTENTE: "bg-yellow-100 text-yellow-800",
      CONFIRME: "bg-emerald-100 text-emerald-800",
      PRISE_EN_CHARGE: "bg-blue-100 text-blue-800",
      TERMINE: "bg-slate-100 text-slate-700",
      ANNULE: "bg-red-100 text-red-800",
    };
    const labels: Record<string, string> = {
      EN_ATTENTE: "EN ATTENTE",
      CONFIRME: "CONFIRMÉ",
      PRISE_EN_CHARGE: "EN CONSULTATION",
      TERMINE: "CONSULTÉ",
      ANNULE: "ANNULÉ",
    };
    return (
      <span
        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${styles[status] || "bg-gray-100 text-gray-700"}`}
      >
        {labels[status] || "HISTORIQUE"}
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
            <Button variant="primary" onClick={() => setConsultationAppointment(apt)}>
              <ClipboardCheck size={16} className="mr-1 inline" /> Consulter
            </Button>
          )}
          {apt.status === "TERMINE" && <span className="self-center text-xs text-gray-500">Historique enregistré</span>}
          {["EN_ATTENTE", "CONFIRME"].includes(apt.status) && (
            <Button
              variant="danger"
              onClick={() => onStatusChange(apt.id, "ANNULE")}
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
    <>
      <Table
        columns={columns}
        data={appointments}
        emptyMessage="Aucun rendez-vous prévu"
        rowId={(appointment) => `appointment-${appointment.id}`}
        rowClassName={(appointment) => appointment.id === highlightedAppointmentId ? "appointment-row-highlight" : ""}
      />
      <ConsultationFormModal
        key={consultationAppointment?.id ?? "closed"}
        appointment={consultationAppointment}
        onClose={() => setConsultationAppointment(null)}
        onSubmit={async (values) => {
          if (!consultationAppointment) return "Sélectionnez un rendez-vous valide.";
          const error = await onConsult(consultationAppointment.id, values);
          if (!error) setConsultationAppointment(null);
          return error;
        }}
      />
    </>
  );
};
