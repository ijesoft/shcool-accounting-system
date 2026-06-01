import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import {
  updateEntitySettings,
  getEntitySettings,
  type RevenueRecognitionMethod,
  type VatRegistrationStatus,
  type EwtRateConfig,
  type BirSerialRange,
} from "@/lib/entity-settings"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }

    const settings = await getEntitySettings(id)
    return NextResponse.json(formatApiResponse(settings))
  } catch (error) {
    console.error("Get entity settings error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to get settings"), { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }
    if (!hasPermission(session.roleName, "entities", "update")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }

    const body = await request.json()
    const patch: {
      revenueRecognitionMethod?: RevenueRecognitionMethod
      bir?: {
        vatRegistrationStatus?: VatRegistrationStatus
        businessName?: string
        businessAddress?: string
        vatRate?: number
        ewtRates?: EwtRateConfig[]
        serialRanges?: BirSerialRange[]
      }
    } = {}

    if (body.revenueRecognitionMethod) {
      if (!["term_straight_line", "immediate"].includes(body.revenueRecognitionMethod)) {
        return NextResponse.json(formatApiError("ERR_VALIDATION", "Invalid revenue recognition method"), {
          status: 400,
        })
      }
      patch.revenueRecognitionMethod = body.revenueRecognitionMethod
    }

    if (body.bir) {
      const birPatch: typeof patch.bir = {}

      if (body.bir.vatRegistrationStatus) {
        if (!["vat_registered", "non_vat", "vat_exempt"].includes(body.bir.vatRegistrationStatus)) {
          return NextResponse.json(formatApiError("ERR_VALIDATION", "Invalid VAT registration status"), {
            status: 400,
          })
        }
        birPatch.vatRegistrationStatus = body.bir.vatRegistrationStatus
      }

      if (body.bir.businessName !== undefined) birPatch.businessName = body.bir.businessName
      if (body.bir.businessAddress !== undefined) birPatch.businessAddress = body.bir.businessAddress
      if (body.bir.vatRate !== undefined) birPatch.vatRate = body.bir.vatRate
      if (body.bir.ewtRates !== undefined) birPatch.ewtRates = body.bir.ewtRates
      if (body.bir.serialRanges !== undefined) birPatch.serialRanges = body.bir.serialRanges

      patch.bir = birPatch
    }

    const settings = await updateEntitySettings(id, patch)
    return NextResponse.json(formatApiResponse(settings))
  } catch (error) {
    console.error("Update entity settings error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to update settings"), { status: 500 })
  }
}
