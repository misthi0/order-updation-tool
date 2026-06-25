export function processData(rawData) {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();
  const todayFormatted = `${dd}-${mm}-${yyyy}`;

  const rows = Array.isArray(rawData) ? rawData : [rawData];

  return rows.map(row => {
    let DIST_CHNL = '';
    let DIV = '';

    if (row.ORDER_TYPE === 'ZDOM') {
      DIST_CHNL = 10;
      DIV = 10;
    } else if (row.ORDER_TYPE === 'ZEXP') {
      DIST_CHNL = 20;
      DIV = 10;
    }

    return {
      ORDER_TYPE: row.ORDER_TYPE || '',
      SALES_ORG: row.SALES_ORG || '',
      DIST_CHNL,
      DIV,
      SOLD_TO_PARTY: row.SOLD_TO_PARTY || '',
      SHIP_TO_PARTY: row.SHIP_TO_PARTY || '',
      PO_NO: row.PO_NO || '',
      PURCHASE_ORDER_DATE: row.PURCHASE_ORDER_DATE || '',
      REQ_DELIVERY_DATE: row.REQ_DELIVERY_DATE || '',
      INCOTERM: row.INCOTERM || '',
      INCOTERM2: row.INCOTERM2 || '',
      ALT_TAX_CLASSF: row.ALT_TAX_CLASSF || '',
      PRICING_DATE: todayFormatted,
      MATERIAL_NUMBER: row.MATERIAL_NUMBER || '',
      VALUATION_TYPE: 'PRODUCED',
      PLANT: row.PLANT || '',
      DELIVERY_DATE: row.DELIVERY_DATE || '',
      GOODS_ISSUE_DATE: row.GOODS_ISSUE_DATE || '',
      LOADING_DATE: row.LOADING_DATE || '',
      MATERIAL_AVAIL_DATE: row.MATERIAL_AVAIL_DATE || '',
      MATERIAL_AVAIL_DATE2: row.MATERIAL_AVAIL_DATE2 || '',
      QUANTITY: row.QUANTITY || '',
      SALES_UNIT: row.SALES_UNIT || '',
      CONDITION_TYPE_1: row.CONDITION_TYPE_1 || '',
      AMOUNT_1: row.AMOUNT_1 || '',
      CONDITION_TYPE_2: row.CONDITION_TYPE_2 || '',
      AMOUNT_2: row.AMOUNT_2 || '',
      CONDITION_TYPE_3: row.CONDITION_TYPE_3 || '',
      AMOUNT_3: row.AMOUNT_3 || '',
      CONDITION_TYPE_4: row.CONDITION_TYPE_4 || '',
      AMOUNT_4: row.AMOUNT_4 || '',
      CONDITION_TYPE_5: row.CONDITION_TYPE_5 || '',
      AMOUNT_5: row.AMOUNT_5 || '',
      CONDITION_TYPE_6: row.CONDITION_TYPE_6 || '',
      AMOUNT_6: row.AMOUNT_6 || '',
      CONDITION_TYPE_7: row.CONDITION_TYPE_7 || '',
      AMOUNT_7: row.AMOUNT_7 || '',
      CUSTOMER_GROUP: row.CUSTOMER_GROUP || '',
      PARTNER_FUNCTIONS_1: row.PARTNER_FUNCTIONS_1 || '',
      PAYER: row.PAYER || '',
      PARTNER_FUNCTIONS_2: row.PARTNER_FUNCTIONS_2 || '',
      SPECIAL_STOCK_PARTNER: row.SPECIAL_STOCK_PARTNER || '',
      FLAG: row.FLAG || '',
    };
  });
}