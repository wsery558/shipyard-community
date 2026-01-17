/**
 * Report Generator Component
 * 
 * UI for generating and downloading project reports in multiple formats:
 * - JSON: Raw data structure
 * - CSV: Spreadsheet compatible
 * - HTML: Web-formatted document
 * - PDF: Professional report (HTML-based)
 */

import React, { useState } from 'react';

/**
 * ReportGenerator Component
 * Provides UI for selecting format and generating reports
 */
export function ReportGenerator({ projectId, sessionId }) {
  const [format, setFormat] = useState('html');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const formatOptions = [
    { value: 'json', label: 'JSON', description: 'Raw data structure for programmatic processing', icon: '{ }' },
    { value: 'csv', label: 'CSV', description: 'Spreadsheet compatible (Excel, Google Sheets)', icon: '📊' },
    { value: 'html', label: 'HTML', description: 'Web-formatted document with styling', icon: '🌐' },
    { value: 'pdf', label: 'PDF', description: 'Professional document (HTML-based)', icon: '📄' }
  ];

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setSuccess(false);

    try {
      const url = `/api/generate-report?project=${encodeURIComponent(projectId)}&sessionId=${encodeURIComponent(sessionId)}&format=${format}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate report');
      }

      // Download the file
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `report_${projectId}_${sessionId}.${format === 'html' || format === 'pdf' ? 'html' : format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('[ReportGenerator] error:', err);
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{
      padding: '20px',
      background: '#ffffff',
      border: '1px solid #e0e0e0',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        borderBottom: '2px solid #1976d2',
        paddingBottom: '12px'
      }}>
        <h3 style={{ 
          margin: 0, 
          fontSize: '18px', 
          fontWeight: 600,
          color: '#333'
        }}>
          📑 Generate Report
        </h3>
        <div style={{ 
          fontSize: '12px', 
          color: '#666',
          background: '#f5f5f5',
          padding: '4px 12px',
          borderRadius: '12px'
        }}>
          {projectId} · {sessionId.substring(0, 8)}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ 
          display: 'block',
          fontSize: '13px',
          fontWeight: 600,
          color: '#333',
          marginBottom: '12px'
        }}>
          Select Format
        </label>
        
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px'
        }}>
          {formatOptions.map(option => (
            <div
              key={option.value}
              onClick={() => setFormat(option.value)}
              style={{
                padding: '16px',
                border: `2px solid ${format === option.value ? '#1976d2' : '#e0e0e0'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                background: format === option.value ? '#e3f2fd' : '#ffffff',
                transition: 'all 0.2s',
                ':hover': {
                  borderColor: '#1976d2',
                  transform: 'translateY(-2px)'
                }
              }}
            >
              <div style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '8px'
              }}>
                <span style={{ fontSize: '24px' }}>{option.icon}</span>
                <div>
                  <div style={{ 
                    fontSize: '14px',
                    fontWeight: 600,
                    color: format === option.value ? '#1976d2' : '#333'
                  }}>
                    {option.label}
                  </div>
                </div>
              </div>
              <div style={{ 
                fontSize: '12px',
                color: '#666',
                lineHeight: '1.4'
              }}>
                {option.description}
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px',
          background: '#ffebee',
          border: '1px solid #ef5350',
          borderRadius: '6px',
          color: '#c62828',
          marginBottom: '16px',
          fontSize: '13px'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '12px 16px',
          background: '#e8f5e9',
          border: '1px solid #4caf50',
          borderRadius: '6px',
          color: '#2e7d32',
          marginBottom: '16px',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>✓</span>
          <span>Report downloaded successfully!</span>
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={generating}
        style={{
          width: '100%',
          padding: '14px 24px',
          background: generating ? '#cccccc' : '#1976d2',
          color: '#ffffff',
          border: 'none',
          borderRadius: '6px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: generating ? 'not-allowed' : 'pointer',
          transition: 'background 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}
      >
        {generating ? (
          <>
            <div style={{
              width: '16px',
              height: '16px',
              border: '2px solid #ffffff',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }} />
            <span>Generating...</span>
          </>
        ) : (
          <>
            <span>⬇️</span>
            <span>Generate & Download {format.toUpperCase()} Report</span>
          </>
        )}
      </button>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        div[style*="cursor: pointer"]:hover {
          border-color: #1976d2 !important;
        }
        
        button:hover:not(:disabled) {
          background: #1565c0 !important;
        }
      `}</style>

      <div style={{
        marginTop: '20px',
        padding: '12px',
        background: '#f9f9f9',
        borderRadius: '6px',
        fontSize: '12px',
        color: '#666',
        lineHeight: '1.6'
      }}>
        <strong style={{ color: '#333' }}>Report Includes:</strong>
        <ul style={{ marginTop: '8px', marginLeft: '16px', marginBottom: 0 }}>
          <li>Project metadata and session summary</li>
          <li>Task plan and completion status</li>
          <li>Event timeline and statistics</li>
          <li>Cost analysis (USD/TWD)</li>
          <li>Command execution history</li>
          <li>Approval decisions and audit trail</li>
          <li>Error logs and success rate</li>
        </ul>
      </div>
    </div>
  );
}

export default ReportGenerator;
