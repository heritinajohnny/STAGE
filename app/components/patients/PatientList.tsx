"use client";
import React from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { Table, Column } from "../ui/Table";

export interface Patient {
  id: number;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: string;
  phone: string | null;
  address: string | null;
}

interface PatientListProps {
  patients: Patient[];
  onEdit: (patient: Patient) => void;
  onDelete: (id: number) => void;
  onView: (patient: Patient) => void;
}

export const PatientList: React.FC<PatientListProps> = ({
  patients,
  onEdit,
  onDelete,
  onView,
}) => {
  const columns: Column<Patient>[] = [
    { header: "ID", accessor: "id" },
    { header: "Nom", accessor: "lastName" },
    { header: "Prénom", accessor: "firstName" },
    { header: "Sexe", accessor: "gender" },
    { header: "Date Nais.", accessor: "birthDate" },
    { header: "Téléphone", accessor: (p) => p.phone || "-" },
    {
      header: "Actions",
      accessor: (patient) => (
        <div className="flex gap-2">
          <button
            type="button"
            className="table-action table-action-edit"
            onClick={() => onView(patient)}
            title="Consulter le dossier et l’historique"
            aria-label={`Consulter le dossier de ${patient.firstName} ${patient.lastName}`}
          >
            <Eye size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="table-action table-action-edit"
            onClick={() => onEdit(patient)}
            title="Modifier le patient"
            aria-label={`Modifier ${patient.firstName} ${patient.lastName}`}
          >
            <Pencil size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="table-action table-action-delete"
            onClick={() => onDelete(patient.id)}
            title="Supprimer le patient"
            aria-label={`Supprimer ${patient.firstName} ${patient.lastName}`}
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
      data={patients}
      emptyMessage="Aucun patient trouvé"
    />
  );
};
