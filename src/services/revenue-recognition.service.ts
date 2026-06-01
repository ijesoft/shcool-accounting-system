import { prisma } from "@/lib/db"
import { revenueRecognitionEngine } from "@/lib/accounting/revenue-recognition-engine"
import { studentAccountService } from "@/services/student-account.service"

export const revenueRecognitionService = {
  async run(
    entitySchema: string,
    entityId: string,
    userId: string,
    params: { periodStart: string; periodEnd: string; fiscalPeriodId?: string }
  ) {
    return revenueRecognitionEngine.runForPeriod(
      entitySchema,
      entityId,
      userId,
      params.periodStart,
      params.periodEnd,
      params.fiscalPeriodId
    )
  },

  async getRollForward(entitySchema: string, asOfDate: string) {
    return revenueRecognitionEngine.getRollForward(entitySchema, asOfDate)
  },

  async getArAging(entitySchema: string) {
    return studentAccountService.getAging(entitySchema)
  },
}
