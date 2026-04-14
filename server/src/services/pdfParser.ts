import pdfParse from "pdf-parse";

export interface InvoiceData {
  archivo: string;
  emisor: string;
  numeroFactura: string;
  fecha: string;
  cifNif: string;
  baseImponible: string;
  ivaPorcentaje: string;
  ivaImporte: string;
  total: string;
}

const FIELD_PATTERNS: Record<string, RegExp[]> = {
  numeroFactura: [
    /(?:factura|invoice|fra\.?|n[ºo°]?\s*factura)[:\s]*([A-Z0-9][\w\-/]{2,20})/i,
    /(?:n[ºo°]?|number)[:\s]*([A-Z0-9][\w\-/]{2,20})/i,
  ],
  fecha: [
    /(?:fecha|date)[:\s]*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/i,
    /(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4})/,
  ],
  cifNif: [
    /(?:CIF|NIF|N\.?I\.?F\.?|C\.?I\.?F\.?|VAT)[:\s]*([A-Z]?\d{7,8}[A-Z]?)/i,
    /\b([A-Z]\d{8})\b/,
    /\b([A-Z]\d{7}[A-Z])\b/,
  ],
  baseImponible: [
    /(?:base\s*imponible|subtotal|base)[:\s]*(\d[\d.\s]*,\d{2})\s*€?/i,
    /(?:base\s*imponible|subtotal|base)[:\s]*€?\s*(\d[\d,]*\.\d{2})/i,
  ],
  ivaPorcentaje: [
    /(\d{1,2})\s*%\s*(?:IVA|VAT|I\.V\.A)/i,
    /(?:IVA|VAT|I\.V\.A)[:\s]*(\d{1,2})\s*%/i,
  ],
  ivaImporte: [
    /(?:cuota\s*IVA|IVA|VAT|I\.V\.A)[:\s]*(\d[\d.\s]*,\d{2})\s*€?/i,
  ],
  total: [
    /(?:total\s*factura|total\s*a\s*pagar|importe\s*total|total)[:\s]*(\d[\d.\s]*,\d{2})\s*€?/i,
    /(?:total\s*factura|total\s*a\s*pagar|importe\s*total|total)[:\s]*€?\s*(\d[\d,]*\.\d{2})/i,
  ],
};

function firstMatch(text: string, patterns: RegExp[]): string {
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) return m[1].trim();
  }
  return "";
}

function extractProvider(text: string): string {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 6)) {
    if (line.length > 4 && !/^[\d\s/\-.,:%€]+$/.test(line)) {
      if (/^(?:factura|fecha|cif|nif|iva|total|base|cliente|dir)/i.test(line)) continue;
      return line.slice(0, 80);
    }
  }
  return "";
}

export async function parseInvoice(buffer: Buffer, filename: string): Promise<InvoiceData> {
  const data: InvoiceData = {
    archivo: filename,
    emisor: "",
    numeroFactura: "",
    fecha: "",
    cifNif: "",
    baseImponible: "",
    ivaPorcentaje: "",
    ivaImporte: "",
    total: "",
  };

  try {
    const pdf = await pdfParse(buffer);
    const text = pdf.text;

    if (!text.trim()) {
      data.emisor = "Sin texto (¿escaneado?)";
      return data;
    }

    for (const [field, patterns] of Object.entries(FIELD_PATTERNS)) {
      (data as any)[field] = firstMatch(text, patterns);
    }

    data.emisor = extractProvider(text);
  } catch (e: any) {
    data.emisor = `Error: ${e.message}`;
  }

  return data;
}
