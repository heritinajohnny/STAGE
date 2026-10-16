"use client";
import React from "react";
import { CalendarClock, Pencil, Trash2 } from "lucide-react";
import { Table, Column } from "../ui/Table";

export interface Doctor {
  id: number;
  firstName: string;
  lastName: string;
  specialty: string;
  phone: string | null;
  email: string | null;
  consultationDurationMinutes?: number;
  maxPatientsPerSlot?: number;
}

interface DoctorListProps {
  doctors: Doctor[];
  onEdit: (doctor: Doctor) => void;
  onDelete: (id: number) => void;
  onManageAvailability: (doctor: Doctor) => void;
}

export const DoctorList: React.FC<DoctorListProps> = ({
  doctors,
  onEdit,
  onDelete,
  onManageAvailability,
}) => {
  const columns: Column<Doctor>[] = [
    { header: "ID", accessor: "id" },
    { header: "Nom", accessor: "lastName" },
    { header: "Prénom", accessor: "firstName" },
    { header: "Spécialité", accessor: "specialty" },
    { header: "Téléphone", accessor: (d) => d.phone || "-" },
    { header: "Email", accessor: (d) => d.email || "-" },
    {
      header: "Actions",
      accessor: (doctor) => (
        <div className="flex gap-2">
          <button
            type="button"
            className="table-action table-action-edit"
            onClick={() => onManageAvailability(doctor)}
            title="Gérer les horaires et absences"
            aria-label={`Gérer les disponibilités de Dr. ${doctor.firstName} ${doctor.lastName}`}
          >
            <CalendarClock size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="table-action table-action-edit"
            onClick={() => onEdit(doctor)}
            title="Modifier le médecin"
            aria-label={`Modifier Dr. ${doctor.firstName} ${doctor.lastName}`}
          >
            <Pencil size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="table-action table-action-delete"
            onClick={() => onDelete(doctor.id)}
            title="Supprimer le médecin"
            aria-label={`Supprimer Dr. ${doctor.firstName} ${doctor.lastName}`}
          >
            <Trash2 size={17} aria-hidden="true" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      data={doctors}
      emptyMessage="Aucun médecin trouvé"
    />
  );
};
