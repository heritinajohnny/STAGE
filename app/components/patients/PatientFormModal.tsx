"use client";
import React, { useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Patient } from "./PatientList";

interface PatientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Patient, "id"> | Patient) => void;
  initialData?: Patient | null;
}

// Composant interne pour le formulaire afin de réinitialiser l'état proprement grâce au prop "key"
const PatientFormContent: React.FC<{
  initialData?: Patient | null;
  onClose: () => void;
  onSubmit: (data: Omit<Patient, "id"> | Patient) => void;
}> = ({ initialData, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    firstName: initialData?.firstName || "",
    lastName: initialData?.lastName || "",
    birthDate: initialData?.birthDate || "",
    gender: initialData?.gender || "M",
    phone: initialData?.phone || "",
    address: initialData?.address || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (initialData) {
      onSubmit({ ...initialData, ...formData });
    } else {
      onSubmit(formData);
    }
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nom</label>
          <input
            type="text"
            required
            className="mt-1 w-full border rounded-md p-2"
            value={formData.lastName}
            onChange={(e) =>
              setFormData({ ...formData, lastName: e.target.value })
            }
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Prénom
          </label>
          <input
            type="text"
            required
            className="mt-1 w-full border rounded-md p-2"
            value={formData.firstName}
            onChange={(e) =>
              setFormData({ ...formData, firstName: e.target.value })
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Date de Naissance
          </label>
          <input
            type="date"
            required
            className="mt-1 w-full border rounded-md p-2"
            value={formData.birthDate}
            onChange={(e) =>
              setFormData({ ...formData, birthDate: e.target.value })
            }
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Sexe
          </label>
          <select
            className="mt-1 w-full border rounded-md p-2 bg-white"
            value={formData.gender}
            onChange={(e) =>
              setFormData({ ...formData, gender: e.target.value })
            }
          >
            <option value="M">Masculin</option>
            <option value="F">Féminin</option>
            <option value="AUTRE">Autre</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Téléphone
        </label>
        <input
          type="text"
          className="mt-1 w-full border rounded-md p-2"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Adresse
        </label>
        <textarea
          className="mt-1 w-full border rounded-md p-2"
          rows={2}
          value={formData.address}
          onChange={(e) =>
            setFormData({ ...formData, address: e.target.value })
          }
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>
          Annuler
        </Button>
        <Button type="submit" variant="primary">
          Enregistrer
        </Button>
      </div>
    </form>
  );
};

export const PatientFormModal: React.FC<PatientFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "Modifier le patient" : "Nouveau patient"}
    >
      {/* L'attribut key re-crée le composant et re-initialise les champs quand initialData change */}
      <PatientFormContent
        key={initialData ? initialData.id : "new"}
        initialData={initialData}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    </Modal>
  );
};
