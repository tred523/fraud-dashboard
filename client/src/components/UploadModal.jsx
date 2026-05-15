import { useState, useRef } from 'react';
import { uploadFile } from '../api';

export default function UploadModal({ onClose, onSuccess }) {
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef();

  async function handleFile(file) {
    if (!file) return;
    setLoading(true);
    setStatus(null);
    try {
      const result = await uploadFile(file);
      setStatus({ ok: true, msg: `Imported ${result.imported} events successfully.` });
      setTimeout(onSuccess, 1200);
    } catch (e) {
      setStatus({ ok: false, msg: e.message });
      setLoading(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 className="modal-title" style={{ margin: 0 }}>Import Event Data</h2>
          <button className="btn btn-ghost" style={{ padding: '4px 10px' }} onClick={onClose}>✕</button>
        </div>

        <div
          className={`upload-area${dragging ? ' dragover' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <div className="upload-icon">📂</div>
          <div className="upload-text">Drop your JSON file here or click to browse</div>
          <div className="upload-sub">Accepts JSON array or newline-delimited JSON (NDJSON)</div>
          <input
            ref={inputRef}
            type="file"
            accept=".json,.ndjson,.jsonl"
            style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files[0])}
          />
        </div>

        {loading && !status && (
          <div style={{ marginTop: 14, fontSize: 13, color: 'var(--text3)', textAlign: 'center' }}>
            Processing…
          </div>
        )}

        {status && (
          <div style={{
            marginTop: 14, padding: '10px 14px', borderRadius: 6, fontSize: 13,
            background: status.ok ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)',
            color: status.ok ? 'var(--green)' : 'var(--red)',
            border: `1px solid ${status.ok ? 'rgba(34,197,94,.2)' : 'rgba(239,68,68,.2)'}`,
          }}>
            {status.msg}
          </div>
        )}

        <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
