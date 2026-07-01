import * as XLSX from 'xlsx';

export function generateExcel(processedData) {
  const headers = [
    'ORDER_TYRE(mandt)', 'SALES_ORG(mandt)', 'DIST_CHNL(mandt)', 'DIV(mandt)',
    'SOLD_TO_PARTY(mandt)', 'SHIP_TO_PARTY(mandt)', 'PO_NO',
    'PURCHASE_ORDER_DATE(DD-MM-YYYY)(mandt)', 'REQ_DELIVERY_DATE(DD-MM-YYYY)(mandt)',
    'INCOTERM', 'INCOTERM2(mandt)', 'ALT_TAX_CLASSF',
    'Pricing Date(DD-MM-YYYY)(mandt)', 'Material Number(mandt)',
    'VALUATION TYPE(mandt)', 'PLANT',
    'Delivery date(DD-MM-YYYY)(mandt)', 'Goods issue date(DD-MM-YYYY)',
    'Loading date(DD-MM-YYYY)', 'Material avail.date(DD-MM-YYYY)',
    'Material avail.date(DD-MM-YYYY)', 'Quantity(mandt)', 'SALES_UNIT',
    'Condition Type No1(Item level)', 'Amount(Item level)',
    'Condition Type No2(Item level)', 'Amount(Item level)',
    'Condition TypeNo3(Item level)', 'Amount(Item level)',
    'Condition Type No4(Item level)', 'Amount(Item level)',
    'Condition Type No5(Item level)', 'Amount(Item level)',
    'Condition Type No6(Item level)', 'Amount(Item level)',
    'Condition Type No7(Item level)', 'Amount(Item level)',
    'Customer Group(at header level)', 'Partner Functions(at header level)(mandt)',
    'Payer(mandt)', 'Partner Functions(at header level)(mandt)',
    'Special Stock Partner(mandt)', 'FLAG'
  ];

  // Fields that are HEADER-level (shown only on first row of each plant group)
  const headerKeys = [
    'ORDER_TYPE', 'SALES_ORG', 'DIST_CHNL', 'DIV',
    'SOLD_TO_PARTY', 'SHIP_TO_PARTY', 'PO_NO',
    'PURCHASE_ORDER_DATE', 'REQ_DELIVERY_DATE',
    'INCOTERM', 'INCOTERM2', 'ALT_TAX_CLASSF',
    'PRICING_DATE',
  ];

  // Fields that are ITEM-level (repeated for every material row)
  const itemKeys = [
    'MATERIAL_NUMBER', 'VALUATION_TYPE', 'PLANT',
    'DELIVERY_DATE', 'GOODS_ISSUE_DATE',
    'LOADING_DATE', 'MATERIAL_AVAIL_DATE',
    'MATERIAL_AVAIL_DATE2', 'QUANTITY', 'SALES_UNIT',
    'CONDITION_TYPE_1', 'AMOUNT_1',
    'CONDITION_TYPE_2', 'AMOUNT_2',
    'CONDITION_TYPE_3', 'AMOUNT_3',
    'CONDITION_TYPE_4', 'AMOUNT_4',
    'CONDITION_TYPE_5', 'AMOUNT_5',
    'CONDITION_TYPE_6', 'AMOUNT_6',
    'CONDITION_TYPE_7', 'AMOUNT_7',
    'CUSTOMER_GROUP', 'PARTNER_FUNCTIONS_1',
    'PAYER', 'PARTNER_FUNCTIONS_2',
    'SPECIAL_STOCK_PARTNER', 'FLAG'
  ];

  // All keys in order (matches headers array)
  const allKeys = [...headerKeys, ...itemKeys];

  const wsData = [headers];

  // Group rows: common header fields shown only once per plant+soldTo group
  // A new group starts when PLANT or SOLD_TO_PARTY changes
  let lastGroupKey = null;

  processedData.forEach(row => {
    const groupKey = `${row.PLANT}__${row.SOLD_TO_PARTY}__${row.ORDER_TYPE}`;
    const isNewGroup = groupKey !== lastGroupKey;
    lastGroupKey = groupKey;

    const excelRow = allKeys.map((key, idx) => {
      // Header-level fields: only fill on first row of group, blank on subsequent rows
      if (headerKeys.includes(key)) {
        return isNewGroup ? (row[key] ?? '') : '';
      }
      // Item-level fields: always fill
      return row[key] ?? '';
    });

    wsData.push(excelRow);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Yellow bold headers
  headers.forEach((_, colIndex) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIndex });
    if (ws[cellRef]) {
      ws[cellRef].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: 'FFFF00' } },
        alignment: { horizontal: 'center' }
      };
    }
  });

  // Auto column widths
  ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length, 15) }));

  XLSX.utils.book_append_sheet(wb, ws, 'Order Updation');
  XLSX.writeFile(wb, 'Order_Updation_Output.xlsx');
}