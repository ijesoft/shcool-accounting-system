import { prisma } from "@/lib/db"

export const birSerialRangeService = {
  async list(entitySchema: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".bir_serial_range ORDER BY created_at DESC`
    )
  },

  async create(entitySchema: string, data: {
    documentType: "invoice" | "official_receipt" | "acknowledgment_receipt"
    seriesPrefix: string
    startNumber: string
    endNumber: string
    accreditedPrinterTin?: string
    permitNumber?: string
    birSerialNumber?: string
  }) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "${entitySchema}".bir_serial_range (
        document_type, series_prefix, start_number, end_number,
        accredited_printer_tin, permit_number, bir_serial_number
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      data.documentType,
      data.seriesPrefix,
      data.startNumber,
      data.endNumber,
      data.accreditedPrinterTin || null,
      data.permitNumber || null,
      data.birSerialNumber || null
    )
    return rows[0]
  },

  async update(entitySchema: string, id: string, data: {
    endNumber?: string
    accreditedPrinterTin?: string
    permitNumber?: string
    birSerialNumber?: string
    isActive?: boolean
  }) {
    const sets: string[] = []
    const vals: any[] = []
    let i = 1

    if (data.endNumber !== undefined) { sets.push(`end_number = $${i}`); vals.push(data.endNumber); i++ }
    if (data.accreditedPrinterTin !== undefined) { sets.push(`accredited_printer_tin = $${i}`); vals.push(data.accreditedPrinterTin); i++ }
    if (data.permitNumber !== undefined) { sets.push(`permit_number = $${i}`); vals.push(data.permitNumber); i++ }
    if (data.birSerialNumber !== undefined) { sets.push(`bir_serial_number = $${i}`); vals.push(data.birSerialNumber); i++ }
    if (data.isActive !== undefined) { sets.push(`is_active = $${i}`); vals.push(data.isActive); i++ }

    vals.push(id)
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `UPDATE "${entitySchema}".bir_serial_range SET ${sets.join(", ")}, created_at = NOW() WHERE id = $${i} RETURNING *`,
      ...vals
    )
    return rows[0] || null
  },

  async deactivate(entitySchema: string, id: string) {
    return this.update(entitySchema, id, { isActive: false })
  },
}
