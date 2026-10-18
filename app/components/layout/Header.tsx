"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Check } from "lucide-react";
import { LogoutButton } from "./LogoutButton";

interface HeaderProps {
  title?: string;
}

interface NotificationItem {
  id: number;
  message: string;
  appointmentId: number | null;
  readAt: string | null;
  createdAt: string;
  href: string;
}

export function Header({ title = "Espace de Gestion" }: HeaderProps) {
  const [name, setName] = useState("Administration");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const currentDate = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data: { user?: { name?: string } }) => {
        if (data.user?.name) setName(data.user.name);
      })
      .catch(() => undefined);

    let isMounted = true;
    const loadNotifications = async () => {
      try {
        const response = await fetch("/api/notifications");
        if (!response.ok) return;
        const items = (await response.json()) as NotificationItem[];
        if (isMounted) setNotifications(items);
      } catch {
        return;
      }
    };
    void loadNotifications();
    const intervalId = window.setInterval(loadNotifications, 30000);
    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  async function toggleNotifications() {
    const nextOpen = !notificationsOpen;
    setNotificationsOpen(nextOpen);
    if (nextOpen && notifications.some((item) => !item.readAt)) {
      await fetch("/api/notifications", { method: "POST" });
      setNotifications((current) =>
        current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })),
      );
    }
  }

  const unreadCount = notifications.filter((item) => !item.readAt).length;

  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <header className="app-header">
      <h2>{title}</h2>
      <div className="header-account">
        <span className="capitalize">{currentDate}</span>
        <span className="header-avatar" title={name}>{initials || "A"}</span>
        <span className="header-user-name">{name}</span>
        <div className="notification-anchor">
          <button
            type="button"
            className="header-icon-button"
            onClick={toggleNotifications}
            aria-label={`Notifications${unreadCount ? `, ${unreadCount} non lues` : ""}`}
            aria-expanded={notificationsOpen}
            title="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && <span className="notification-count">{unreadCount > 9 ? "9+" : unreadCount}</span>}
          </button>
          {notificationsOpen && (
            <section className="notification-popover" aria-label="Notifications">
              <div className="notification-heading">
                <strong>Notifications</strong>
                {unreadCount > 0 && <span>{unreadCount} nouvelle{unreadCount > 1 ? "s" : ""}</span>}
              </div>
              {notifications.length === 0 ? (
                <p className="notification-empty">Aucune notification pour le moment.</p>
              ) : (
                <ul>
                  {notifications.map((item) => (
                    <li key={item.id} className={!item.readAt ? "unread" : ""}>
                      <Link
                        href={item.href}
                        className="notification-link"
                        onClick={() => setNotificationsOpen(false)}
                      >
                        <span className="notification-dot" />
                        <span>
                          <span className="notification-message">{item.message}</span>
                          <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</time>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {notifications.length > 0 && unreadCount === 0 && (
                <div className="notification-read-all"><Check size={14} /> Tout est lu</div>
              )}
            </section>
          )}
        </div>
        <LogoutButton location="header" />
      </div>
    </header>
  );
}