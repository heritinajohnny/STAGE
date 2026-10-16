"use client";
import React, { useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Doctor } from "./DoctorList";

interface DoctorFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Doctor, "id"> | Doctor) => void;
  initialData?: Doctor | null;
}

// Composant interne pour le formulaire afin d'initialiser l'état proprement grâce au prop "key"
const DoctorFormContent: React.FC<{
  initialData?: Doctor | null;
  onClose: () => void;
  onSubmit: (data: Omit<Doctor, "id"> | Doctor) => void;
}> = ({ initialData, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    firstName: initialData?.firstName || "",
    lastName: initialData?.lastName || "",
    specialty: initialData?.specialty || "",
    phone: initialData?.phone || "",
    email: initialData?.email || "",
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

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Spécialité
        </label>
        <input
          type="text"
          required
          placeholder="Médecine générale, Pédiatrie, etc."
          className="mt-1 w-full border rounded-md p-2"
          value={formData.specialty}
          onChange={(e) =>
            setFormData({ ...formData, specialty: e.target.value })
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Téléphone
          </label>
          <input
            type="text"
            className="mt-1 w-full border rounded-md p-2"
            value={formData.phone}
            onChange={(e) =>
              setFormData({ ...formData, phone: e.target.value })
            }
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            type="email"
            className="mt-1 w-full border rounded-md p-2"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
          />
        </div>
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

export const DoctorFormModal: React.FC<DoctorFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "Modifier le médecin" : "Nouveau médecin"}
    >
      <DoctorFormContent
        key={initialData ? initialData.id : "new"}
        initialData={initialData}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    </Modal>
  );
};
