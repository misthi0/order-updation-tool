import { useState } from 'react';
import './App.css';
import FileUpload from './components/FileUpload';
import { parseFile } from './utils/parser';
import { processData } from './utils/processor';
import { generateExcel } from './utils/excelGenerator';

function App() {
  const [status, setStatus] = useState('idle'); // idle | loading | success
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
      const rawData = await parseFile(file);
      const processedData = processData(rawData);
      generateExcel(processedData);
      setStatus('success');
    } catch (err) {
      console.error(err);
      setErrorMessage('Error: ' + err.message);
      setStatus('idle');
    }
  }

  return (
    <div className="app-container">
      <h1>Order Updation Tool</h1>
      <FileUpload
        onFileSelected={handleFileSelected}
        status={status}
        fileName={fileName}
        errorMessage={errorMessage}
      />
    </div>
  );
}

export default App;