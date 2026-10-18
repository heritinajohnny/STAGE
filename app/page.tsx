"use client";
import React, { useState, useEffect } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { StatCard } from "./components/dashboard/StatCard";
import {
  AppointmentChart,
  AppointmentStatusData,
  DailyActivityData,
  MonthlyActivityData,
  SpecialtyActivityData,
} from "./components/dashboard/AppointmentChart";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalPatients: 0,
    totalDoctors: 0,
    todayAppointments: 0,
    confirmedAppointments: 0,
    pendingAppointments: 0,
    canceledAppointments: 0,
    waitingPatients: 0,
  });
  const [statusData, setStatusData] = useState<AppointmentStatusData[]>([]);
  const [activityData, setActivityData] = useState<DailyActivityData[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyActivityData[]>([]);
  const [specialtyData, setSpecialtyData] = useState<SpecialtyActivityData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchDashboardData() {
      try {
        const response = await fetch("/api/dashboard");
        if (response.ok) {
          const data = await response.json();
          if (isMounted) {
            setStats(data.statsSummary);
            setStatusData(data.statusData);
            setActivityData(data.activityData);
            setMonthlyData(data.monthlyData);
            setSpecialtyData(data.specialtyData);
          }
        }
      } catch (error) {
        console.error("Erreur chargement tableau de bord:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchDashboardData();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="app-shell">
      <Sidebar />

      <div className="app-workspace">
        <Header title="Tableau de Bord Général" />

        <main className="page-content space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Aperçu des Activités
            </h1>
            <p className="text-sm text-gray-500">
              Statistiques en temps réel issues de la base de données
            </p>
          </div>

          {loading ? (
            <p className="text-gray-500 text-sm">
              Chargement des indicateurs...
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard
                  title="Total Patients"
                  value={stats.totalPatients}
                  subtitle="Enregistrés en base"
                />
                <StatCard title="Médecins" value={stats.totalDoctors} subtitle="Spécialistes actifs" />
                <StatCard
                  title="RDV du Jour"
                  value={stats.todayAppointments}
                  subtitle="Toutes spécialités confondues"
                />
                <StatCard title="Confirmés" value={stats.confirmedAppointments} subtitle="Rendez-vous validés" />
                <StatCard title="En attente" value={stats.pendingAppointments} subtitle="Demandes à valider" />
                <StatCard title="Annulés" value={stats.canceledAppointments} subtitle="Demandes annulées" />
                <StatCard title="Liste d’attente" value={stats.waitingPatients} subtitle="Patients en attente de créneau" />
              </div>

              <AppointmentChart
                statusData={statusData}
                activityData={activityData}
                monthlyData={monthlyData}
                specialtyData={specialtyData}
              />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
