import * as XLSX from 'xlsx';
import mammoth from 'mammoth';

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

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

// ---- AI Extraction using Groq ----
async function extractWithGroq(text) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: `Extract order data from the following document text and return ONLY a valid JSON object with these exact keys. If a value is not found, use empty string "".

Keys to extract:
- ORDER_TYPE (usually ZDOM or ZEXP)
- SALES_ORG (sales organization code)
- SOLD_TO_PARTY (customer/buyer code or name)
- SHIP_TO_PARTY (delivery address or code)
- PO_NO (Purchase Order Number)
- PURCHASE_ORDER_DATE (format DD-MM-YYYY)
- REQ_DELIVERY_DATE (required delivery date, format DD-MM-YYYY)
- INCOTERM (shipping terms like FOB, CIF etc)
- INCOTERM2 (secondary incoterm if present)
- ALT_TAX_CLASSF (tax classification)
- CUSTOMER_GROUP
- PAYER (payer code)
- SPECIAL_STOCK_PARTNER
- MATERIAL_NUMBER (product/material code, can be multiple - return as array)
- QUANTITY (numeric value only, can be multiple - return as array)
- SALES_UNIT (KG, Nos, PCS etc, can be multiple - return as array)
- DELIVERY_DATE (format DD-MM-YYYY, can be multiple - return as array)
- PLANT (plant code)
- CONDITION_TYPE_1
- AMOUNT_1
- CONDITION_TYPE_2
- AMOUNT_2

IMPORTANT: Return ONLY the JSON object, no explanation, no markdown, no code blocks.

Document text:
${text}`
        }
      ]
    })
  });

  const data = await response.json();
  
  if (!data.choices || !data.choices[0]) {
    throw new Error('Groq API error: ' + JSON.stringify(data));
  }

  const raw = data.choices[0].message.content.trim();
  
  // Clean any markdown if present
  const cleaned = raw.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(cleaned);

  const header = {
    ORDER_TYPE: parsed.ORDER_TYPE || '',
    SALES_ORG: parsed.SALES_ORG || '',
    SOLD_TO_PARTY: parsed.SOLD_TO_PARTY || '',
    SHIP_TO_PARTY: parsed.SHIP_TO_PARTY || '',
    PO_NO: parsed.PO_NO || '',
    PURCHASE_ORDER_DATE: parsed.PURCHASE_ORDER_DATE || '',
    REQ_DELIVERY_DATE: parsed.REQ_DELIVERY_DATE || '',
    INCOTERM: parsed.INCOTERM || '',
    INCOTERM2: parsed.INCOTERM2 || '',
    ALT_TAX_CLASSF: parsed.ALT_TAX_CLASSF || '',
    CUSTOMER_GROUP: parsed.CUSTOMER_GROUP || '',
    PAYER: parsed.PAYER || '',
    SPECIAL_STOCK_PARTNER: parsed.SPECIAL_STOCK_PARTNER || '',
  };

  // Handle multiple items (arrays)
  const materialNumbers = Array.isArray(parsed.MATERIAL_NUMBER) 
    ? parsed.MATERIAL_NUMBER 
    : [parsed.MATERIAL_NUMBER || ''];
  
  const quantities = Array.isArray(parsed.QUANTITY)
    ? parsed.QUANTITY
    : [parsed.QUANTITY || ''];
  
  const salesUnits = Array.isArray(parsed.SALES_UNIT)
    ? parsed.SALES_UNIT
    : [parsed.SALES_UNIT || ''];
  
  const deliveryDates = Array.isArray(parsed.DELIVERY_DATE)
    ? parsed.DELIVERY_DATE
    : [parsed.DELIVERY_DATE || ''];

  const items = materialNumbers.map((mat, i) => ({
    MATERIAL_NUMBER: mat || '',
    QUANTITY: quantities[i] || '',
    SALES_UNIT: salesUnits[i] || '',
    DELIVERY_DATE: deliveryDates[i] || '',
    PLANT: parsed.PLANT || '',
    CONDITION_TYPE_1: parsed.CONDITION_TYPE_1 || '',
    AMOUNT_1: parsed.AMOUNT_1 || '',
    CONDITION_TYPE_2: parsed.CONDITION_TYPE_2 || '',
    AMOUNT_2: parsed.AMOUNT_2 || '',
  }));

  return { header, items };
}

// ---- PDF ----
async function parsePdf(file) {
  const data = await file.arrayBuffer();

  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById('pdfjs-script');
    if (existingScript) existingScript.remove();

    const script = document.createElement('script');
    script.id = 'pdfjs-script';
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';

    script.onload = async () => {
      try {
        const pdfjsLib = window['pdfjs-dist/build/pdf'];
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        const pdf = await pdfjsLib.getDocument({ data }).promise;
        let text = '';

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map((item) => item.str).join(' ') + '\n';
        }

        resolve(await extractWithGroq(text));
      } catch (err) {
        reject(err);
      }
    };

    script.onerror = () => reject(new Error('Failed to load PDF.js'));
    document.head.appendChild(script);
  });
}

// ---- Word ----
async function parseDocx(file) {
  const data = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: data });
  return extractWithGroq(result.value);
}

// ---- Text ----
async function parseTxt(file) {
  const text = await readTextFile(file);
  return extractWithGroq(text);
}

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}