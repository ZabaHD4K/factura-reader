"use client";

import { useState, useCallback, useRef } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface InvoiceData {
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

const COLUMNS = [
  { key: "archivo", label: "Archivo" },
  { key: "emisor", label: "Emisor" },
  { key: "numeroFactura", label: "Nº Factura" },
  { key: "fecha", label: "Fecha" },
  { key: "cifNif", label: "CIF / NIF" },
  { key: "baseImponible", label: "Base Imp." },
  { key: "ivaPorcentaje", label: "IVA %" },
  { key: "ivaImporte", label: "IVA Imp." },
  { key: "total", label: "Total" },
];

export default function Home() {
  const [records, setRecords] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const validExts = [".pdf", ".xlsx", ".xls"];
    const valid = Array.from(files).filter((f) =>
      validExts.some((ext) => f.name.toLowerCase().endsWith(ext))
    );
    if (valid.length === 0) {
      setError("No se encontraron archivos PDF o Excel");
      return;
    }

    setLoading(true);
    setError(null);
    setProgress(0);

    const formData = new FormData();
    valid.forEach((f) => formData.append("files", f));

    try {
      setProgress(30);
      const res = await fetch(`${API_URL}/api/invoices/parse`, {
        method: "POST",
        body: formData,
      });

      setProgress(80);

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `Error ${res.status}`);
      }

      const { data } = await res.json();
      setRecords((prev) => [...prev, ...data]);
      setProgress(100);
    } catch (err: any) {
      setError(err.message || "Error al procesar las facturas");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        uploadFiles(e.dataTransfer.files);
      }
    },
    [uploadFiles]
  );

  const handleExport = async () => {
    try {
      const res = await fetch(`${API_URL}/api/invoices/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records }),
      });

      if (!res.ok) throw new Error("Error al generar el Excel");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `facturas_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleClear = () => {
    setRecords([]);
    setError(null);
    setProgress(0);
  };

  const handleEdit = (rowIdx: number, key: string, value: string) => {
    setRecords((prev) =>
      prev.map((r, i) => (i === rowIdx ? { ...r, [key]: value } : r))
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-lg font-bold">
              F
            </div>
            <h1 className="text-xl font-bold tracking-tight">Factura Reader</h1>
          </div>

          <div className="flex items-center gap-3">
            {records.length > 0 && (
              <>
                <button
                  onClick={handleClear}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Limpiar
                </button>
                <button
                  onClick={handleExport}
                  className="px-5 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-900/30 cursor-pointer"
                >
                  Exportar a Excel
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {/* Error toast */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/50 border border-red-800 text-red-300 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200 cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {/* Drop zone */}
        <div
          className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 ${
            dragOver
              ? "border-blue-500 bg-blue-500/5"
              : "border-slate-700 hover:border-slate-500 bg-slate-900/40"
          } ${records.length > 0 ? "p-6" : "p-16"}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <div className={`flex flex-col items-center ${records.length > 0 ? "gap-2" : "gap-4"}`}>
            {records.length === 0 && (
              <div className="w-20 h-20 rounded-2xl bg-slate-800 flex items-center justify-center mb-2">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              </div>
            )}

            <p className={`font-semibold text-slate-200 ${records.length > 0 ? "text-base" : "text-xl"}`}>
              {records.length > 0 ? "Arrastra mas facturas o un Excel existente" : "Arrastra tus facturas aqui"}
            </p>

            {records.length === 0 && (
              <p className="text-slate-400 text-sm">Archivos PDF o Excel (.xlsx) con facturas</p>
            )}

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="px-6 py-2.5 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors shadow-lg shadow-blue-900/30 cursor-pointer"
            >
              {loading ? "Procesando..." : "Seleccionar archivos"}
            </button>
          </div>

          {/* Progress bar */}
          {loading && (
            <div className="mt-4 max-w-md mx-auto">
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        {records.length > 0 && (
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Facturas" value={records.length.toString()} color="blue" />
            <StatCard
              label="Con datos completos"
              value={records.filter((r) => r.total && r.numeroFactura).length.toString()}
              color="emerald"
            />
            <StatCard
              label="Sin texto"
              value={records.filter((r) => r.emisor.includes("Sin texto")).length.toString()}
              color="amber"
            />
            <StatCard
              label="Con errores"
              value={records.filter((r) => r.emisor.startsWith("Error")).length.toString()}
              color="red"
            />
          </div>
        )}

        {/* Table */}
        {records.length > 0 && (
          <div className="mt-6 rounded-xl border border-slate-800 overflow-hidden bg-slate-900/60">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-800/80">
                    {COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap"
                      >
                        {col.label}
                      </th>
                    ))}
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record, rowIdx) => (
                    <tr
                      key={rowIdx}
                      className={`border-t border-slate-800/60 hover:bg-slate-800/40 transition-colors ${
                        rowIdx % 2 === 1 ? "bg-slate-800/20" : ""
                      }`}
                    >
                      {COLUMNS.map((col) => (
                        <td key={col.key} className="px-4 py-3">
                          <input
                            type="text"
                            value={(record as any)[col.key] || ""}
                            onChange={(e) => handleEdit(rowIdx, col.key, e.target.value)}
                            className="w-full bg-transparent text-slate-200 text-sm outline-none focus:ring-1 focus:ring-blue-500/50 rounded px-1 -mx-1 py-0.5"
                            title="Haz clic para editar"
                          />
                        </td>
                      ))}
                      <td className="px-2 py-3">
                        <button
                          onClick={() => setRecords((prev) => prev.filter((_, i) => i !== rowIdx))}
                          className="text-slate-600 hover:text-red-400 transition-colors cursor-pointer"
                          title="Eliminar fila"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-4">
        <p className="text-center text-xs text-slate-500">
          Factura Reader — Los datos se procesan localmente en tu servidor
        </p>
      </footer>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: "from-blue-500/10 to-blue-600/5 border-blue-800/50 text-blue-400",
    emerald: "from-emerald-500/10 to-emerald-600/5 border-emerald-800/50 text-emerald-400",
    amber: "from-amber-500/10 to-amber-600/5 border-amber-800/50 text-amber-400",
    red: "from-red-500/10 to-red-600/5 border-red-800/50 text-red-400",
  };

  return (
    <div className={`rounded-xl bg-gradient-to-br border p-4 ${colorMap[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
    </div>
  );
}
