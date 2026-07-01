import * as XLSX from 'xlsx';
import mammoth from 'mammoth';

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

const safeStr = (val) => (val != null ? String(val) : '');

export async function parseFile(file) {
  if (!file || typeof file.name !== 'string') {
    throw new Error('Invalid file object.');
  }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'xlsx' || ext === 'xls') return parseExcel(file);
  if (ext === 'pdf') return parsePdf(file);
  if (ext === 'docx') return parseDocx(file);
  if (ext === 'txt') return parseTxt(file);
  throw new Error('Unsupported file type: .' + ext);
}

// ---- Format date: handles JS Date objects + "DD.MM.YYYY" / "DD/MM/YYYY" strings ----
function formatDate(val) {
  if (!val) return '';
  if (val instanceof Date && !isNaN(val)) {
    const dd = String(val.getDate()).padStart(2, '0');
    const mm = String(val.getMonth() + 1).padStart(2, '0');
    return `${dd}-${mm}-${val.getFullYear()}`;
  }
  const s = safeStr(val).trim();
  if (!s) return '';
  return s.replace(/[./]/g, '-');
}

// ---- Excel: read every row directly — NO Groq (Groq collapses rows) ----
async function parseExcel(file) {
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    // Find header row — look for row containing 'grade' or 'material'
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
      const rowLower = rawRows[i].map(c => safeStr(c).toLowerCase().trim());
      if (rowLower.some(c => c === 'grade' || c === 'material' || c === 'material number')) {
        headerRowIndex = i;
        break;
      }
    }

    // No recognizable header → fall back to Groq (for PO-style Excel)
    if (headerRowIndex === -1) {
      const tableText = rawRows
        .filter(row => row.some(c => safeStr(c).trim() !== ''))
        .map(row => row.map(cell => {
          if (cell instanceof Date && !isNaN(cell)) return formatDate(cell);
          return safeStr(cell).trim();
        }).join('\t'))
        .join('\n');
      return await extractWithGroq(tableText, 'excel');
    }

    const headers = rawRows[headerRowIndex].map(c => safeStr(c).toLowerCase().trim());

    // Get value from row by matching any of the given keywords against headers
    const col = (row, ...keys) => {
      for (const key of keys) {
        const idx = headers.findIndex(h => h.includes(key));
        if (idx !== -1) {
          const val = row[idx];
          if (val !== undefined && val !== null && safeStr(val).trim() !== '') {
            return val;
          }
        }
      }
      return '';
    };

    const dataRows = rawRows.slice(headerRowIndex + 1);

    // Auto-detect plant (most common non-empty supplying plant value)
    const plantCounts = {};
    dataRows.forEach(row => {
      const p = safeStr(col(row, 'supplying plant', 'plant')).trim();
      if (p) plantCounts[p] = (plantCounts[p] || 0) + 1;
    });
    const plant = Object.keys(plantCounts).sort((a, b) => plantCounts[b] - plantCounts[a])[0] || '';

    // Auto-detect delivery location (most common non-empty value)
    const locationCounts = {};
    dataRows.forEach(row => {
      const l = safeStr(col(row, 'delivery location', 'location', 'destination')).trim();
      if (l) locationCounts[l] = (locationCounts[l] || 0) + 1;
    });
    const location = Object.keys(locationCounts).sort((a, b) => locationCounts[b] - locationCounts[a])[0] || '';

    // Extract every valid data row — one output item per row
    const items = dataRows
      .filter(row => {
        const grade = safeStr(col(row, 'grade', 'material number', 'material')).trim();
        const delivDate = col(row, 'delivery schedule', 'delivery date', 'dispatch schedule');
        const qty = safeStr(col(row, 'schedule qty', 'quantity', 'qty', 'schedule quantity')).trim();
        if (!grade || !delivDate) return false;
        const qtyNum = parseFloat(qty);
        if (isNaN(qtyNum) || qtyNum <= 0) return false;
        return true;
      })
      .map(row => {
        const grade = safeStr(col(row, 'grade', 'material number', 'material')).trim();
        const pack  = safeStr(col(row, 'pack', 'packing', 'pack type')).trim();
        const qty   = safeStr(col(row, 'schedule qty', 'quantity', 'qty', 'schedule quantity')).trim();
        const delivDate = formatDate(col(row, 'delivery schedule', 'delivery date'));
        const amount = safeStr(col(row, 'amount', 'price', 'basic price', 'rate')).trim();

        return {
          MATERIAL_NUMBER:  pack ? `${grade} ${pack}` : grade,
          QUANTITY:         qty,
          SALES_UNIT:       'MT',
          DELIVERY_DATE:    delivDate,
          AMOUNT_1:         amount,
          CONDITION_TYPE_1: '',
          CONDITION_TYPE_2: '',
          AMOUNT_2:         '',
        };
      });

    // Pass location name as-is — processor.js PARTY_MAP will convert to codes
    const header = {
      ORDER_TYPE:            'ZDOM',
      SALES_ORG:             plant,
      SOLD_TO_PARTY:         location,
      SHIP_TO_PARTY:         location,
      PO_NO:                 '',
      PURCHASE_ORDER_DATE:   '',
      REQ_DELIVERY_DATE:     '',
      INCOTERM:              '',
      INCOTERM2:             '',
      ALT_TAX_CLASSF:        '',
      CUSTOMER_GROUP:        '',
      PAYER:                 '',
      SPECIAL_STOCK_PARTNER: '',
      PLANT:                 plant,
    };

    return { header, items };

  } catch (err) {
    // Password protected / encrypted → Python backend
    if (
      err.message?.includes('password') ||
      err.message?.includes('encrypted') ||
      err.message?.includes('CFB') ||
      err.message?.includes('zip')
    ) {
      return await decryptAndParse(file, '');
    }
    throw err;
  }
}

// ---- Backend decrypt (password-protected Excel only) ----
async function decryptAndParse(file, password = '') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('password', password);
  formData.append('api_key', GROQ_API_KEY || '');

  const response = await fetch('http://localhost:5001/decrypt', {
    method: 'POST',
    body: formData,
  });

  const result = await response.json();

  if (response.status === 400 && result.error === 'PASSWORD_REQUIRED') {
    const pwd = window.prompt('🔒 This file is password protected.\nPlease enter the password:');
    if (!pwd) throw new Error('Password is required.');
    return await decryptAndParse(file, pwd);
  }
  if (response.status === 401 && result.error === 'WRONG_PASSWORD') {
    const pwd = window.prompt('❌ Wrong password! Please try again:');
    if (!pwd) throw new Error('Password is required.');
    return await decryptAndParse(file, pwd);
  }
  if (!result.success) throw new Error(result.error || 'Failed to process file.');

  return { header: result.header || {}, items: result.items || [] };
}

// ---- Groq AI — used for PDF, Word, Text, and unrecognized Excel ----
async function extractWithGroq(text, sourceType = 'document') {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    throw new Error('No content found in file.');
  }

  const MAX_CHARS = 12000;
  const truncated = text.length > MAX_CHARS ? text.substring(0, MAX_CHARS) : text;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 4000,
      messages: [
        {
          role: 'system',
          content: `You are an expert at reading business documents — purchase orders, delivery schedules, invoices, dispatch plans — and extracting structured order data.

You will receive raw file content. Extract ALL line item rows and map to the output fields.

OUTPUT FORMAT — return ONLY valid JSON, no markdown, no explanation:
{
  "ORDER_TYPE": "ZDOM or ZEXP (Domestic=ZDOM, Export=ZEXP, default ZDOM)",
  "SALES_ORG": "plant/org code if present else empty string",
  "SOLD_TO_PARTY": "customer code or name",
  "SHIP_TO_PARTY": "ship-to code or delivery location name",
  "PO_NO": "purchase order number if present else empty string",
  "PURCHASE_ORDER_DATE": "DD-MM-YYYY or empty string",
  "REQ_DELIVERY_DATE": "DD-MM-YYYY or empty string",
  "INCOTERM": "CIF/FOB etc or empty string",
  "INCOTERM2": "",
  "ALT_TAX_CLASSF": "",
  "CUSTOMER_GROUP": "",
  "PAYER": "",
  "SPECIAL_STOCK_PARTNER": "",
  "PLANT": "supplying plant code e.g. ING1 INR1 INP1 INC1 PTG GMPD",
  "MATERIAL_NUMBER": ["one entry per line item — Grade+Pack combined e.g. N220 JB"],
  "QUANTITY": ["one number per line item"],
  "SALES_UNIT": ["MT or KG per line item"],
  "DELIVERY_DATE": ["DD-MM-YYYY per line item"],
  "AMOUNT_1": ["price per line item or empty string"]
}

RULES:
- Extract EVERY row — never summarize or collapse rows
- Skip subtotals, grand totals, blank rows, header rows
- Dates DD.MM.YYYY or DD/MM/YYYY → convert to DD-MM-YYYY
- All arrays must be same length
- Return ONLY the JSON object, nothing else`
        },
        {
          role: 'user',
          content: `File type: ${sourceType}\n\nContent:\n${truncated}`
        }
      ]
    })
  });

  const data = await response.json();

  if (!data.choices || !data.choices[0]) {
    throw new Error('Groq API error: ' + JSON.stringify(data));
  }

  const raw = safeStr(data.choices[0].message?.content).trim();
  if (!raw) throw new Error('Groq returned empty response.');

  const cleaned = raw.replace(/```json|```/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error('Groq returned invalid JSON: ' + cleaned.substring(0, 300));
  }

  const toSafeArray = (val) => {
    if (Array.isArray(val)) return val.map(safeStr);
    if (val != null && safeStr(val) !== '') return [safeStr(val)];
    return [];
  };

  const header = {
    ORDER_TYPE:            safeStr(parsed.ORDER_TYPE),
    SALES_ORG:             safeStr(parsed.SALES_ORG),
    SOLD_TO_PARTY:         safeStr(parsed.SOLD_TO_PARTY),
    SHIP_TO_PARTY:         safeStr(parsed.SHIP_TO_PARTY),
    PO_NO:                 safeStr(parsed.PO_NO),
    PURCHASE_ORDER_DATE:   safeStr(parsed.PURCHASE_ORDER_DATE),
    REQ_DELIVERY_DATE:     safeStr(parsed.REQ_DELIVERY_DATE),
    INCOTERM:              safeStr(parsed.INCOTERM),
    INCOTERM2:             safeStr(parsed.INCOTERM2),
    ALT_TAX_CLASSF:        '',
    CUSTOMER_GROUP:        safeStr(parsed.CUSTOMER_GROUP),
    PAYER:                 safeStr(parsed.PAYER),
    SPECIAL_STOCK_PARTNER: safeStr(parsed.SPECIAL_STOCK_PARTNER),
    PLANT:                 safeStr(parsed.PLANT),
  };

  const materials  = toSafeArray(parsed.MATERIAL_NUMBER);
  const quantities = toSafeArray(parsed.QUANTITY);
  const units      = toSafeArray(parsed.SALES_UNIT);
  const dates      = toSafeArray(parsed.DELIVERY_DATE);
  const amounts    = toSafeArray(parsed.AMOUNT_1);

  const items = materials
    .filter(mat => mat.trim() !== '')
    .map((mat, i) => ({
      MATERIAL_NUMBER:  mat,
      QUANTITY:         quantities[i] ?? '',
      SALES_UNIT:       units[i] || 'MT',
      DELIVERY_DATE:    dates[i] ?? '',
      AMOUNT_1:         amounts[i] ?? '',
      CONDITION_TYPE_1: '',
      CONDITION_TYPE_2: '',
      AMOUNT_2:         '',
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
          text += content.items.map(item => safeStr(item.str)).join(' ') + '\n';
        }
        if (!text.trim()) {
          reject(new Error('Could not extract text from PDF.'));
          return;
        }
        resolve(await extractWithGroq(text, 'pdf'));
      } catch (err) { reject(err); }
    };

    script.onerror = () => reject(new Error('Failed to load PDF.js'));
    document.head.appendChild(script);
  });
}

// ---- Word ----
async function parseDocx(file) {
  const data = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: data });
  const text = safeStr(result?.value);
  if (!text.trim()) throw new Error('Could not extract text from Word file.');
  return extractWithGroq(text, 'word');
}

// ---- Text ----
async function parseTxt(file) {
  const text = safeStr(await readTextFile(file));
  if (!text.trim()) throw new Error('Text file is empty.');
  return extractWithGroq(text, 'text');
}

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}