export interface DepreciationLine {
  periodDate: string
  depreciationAmount: number
  accumulatedDepreciation: number
  netBookValue: number
}

export interface DepreciationSchedule {
  assetId: string
  method: string
  lines: DepreciationLine[]
}

export const depreciationEngine = {
  calculateStraightLine(
    cost: number,
    salvageValue: number,
    usefulLifeYears: number,
    acquisitionDate: string,
    totalPeriods: number
  ): DepreciationLine[] {
    const depreciableBase = cost - salvageValue
    const monthlyDepreciation = depreciableBase / (usefulLifeYears * 12)
    const lines: DepreciationLine[] = []
    let accumulated = 0

    for (let i = 0; i < totalPeriods; i++) {
      const periodDate = new Date(acquisitionDate)
      periodDate.setMonth(periodDate.getMonth() + i + 1)

      const remaining = depreciableBase - accumulated
      const amount = Math.min(monthlyDepreciation, remaining)
      accumulated += amount

      lines.push({
        periodDate: periodDate.toISOString().split("T")[0],
        depreciationAmount: Math.round(amount * 100) / 100,
        accumulatedDepreciation: Math.round(accumulated * 100) / 100,
        netBookValue: Math.round((cost - accumulated) * 100) / 100,
      })
    }

    return lines
  },

  calculateDecliningBalance(
    cost: number,
    salvageValue: number,
    usefulLifeYears: number,
    acquisitionDate: string,
    totalPeriods: number
  ): DepreciationLine[] {
    const rate = 2 / usefulLifeYears
    const monthlyRate = 1 - Math.pow(1 - rate, 1 / 12)
    const lines: DepreciationLine[] = []
    let bookValue = cost
    let accumulated = 0

    for (let i = 0; i < totalPeriods; i++) {
      const periodDate = new Date(acquisitionDate)
      periodDate.setMonth(periodDate.getMonth() + i + 1)

      const amount = Math.min(bookValue * monthlyRate, bookValue - salvageValue)
      accumulated += amount
      bookValue -= amount

      lines.push({
        periodDate: periodDate.toISOString().split("T")[0],
        depreciationAmount: Math.round(amount * 100) / 100,
        accumulatedDepreciation: Math.round(accumulated * 100) / 100,
        netBookValue: Math.round(bookValue * 100) / 100,
      })
    }

    return lines
  },

  calculateSumOfYearsDigits(
    cost: number,
    salvageValue: number,
    usefulLifeYears: number,
    acquisitionDate: string,
    totalPeriods: number
  ): DepreciationLine[] {
    const depreciableBase = cost - salvageValue
    const sumOfYears = (usefulLifeYears * (usefulLifeYears + 1)) / 2
    const lines: DepreciationLine[] = []
    let accumulated = 0
    let remainingYears = usefulLifeYears

    for (let year = 0; year < usefulLifeYears && year < Math.ceil(totalPeriods / 12); year++) {
      const yearFraction = remainingYears / sumOfYears
      const yearDepreciation = depreciableBase * yearFraction
      remainingYears--

      for (let month = 0; month < 12; month++) {
        const periodIdx = year * 12 + month
        if (periodIdx >= totalPeriods) break

        const periodDate = new Date(acquisitionDate)
        periodDate.setMonth(periodDate.getMonth() + periodIdx + 1)

        const monthlyAmount = yearDepreciation / 12
        const remaining = depreciableBase - accumulated
        const amount = Math.min(monthlyAmount, remaining)
        accumulated += amount

        lines.push({
          periodDate: periodDate.toISOString().split("T")[0],
          depreciationAmount: Math.round(amount * 100) / 100,
          accumulatedDepreciation: Math.round(accumulated * 100) / 100,
          netBookValue: Math.round((cost - accumulated) * 100) / 100,
        })
      }
    }

    return lines
  },

  generateSchedule(
    method: string,
    cost: number,
    salvageValue: number,
    usefulLifeYears: number,
    acquisitionDate: string,
    totalPeriods: number
  ): DepreciationSchedule {
    let lines: DepreciationLine[]

    switch (method) {
      case "straight_line":
        lines = this.calculateStraightLine(cost, salvageValue, usefulLifeYears, acquisitionDate, totalPeriods)
        break
      case "declining_balance":
        lines = this.calculateDecliningBalance(cost, salvageValue, usefulLifeYears, acquisitionDate, totalPeriods)
        break
      case "sum_of_years":
        lines = this.calculateSumOfYearsDigits(cost, salvageValue, usefulLifeYears, acquisitionDate, totalPeriods)
        break
      default:
        lines = this.calculateStraightLine(cost, salvageValue, usefulLifeYears, acquisitionDate, totalPeriods)
    }

    return {
      assetId: "",
      method,
      lines,
    }
  },
}
