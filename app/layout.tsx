import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PSFA - Prise de rendez-vous",
  description:
    "Application d'automatisation de la gestion des patients et consultations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
