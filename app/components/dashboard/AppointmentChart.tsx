"use client";
import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export interface AppointmentStatusData {
  status: string;
  count: number;
}

export interface DailyActivityData {
  day: string;
  total: number;
}
export interface MonthlyActivityData {
  month: string;
  total: number;
}
export interface SpecialtyActivityData {
  specialty: string;
  total: number;
}

interface AppointmentChartProps {
  statusData: AppointmentStatusData[];
  activityData: DailyActivityData[];
  monthlyData: MonthlyActivityData[];
  specialtyData: SpecialtyActivityData[];
}

const COLORS = ["#F59E0B", "#0B766D", "#3B82F6", "#10B981", "#EF4444"];

export const AppointmentChart: React.FC<AppointmentChartProps> = ({
  statusData,
  activityData,
  monthlyData,
  specialtyData,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
        <h3 className="text-base font-semibold text-gray-800 mb-4">Activité des rendez-vous — 7 derniers jours</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={activityData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="day" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="total" fill="#3B82F6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
        <h3 className="text-base font-semibold text-gray-800 mb-4">Répartition des rendez-vous par statut</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="count"
                nameKey="status"
              >
                {statusData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
        <h3 className="text-base font-semibold text-gray-800 mb-4">Rendez-vous par spécialité</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={specialtyData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
              <XAxis type="number" stroke="#9CA3AF" allowDecimals={false} />
              <YAxis type="category" dataKey="specialty" width={110} stroke="#9CA3AF" />
              <Tooltip />
              <Bar dataKey="total" fill="#3B82F6" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
        <h3 className="text-base font-semibold text-gray-800 mb-4">Évolution mensuelle des rendez-vous</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="month" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="total" fill="#0B766D" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
