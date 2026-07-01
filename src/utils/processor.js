// Sold To / Ship To mapping
const PARTY_MAP = {
  'ace':         { sold: '2651', ship: '113' },
  'spinmax':     { sold: '2651', ship: '4211' },
  'spinnmax':    { sold: '2651', ship: '4211' },
  'chennai':     { sold: '88',   ship: '88' },
  'perambra':    { sold: '29',   ship: '29' },
  'perambara':   { sold: '29',   ship: '29' },
  'baroda':      { sold: '30',   ship: '30' },
  'linda':       { sold: '30',   ship: '30' },
  'limda':       { sold: '30',   ship: '30' },
  'ap':          { sold: '3544', ship: '3544' },
  'pune':        { sold: '127',  ship: '31' },
  'kalamassary': { sold: '32',   ship: '366' },
  'kalamassery': { sold: '32',   ship: '366' },
};

// Plant code mapping — raw plant text found in file → final SAP plant code
const PLANT_MAP = {
  'PTG SCM':  'INC1',   // must be before 'PTG' for partial match
  'PTG':      'INP1',
  'GMPD':     'ING1',
  'RKT':      'INR1',
  'RNKT':     'INR1',
  '8030':     'INC1',
  'CONTINUA': 'INC1',
  'INC1':     'INC1',
  'ING1':     'ING1',
  'INP1':     'INP1',
  'INR1':     'INR1',
};

function mapPlant(rawPlant, materialNumber = '') {
  // Material-based override — 8030/CONTINUA always = INC1 regardless of what plant column says
  const matUpper = String(materialNumber || '').toUpperCase();
  if (matUpper.includes('8030') || matUpper.includes('CONTINUA')) return 'INC1';

  if (!rawPlant) return '';
  const upper = String(rawPlant).trim().toUpperCase();

  // Exact match first
  if (PLANT_MAP[upper]) return PLANT_MAP[upper];

  // Partial match — sort by length descending so 'PTG SCM' matches before 'PTG'
  const sortedKeys = Object.keys(PLANT_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (upper.includes(key)) return PLANT_MAP[key];
  }

  return rawPlant;
}

// Transit days by FINAL plant code and place
const TRANSIT_DAYS = {
  ING1: { chennai: 1, ap: 1, pune: 5, baroda: 4, linda: 4, limda: 4, ace: 3, spinmax: 3, spinnmax: 3, perambra: 2, perambara: 2, kalamassery: 2, kalamassary: 2 },
  INP1: { chennai: 4, ap: 4, pune: 1, baroda: 2, linda: 2, limda: 2, ace: 3, spinmax: 3, spinnmax: 3, perambra: 4, perambara: 4, kalamassery: 4, kalamassary: 4 },
  INR1: { chennai: 7, ap: 7, pune: 8, baroda: 5, linda: 5, limda: 5, ace: 5, spinmax: 5, spinnmax: 5, perambra: 8, perambara: 8, kalamassery: 8, kalamassary: 8 },
  INC1: { chennai: 4, ap: 4, pune: 1, baroda: 2, linda: 2, limda: 2, ace: 3, spinmax: 3, spinnmax: 3, perambra: 4, perambara: 4, kalamassery: 4, kalamassary: 4 },
};

function findPlace(text) {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase();
  const places = ['kalamassery', 'kalamassary', 'perambara', 'perambra', 'spinnmax', 'spinmax', 'chennai', 'baroda', 'limda', 'linda', 'pune', 'ace', 'ap'];
  for (const place of places) {
    if (lower.includes(place)) return place;
  }
  return null;
}

function parseDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    return new Date(`${yyyy}-${mm}-${dd}`);
  }
  return null;
}

function formatDate(date) {
  if (!date || isNaN(date)) return '';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function subtractDays(dateStr, days) {
  const date = parseDate(dateStr);
  if (!date) return '';
  date.setDate(date.getDate() - days);
  return formatDate(date);
}

function convertQuantity(quantity, unit) {
  if (!quantity) return '';
  const num = parseFloat(quantity);
  if (isNaN(num)) return String(quantity);
  const unitLower = (unit != null ? String(unit) : '').toLowerCase();
  if ((unitLower.includes('kg') || unitLower.includes('kilogram')) && num >= 1000) {
    return (num / 1000).toFixed(3);
  }
  return num.toString();
}

function convertUnit(unit) {
  const unitLower = (unit != null ? String(unit) : '').toLowerCase();
  if (unitLower.includes('kg') || unitLower.includes('kilogram')) return 'MT';
  return unit != null ? String(unit) : '';
}

export function processData(rawData) {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();
  const todayFormatted = `${dd}-${mm}-${yyyy}`;

  const rows = Array.isArray(rawData) ? rawData : [rawData];

  return rows.map(row => {
    const safe = (val) => (val != null ? String(val) : '');

    let DIST_CHNL = '';
    let DIV = '';
    if (row.ORDER_TYPE === 'ZDOM') { DIST_CHNL = 10; DIV = 10; }
    else if (row.ORDER_TYPE === 'ZEXP') { DIST_CHNL = 20; DIV = 10; }

    const place = findPlace(safe(row.SHIP_TO_PARTY)) ||
                  findPlace(safe(row.SOLD_TO_PARTY)) ||
                  findPlace(safe(row.CUSTOMER_NAME)) ||
                  findPlace(safe(row.LOCATION)) || null;

    let soldTo = safe(row.SOLD_TO_PARTY);
    let shipTo = safe(row.SHIP_TO_PARTY);
    if (place && PARTY_MAP[place]) {
      soldTo = PARTY_MAP[place].sold;
      shipTo = PARTY_MAP[place].ship;
    }

    // Pass material number so 8030/CONTINUA always maps to INC1
    const plant = mapPlant(safe(row.PLANT), safe(row.MATERIAL_NUMBER));

    let transitDays = 0;
    if (place && TRANSIT_DAYS[plant] && TRANSIT_DAYS[plant][place] !== undefined) {
      transitDays = TRANSIT_DAYS[plant][place];
    }

    const deliveryDate = safe(row.DELIVERY_DATE);
    const goodsIssueDate = subtractDays(deliveryDate, transitDays);
    const loadingDate = subtractDays(deliveryDate, transitDays);
    const materialAvailDate = subtractDays(deliveryDate, transitDays);

    const convertedQty = convertQuantity(row.QUANTITY, row.SALES_UNIT);
    const convertedUnit = convertUnit(row.SALES_UNIT);

    return {
      ORDER_TYPE:             safe(row.ORDER_TYPE),
      SALES_ORG:              mapPlant(safe(row.SALES_ORG), safe(row.MATERIAL_NUMBER)) || plant,
      DIST_CHNL,
      DIV,
      SOLD_TO_PARTY:          soldTo,
      SHIP_TO_PARTY:          shipTo,
      PO_NO:                  safe(row.PO_NO),
      PURCHASE_ORDER_DATE:    safe(row.PURCHASE_ORDER_DATE),
      REQ_DELIVERY_DATE:      safe(row.REQ_DELIVERY_DATE),
      INCOTERM:               safe(row.INCOTERM),
      INCOTERM2:              safe(row.INCOTERM2),
      ALT_TAX_CLASSF:         safe(row.ALT_TAX_CLASSF),
      PRICING_DATE:           todayFormatted,
      MATERIAL_NUMBER:        safe(row.MATERIAL_NUMBER),
      VALUATION_TYPE:         'PRODUCED',
      PLANT:                  plant,
      DELIVERY_DATE:          deliveryDate,
      GOODS_ISSUE_DATE:       goodsIssueDate,
      LOADING_DATE:           loadingDate,
      MATERIAL_AVAIL_DATE:    materialAvailDate,
      MATERIAL_AVAIL_DATE2:   materialAvailDate,
      QUANTITY:               convertedQty,
      SALES_UNIT:             convertedUnit,
      CONDITION_TYPE_1:       safe(row.CONDITION_TYPE_1),
      AMOUNT_1:               safe(row.AMOUNT_1),
      CONDITION_TYPE_2:       safe(row.CONDITION_TYPE_2),
      AMOUNT_2:               safe(row.AMOUNT_2),
      CONDITION_TYPE_3:       safe(row.CONDITION_TYPE_3),
      AMOUNT_3:               safe(row.AMOUNT_3),
      CONDITION_TYPE_4:       safe(row.CONDITION_TYPE_4),
      AMOUNT_4:               safe(row.AMOUNT_4),
      CONDITION_TYPE_5:       safe(row.CONDITION_TYPE_5),
      AMOUNT_5:               safe(row.AMOUNT_5),
      CONDITION_TYPE_6:       safe(row.CONDITION_TYPE_6),
      AMOUNT_6:               safe(row.AMOUNT_6),
      CONDITION_TYPE_7:       safe(row.CONDITION_TYPE_7),
      AMOUNT_7:               safe(row.AMOUNT_7),
      CUSTOMER_GROUP:         safe(row.CUSTOMER_GROUP),
      PARTNER_FUNCTIONS_1:    safe(row.PARTNER_FUNCTIONS_1),
      PAYER:                  safe(row.PAYER),
      PARTNER_FUNCTIONS_2:    safe(row.PARTNER_FUNCTIONS_2),
      SPECIAL_STOCK_PARTNER:  safe(row.SPECIAL_STOCK_PARTNER),
      FLAG:                   safe(row.FLAG),
    };
  });
}