export function maskTin(tin: string): string {
  if (!tin) return ""
  const parts = tin.split("-")
  if (parts.length < 3) {
    const visible = tin.slice(-4)
    return "*".repeat(tin.length - 4) + visible
  }
  return parts
    .map((part, idx) => (idx < parts.length - 2 ? part.replace(/\d/g, "*") : part))
    .join("-")
}

export function maskSalary(_amount: number): string {
  return "PHP ****"
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function amountInWords(amount: number): string {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
    "Sixteen", "Seventeen", "Eighteen", "Nineteen",
  ]
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

  function convertBelow1000(n: number): string {
    if (n === 0) return ""
    if (n < 20) return ones[n]
    if (n < 100) {
      const t = tens[Math.floor(n / 10)]
      const o = n % 10
      return o > 0 ? `${t}-${ones[o]}` : t
    }
    const h = Math.floor(n / 100)
    const remainder = n % 100
    const hundredStr = `${ones[h]} Hundred`
    return remainder > 0 ? `${hundredStr} ${convertBelow1000(remainder)}` : hundredStr
  }

  const intPart = Math.floor(Math.abs(amount))
  const centPart = Math.round((Math.abs(amount) - intPart) * 100)
  const negative = amount < 0 ? "Negative " : ""

  if (intPart === 0 && centPart === 0) return "Zero and 00/100"

  let words = ""
  const billions = Math.floor(intPart / 1_000_000_000)
  const millions = Math.floor((intPart % 1_000_000_000) / 1_000_000)
  const thousands = Math.floor((intPart % 1_000_000) / 1000)
  const remainder = intPart % 1000

  if (billions > 0) words += convertBelow1000(billions) + " Billion "
  if (millions > 0) words += convertBelow1000(millions) + " Million "
  if (thousands > 0) words += convertBelow1000(thousands) + " Thousand "
  if (remainder > 0) words += convertBelow1000(remainder)
  words = words.trim() || "Zero"

  return `${negative}${words} and ${String(centPart).padStart(2, "0")}/100`
}
