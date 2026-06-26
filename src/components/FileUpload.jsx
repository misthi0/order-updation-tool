import { useState, useRef } from 'react';

const ALLOWED_EXTENSIONS = ['xlsx', 'docx', 'pdf', 'txt'];
const FORMAT_CHIPS = ['XLSX', 'DOCX', 'PDF', 'TXT'];
const STAGES = ['Receive', 'Process', 'Export'];

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

  let activeStageIndex = -1;
  if (fileName && !errorMessage) activeStageIndex = 0;
  if (status === 'loading') activeStageIndex = 1;
  if (status === 'success') activeStageIndex = 2;

  const fileExt = fileName ? fileName.split('.').pop().toUpperCase() : '';

  return (
    <div className="file-upload-container">
      <div
        className={`drop-zone ${isDragging ? 'dragging' : ''} ${status === 'loading' ? 'scanning' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <span className="bracket bracket-tl" />
        <span className="bracket bracket-tr" />
        <span className="bracket bracket-bl" />
        <span className="bracket bracket-br" />

        {status === 'loading' && <span className="scan-line" />}

        <input
          type="file"
          ref={inputRef}
          accept=".xlsx,.docx,.pdf,.txt"
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />

        <svg className="upload-icon" width="40" height="40" viewBox="0 0 40 40" fill="none">
          <path d="M20 5V25M20 5L12 13M20 5L28 13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M6 28V31C6 32.6569 7.34315 34 9 34H31C32.6569 34 34 32.6569 34 31V28" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>

        <p className="drop-title">Drag &amp; drop your purchase order</p>
        <p className="hint">or click to browse files</p>

        <div className="chip-row">
          {FORMAT_CHIPS.map((c) => (
            <span key={c} className="chip">{c}</span>
          ))}
        </div>
      </div>

      {fileName && (
        <div className="manifest-line">
          <span className="manifest-ext">{fileExt}</span>
          <span className="manifest-name">{fileName}</span>
          <span className={`manifest-status manifest-status--${status}`}>
            {status === 'loading' && 'Processing'}
            {status === 'success' && 'Done'}
            {status === 'idle' && !errorMessage && 'Queued'}
          </span>
        </div>
      )}

      {(fileName || status === 'loading' || status === 'success') && !errorMessage && (
        <div className="stage-strip">
          {STAGES.map((label, i) => {
            const isDone = i < activeStageIndex || (i === activeStageIndex && status === 'success');
            const isActive = i === activeStageIndex && status !== 'success';
            return (
              <div key={label} className={`stage ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}>
                <span className="stage-dot">{isDone ? '✓' : i + 1}</span>
                <span className="stage-label">{label}</span>
                {i < STAGES.length - 1 && <span className="stage-rule" />}
              </div>
            );
          })}
        </div>
      )}

      {status === 'success' && (
        <p className="success-message">Excel file generated and downloaded.</p>
      )}

      {errorMessage && (
        <p className="error-message">
          <span className="error-icon">!</span> {errorMessage}
        </p>
      )}
    </div>
  );
}

export default FileUpload;