import ExcelJS from "exceljs";
import { InvoiceData } from "./pdfParser";

const HEADER_MAP: Record<string, keyof InvoiceData> = {
  "archivo": "archivo",
  "emisor": "emisor",
  "nº factura": "numeroFactura",
  "n factura": "numeroFactura",
  "numero factura": "numeroFactura",
  "núm factura": "numeroFactura",
  "num factura": "numeroFactura",
  "factura": "numeroFactura",
  "fecha": "fecha",
  "date": "fecha",
  "cif / nif": "cifNif",
  "cif/nif": "cifNif",
  "cif": "cifNif",
  "nif": "cifNif",
  "base imponible": "baseImponible",
  "base imp.": "baseImponible",
  "base imp": "baseImponible",
  "subtotal": "baseImponible",
  "iva %": "ivaPorcentaje",
  "iva%": "ivaPorcentaje",
  "% iva": "ivaPorcentaje",
  "iva importe": "ivaImporte",
  "iva imp.": "ivaImporte",
  "iva imp": "ivaImporte",
  "cuota iva": "ivaImporte",
  "total": "total",
  "importe total": "total",
  "total factura": "total",
};

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export async function parseExcel(buffer: Buffer): Promise<InvoiceData[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) return [];

  // Mapear cabeceras
  const headerRow = sheet.getRow(1);
  const colMap: Map<number, keyof InvoiceData> = new Map();

  headerRow.eachCell((cell, colNumber) => {
    const raw = normalize(String(cell.value || ""));
    const mapped = HEADER_MAP[raw];
    if (mapped) {
      colMap.set(colNumber, mapped);
    }
  });

  if (colMap.size === 0) return [];

  const records: InvoiceData[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const record: InvoiceData = {
      archivo: "",
      emisor: "",
      numeroFactura: "",
      fecha: "",
      cifNif: "",
      baseImponible: "",
      ivaPorcentaje: "",
      ivaImporte: "",
      total: "",
    };

    let hasData = false;
    colMap.forEach((field, colNumber) => {
      const val = String(row.getCell(colNumber).value || "").trim();
      if (val) hasData = true;
      record[field] = val;
    });

    if (hasData) records.push(record);
  });

  return records;
}
