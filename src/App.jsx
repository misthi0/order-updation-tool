import { useState } from 'react';
import './App.css';
import FileUpload from './components/FileUpload';
import { parseFile } from './utils/parser';
import { processData } from './utils/processor';
import { generateExcel } from './utils/excelGenerator';

function App() {
  const [status, setStatus] = useState('idle');
  const [fileName, setFileName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleFileSelected(file, error) {
    if (error) {
      setErrorMessage(error);
      setStatus('idle');
      setFileName('');
      return;
    }

    setErrorMessage('');
    setFileName(file.name);
    setStatus('loading');

    try {
      const result = await parseFile(file);
      console.log('Raw result from parseFile:', result);

      const header = result.header || {};
      const items = result.items || [];

      console.log('Header:', header);
      console.log('Items:', items);

      let rows = [];

      if (items.length > 0) {
        rows = items.map(item => ({
          // ---- Header-level fields (shared across all rows) ----
          ORDER_TYPE:            item.ORDER_TYPE            || header.ORDER_TYPE            || '',
          PO_NO:                 item.PO_NO                 || header.PO_NO                 || '',
          PURCHASE_ORDER_DATE:   item.PURCHASE_ORDER_DATE   || header.PURCHASE_ORDER_DATE   || '',
          REQ_DELIVERY_DATE:     item.REQ_DELIVERY_DATE     || header.REQ_DELIVERY_DATE     || '',
          INCOTERM:              item.INCOTERM              || header.INCOTERM              || '',
          INCOTERM2:             item.INCOTERM2             || header.INCOTERM2             || '',
          ALT_TAX_CLASSF:        item.ALT_TAX_CLASSF        || header.ALT_TAX_CLASSF        || '',
          CUSTOMER_GROUP:        item.CUSTOMER_GROUP        || header.CUSTOMER_GROUP        || '',
          PAYER:                 item.PAYER                 || header.PAYER                 || '',
          SPECIAL_STOCK_PARTNER: item.SPECIAL_STOCK_PARTNER || header.SPECIAL_STOCK_PARTNER || '',

          // ---- Per-item fields — item value FIRST, header as fallback only ----
          // These differ per sheet (Chennai/AP/Limda etc) and per row (PTG/GMPD/RKT)
          SALES_ORG:    item.PLANT        || header.PLANT        || '', // will be mapped by processor
          SOLD_TO_PARTY: item.SOLD_TO_PARTY || header.SOLD_TO_PARTY || '',
          SHIP_TO_PARTY: item.SHIP_TO_PARTY || header.SHIP_TO_PARTY || '',
          PLANT:         item.PLANT        || header.PLANT        || '',

          // ---- Item-specific fields ----
          MATERIAL_NUMBER:  item.MATERIAL_NUMBER  || '',
          QUANTITY:         item.QUANTITY         || '',
          SALES_UNIT:       item.SALES_UNIT        || '',
          DELIVERY_DATE:    item.DELIVERY_DATE     || '',
          CONDITION_TYPE_1: item.CONDITION_TYPE_1  || '',
          AMOUNT_1:         item.AMOUNT_1          || '',
          CONDITION_TYPE_2: item.CONDITION_TYPE_2  || '',
          AMOUNT_2:         item.AMOUNT_2          || '',
        }));
      } else {
        // No items — one row with header data only
        rows = [{
          ORDER_TYPE:            header.ORDER_TYPE            || '',
          SALES_ORG:             header.SALES_ORG             || '',
          SOLD_TO_PARTY:         header.SOLD_TO_PARTY         || '',
          SHIP_TO_PARTY:         header.SHIP_TO_PARTY         || '',
          PO_NO:                 header.PO_NO                 || '',
          PURCHASE_ORDER_DATE:   header.PURCHASE_ORDER_DATE   || '',
          REQ_DELIVERY_DATE:     header.REQ_DELIVERY_DATE     || '',
          INCOTERM:              header.INCOTERM              || '',
          INCOTERM2:             header.INCOTERM2             || '',
          ALT_TAX_CLASSF:        header.ALT_TAX_CLASSF        || '',
          CUSTOMER_GROUP:        header.CUSTOMER_GROUP        || '',
          PAYER:                 header.PAYER                 || '',
          SPECIAL_STOCK_PARTNER: header.SPECIAL_STOCK_PARTNER || '',
          PLANT:                 header.PLANT                 || '',
          MATERIAL_NUMBER:  '',
          QUANTITY:         '',
          SALES_UNIT:       '',
          DELIVERY_DATE:    '',
          CONDITION_TYPE_1: '',
          AMOUNT_1:         '',
          CONDITION_TYPE_2: '',
          AMOUNT_2:         '',
        }];
      }

      console.log('Rows to process:', rows);
      const processedData = processData(rows);
      console.log('Processed data:', processedData);
      generateExcel(processedData);
      setStatus('success');

    } catch (err) {
      console.error(err);
      setErrorMessage('Error: ' + err.message);
      setStatus('idle');
    }
  }

  return (
    <div className="app-shell">
      <div className="app-container">
        <p className="eyebrow">Purchase Order Pipeline</p>
        <h1>Order Updation Tool</h1>
        <p className="subtitle">
          Drop a purchase order — get back a structured Excel file, ready for upload.
        </p>
        <FileUpload
          onFileSelected={handleFileSelected}
          status={status}
          fileName={fileName}
          errorMessage={errorMessage}
        />
      </div>
    </div>
  );
}

export default App;