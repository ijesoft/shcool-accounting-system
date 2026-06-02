"use client"

export interface InvoicePrintLine {
  description: string
  quantity?: number
  unitPrice?: number
  vatExemptSales: number
  vatSales: number
  vatAmount: number
  total: number
}

export interface InvoicePrintProps {
  invoiceNumber: string
  invoiceDate: string
  dueDate?: string
  buyerName: string
  buyerAddress?: string
  buyerTin?: string
  sellerName: string
  sellerTin: string
  sellerAddress: string
  birSerialNumber?: string
  birPermitNumber?: string
  casPermitNumber?: string
  lines: InvoicePrintLine[]
  totalVatExempt: number
  totalVatSales: number
  totalVatAmount: number
  grandTotal: number
}

const phpFmt = (n: number) =>
  new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

export function InvoicePrint({
  invoiceNumber,
  invoiceDate,
  dueDate,
  buyerName,
  buyerAddress,
  buyerTin,
  sellerName,
  sellerTin,
  sellerAddress,
  birSerialNumber,
  birPermitNumber,
  casPermitNumber,
  lines,
  totalVatExempt,
  totalVatSales,
  totalVatAmount,
  grandTotal,
}: InvoicePrintProps) {
  return (
    <div
      className="print-invoice bg-white text-black"
      style={{ fontFamily: "Arial, sans-serif", fontSize: "11pt", padding: "20mm 15mm", maxWidth: "210mm", margin: "0 auto" }}
    >
      {/* Letterhead */}
      <div style={{ textAlign: "center", marginBottom: "8px" }}>
        <p style={{ fontWeight: "bold", fontSize: "14pt" }}>{sellerName}</p>
        <p style={{ fontSize: "9pt" }}>{sellerAddress}</p>
        <p style={{ fontSize: "9pt" }}>TIN: {sellerTin}</p>
        {birPermitNumber && <p style={{ fontSize: "9pt" }}>BIR Permit No.: {birPermitNumber}</p>}
        {casPermitNumber && <p style={{ fontSize: "9pt" }}>CAS Permit No.: {casPermitNumber}</p>}
      </div>

      <div style={{ textAlign: "center", margin: "10px 0", borderTop: "2px solid black", borderBottom: "2px solid black", padding: "4px 0" }}>
        <p style={{ fontWeight: "bold", fontSize: "13pt", letterSpacing: "2px" }}>SALES INVOICE</p>
      </div>

      {/* Invoice details */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
        <div>
          <span style={{ fontWeight: "bold" }}>Invoice No.: </span>
          <span style={{ fontWeight: "bold", fontSize: "12pt" }}>{invoiceNumber}</span>
          {birSerialNumber && (
            <span style={{ fontSize: "9pt", color: "#444", marginLeft: "8px" }}>(BIR Serial: {birSerialNumber})</span>
          )}
        </div>
        <div>
          <span style={{ fontWeight: "bold" }}>Date: </span>
          {new Date(invoiceDate).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}
        </div>
      </div>
      {dueDate && (
        <div style={{ marginBottom: "6px" }}>
          <span style={{ fontWeight: "bold" }}>Due Date: </span>
          {new Date(dueDate).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}
        </div>
      )}

      {/* Buyer info */}
      <div style={{ marginBottom: "6px" }}>
        <span style={{ fontWeight: "bold" }}>Sold to: </span>
        <span>{buyerName}</span>
      </div>
      {buyerAddress && (
        <div style={{ marginBottom: "6px" }}>
          <span style={{ fontWeight: "bold" }}>Address: </span>
          <span>{buyerAddress}</span>
        </div>
      )}
      {buyerTin && (
        <div style={{ marginBottom: "12px" }}>
          <span style={{ fontWeight: "bold" }}>TIN: </span>
          <span>{buyerTin}</span>
        </div>
      )}

      {/* Line items with VAT columns */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "12px", fontSize: "10pt" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid black", backgroundColor: "#f0f0f0" }}>
            <th style={{ textAlign: "left", padding: "4px 6px" }}>Description</th>
            <th style={{ textAlign: "right", padding: "4px 6px", width: "100px" }}>VAT Exempt</th>
            <th style={{ textAlign: "right", padding: "4px 6px", width: "100px" }}>VAT Sales</th>
            <th style={{ textAlign: "right", padding: "4px 6px", width: "80px" }}>VAT Amt</th>
            <th style={{ textAlign: "right", padding: "4px 6px", width: "100px" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "4px 6px" }}>{line.description}</td>
              <td style={{ textAlign: "right", padding: "4px 6px" }}>{phpFmt(line.vatExemptSales)}</td>
              <td style={{ textAlign: "right", padding: "4px 6px" }}>{phpFmt(line.vatSales)}</td>
              <td style={{ textAlign: "right", padding: "4px 6px" }}>{phpFmt(line.vatAmount)}</td>
              <td style={{ textAlign: "right", padding: "4px 6px", fontWeight: "bold" }}>{phpFmt(line.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: "2px solid black", backgroundColor: "#f0f0f0", fontWeight: "bold" }}>
            <td style={{ padding: "6px" }}>TOTAL</td>
            <td style={{ textAlign: "right", padding: "6px" }}>{phpFmt(totalVatExempt)}</td>
            <td style={{ textAlign: "right", padding: "6px" }}>{phpFmt(totalVatSales)}</td>
            <td style={{ textAlign: "right", padding: "6px" }}>{phpFmt(totalVatAmount)}</td>
            <td style={{ textAlign: "right", padding: "6px", fontSize: "12pt" }}>PHP {phpFmt(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>

      {/* VAT Summary */}
      <div style={{ marginLeft: "auto", width: "240px", marginBottom: "20px", fontSize: "9pt", border: "1px solid #ccc", padding: "6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>VAT Exempt Sales:</span><span>PHP {phpFmt(totalVatExempt)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Vatable Sales (excl. VAT):</span><span>PHP {phpFmt(totalVatSales)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>12% VAT:</span><span>PHP {phpFmt(totalVatAmount)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", borderTop: "1px solid black", paddingTop: "4px", marginTop: "4px" }}>
          <span>Amount Due:</span><span>PHP {phpFmt(grandTotal)}</span>
        </div>
      </div>

      <div style={{ borderTop: "1px solid black", paddingTop: "8px", textAlign: "center" }}>
        <p style={{ fontSize: "8pt", color: "#555" }}>
          This document is a BIR-registered Sales Invoice. TIN of Seller: {sellerTin}
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "30px" }}>
        <div style={{ textAlign: "center", width: "40%" }}>
          <div style={{ borderTop: "1px solid black", paddingTop: "4px" }}>
            <p style={{ fontSize: "9pt" }}>Received by / Customer&apos;s Signature</p>
          </div>
        </div>
        <div style={{ textAlign: "center", width: "40%" }}>
          <div style={{ borderTop: "1px solid black", paddingTop: "4px" }}>
            <p style={{ fontSize: "9pt" }}>Authorized Representative</p>
          </div>
        </div>
      </div>
    </div>
  )
}
