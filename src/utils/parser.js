import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const HEADER_FIELDS = [
  'ORDER_TYPE', 'SALES_ORG', 'SOLD_TO_PARTY', 'SHIP_TO_PARTY',
  'PO_NO', 'PURCHASE_ORDER_DATE', 'REQ_DELIVERY_DATE',
  'INCOTERM', 'INCOTERM2', 'ALT_TAX_CLASSF',
  'CUSTOMER_GROUP', 'PAYER', 'SPECIAL_STOCK_PARTNER',
];

function emptyHeader() {
  const obj = {};
  HEADER_FIELDS.forEach((f) => (obj[f] = ''));
  return obj;
}

export async function parseFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'xlsx') return parseExcel(file);
  if (ext === 'pdf') return parsePdf(file);
  if (ext === 'docx') return parseDocx(file);
  if (ext === 'txt') return parseTxt(file);

  throw new Error('Unsupported file type: .' + ext);
}

// ---- Excel ----
async function parseExcel(file) {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const header = emptyHeader();
  const items = [];

  rows.forEach((row) => {
    HEADER_FIELDS.forEach((f) => {
      if (row[f] !== undefined && row[f] !== '' && header[f] === '') {
        header[f] = row[f];
      }
    });
    items.push({
      MATERIAL_NUMBER: row['MATERIAL_NUMBER'] || row['Material Code'] || '',
      QUANTITY: row['QUANTITY'] || row['Qty'] || '',
      DELIVERY_DATE: row['DELIVERY_DATE'] || row['Delivery Date'] || '',
      PLANT: row['PLANT'] || '',
      SALES_UNIT: row['SALES_UNIT'] || row['UOM'] || '',
    });
  });

  return { header, items };
}

// ---- PDF (table-based PO format) ----
async function parsePdf(file) {
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item) => item.str).join(' ') + '\n';
  }
  return extractPoFromText(text);
}

// ---- Word ----
async function parseDocx(file) {
  const data = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: data });
  return extractPoFromText(result.value);
}

// ---- Text ----
async function parseTxt(file) {
  const text = await readTextFile(file);
  return extractPoFromText(text);
}

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// Parses header fields + repeating material line-items from PO text
function extractPoFromText(text) {
  const header = emptyHeader();

  const poMatch = text.match(/Purchase Order No\.?\s*([A-Z0-9]+)/i);
  if (poMatch) header.PO_NO = poMatch[1];

  const dateMatch = text.match(/P\.?O\.?\s*Date\s*([\d-]+)/i);
  if (dateMatch) header.PURCHASE_ORDER_DATE = dateMatch[1];

  const soldToMatch = text.match(/Sold To Party\s+(.+?)(?=Ship To Party|Buyer|$)/i);
  if (soldToMatch) header.SOLD_TO_PARTY = soldToMatch[1].trim();

  const shipToMatch = text.match(/Ship To Party\s+(.+?)(?=Buyer|$)/i);
  if (shipToMatch) header.SHIP_TO_PARTY = shipToMatch[1].trim();

  // Line item row pattern: SrNo, MaterialCode, Description, Qty, UOM, Price, Date(DD-MM-YYYY)
  const rowRegex = /(\d+)\s+([A-Z0-9]{3,})\s+(.+?)\s+(\d+)\s+(Kilogram|KG|kg|Nos|PCS)\s+([\d.]+)\s+(\d{2}-\d{2}-\d{4})/g;
  const items = [];
  let match;
  while ((match = rowRegex.exec(text)) !== null) {
    items.push({
      MATERIAL_NUMBER: match[2],
      QUANTITY: match[4],
      SALES_UNIT: match[5],
      DELIVERY_DATE: match[7],
    });
  }

  return { header, items };
}