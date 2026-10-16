"use client";
import React, { useState, useEffect } from "react";
import { Sidebar } from "../components/layout/Sidebar";
import { Header } from "../components/layout/Header";
import { Button } from "../components/ui/Button";
import { DoctorList, Doctor } from "../components/doctors/DoctorList";
import { DoctorFormModal } from "../components/doctors/DoctorFormModal";
import { DoctorAvailabilityModal } from "../components/doctors/DoctorAvailabilityModal";

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [availabilityDoctor, setAvailabilityDoctor] = useState<Doctor | null>(null);

  // Fonction pour rafraîchir la liste après une action
  const refreshDoctors = async () => {
    try {
      const response = await fetch("/api/doctors");
      if (response.ok) {
        const data = await response.json();
        setDoctors(data);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des médecins:", error);
    }
  };

  // Chargement initial sécurisé
  useEffect(() => {
    let isMounted = true;

    async function initDoctors() {
      try {
        const response = await fetch("/api/doctors");
        if (response.ok) {
          const data = await response.json();
          if (isMounted) {
            setDoctors(data);
          }
        }
      } catch (error) {
        console.error("Erreur lors du chargement des médecins:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    initDoctors();

    return () => {
      isMounted = false;
    };
  }, []);

  // Création (POST) ou Modification (PUT)
  const handleCreateOrUpdate = async (data: Omit<Doctor, "id"> | Doctor) => {
    try {
      if ("id" in data) {
        const response = await fetch(`/api/doctors/${data.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (response.ok) {
          await refreshDoctors();
        }
      } else {
        const response = await fetch("/api/doctors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (response.ok) {
          await refreshDoctors();
        }
      }
    } catch (error) {
      console.error("Erreur lors de l’enregistrement du médecin:", error);
    }
  };

  // Suppression (DELETE)
  const handleDelete = async (id: number) => {
    if (!confirm("Voulez-vous vraiment supprimer ce médecin ?")) return;

    try {
      const response = await fetch(`/api/doctors/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setDoctors((prev) => prev.filter((d) => d.id !== id));
      }
    } catch (error) {
      console.error("Erreur lors de la suppression du médecin:", error);
    }
  };

  const handleOpenEdit = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setIsFormOpen(true);
  };

  const handleOpenCreate = () => {
    setSelectedDoctor(null);
    setIsFormOpen(true);
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-workspace">
        <Header title="Gestion des Médecins" />
        <main className="page-content space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">Corps Médical</h1>
            <Button variant="primary" onClick={handleOpenCreate}>
              + Ajouter un Médecin
            </Button>
          </div>

          {loading ? (
            <p className="text-gray-500 text-sm">Chargement des médecins...</p>
          ) : (
            <DoctorList
              doctors={doctors}
              onEdit={handleOpenEdit}
              onDelete={handleDelete}
              onManageAvailability={setAvailabilityDoctor}
            />
          )}

          <DoctorFormModal
            isOpen={isFormOpen}
            onClose={() => setIsFormOpen(false)}
            onSubmit={handleCreateOrUpdate}
            initialData={selectedDoctor}
          />
          <DoctorAvailabilityModal
            doctor={availabilityDoctor}
            onClose={() => setAvailabilityDoctor(null)}
          />
        </main>
      </div>
    </div>
  );
}
