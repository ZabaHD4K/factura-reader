// @ts-ignore — no type declarations available
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

// ── helpers ──────────────────────────────────────────────────────────────────

function first(text: string, patterns: RegExp[]): string {
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return "";
}

/** Matches an amount in EU format (1.234,56) or US format (1,234.56).
 *  Negative lookaheads prevent partial matches across formats
 *  (e.g. US matching "6.43" from EU "6.439,49", or EU matching "9,04" from US "9,049.22"). */
const AMT_EU = `(\\d[\\d.\\s]*,\\d{2})(?![\\d.])`;
const AMT_US = `(\\d[\\d,]*\\.\\d{2})(?![\\d,])`;

/** Build regex that matches a label followed by an amount, tolerating €/$/ symbols and whitespace.
 *  US format is tried first to avoid EU pattern capturing partial US amounts (e.g. "9,04" from "9,049.22"). */
function amtPatterns(labels: string): RegExp[] {
  // label then US amount (try first — avoids EU partial match on US numbers like 9,049.22)
  const us = new RegExp(`(?:${labels})[:\\s]*(?:[€$£﷼₪]|EUR|USD|ر\\.س|ریال)?\\s*${AMT_US}`, "i");
  // label then EU amount
  const eu = new RegExp(`(?:${labels})[:\\s]*(?:[€$£﷼₪]|EUR|USD|ر\\.س|ریال)?\\s*${AMT_EU}\\s*€?`, "i");
  return [us, eu];
}

/**
 * Build regex for RTL-reversed text (pdf-parse outputs "AMOUNTcurrency: LABEL_REVERSED").
 * The amount appears BEFORE the label in the extracted text.
 */
function amtPatternsRTL(labels: string): RegExp[] {
  const us = new RegExp(`${AMT_US}(?:[€$£﷼₪]|ر\\.س|ریال)?\\s*(?:${labels})`, "i");
  const eu = new RegExp(`${AMT_EU}(?:[€$£﷼₪]|ر\\.س|ریال)?\\s*(?:${labels})`, "i");
  return [us, eu];
}

// ── invoice number ───────────────────────────────────────────────────────────

const INVOICE_NUMBER: RegExp[] = [
  // "Invoice INV/2023/03/0008"
  /invoice\s+([A-Z]{2,5}\/\d{4}\/\d{2}\/\d+)/i,
  // French: "Facture n°: FR-002501" or "Facture n°562044387"
  /facture\s*n[°ºo]?\s*[:\s]*([A-Z0-9][\w\-/]{2,25})/i,
  // Dutch: "Factuurnummer: NL-004000" or "Factuurnummer: 993548900"
  /factuurnummer\s*[:\s]*([A-Z0-9][\w\-/]{2,25})/i,
  // German: "Rechnungsnr.: DE-003751" or "Rechnungsnr. 47774"
  /rechnungsnr\.?\s*[:\s]*([A-Z0-9][\w\-/]{2,25})/i,
  // English: "Invoice No : # BLR_WFLD..."
  /invoice\s*(?:no\.?|number|#|num\.?)\s*[:\s]*#?\s*([A-Z0-9][\w\-/#]{2,25})/i,
  // Spanish: "Factura Nº F-2024-001"
  /\bfactura\s*(?:n[ºo°]?\.?\s*)?[:\s]*([A-Z0-9][\w\-/#]{2,25})/i,
  // English: "# invoice_number_1" (standalone hash)
  /^#\s*([A-Za-z0-9][\w\-]{2,25})/m,
  // Dutch factuur number in table
  /factuur\s*[:\s]+([A-Z0-9][\w\-/]{2,25})/i,
  // Booking/Order ID
  /(?:booking\s*id|order\s*id)[:\s]*([A-Z0-9][\w\-]{3,20})/i,
  // Arabic: رقم الفاتورة (normal + RTL-reversed "AR-006250الفاتورة: رقم")
  /(?:رقم\s*الفاتورة|فاتورة\s*رقم)\s*[:\s]*([A-Z0-9\u0660-\u0669][\w\u0660-\u0669\-/]{2,25})/,
  /([A-Z0-9][\w\-/]{2,25})الفاتورة:?\s*رقم/,
  // Persian: شماره فاکتور (normal + RTL-reversed)
  /(?:شماره\s*فاکتور|صورتحساب\s*شماره|فاکتور\s*شماره)\s*[:\s]*([A-Z0-9\u06F0-\u06F9][\w\u06F0-\u06F9\-/]{2,25})/,
  /([A-Z0-9][\w\-/]{2,25})فاکتور:?\s*شماره/,
  // Hebrew: מספר חשבונית (normal + RTL-reversed)
  /(?:מספר\s*חשבונית|חשבונית\s*(?:מס\s*)?(?:מס['׳]?\s*)?)\s*[:\s]*([A-Z0-9][\w\-/]{2,25})/,
  /([A-Z0-9][\w\-/]{2,25})חשבונית:?\s*מספר/,
];

// ── date ─────────────────────────────────────────────────────────────────────

const DATE: RegExp[] = [
  // Labeled: "Invoice Date: 20-10-2015", "Fecha: ...", "Datum: ...", etc.
  /(?:fecha|date|datum|factuurdatum|rechnungsdatum|invoice\s*date)[:\s]*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/i,
  // French: "du 02 Juillet 2015" or "Date: 5 septembre 2021"
  /(?:du|date)\s*[:\s]*(\d{1,2}\s+(?:janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre)\s+\d{4})/i,
  // Dutch: "19 april 2014"
  /(\d{1,2}\s+(?:januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4})/i,
  // German: "7. Mai 2014"
  /(\d{1,2}\.?\s+(?:Januar|Februar|M[aä]rz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+\d{4})/i,
  // English: "Jan 1, 2022"
  /(?:date)[:\s]*(\w{3,9}\s+\d{1,2},?\s+\d{4})/i,
  // Arabic: التاريخ (normal + RTL-reversed "18/01/2020التاريخ:")
  /(?:التاريخ|تاريخ\s*الفاتورة)\s*[:\s]*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/,
  /(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})التاريخ/,
  // Persian: تاریخ (normal + RTL-reversed)
  /(?:تاریخ|تاریخ\s*فاکتور)\s*[:\s]*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/,
  /(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})تاریخ/,
  // Hebrew: תאריך (normal + RTL-reversed)
  /(?:תאריך)\s*[:\s]*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/,
  /(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})תאריך/,
  // Persian month names (Jalali): "15 فروردین 1403" (normal + RTL-reversed "1403فروردین 15")
  /(\d{1,2}\s+(?:فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند)\s+\d{4})/,
  /(\d{4}(?:فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند)\s+\d{1,2})/,
  // Arabic month names: "15 يناير 2024"
  /(\d{1,2}\s+(?:يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)\s+\d{4})/,
  // Hebrew month names: "15 בינואר 2024"
  /(\d{1,2}\s+(?:בינואר|בפברואר|במרץ|באפריל|במאי|ביוני|ביולי|באוגוסט|בספטמבר|באוקטובר|בנובמבר|בדצמבר)\s+\d{4})/,
  // Standalone dd/mm/yyyy (4-digit year)
  /(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4})/,
];

// ── tax ID ───────────────────────────────────────────────────────────────────

const TAX_ID: RegExp[] = [
  // Dutch BTW: NL810433941B01
  /\b(NL\d{9}B\d{2})\b/,
  // German UStId / USt-IdNr: DE805934671 or DE 232 446 240
  /(?:UStId|USt[\-.]?Id(?:Nr)?\.?)\s*(?:Nr\.?\s*)?[:\s]*(DE\s*[\d\s]{9,12})/i,
  // French TVA intracom
  /\b(FR\s*\d{2}\s*\d{9})\b/,
  // Spanish CIF/NIF
  /(?:CIF|NIF|N\.?I\.?F\.?|C\.?I\.?F\.?)[:\s]*([A-Z]?\d{7,8}[A-Z]?)/i,
  // Generic VAT/BTW/TVA + ID
  /(?:VAT|TVA|BTW|IVA)\s*(?:n[°ºo]?\s*)?[:\s]*([A-Z]{2}\s*[\d\s]{6,15})/i,
  // Indian VAT/TIN
  /(?:VAT|TIN)[/:\s]*(\d{11,15})/i,
  // Service tax
  /(?:service\s*tax\s*#?)[:\s]*([A-Z0-9]{10,20})/i,
  // Arabic: الرقم الضريبي (normal + RTL-reversed "342...الضريبي: الرقم")
  /(?:الرقم\s*الضريبي|رقم\s*التسجيل\s*الضريبي)\s*[:\s]*([\d\u0660-\u0669]{9,15})/,
  /([\d]{9,15})الضريبي:?\s*الرقم/,
  // Persian: شناسه ملی / کد اقتصادی (normal + RTL-reversed)
  /(?:شناسه\s*ملی|کد\s*اقتصادی|شماره\s*مالیاتی)\s*[:\s]*([\d\u06F0-\u06F9]{9,15})/,
  /([\d]{9,15})ملی:?\s*شناسه/,
  // Hebrew: ע.מ / ח.פ / מספר עוסק מורשה (normal + RTL-reversed)
  /(?:ע\.?מ\.?|ח\.?פ\.?|מספר\s*עוסק(?:\s*מורשה)?)\s*[:\s]*(\d{9})/,
  /(\d{9})ע\.?מ/,
  // Saudi Arabia VAT (15-digit TIN)
  /\b(\d{15})\b/,
  // Spanish standalone
  /\b([A-Z]\d{8})\b/,
  /\b([A-Z]\d{7}[A-Z])\b/,
];

// ── subtotal / base imponible ────────────────────────────────────────────────

const SUBTOTAL: RegExp[] = [
  // Spanish
  ...amtPatterns("base\\s*imponible|base\\s*imp\\.?"),
  // French: "Total HT", "Montant EUR HT"
  ...amtPatterns("total\\s*HT|montant\\s*(?:EUR\\s*)?HT"),
  // Dutch: "Grondslag"
  ...amtPatterns("grondslag|subtotaal"),
  // German: "Netto"
  ...amtPatterns("netto(?:betrag)?|zwischensumme"),
  // English
  ...amtPatterns("subtotal|sub\\s*total|net\\s*amount"),
  // Arabic: المبلغ قبل الضريبة (normal + RTL-reversed "5,806.41ر.س الضريبة: قبل المبلغ")
  ...amtPatterns("المبلغ\\s*قبل\\s*الضريبة|الإجمالي\\s*بدون\\s*ضريبة|المبلغ\\s*الخاضع\\s*للضريبة"),
  ...amtPatternsRTL("الضريبة:?\\s*قبل\\s*المبلغ"),
  // Persian: جمع بدون مالیات (normal + RTL-reversed "3,381.49ریال مالیات: بدون جمع")
  ...amtPatterns("جمع\\s*(?:کل\\s*)?بدون\\s*مالیات|مبلغ\\s*قبل\\s*(?:از\\s*)?مالیات"),
  ...amtPatternsRTL("مالیات:?\\s*بدون\\s*جمع"),
  // Hebrew: סכום לפני מע"מ (normal + RTL-reversed "5,315.90מע"מ: לפני סכום")
  ...amtPatterns('סכום\\s*לפני\\s*מע"מ|סה"כ\\s*לפני\\s*מע"מ'),
  ...amtPatternsRTL('מע"מ:?\\s*לפני\\s*סכום'),
  // Rs
  /(?:subtotal|sub\s*total)[:\s]*(?:Rs\.?\s*)(\d[\d,]*)/i,
];

// ── tax percentage ───────────────────────────────────────────────────────────

const TAX_PERCENT: RegExp[] = [
  /(\d{1,2}(?:[.,]\d+)?)\s*%\s*(?:IVA|VAT|TVA|BTW|USt|MwSt|I\.V\.A|GST)/i,
  /(?:IVA|VAT|TVA|BTW|USt|MwSt|I\.V\.A|GST|tax)[:\s]*(\d{1,2}(?:[.,]\d+)?)\s*%/i,
  /(?:TVA|BTW|IVA|VAT)\s+(\d{1,2})\s*%/i,
  // Arabic: ضريبة القيمة المضافة 15% (+ RTL-reversed "%15ض.ق.م")
  /(?:ضريبة\s*القيمة\s*المضافة|ض\.?ق\.?م\.?)\s*[:\s]*(\d{1,2}(?:[.,]\d+)?)\s*%/,
  /(\d{1,2}(?:[.,]\d+)?)\s*%\s*(?:ضريبة|ض\.?ق\.?م)/,
  /%(\d{1,2})ض\.?ق\.?م/,
  // Persian: مالیات بر ارزش افزوده 9% (+ RTL-reversed "%9مالیات")
  /(?:مالیات\s*(?:بر\s*)?ارزش\s*افزوده)\s*[:\s]*(\d{1,2}(?:[.,]\d+)?)\s*%/,
  /(\d{1,2}(?:[.,]\d+)?)\s*%\s*مالیات/,
  /%(\d{1,2})مالیات/,
  // Hebrew: מע"מ 17% (+ RTL-reversed "%17מע"מ")
  /(?:מע"מ|מ\.?ע\.?מ\.?)\s*[:\s]*(\d{1,2}(?:[.,]\d+)?)\s*%/,
  /(\d{1,2}(?:[.,]\d+)?)\s*%\s*מע"מ/,
  /%(\d{1,2})מע"מ/,
];

// ── tax amount ───────────────────────────────────────────────────────────────

const TAX_AMOUNT: RegExp[] = [
  // Spanish
  ...amtPatterns("cuota\\s*IVA|importe\\s*IVA|IVA\\s*importe"),
  // French
  ...amtPatterns("montant\\s*TVA"),
  // Dutch
  ...amtPatterns("BTW\\s*bedrag"),
  // German
  ...amtPatterns("MwSt\\.?\\s*Betrag|USt\\.?\\s*Betrag"),
  // English
  ...amtPatterns("VAT\\s*amount|tax\\s*amount|GST\\s*amount"),
  // Arabic: مبلغ الضريبة (+ RTL-reversed "870.96ر.س :%15ض.ق.م")
  ...amtPatterns("مبلغ\\s*الضريبة|قيمة\\s*الضريبة|ضريبة\\s*القيمة\\s*المضافة"),
  ...amtPatternsRTL(":%?\\d{1,2}ض\\.?ق\\.?م"),
  // Persian: مبلغ مالیات (+ RTL-reversed "304.33ریال :%9مالیات")
  ...amtPatterns("مبلغ\\s*مالیات|مالیات\\s*ارزش\\s*افزوده"),
  ...amtPatternsRTL(":%?\\d{1,2}مالیات"),
  // Hebrew: סכום מע"מ (+ RTL-reversed "903.70₪ :17%מע"מ")
  ...amtPatterns('סכום\\s*מע"מ|מע"מ'),
  ...amtPatternsRTL(':\\d{1,2}%מע"מ'),
  // "IVA 21%: € 1.445,30", "VAT 20%: $ 959.01", "MwSt 19%: € 150,92", "TVA 20%: € 1.375,60", "BTW 21%: € ..."
  ...amtPatterns("(?:IVA|VAT|TVA|BTW|MwSt|USt|GST)\\s*\\d{1,2}(?:[.,]\\d+)?\\s*%"),
  // Generic "TVA 20%:" or "IVA:" followed by amount
  ...amtPatterns("TVA\\s*\\d*%?"),
  ...amtPatterns("IVA|VAT|BTW"),
  // Tax (0%): $0.00
  /tax\s*\(\d+%?\)[:\s]*(?:[\$€£]?\s*)(\d[\d,]*\.\d{2})/i,
];

// ── total ────────────────────────────────────────────────────────────────────

const TOTAL: RegExp[] = [
  // Spanish
  ...amtPatterns("total\\s*factura|total\\s*a\\s*pagar|importe\\s*total"),
  // French TTC
  ...amtPatterns("total\\s*TTC|somme\\s*[àa]\\s*payer|net\\s*[àa]\\s*payer|total\\s*facture"),
  // "29.99 € TTC" pattern (amount before TTC)
  /(\d[\d.\s]*,\d{2})\s*€?\s*TTC/i,
  /(\d[\d,]*\.\d{2})\s*€?\s*TTC/i,
  // Dutch (negative lookbehind to avoid matching "Subtotaal")
  ...amtPatterns("(?<!sub)totaal|factuur\\s*totaal"),
  // German
  ...amtPatterns("gesamtbetrag|rechnungsbetrag|endbetrag"),
  // English
  ...amtPatterns("grand\\s*total|total\\s*amount|amount\\s*due|balance\\s*due"),
  // Arabic: المبلغ الإجمالي (+ RTL-reversed "6,677.37ر.س الإجمالي: المبلغ")
  ...amtPatterns("المبلغ\\s*الإجمالي|إجمالي\\s*الفاتورة|المبلغ\\s*المستحق|الإجمالي"),
  ...amtPatternsRTL("الإجمالي:?\\s*المبلغ"),
  // Persian: جمع کل (+ RTL-reversed "3,685.82ریال کل: جمع")
  ...amtPatterns("جمع\\s*کل|مبلغ\\s*قابل\\s*پرداخت|جمع\\s*نهایی"),
  ...amtPatternsRTL("کل:?\\s*جمع"),
  // Hebrew: סה"כ לתשלום (+ RTL-reversed "6,219.60לתשלום: סה"כ")
  ...amtPatterns('סה"כ\\s*לתשלום|סכום\\s*לתשלום|סה"כ'),
  ...amtPatternsRTL('לתשלום:?\\s*סה"כ'),
  // Rs total
  /(?:grand\s*total|(?<!sub)total)[:\s]*(?:Rs\.?\s*)(\d[\d,]*)/i,
  // Generic "Total" (keep last; negative lookbehind to avoid matching "subtotal")
  ...amtPatterns("(?<!sub)total"),
];

// ── provider extraction ──────────────────────────────────────────────────────

const SKIP_LINE = /^(?:factura|fecha|cif|nif|iva|total|base|cliente|dir|invoice|bill|ship|date|payment|tax|description|item|quantity|rate|amount|page|rechnung|factuur|facture|adresse|désignation|designation|artikel|kopie|prix|service|note|subtotal|sold|warehouse|s:\s|payment\s*receipt|فاتورة|تاریخ|التاريخ|رقم|ضريبة|مالیات|الإجمالي|جمع|חשבונית|תאריך|מע"מ|סה"כ|\*)/i;
const ONLY_NUMBERS = /^[\d\s/\-.,:%€$£₹Rs﷼₪]+$/;

function extractProvider(text: string): string {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 12)) {
    if (line.length < 4 || line.length > 100) continue;
    if (ONLY_NUMBERS.test(line)) continue;
    if (SKIP_LINE.test(line)) continue;
    // Skip lines that are just addresses (start with a number followed by lots of text)
    if (/^\d{4,6}\s/.test(line)) continue;
    // Match Latin, Arabic, Hebrew, and other scripts
    if (/[A-Za-zÀ-ÿ\u0600-\u06FF\u0750-\u077F\u0590-\u05FF]/.test(line)) {
      return line.slice(0, 80);
    }
  }
  return "";
}

// ── main parser ──────────────────────────────────────────────────────────────

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

    data.numeroFactura = first(text, INVOICE_NUMBER);
    data.fecha = first(text, DATE);
    data.cifNif = first(text, TAX_ID);
    data.baseImponible = first(text, SUBTOTAL);
    data.ivaPorcentaje = first(text, TAX_PERCENT);
    data.ivaImporte = first(text, TAX_AMOUNT);
    data.total = first(text, TOTAL);
    data.emisor = extractProvider(text);
  } catch (e: any) {
    data.emisor = `Error: ${e.message}`;
  }

  return data;
}
