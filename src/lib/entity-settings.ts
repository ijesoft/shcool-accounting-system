import { prisma } from "@/lib/db"

export type RevenueRecognitionMethod = "term_straight_line" | "immediate"

export type VatRegistrationStatus = "vat_registered" | "non_vat" | "vat_exempt"

export type EwtType = "expanded" | "creditable" | "final"

export interface EwtRateConfig {
  ewtType: EwtType
  description: string
  rate: number
  birFormCode: string
}

export interface BirSerialRange {
  documentType: "invoice" | "official_receipt" | "acknowledgment_receipt"
  seriesPrefix: string
  startNumber: string
  endNumber: string
  accreditedPrinterTin: string
  permitNumber: string
  birSerialNumber: string
}

export interface EntitySettings {
  fiscalYearType?: 'calendar' | 'school_year'
  schoolYearStartMonth?: number
  revenueRecognitionMethod?: RevenueRecognitionMethod
  bir?: {
    vatRegistrationStatus?: VatRegistrationStatus
    businessName?: string
    businessAddress?: string
    vatRate?: number
    ewtRates?: EwtRateConfig[]
    serialRanges?: BirSerialRange[]
    casPermitNumber?: string
    casPermitDate?: string
    casRegistrationNumber?: string
  }
}

const DEFAULT_EWT_RATES: EwtRateConfig[] = [
  { ewtType: "expanded", description: "Professional fees", rate: 10, birFormCode: "0605E" },
  { ewtType: "expanded", description: "Rent", rate: 5, birFormCode: "0605E" },
  { ewtType: "creditable", description: "Sale of goods", rate: 2, birFormCode: "2307" },
  { ewtType: "final", description: "Interest income", rate: 20, birFormCode: "0619E" },
  { ewtType: "final", description: "Royalties", rate: 10, birFormCode: "0619E" },
]

const DEFAULT_SETTINGS: EntitySettings = {
  revenueRecognitionMethod: "term_straight_line",
  fiscalYearType: "calendar",
  schoolYearStartMonth: 6,
  bir: {
    vatRegistrationStatus: "vat_exempt",
    vatRate: 12,
    ewtRates: DEFAULT_EWT_RATES,
    serialRanges: [],
  },
}

export async function getEntitySettings(entityId: string): Promise<EntitySettings> {
  const entity = await prisma.entity.findUnique({
    where: { id: entityId },
    select: { settings: true },
  })
  if (!entity) {
    throw new Error("Entity not found")
  }

  const raw = (entity.settings ?? {}) as EntitySettings
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
  }
}

export async function updateEntitySettings(
  entityId: string,
  patch: Partial<EntitySettings>
): Promise<EntitySettings> {
  const current = await getEntitySettings(entityId)

  const merged: EntitySettings = { ...current }
    if (patch.fiscalYearType !== undefined) {
      merged.fiscalYearType = patch.fiscalYearType
    }
    if (patch.schoolYearStartMonth !== undefined) {
      merged.schoolYearStartMonth = patch.schoolYearStartMonth
    }
  if (patch.revenueRecognitionMethod !== undefined) {
    merged.revenueRecognitionMethod = patch.revenueRecognitionMethod
  }
  if (patch.bir) {
    merged.bir = {
      ...merged.bir,
      ...patch.bir,
      ewtRates: patch.bir.ewtRates ?? merged.bir?.ewtRates,
      serialRanges: patch.bir.serialRanges ?? merged.bir?.serialRanges,
    }
  }

  await prisma.entity.update({
    where: { id: entityId },
    data: { settings: merged as any },
  })

  return merged
}

export function getRevenueAccountForFeeType(feeType: string): string {
  const key = feeType.trim().toLowerCase().replace(/\s+/g, "_")
  const map: Record<string, string> = {
    tuition: "41100",
    misc: "41200",
    miscellaneous: "41200",
    laboratory: "41300",
    lab: "41300",
    other: "41400",
  }
  return map[key] ?? "41100"
}

export function getDeferredAccountForFeeType(
  feeType: string,
  method: RevenueRecognitionMethod
): string {
  if (method === "immediate") {
    return getRevenueAccountForFeeType(feeType)
  }

  const key = feeType.trim().toLowerCase().replace(/\s+/g, "_")
  if (key === "tuition" || key === "registration") {
    return "21300"
  }

  return getRevenueAccountForFeeType(feeType)
}

export async function getBirSettings(entityId: string): Promise<NonNullable<EntitySettings["bir"]>> {
  const settings = await getEntitySettings(entityId)
  return (
    settings.bir ?? {
      vatRegistrationStatus: "vat_exempt",
      vatRate: 12,
      ewtRates: DEFAULT_EWT_RATES,
      serialRanges: [],
    }
  )
}

export function isVatRegistered(
  settings: NonNullable<EntitySettings["bir"]>
): boolean {
  return settings.vatRegistrationStatus === "vat_registered"
}
