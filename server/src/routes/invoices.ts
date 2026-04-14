import { Router } from "express";
import multer from "multer";
import { parseInvoice, InvoiceData } from "../services/pdfParser";
import { generateExcel } from "../services/excelExporter";
import { parseExcel } from "../services/excelParser";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// POST /api/invoices/parse — recibe PDFs y/o Excel y devuelve los datos extraídos
router.post("/parse", (req, res, next) => {
  upload.array("files", 50)(req, res, (err) => {
    if (err) {
      const msg = err instanceof multer.MulterError
        ? `Multer: ${err.message} (max 50 archivos, 20MB cada uno)`
        : err.message;
      res.status(400).json({ error: msg });
      return;
    }
    next();
  });
}, async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: "No se recibieron archivos" });
      return;
    }

    const pdfs = files.filter((f) => f.originalname.toLowerCase().endsWith(".pdf"));
    const excels = files.filter((f) =>
      f.originalname.toLowerCase().endsWith(".xlsx") || f.originalname.toLowerCase().endsWith(".xls")
    );

    const results: InvoiceData[] = [];

    // Parsear PDFs en lotes de 10 para limitar uso de memoria
    const PDF_BATCH = 10;
    for (let i = 0; i < pdfs.length; i += PDF_BATCH) {
      const batch = pdfs.slice(i, i + PDF_BATCH);
      const batchResults = await Promise.all(
        batch.map((f) => parseInvoice(f.buffer, f.originalname))
      );
      results.push(...batchResults);
    }

    // Parsear Excels
    for (const excel of excels) {
      const excelRows = await parseExcel(excel.buffer);
      results.push(...excelRows);
    }

    res.json({ data: results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/invoices/export — recibe datos JSON y devuelve un Excel
router.post("/export", async (req, res) => {
  try {
    const records: InvoiceData[] = req.body.records;
    if (!records || records.length === 0) {
      res.status(400).json({ error: "No hay datos para exportar" });
      return;
    }

    const buffer = await generateExcel(records);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=facturas_${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
