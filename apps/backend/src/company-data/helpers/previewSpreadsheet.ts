import { readSpreadsheet } from './readSpreadsheet';
import { inferColumnType } from './inferColumnType';
import { CellValue } from './dataTypes';

const sampleText = (v: CellValue) => (v === null ? null : String(v));

/** O que o ficheiro tem, antes de gravar: os cabeçalhos, o tipo que parecem ter e as primeiras linhas. */
export function previewSpreadsheet(file: { buffer: Buffer; size: number; originalname: string }) {
  const sheet = readSpreadsheet(file);
  const dataRows = sheet.totalsRowDetected ? sheet.rows.slice(0, -1) : sheet.rows;

  return {
    fileName: file.originalname,
    headers: sheet.headers,
    columns: sheet.headers.map((header, i) => {
      const values = dataRows.map((row) => row[i]);
      return {
        header,
        type: inferColumnType(header, values),
        samples: values
          .map(sampleText)
          .filter((v): v is string => v !== null)
          .slice(0, 3),
      };
    }),
    rows: sheet.rows.slice(0, 20),
    totalRows: sheet.rows.length,
    totalsRowDetected: sheet.totalsRowDetected,
  };
}
