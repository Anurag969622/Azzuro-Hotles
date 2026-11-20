import React, { useState, useRef } from 'react';
import { reviewsApi, importApi, propertiesApi } from '../../api';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Download,
  Building,
  Table,
  Check,
  X,
  ShieldCheck,
  RefreshCw,
  FileCode
} from 'lucide-react';

export default function DataImportPage() {
  const fileInputRef = useRef(null);

  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [defaultProperty, setDefaultProperty] = useState('');
  const [properties, setProperties] = useState([]);

  // Preview & Processing state
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [importError, setImportError] = useState(null);

  React.useEffect(() => {
    propertiesApi.getAll()
      .then((res) => {
        if (res.success && res.properties) {
          setProperties(res.properties);
        }
      })
      .catch(() => {});
  }, []);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (file) => {
    setSelectedFile(file);
    setImportSummary(null);
    setImportError(null);

    // If CSV, trigger preview
    if (file.name.endsWith('.csv')) {
      const formData = new FormData();
      formData.append('file', file);
      if (defaultProperty) formData.append('defaultPropertyCode', defaultProperty);

      setPreviewLoading(true);
      importApi.previewCsv(formData)
        .then((res) => {
          if (res.success) {
            setPreviewData(res);
          }
          setPreviewLoading(false);
        })
        .catch((err) => {
          console.warn('Preview fallback:', err);
          setPreviewLoading(false);
        });
    } else {
      setPreviewData(null);
    }
  };

  const handleExecuteImport = async () => {
    if (!selectedFile) return;

    setImporting(true);
    setImportError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    if (defaultProperty) formData.append('defaultPropertyCode', defaultProperty);

    try {
      let res;
      if (selectedFile.name.endsWith('.json')) {
        res = await reviewsApi.importJson(formData);
      } else {
        res = await reviewsApi.importCsv(formData);
      }

      if (res.success) {
        setImportSummary(res.summary);
      }
    } catch (err) {
      setImportError(err.response?.data?.error?.message || 'Failed to import file. Please check column format.');
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadErrorReport = () => {
    if (!importSummary?.failedRows || importSummary.failedRows.length === 0) return;
    const csvContent = 'data:text/csv;charset=utf-8,' +
      'RowIndex,ErrorReason,RawData\n' +
      importSummary.failedRows.map((r) => `${r.rowNumber},"${r.error}","${JSON.stringify(r.raw || '')}"`).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `failed_import_rows_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Review Ingestion & File Importer</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Authorized multi-format ingestion for Booking.com guest verbatims with automatic deduplication.
          </p>
        </div>

        {/* Synthetic vs Genuine badge */}
        <div className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-2">
          <ShieldCheck size={15} className="text-azzurro-600" />
          <span>SHA-256 Provenance & Deduplication Guaranteed</span>
        </div>
      </div>

      {/* Main Upload Box */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm space-y-6">
        {/* Optional Property Assignment */}
        <div className="max-w-md">
          <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">
            Target Property (Optional Default)
          </label>
          <select
            value={defaultProperty}
            onChange={(e) => setDefaultProperty(e.target.value)}
            className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-700 font-medium"
          >
            <option value="">Auto-Detect from CSV &apos;property&apos; column</option>
            {properties.map((p) => (
              <option key={p.id} value={p.property_code}>{p.name} ({p.property_code})</option>
            ))}
          </select>
        </div>

        {/* Drag and drop zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
            dragActive
              ? 'border-azzurro-500 bg-azzurro-50/50 scale-[1.01]'
              : 'border-slate-300 hover:border-slate-400 bg-slate-50/40'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="w-14 h-14 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4 text-azzurro-600">
            <UploadCloud size={28} />
          </div>

          <h3 className="text-sm font-bold text-slate-800">
            {selectedFile ? selectedFile.name : 'Click to upload or drag & drop review file'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Supports standardized Booking.com CSV exports and structured JSON review arrays up to 10MB.
          </p>
          <p className="text-[11px] text-slate-400 mt-2 font-mono">
            Supported columns: property, rating, review_date, positive_text, negative_text, language
          </p>
        </div>

        {/* Execute button */}
        {selectedFile && (
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <FileSpreadsheet size={16} className="text-azzurro-600" />
              <span>Selected file: <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
            </div>

            <button
              onClick={handleExecuteImport}
              disabled={importing}
              className="px-5 py-2.5 bg-azzurro-600 hover:bg-azzurro-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {importing ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
              {importing ? 'Processing & Deduplicating...' : 'Confirm & Commit Ingestion'}
            </button>
          </div>
        )}
      </div>

      {/* Import Error Banner */}
      {importError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
          <AlertTriangle size={16} className="shrink-0" />
          <span>{importError}</span>
        </div>
      )}

      {/* Import Summary Results */}
      {importSummary && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-600" />
              Ingestion Execution Summary
            </h3>
            <span className="text-xs font-mono text-slate-400">Batch ID: {importSummary.batchId || 'N/A'}</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-500 block">Total Read</span>
              <span className="text-xl font-bold text-slate-800 mt-0.5 block">{importSummary.totalProcessed ?? 0}</span>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <span className="text-[11px] text-emerald-800 block">Inserted Unique</span>
              <span className="text-xl font-bold text-emerald-700 mt-0.5 block">{importSummary.insertedCount ?? 0}</span>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <span className="text-[11px] text-amber-800 block">Duplicate Skipped</span>
              <span className="text-xl font-bold text-amber-700 mt-0.5 block">{importSummary.duplicateCount ?? 0}</span>
            </div>
            <div className="p-3 bg-rose-50 rounded-lg border border-rose-200">
              <span className="text-[11px] text-rose-800 block">Failed / Invalid</span>
              <span className="text-xl font-bold text-rose-700 mt-0.5 block">{importSummary.failedCount ?? 0}</span>
            </div>
          </div>

          {importSummary.failedRows && importSummary.failedRows.length > 0 && (
            <div className="pt-2 flex items-center justify-between">
              <p className="text-xs text-rose-700 font-medium">
                {importSummary.failedRows.length} rows failed schema or score range validation.
              </p>
              <button
                onClick={handleDownloadErrorReport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold hover:bg-rose-100"
              >
                <Download size={13} /> Download Failed Rows Report
              </button>
            </div>
          )}
        </div>
      )}

      {/* CSV Preview Table */}
      {previewData && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">File Content Preview</h3>
              <p className="text-[11px] text-slate-500">First 5 detected valid records before database insertion</p>
            </div>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
              {previewData.validCount} Valid / {previewData.failedCount} Failed
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                  <th className="py-2.5 px-4">Property</th>
                  <th className="py-2.5 px-4">Rating</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Positive Feedback</th>
                  <th className="py-2.5 px-4">Negative Feedback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewData.preview?.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 font-bold text-slate-800">{row.propertyCode || defaultProperty || 'N/A'}</td>
                    <td className="py-2.5 px-4 font-mono font-semibold">{row.rating}</td>
                    <td className="py-2.5 px-4 text-slate-600">{row.reviewDate || 'N/A'}</td>
                    <td className="py-2.5 px-4 text-emerald-800 truncate max-w-xs">{row.positiveText || '—'}</td>
                    <td className="py-2.5 px-4 text-rose-800 truncate max-w-xs">{row.negativeText || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

