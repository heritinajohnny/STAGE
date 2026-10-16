"use client";
import React from "react";
import jsPDF from "jspdf";
import { Button } from "../ui/Button";

interface PdfExportButtonProps {
  title: string;
  filename?: string;
  getData: () => {
    headerTitle: string;
    items: { label: string; value: string }[];
  };
}

export const PdfExportButton: React.FC<PdfExportButtonProps> = ({
  title,
  filename = "document.pdf",
  getData,
}) => {
  const handleGeneratePdf = () => {
    const doc = new jsPDF();
    const data = getData();

    // En-tête Polyclinique
    doc.setFontSize(18);
    doc.setTextColor(30, 58, 138); // Bleu
    doc.text("POLYCLINIQUE DE MANAGEMENT", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Service Automatise de Gestion des Patients", 14, 26);
    doc.line(14, 30, 196, 30);

    // Titre du Document
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(data.headerTitle, 14, 42);

    // Contenu
    let yPosition = 55;
    doc.setFontSize(11);

    data.items.forEach((item) => {
      doc.setFont("helvetica", "bold");
      doc.text(`${item.label} :`, 14, yPosition);
      doc.setFont("helvetica", "normal");
      doc.text(`${item.value}`, 85, yPosition);
      yPosition += 10;
    });

    // Pied de page
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text(
      `Généré le : ${new Date().toLocaleString("fr-FR")}`,
      14,
      doc.internal.pageSize.height - 10,
    );

    // Téléchargement
    doc.save(filename);
  };

  return (
    <Button variant="secondary" onClick={handleGeneratePdf}>
      {title}
    </Button>
  );
};
