import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { fiscalCalendarService } from "@/services/fiscal-calendar.service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FiscalPeriodActions } from "./period-actions"

export const dynamic = "force-dynamic"

export default async function FiscalPeriodsPage() {
  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!session.entityId) {
    return <p className="p-6 text-muted-foreground">Please select an entity.</p>
  }
  if (
    !hasPermission(session.roleName, "fiscal_periods", "read") &&
    !hasPermission(session.roleName, "fiscal_periods", "update")
  ) {
    redirect("/")
  }

  const years = await fiscalCalendarService.listYears(session.entityId)
  const canManage = hasPermission(session.roleName, "fiscal_periods", "update")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Fiscal Periods</h1>
        <p className="text-sm text-muted-foreground">
          Manage accounting periods for the selected entity. Posting requires an open period.
        </p>
      </div>

      {years.length === 0 && (
        <Card>
          <CardContent className="p-6 text-muted-foreground">
            No fiscal calendar found. Run database seed or create a fiscal year via API.
          </CardContent>
        </Card>
      )}

      {years.map((year) => (
        <Card key={year.id}>
          <CardHeader>
            <CardTitle>
              {year.label}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({new Date(year.startDate).toLocaleDateString()} –{" "}
                {new Date(year.endDate).toLocaleDateString()})
                {year.isClosed ? " · Closed" : " · Open"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-2 font-medium">Period</th>
                  <th className="p-2 font-medium">Start</th>
                  <th className="p-2 font-medium">End</th>
                  <th className="p-2 font-medium">Status</th>
                  {canManage && <th className="p-2 font-medium text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {year.periods.map((period) => (
                  <tr key={period.id} className="border-b">
                    <td className="p-2">{period.periodNumber}</td>
                    <td className="p-2">{new Date(period.startDate).toLocaleDateString()}</td>
                    <td className="p-2">{new Date(period.endDate).toLocaleDateString()}</td>
                    <td className="p-2 capitalize">
                      {period.isClosed ? "Closed" : "Open"}
                    </td>
                    {canManage && (
                      <td className="p-2 text-right">
                        <FiscalPeriodActions periodId={period.id} isClosed={period.isClosed} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
