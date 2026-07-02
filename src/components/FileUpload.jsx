import { useState, useRef } from 'react';

const ALLOWED_EXTENSIONS = ['xlsx', 'docx', 'pdf', 'txt'];

function FileUpload({ onFileSelected, status, fileName, errorMessage }) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  function isValidFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    return ALLOWED_EXTENSIONS.includes(ext);
  }

  function handleFile(file) {
    if (!file) return;
    if (!isValidFile(file)) {
      onFileSelected(null, 'Invalid file type. Please upload .xlsx, .docx, .pdf or .txt');
      return;
    }
    onFileSelected(file, null);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleInputChange(e) {
    handleFile(e.target.files[0]);
  }

  function handleClick() {
    inputRef.current.click();
  }

  return (
    <div className="file-upload-container">
      <div
        className={`drop-zone ${isDragging ? 'dragging' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <input
          type="file"
          ref={inputRef}
          accept=".xlsx,.docx,.pdf,.txt"
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />
        <p>Drag & drop your file here, or click to browse</p>
        <p className="hint">Accepted formats: .xlsx, .docx, .pdf, .txt</p>
      </div>

      {fileName && <p className="file-name">📄 {fileName}</p>}

      {status === 'loading' && (
        <div className="spinner-container">
          <div className="spinner"></div>
          <p>Processing file...</p>
        </div>
      )}

      {status === 'success' && (
        <p className="success-message">✅ File processed and Excel downloaded successfully!</p>
      )}

      {errorMessage && <p className="error-message">⚠️ {errorMessage}</p>}
    </div>
  );
}

export default FileUpload;