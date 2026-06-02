"use client"

import { useState } from "react"
import { OfficialReceiptPrint, OfficialReceiptPrintProps } from "./OfficialReceiptPrint"

export function OfficialReceiptPrintWrapper({ printProps }: { printProps: OfficialReceiptPrintProps }) {
  const [showPrint, setShowPrint] = useState(false)

  function handlePrint() {
    setShowPrint(true)
    setTimeout(() => {
      window.print()
      setShowPrint(false)
    }, 200)
  }

  return (
    <>
      <button
        onClick={handlePrint}
        className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
      >
        Print Receipt
      </button>
      {showPrint && (
        <div className="hidden print:block">
          <OfficialReceiptPrint {...printProps} />
        </div>
      )}
    </>
  )
}
