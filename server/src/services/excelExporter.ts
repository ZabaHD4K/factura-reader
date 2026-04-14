import ExcelJS from "exceljs";
import { InvoiceData } from "./pdfParser";

const HEADERS = [
  { key: "archivo", header: "Archivo", width: 25 },
  { key: "emisor", header: "Emisor", width: 35 },
  { key: "numeroFactura", header: "Nº Factura", width: 18 },
  { key: "fecha", header: "Fecha", width: 14 },
  { key: "cifNif", header: "CIF / NIF", width: 16 },
  { key: "baseImponible", header: "Base Imponible", width: 16 },
  { key: "ivaPorcentaje", header: "IVA %", width: 10 },
  { key: "ivaImporte", header: "IVA Importe", width: 16 },
  { key: "total", header: "Total", width: 16 },
];

export async function generateExcel(records: InvoiceData[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Facturas");

  // Columnas
  sheet.columns = HEADERS.map((h) => ({
    header: h.header,
    key: h.key,
    width: h.width,
  }));

  // Estilo cabecera
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E40AF" },
  };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };
  headerRow.height = 30;

  // Datos
  for (let i = 0; i < records.length; i++) {
    const row = sheet.addRow(records[i]);
    row.font = { size: 10 };
    row.alignment = { vertical: "middle", wrapText: true };

    if (i % 2 === 1) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEFF6FF" },
      };
    }
  }

  // Bordes
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFD1D5DB" } },
        bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
        left: { style: "thin", color: { argb: "FFD1D5DB" } },
        right: { style: "thin", color: { argb: "FFD1D5DB" } },
      };
    });
  });

  // Filtros
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: records.length + 1, column: HEADERS.length },
  };

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
