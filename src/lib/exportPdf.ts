import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface PdfSection {
  title: string;
  rows: (string | number)[][];
  head?: string[];
}

export function exportReportPdf(opts: {
  title: string;
  subtitle?: string;
  meta?: Record<string, string | number>;
  sections: PdfSection[];
  fileName?: string;
}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  // Header band
  doc.setFillColor(20, 30, 60);
  doc.rect(0, 0, pageW, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(18);
  doc.text(opts.title, 40, 38);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  if (opts.subtitle) doc.text(opts.subtitle, 40, 56);
  doc.setFontSize(9); doc.setTextColor(180, 200, 230);
  doc.text("Versátil Digital · ZailonSoft", pageW - 40, 38, { align: "right" });
  doc.text(new Date().toLocaleString("pt-BR"), pageW - 40, 56, { align: "right" });

  let cursorY = 100;
  doc.setTextColor(20, 30, 60);

  if (opts.meta) {
    const entries = Object.entries(opts.meta);
    doc.setFontSize(10);
    entries.forEach(([k, v], i) => {
      const x = 40 + (i % 3) * ((pageW - 80) / 3);
      const y = cursorY + Math.floor(i / 3) * 22;
      doc.setFont("helvetica", "bold"); doc.setTextColor(120, 120, 140);
      doc.text(`${k}`, x, y);
      doc.setFont("helvetica", "normal"); doc.setTextColor(20, 30, 60);
      doc.text(String(v), x, y + 12);
    });
    cursorY += Math.ceil(entries.length / 3) * 22 + 14;
  }

  opts.sections.forEach(s => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(20, 30, 60);
    doc.text(s.title, 40, cursorY);
    cursorY += 8;
    autoTable(doc, {
      startY: cursorY,
      head: s.head ? [s.head] : undefined,
      body: s.rows,
      styles: { fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: [50, 100, 200], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 248, 252] },
      margin: { left: 40, right: 40 },
    });
    // @ts-expect-error - lastAutoTable is added by autotable
    cursorY = (doc.lastAutoTable.finalY ?? cursorY) + 24;
  });

  doc.save(opts.fileName ?? `${opts.title.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}