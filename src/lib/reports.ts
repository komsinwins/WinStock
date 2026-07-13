import * as XLSX from 'xlsx';

// Helper to format currency in Thai Baht
export const formatBaht = (value: number) => {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0
  }).format(value);
};

// Export to Excel function using xlsx
export const exportToExcel = (data: any[], headers: string[], fileName: string) => {
  // Translate keys to headers for the excel sheet
  const wsData = [
    headers,
    ...data.map(item => Object.values(item))
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  
  // Save file
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

// Print utility that generates a clean, printable HTML view
export const printReport = (title: string, headers: string[], rows: any[][], summaryText?: string) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('กรุณาอนุญาตให้เปิดหน้าต่างป๊อปอัปเพื่อแสดงรายงาน');
    return;
  }

  const currentDate = new Date().toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <meta charset="utf-8">
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: 'Sarabun', sans-serif;
          margin: 40px;
          color: #333;
          background-color: #fff;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .title {
          font-size: 24px;
          font-weight: 700;
          color: #1e293b;
          margin: 0;
        }
        .subtitle {
          font-size: 14px;
          color: #64748b;
          margin-top: 5px;
        }
        .meta-info {
          text-align: right;
          font-size: 12px;
          color: #64748b;
        }
        .company-name {
          font-size: 18px;
          font-weight: 600;
          color: #0f172a;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
          font-size: 13px;
        }
        th {
          background-color: #f1f5f9;
          color: #334155;
          font-weight: 600;
          text-align: left;
          padding: 12px 10px;
          border-bottom: 2px solid #cbd5e1;
        }
        td {
          padding: 10px;
          border-bottom: 1px solid #e2e8f0;
          color: #475569;
        }
        tr:nth-child(even) td {
          background-color: #f8fafc;
        }
        .summary-section {
          background-color: #f1f5f9;
          border-radius: 6px;
          padding: 15px;
          display: flex;
          justify-content: flex-end;
          align-items: center;
          font-size: 15px;
          font-weight: 600;
          color: #1e293b;
        }
        .footer {
          margin-top: 50px;
          border-top: 1px solid #e2e8f0;
          padding-top: 20px;
          font-size: 11px;
          color: #94a3b8;
          text-align: center;
        }
        @media print {
          body {
            margin: 20px;
          }
          .no-print {
            display: none;
          }
        }
        .no-print-bar {
          background-color: #1e293b;
          color: white;
          padding: 10px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: -40px -40px 40px -40px;
        }
        .btn-print {
          background-color: #10b981;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          font-family: 'Sarabun', sans-serif;
          font-weight: 500;
          cursor: pointer;
        }
        .btn-print:hover {
          background-color: #059669;
        }
      </style>
    </head>
    <body>
      <div class="no-print-bar no-print">
        <span>ตัวอย่างก่อนพิมพ์รายงาน (Print Preview)</span>
        <button class="btn-print" onclick="window.print()">พิมพ์รายงาน (Print / Save PDF)</button>
      </div>

      <div class="header">
        <div>
          <div class="title">${title}</div>
          <div class="subtitle">ระบบจัดการคลังสินค้า WinStock</div>
        </div>
        <div class="meta-info">
          <div class="company-name">บริษัท WinStock จำกัด</div>
          <div style="margin-top: 5px;">พิมพ์เมื่อ: ${currentDate}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            ${headers.map(h => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              ${row.map(cell => `<td>${cell !== null && cell !== undefined ? cell : '-'}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${summaryText ? `
        <div class="summary-section">
          ${summaryText}
        </div>
      ` : ''}

      <div class="footer">
        รายงานนี้สร้างขึ้นโดยระบบ WinStock • สงวนลิขสิทธิ์ © ${new Date().getFullYear()}
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
};
