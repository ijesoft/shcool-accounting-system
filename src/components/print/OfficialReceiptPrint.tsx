"use client"

export interface OfficialReceiptPrintProps {
  orNumber: string
  orDate: string
  payorName: string
  payorAddress?: string
  payorTin?: string
  sellerName: string
  sellerTin: string
  sellerAddress: string
  birSerialNumber?: string
  birPermitNumber?: string
  casPermitNumber?: string
  lines: { description: string; amount: number }[]
  total: number
}

function amountToWords(amount: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

  function convertBelow1000(n: number): string {
    if (n === 0) return ""
    if (n < 20) return ones[n]
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + ones[n % 10] : "")
    return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 !== 0 ? " " + convertBelow1000(n % 100) : "")
  }

  const intPart = Math.floor(amount)
  const centPart = Math.round((amount - intPart) * 100)

  let words = ""
  if (intPart === 0) {
    words = "Zero"
  } else {
    const millions = Math.floor(intPart / 1_000_000)
    const thousands = Math.floor((intPart % 1_000_000) / 1000)
    const remainder = intPart % 1000

    if (millions > 0) words += convertBelow1000(millions) + " Million "
    if (thousands > 0) words += convertBelow1000(thousands) + " Thousand "
    if (remainder > 0) words += convertBelow1000(remainder)
    words = words.trim()
  }

  return `${words} and ${String(centPart).padStart(2, "0")}/100`
}

const phpFmt = (n: number) =>
  new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

export function OfficialReceiptPrint({
  orNumber,
  orDate,
  payorName,
  payorAddress,
  payorTin,
  sellerName,
  sellerTin,
  sellerAddress,
  birSerialNumber,
  birPermitNumber,
  casPermitNumber,
  lines,
  total,
}: OfficialReceiptPrintProps) {
  return (
    <div
      className="print-or bg-white text-black"
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

      {/* Watermark-style heading */}
      <div style={{ textAlign: "center", margin: "10px 0", borderTop: "2px solid black", borderBottom: "2px solid black", padding: "4px 0" }}>
        <p style={{ fontWeight: "bold", fontSize: "13pt", letterSpacing: "2px" }}>OFFICIAL RECEIPT</p>
      </div>

      {/* OR Number and Date */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
        <div>
          <span style={{ fontWeight: "bold" }}>OR No.: </span>
          <span style={{ fontWeight: "bold", fontSize: "12pt" }}>{orNumber}</span>
          {birSerialNumber && (
            <span style={{ fontSize: "9pt", color: "#444", marginLeft: "8px" }}>(BIR Serial: {birSerialNumber})</span>
          )}
        </div>
        <div>
          <span style={{ fontWeight: "bold" }}>Date: </span>
          {new Date(orDate).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}
        </div>
      </div>

      {/* Received from */}
      <div style={{ marginBottom: "6px" }}>
        <span style={{ fontWeight: "bold" }}>Received from: </span>
        <span style={{ borderBottom: "1px solid black", paddingBottom: "1px" }}>{payorName}</span>
      </div>
      {payorAddress && (
        <div style={{ marginBottom: "6px" }}>
          <span style={{ fontWeight: "bold" }}>Address: </span>
          <span>{payorAddress}</span>
        </div>
      )}
      {payorTin && (
        <div style={{ marginBottom: "6px" }}>
          <span style={{ fontWeight: "bold" }}>TIN: </span>
          <span>{payorTin}</span>
        </div>
      )}

      {/* Amount in words */}
      <div style={{ marginBottom: "12px", padding: "6px", border: "1px solid #ccc", backgroundColor: "#f9f9f9" }}>
        <span style={{ fontWeight: "bold" }}>Amount in Words: </span>
        <span style={{ fontStyle: "italic" }}>Philippine Pesos {amountToWords(total)} Only</span>
      </div>

      {/* Line items */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "12px" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid black" }}>
            <th style={{ textAlign: "left", padding: "4px 6px", fontWeight: "bold" }}>Description</th>
            <th style={{ textAlign: "right", padding: "4px 6px", fontWeight: "bold", width: "120px" }}>Amount (PHP)</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "4px 6px" }}>{line.description}</td>
              <td style={{ textAlign: "right", padding: "4px 6px" }}>{phpFmt(line.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: "2px solid black" }}>
            <td style={{ padding: "6px", fontWeight: "bold", textAlign: "right" }}>TOTAL</td>
            <td style={{ padding: "6px", fontWeight: "bold", textAlign: "right", fontSize: "12pt" }}>
              PHP {phpFmt(total)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Footer */}
      <div style={{ borderTop: "1px solid black", paddingTop: "8px", textAlign: "center", marginTop: "20px" }}>
        <p style={{ fontWeight: "bold", letterSpacing: "1px", fontSize: "10pt" }}>
          THIS SERVES AS YOUR OFFICIAL RECEIPT
        </p>
        <p style={{ fontSize: "8pt", marginTop: "4px", color: "#555" }}>
          This document is not valid for claim of input tax.
        </p>
      </div>

      {/* Signature lines */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "30px" }}>
        <div style={{ textAlign: "center", width: "40%" }}>
          <div style={{ borderTop: "1px solid black", paddingTop: "4px" }}>
            <p style={{ fontSize: "9pt" }}>Received by / Payor&apos;s Signature</p>
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
