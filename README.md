# Factura Reader

Aplicacion web para leer facturas en PDF o Excel y extraer automaticamente los datos clave (emisor, CIF/NIF, base imponible, IVA, total) a una tabla editable que se puede exportar a Excel.

## Caracteristicas

- **Carga masiva** — Arrastra hasta 50 archivos PDF o Excel a la vez
- **Extraccion automatica** — Detecta numero de factura, fecha, CIF/NIF, base imponible, IVA y total mediante patrones regex
- **Edicion en linea** — Corrige cualquier campo directamente en la tabla antes de exportar
- **Importacion de Excel existente** — Carga un Excel con facturas previas y continua agregando
- **Exportacion a Excel** — Genera un archivo .xlsx formateado con cabeceras, colores alternos y filtros
- **Procesamiento local** — Los archivos se procesan en tu servidor, no se envian a terceros

## Tech Stack

| Capa | Tecnologia |
|------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, TypeScript |
| Backend | Express.js, TypeScript |
| PDF | pdf-parse |
| Excel | ExcelJS |

## Inicio rapido

```bash
# 1. Clonar el repo
git clone https://github.com/ZabaHD4K/factura-reader.git
cd factura-reader

# 2. Instalar dependencias
npm run install:all

# 3. Levantar cliente y servidor
npm run dev
```

El cliente arranca en `http://localhost:3000` y el servidor en `http://localhost:3001`.

## Scripts disponibles

| Comando | Descripcion |
|---------|-------------|
| `npm run dev` | Arranca cliente y servidor en paralelo |
| `npm run dev:client` | Solo el frontend (Next.js, puerto 3000) |
| `npm run dev:server` | Solo el backend (Express, puerto 3001) |
| `npm run install:all` | Instala dependencias de ambos paquetes |

## Variables de entorno

| Variable | Default | Descripcion |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | URL del backend para el cliente |
| `PORT` | `3001` | Puerto del servidor Express |

## API

### `POST /api/invoices/parse`

Recibe archivos PDF/Excel via multipart form data y devuelve los datos extraidos.

```json
{
  "data": [
    {
      "archivo": "factura_001.pdf",
      "emisor": "Empresa S.L.",
      "numeroFactura": "F-2024-001",
      "fecha": "15/01/2024",
      "cifNif": "B12345678",
      "baseImponible": "1000.00",
      "ivaPorcentaje": "21",
      "ivaImporte": "210.00",
      "total": "1210.00"
    }
  ]
}
```

### `POST /api/invoices/export`

Recibe un array de registros y devuelve un archivo `.xlsx`.

### `GET /api/health`

Health check — devuelve `{ "status": "ok" }`.

## Estructura del proyecto

```
factura-reader/
├── client/          # Frontend Next.js
│   └── app/
│       └── page.tsx # Interfaz principal (upload, tabla, export)
├── server/          # Backend Express
│   └── src/
│       ├── index.ts
│       ├── routes/
│       │   └── invoices.ts
│       └── services/
│           ├── pdfParser.ts      # Extraccion de campos de PDFs
│           ├── excelParser.ts    # Lectura de Excel con mapeo flexible de cabeceras
│           └── excelExporter.ts  # Generacion de Excel formateado
└── test-invoices/   # PDFs de ejemplo para pruebas manuales
```

## Licencia

MIT
