import React from "react";
import { CalendarDays, Clock3, Stethoscope, UsersRound } from "lucide-react";

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
}) => {
  const Icon = title.includes("Patient")
    ? UsersRound
    : title.includes("RDV")
      ? CalendarDays
      : title.includes("Attente")
        ? Clock3
        : Stethoscope;

  return (
    <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <h3 className="text-2xl font-bold text-gray-800 mt-1">{value}</h3>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
      <div className="stat-icon" aria-hidden="true">
        <Icon size={21} strokeWidth={1.8} />
      </div>
    </div>
  );
};
