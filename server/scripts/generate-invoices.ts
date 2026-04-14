/**
 * Generates ~10,000 test PDF invoices in multiple languages.
 *
 * Usage:  npx tsx scripts/generate-invoices.ts [count]
 * Default count: 10000
 * Output: test-invoices/
 */

import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

const OUTPUT_DIR = path.join(__dirname, "..", "..", "test-invoices");
const TOTAL_COUNT = parseInt(process.argv[2] || "10000", 10);

// ── language templates ───────────────────────────────────────────────────────

interface LangTemplate {
  lang: string;
  invoiceLabel: string;
  dateLabel: string;
  taxIdLabel: string;
  subtotalLabel: string;
  taxLabel: string;
  taxPctLabel: string;
  totalLabel: string;
  currency: string;
  providers: string[];
  taxIdFormat: () => string;
  dateFormat: (d: Date) => string;
  /** Use EU amount format (1.234,56) vs US (1,234.56) */
  euFormat: boolean;
  taxRate: number;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randDigits(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function fmtAmount(value: number, eu: boolean): string {
  if (eu) {
    const [int, dec] = value.toFixed(2).split(".");
    const intFormatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${intFormatted},${dec}`;
  }
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDateEU(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function randomDate(): Date {
  const start = new Date(2020, 0, 1).getTime();
  const end = new Date(2026, 3, 14).getTime();
  return new Date(start + Math.random() * (end - start));
}

// ── language definitions ─────────────────────────────────────────────────────

const SPANISH: LangTemplate = {
  lang: "es",
  invoiceLabel: "Factura Nº",
  dateLabel: "Fecha",
  taxIdLabel: "CIF",
  subtotalLabel: "Base Imponible",
  taxLabel: "Cuota IVA",
  taxPctLabel: "IVA",
  totalLabel: "Total Factura",
  currency: "€",
  providers: [
    "Servicios Técnicos López S.L.", "Distribuciones García S.A.", "Consultoría Martínez",
    "Electrónica Sánchez S.L.", "Transportes Ruiz S.A.", "Alimentación Fernández",
    "Construcciones Pérez S.L.", "Asesoría Fiscal Gómez", "Imprenta Digital Madrid",
    "Software Solutions España S.L.", "Ingeniería Rodríguez S.A.", "Farmacia Central Barcelona",
    "Talleres Mecánicos Díaz", "Textiles Moreno S.L.", "Panadería Artesanal Jiménez",
  ],
  taxIdFormat: () => pick("ABCDEFGH".split("")) + randDigits(8),
  dateFormat: fmtDateEU,
  euFormat: true,
  taxRate: 21,
};

const ENGLISH: LangTemplate = {
  lang: "en",
  invoiceLabel: "Invoice No",
  dateLabel: "Invoice Date",
  taxIdLabel: "VAT",
  subtotalLabel: "Subtotal",
  taxLabel: "VAT Amount",
  taxPctLabel: "VAT",
  totalLabel: "Total Amount",
  currency: "$",
  providers: [
    "Acme Corporation", "Global Tech Solutions", "Pinnacle Consulting LLC",
    "Bright Star Industries", "Summit Logistics Inc.", "Pacific Trading Co.",
    "Northern Software Ltd.", "Eastern Supply Chain", "Riverside Manufacturing",
    "CloudNine Services", "Blue Ocean Enterprises", "Golden Gate Imports",
    "Silver Creek Analytics", "Evergreen Solutions", "Horizon Digital Media",
  ],
  taxIdFormat: () => "GB" + randDigits(9),
  dateFormat: (d: Date) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  },
  euFormat: false,
  taxRate: 20,
};

const FRENCH: LangTemplate = {
  lang: "fr",
  invoiceLabel: "Facture n°",
  dateLabel: "Date",
  taxIdLabel: "TVA intracom",
  subtotalLabel: "Total HT",
  taxLabel: "Montant TVA",
  taxPctLabel: "TVA",
  totalLabel: "Total TTC",
  currency: "€",
  providers: [
    "Société Dupont & Fils", "Services Informatiques Martin", "Boulangerie Lefèvre",
    "Cabinet Moreau Avocats", "Transports Bernard SA", "Agence Petit Immobilier",
    "Laboratoire Roux SAS", "Éditions Fournier", "Garage Durand Auto",
    "Architectes Leroy & Associés", "Vignobles Girard", "Pharmacie Simon",
    "Menuiserie Artisanale Laurent", "Restaurant Le Bon Goût", "Électricité Michel SARL",
  ],
  taxIdFormat: () => "FR" + randDigits(2) + randDigits(9),
  dateFormat: (d: Date) => {
    const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  },
  euFormat: true,
  taxRate: 20,
};

const GERMAN: LangTemplate = {
  lang: "de",
  invoiceLabel: "Rechnungsnr.",
  dateLabel: "Rechnungsdatum",
  taxIdLabel: "USt-IdNr.",
  subtotalLabel: "Nettobetrag",
  taxLabel: "MwSt. Betrag",
  taxPctLabel: "MwSt",
  totalLabel: "Gesamtbetrag",
  currency: "€",
  providers: [
    "Schmidt & Partner GmbH", "Müller Maschinenbau AG", "Becker IT-Lösungen",
    "Fischer Elektrotechnik", "Weber Logistik GmbH", "Wagner Consulting",
    "Koch Bauunternehmen", "Hoffmann Rechtsanwälte", "Schäfer Druckerei",
    "Bauer Landtechnik AG", "Richter Software GmbH", "Klein Metallverarbeitung",
    "Wolf Energietechnik", "Neumann Handels GmbH", "Braun Medizintechnik",
  ],
  taxIdFormat: () => "DE" + randDigits(9),
  dateFormat: (d: Date) => {
    const months = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
    return `${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`;
  },
  euFormat: true,
  taxRate: 19,
};

const DUTCH: LangTemplate = {
  lang: "nl",
  invoiceLabel: "Factuurnummer",
  dateLabel: "Factuurdatum",
  taxIdLabel: "BTW-nummer",
  subtotalLabel: "Subtotaal",
  taxLabel: "BTW bedrag",
  taxPctLabel: "BTW",
  totalLabel: "Totaal",
  currency: "€",
  providers: [
    "Van den Berg Techniek B.V.", "De Vries Consulting", "Jansen & Zonen Bouw",
    "Bakker Transport B.V.", "Visser ICT Solutions", "Smit Handel B.V.",
    "Meijer Administratie", "De Boer Installaties", "Hendriks Machines",
    "Dekker Elektra B.V.", "Van Dijk Architecten", "Mulder Catering",
    "Bos & Partners Advocaten", "Vos Drukwerk B.V.", "Peters Groentechniek",
  ],
  taxIdFormat: () => "NL" + randDigits(9) + "B" + randDigits(2),
  dateFormat: (d: Date) => {
    const months = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  },
  euFormat: true,
  taxRate: 21,
};

const ARABIC: LangTemplate = {
  lang: "ar",
  invoiceLabel: "رقم الفاتورة",
  dateLabel: "التاريخ",
  taxIdLabel: "الرقم الضريبي",
  subtotalLabel: "المبلغ قبل الضريبة",
  taxLabel: "ضريبة القيمة المضافة",
  taxPctLabel: "ض.ق.م",
  totalLabel: "المبلغ الإجمالي",
  currency: "ر.س",
  providers: [
    "شركة الراجحي للتجارة", "مؤسسة النور للمقاولات", "شركة الفيصل للتقنية",
    "مجموعة السعودية للخدمات", "شركة الأمان للاستشارات", "مؤسسة الرياض التجارية",
    "شركة جدة للصناعات", "مؤسسة الخليج للنقل", "شركة المدينة للبناء",
    "مجموعة الشرق للتوريدات", "شركة الدمام للطاقة", "مؤسسة مكة للأغذية",
    "شركة تبوك للتعدين", "مؤسسة أبها للسياحة", "شركة الباحة للزراعة",
  ],
  taxIdFormat: () => "3" + randDigits(13) + "3",
  dateFormat: fmtDateEU,
  euFormat: false,
  taxRate: 15,
};

const PERSIAN: LangTemplate = {
  lang: "fa",
  invoiceLabel: "شماره فاکتور",
  dateLabel: "تاریخ",
  taxIdLabel: "شناسه ملی",
  subtotalLabel: "جمع بدون مالیات",
  taxLabel: "مالیات ارزش افزوده",
  taxPctLabel: "مالیات",
  totalLabel: "جمع کل",
  currency: "ریال",
  providers: [
    "شرکت فناوری اطلاعات نوین", "گروه صنعتی بهمن", "شرکت ساختمانی آبادگران",
    "مجتمع تجاری ایرانیان", "شرکت حمل و نقل سپهر", "موسسه مشاوره‌ای پارس",
    "شرکت تولیدی البرز", "کارگاه هنری اصفهان", "شرکت کشاورزی سبز دشت",
    "گروه خودروسازی سایپا", "شرکت داروسازی تهران", "مجتمع فولاد خوزستان",
    "شرکت بیمه آسیا", "موسسه آموزشی دانش", "شرکت نفت و گاز پارسیان",
  ],
  taxIdFormat: () => randDigits(11),
  dateFormat: (d: Date) => {
    // Simplified Jalali approximation (not accurate, just for testing)
    const jYear = d.getFullYear() - 621;
    const months = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
    return `${d.getDate()} ${months[d.getMonth()]} ${jYear}`;
  },
  euFormat: false,
  taxRate: 9,
};

const HEBREW: LangTemplate = {
  lang: "he",
  invoiceLabel: "מספר חשבונית",
  dateLabel: "תאריך",
  taxIdLabel: "ע.מ",
  subtotalLabel: 'סכום לפני מע"מ',
  taxLabel: 'סכום מע"מ',
  taxPctLabel: 'מע"מ',
  totalLabel: 'סה"כ לתשלום',
  currency: "₪",
  providers: [
    "טכנולוגיות מתקדמות בע\"מ", "שירותי ייעוץ כהן", "תעשיות לוי בע\"מ",
    "משרד עורכי דין גולדברג", "חברת הובלות ישראלי", "פתרונות תוכנה שלום",
    "קבוצת השקעות דוד", "אדריכלות מזרחי", "מעבדות רפואיות אברהם",
    "חברת בנייה יצחק", "שירותי חשמל משה", "ייבוא ויצוא אריה",
    "חברת ביטוח שמעון", "מסעדות רחל בע\"מ", "תקשורת יעקב בע\"מ",
  ],
  taxIdFormat: () => randDigits(9),
  dateFormat: fmtDateEU,
  euFormat: false,
  taxRate: 17,
};

const RTL_LANGS = new Set(["ar", "fa", "he"]);

/** Windows system font that supports Arabic, Hebrew, and Persian glyphs */
const TAHOMA_PATH = "C:/Windows/Fonts/tahoma.ttf";
const TAHOMA_BOLD_PATH = "C:/Windows/Fonts/tahomabd.ttf";

const ALL_LANGS: LangTemplate[] = [SPANISH, ENGLISH, FRENCH, GERMAN, DUTCH, ARABIC, PERSIAN, HEBREW];

// ── PDF generation ───────────────────────────────────────────────────────────

function generateInvoicePDF(template: LangTemplate, index: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, compress: false });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const isRTL = RTL_LANGS.has(template.lang);

    // Register Tahoma for RTL languages (supports Arabic, Hebrew, Persian)
    if (isRTL) {
      doc.registerFont("Tahoma", TAHOMA_PATH);
      doc.registerFont("Tahoma-Bold", TAHOMA_BOLD_PATH);
      doc.font("Tahoma");
    }

    const provider = pick(template.providers);
    const invoiceNum = `${template.lang.toUpperCase()}-${String(index).padStart(6, "0")}`;
    const date = randomDate();
    const taxId = template.taxIdFormat();
    const subtotal = parseFloat((Math.random() * 9900 + 100).toFixed(2));
    const taxAmount = parseFloat((subtotal * template.taxRate / 100).toFixed(2));
    const total = parseFloat((subtotal + taxAmount).toFixed(2));

    // Add line items count for variety
    const lineItemCount = rand(1, 8);

    // For RTL: write each labeled field on its own line so pdf-parse can extract text in order
    // PDFKit doesn't do bidi reordering, so we write label + value as separate text calls

    // Header: provider name
    if (isRTL) doc.font("Tahoma-Bold");
    doc.fontSize(16).text(provider, { align: "left" });
    if (isRTL) doc.font("Tahoma");
    doc.moveDown(0.5);

    // Tax ID line
    doc.fontSize(10).text(`${template.taxIdLabel}: ${taxId}`);
    doc.moveDown(1.5);

    // Invoice title
    if (isRTL) doc.font("Tahoma-Bold");
    doc.fontSize(14).text(`${template.invoiceLabel}: ${invoiceNum}`, { align: "left" });
    if (isRTL) doc.font("Tahoma");
    doc.moveDown(0.3);
    doc.fontSize(10).text(`${template.dateLabel}: ${template.dateFormat(date)}`);
    doc.moveDown(1.5);

    // Line items table header
    const itemLabels: Record<string, [string, string, string, string]> = {
      es: ["Descripción", "Cantidad", "Precio", "Importe"],
      en: ["Description", "Qty", "Price", "Amount"],
      fr: ["Désignation", "Qté", "Prix", "Montant"],
      de: ["Beschreibung", "Menge", "Preis", "Betrag"],
      nl: ["Omschrijving", "Aantal", "Prijs", "Bedrag"],
      ar: ["الوصف", "الكمية", "السعر", "المبلغ"],
      fa: ["شرح", "تعداد", "قیمت", "مبلغ"],
      he: ["תיאור", "כמות", "מחיר", "סכום"],
    };

    const labels = itemLabels[template.lang] || itemLabels["en"];
    doc.fontSize(9).text(`${labels[0]}                              ${labels[1]}    ${labels[2]}       ${labels[3]}`);
    doc.text("─".repeat(70));

    // Generate line items that sum to subtotal
    let remaining = subtotal;
    for (let i = 0; i < lineItemCount; i++) {
      const isLast = i === lineItemCount - 1;
      const fraction = (Math.random() * 0.5 + 0.1) / (lineItemCount - i);
      const lineAmount = isLast ? remaining : parseFloat(Math.max(0.01, remaining * fraction).toFixed(2));
      remaining = parseFloat(Math.max(0, remaining - lineAmount).toFixed(2));
      const qty = rand(1, 10);
      const unitPrice = parseFloat((lineAmount / qty).toFixed(2));
      const itemNames: string[] = {
        es: ["Servicio profesional", "Consultoría", "Material de oficina", "Licencia software", "Mantenimiento", "Diseño gráfico", "Desarrollo web", "Auditoría"],
        en: ["Professional service", "Consulting", "Office supplies", "Software license", "Maintenance", "Graphic design", "Web development", "Audit"],
        fr: ["Service professionnel", "Conseil", "Fournitures", "Licence logiciel", "Maintenance", "Design graphique", "Développement web", "Audit"],
        de: ["Dienstleistung", "Beratung", "Büromaterial", "Softwarelizenz", "Wartung", "Grafikdesign", "Webentwicklung", "Prüfung"],
        nl: ["Dienstverlening", "Advies", "Kantoorbenodigdheden", "Softwarelicentie", "Onderhoud", "Grafisch ontwerp", "Webontwikkeling", "Audit"],
        ar: ["خدمة مهنية", "استشارات", "مستلزمات مكتبية", "ترخيص برمجي", "صيانة", "تصميم", "تطوير مواقع", "مراجعة"],
        fa: ["خدمات حرفه‌ای", "مشاوره", "لوازم اداری", "مجوز نرم‌افزار", "نگهداری", "طراحی", "توسعه وب", "حسابرسی"],
        he: ["שירות מקצועי", "ייעוץ", "ציוד משרדי", "רישיון תוכנה", "תחזוקה", "עיצוב גרפי", "פיתוח אתרים", "ביקורת"],
      }[template.lang] || ["Service", "Consulting", "Supplies", "License", "Maintenance", "Design", "Development", "Audit"];

      doc.text(`${pick(itemNames)}                         ${qty}      ${fmtAmount(unitPrice, template.euFormat)}    ${fmtAmount(lineAmount, template.euFormat)}`);
    }

    doc.moveDown(1);
    doc.text("─".repeat(70));
    doc.moveDown(0.5);

    // Totals
    doc.fontSize(10);
    doc.text(`${template.subtotalLabel}: ${template.currency} ${fmtAmount(subtotal, template.euFormat)}`);
    doc.text(`${template.taxPctLabel} ${template.taxRate}%: ${template.currency} ${fmtAmount(taxAmount, template.euFormat)}`);
    doc.moveDown(0.3);
    if (isRTL) doc.font("Tahoma-Bold");
    doc.fontSize(12).text(`${template.totalLabel}: ${template.currency} ${fmtAmount(total, template.euFormat)}`);

    doc.end();
  });
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`Generating ${TOTAL_COUNT} test invoices in ${OUTPUT_DIR}...`);

  // Distribute across languages: equal split + remainder to Spanish
  const perLang = Math.floor(TOTAL_COUNT / ALL_LANGS.length);
  const langCounts = ALL_LANGS.map((_, i) => perLang + (i === 0 ? TOTAL_COUNT % ALL_LANGS.length : 0));

  let generated = 0;
  const BATCH_SIZE = 100;

  for (let li = 0; li < ALL_LANGS.length; li++) {
    const template = ALL_LANGS[li];
    const count = langCounts[li];
    console.log(`  [${template.lang}] generating ${count} invoices...`);

    for (let start = 0; start < count; start += BATCH_SIZE) {
      const batchEnd = Math.min(start + BATCH_SIZE, count);
      const promises: Promise<void>[] = [];

      for (let i = start; i < batchEnd; i++) {
        const globalIdx = generated + i;
        const filename = `invoice_${template.lang}_${String(i + 1).padStart(5, "0")}.pdf`;
        const filepath = path.join(OUTPUT_DIR, filename);

        promises.push(
          generateInvoicePDF(template, globalIdx).then((buf) => {
            fs.writeFileSync(filepath, buf);
          })
        );
      }

      await Promise.all(promises);

      if (batchEnd % 500 === 0 || batchEnd === count) {
        process.stdout.write(`\r  [${template.lang}] ${batchEnd}/${count}`);
      }
    }

    generated += count;
    console.log(` ✓`);
  }

  console.log(`\nDone! Generated ${generated} invoices in ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
