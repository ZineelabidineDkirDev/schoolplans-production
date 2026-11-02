type ExportCell = string | number;

type ExportColumn = {
  label: string;
  width?: number;
};

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function exportTableToExcel(
  fileName: string,
  sheetName: string,
  columns: ExportColumn[],
  rows: ExportCell[][],
) {
  const XLSX = await import('@e965/xlsx');
  const worksheet = XLSX.utils.aoa_to_sheet([
    columns.map((column) => column.label),
    ...rows,
  ]);
  worksheet['!cols'] = columns.map((column, index) => {
    const longestValue = rows.reduce(
      (longest, row) => Math.max(longest, String(row[index] ?? '').length),
      column.label.length,
    );
    return { wch: Math.min(42, Math.max(column.width ?? 12, longestValue + 2)) };
  });
  worksheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(rows.length, 1), c: Math.max(columns.length - 1, 0) },
    }),
  };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  downloadBlob(
    new Blob([output], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    fileName,
  );
}

export async function exportTableToPdf(
  fileName: string,
  title: string,
  columns: ExportColumn[],
  rows: ExportCell[][],
) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 10;
  const tableWidth = pdf.internal.pageSize.getWidth() - margin * 2;
  const pageBottom = pdf.internal.pageSize.getHeight() - margin;
  const weights = columns.map((column) => column.width ?? 1);
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const widths = weights.map((weight) => (tableWidth * weight) / weightTotal);
  const lineHeight = 3.6;
  const cellPadding = 2;
  let y = margin;

  function drawHeading() {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.setTextColor(15, 23, 42);
    pdf.text(title, margin, y + 5);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text(
      `${rows.length} ligne${rows.length === 1 ? '' : 's'} · Exporté le ${new Date().toLocaleString('fr-FR')}`,
      margin,
      y + 10,
    );
    y += 14;
    drawHeader();
  }

  function drawHeader() {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    const wrapped = columns.map((column, index) =>
      pdf.splitTextToSize(column.label, widths[index] - cellPadding * 2),
    );
    const headerHeight = Math.max(...wrapped.map((lines) => lines.length)) * lineHeight + cellPadding * 2;
    let x = margin;
    columns.forEach((_, index) => {
      pdf.setFillColor(23, 37, 84);
      pdf.setDrawColor(203, 213, 225);
      pdf.rect(x, y, widths[index], headerHeight, 'FD');
      pdf.setTextColor(255, 255, 255);
      pdf.text(wrapped[index], x + cellPadding, y + cellPadding + 2.5);
      x += widths[index];
    });
    y += headerHeight;
  }

  drawHeading();
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  rows.forEach((row, rowIndex) => {
    const wrapped = columns.map((_, index) =>
      pdf.splitTextToSize(String(row[index] ?? '—'), widths[index] - cellPadding * 2),
    );
    const rowHeight = Math.max(...wrapped.map((lines) => Math.min(lines.length, 5))) * lineHeight + cellPadding * 2;
    if (y + rowHeight > pageBottom) {
      pdf.addPage();
      y = margin;
      drawHeading();
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
    }

    let x = margin;
    columns.forEach((_, index) => {
      const cellLines = wrapped[index].slice(0, 5);
      if (cellLines.length < wrapped[index].length && cellLines.length > 0) {
        cellLines[cellLines.length - 1] = `${cellLines[cellLines.length - 1].slice(0, -1)}…`;
      }
      pdf.setFillColor(rowIndex % 2 === 0 ? 255 : 248, rowIndex % 2 === 0 ? 255 : 250, rowIndex % 2 === 0 ? 255 : 252);
      pdf.setDrawColor(226, 232, 240);
      pdf.rect(x, y, widths[index], rowHeight, 'FD');
      pdf.setTextColor(30, 41, 59);
      pdf.text(cellLines, x + cellPadding, y + cellPadding + 2.5);
      x += widths[index];
    });
    y += rowHeight;
  });

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setFontSize(7);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`${page} / ${pageCount}`, pdf.internal.pageSize.getWidth() - margin, pdf.internal.pageSize.getHeight() - 4, {
      align: 'right',
    });
  }
  pdf.save(fileName);
}
