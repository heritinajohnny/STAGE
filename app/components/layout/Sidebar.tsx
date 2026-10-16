"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  CalendarRange,
  FileChartColumnIncreasing,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Stethoscope,
  UsersRound,
} from "lucide-react";

const navItems = [
  { label: "Tableau de bord", href: "/", icon: LayoutDashboard },
  { label: "Patients", href: "/patients", icon: UsersRound },
  { label: "Médecins", href: "/doctors", icon: Stethoscope },
  { label: "Rendez-vous", href: "/appointments", icon: CalendarDays },
  { label: "Emploi du temps", href: "/schedule", icon: CalendarRange },
  { label: "Rapports", href: "/reports", icon: FileChartColumnIncreasing },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark"><HeartPulse size={22} /></span>
        <span>
          <span className="sidebar-brand-title">PSFA<span className="brand-period">.</span></span>
          <span className="sidebar-brand-subtitle">Prise de rendez-vous</span>
        </span>
      </div>
      <nav className="sidebar-nav" aria-label="Navigation principale">
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-current={isActive ? "page" : undefined}
              className={`sidebar-link${isActive ? " active" : ""}`}
            >
              <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-bottom">
        <button type="button" className="sidebar-logout" onClick={logout}>
          <LogOut size={18} aria-hidden="true" />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  );
}