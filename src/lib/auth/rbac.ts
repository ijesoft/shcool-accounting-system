export type Resource =
  | "accounts"
  | "journal_entries"
  | "official_receipts"
  | "cash_receipts"
  | "cash_disbursements"
  | "student_accounts"
  | "vendor_accounts"
  | "fixed_assets"
  | "bank_reconciliation"
  | "reports"
  | "users"
  | "entities"
  | "audit_log"
  | "fiscal_periods"
  | "employees"
  | "payroll"
  | "budget"

export type Action = "create" | "read" | "update" | "delete" | "post" | "approve" | "export" | "void" | "depreciate" | "dispose" | "submit" | "reject"

const rolePermissions: Record<string, { resource: Resource; action: Action }[]> = {
  super_admin: [
    { resource: "accounts", action: "create" },
    { resource: "accounts", action: "read" },
    { resource: "accounts", action: "update" },
    { resource: "accounts", action: "delete" },
    { resource: "journal_entries", action: "create" },
    { resource: "journal_entries", action: "read" },
    { resource: "journal_entries", action: "update" },
    { resource: "journal_entries", action: "post" },
    { resource: "journal_entries", action: "approve" },
    { resource: "reports", action: "read" },
    { resource: "reports", action: "export" },
    { resource: "users", action: "create" },
    { resource: "users", action: "read" },
    { resource: "users", action: "update" },
    { resource: "users", action: "delete" },
    { resource: "entities", action: "create" },
    { resource: "entities", action: "read" },
    { resource: "entities", action: "update" },
    { resource: "entities", action: "delete" },
    { resource: "audit_log", action: "read" },
    { resource: "official_receipts", action: "void" },
    { resource: "fiscal_periods", action: "create" },
    { resource: "fiscal_periods", action: "read" },
    { resource: "fiscal_periods", action: "update" },
    { resource: "student_accounts", action: "create" },
    { resource: "student_accounts", action: "read" },
    { resource: "student_accounts", action: "update" },
    { resource: "student_accounts", action: "delete" },
    { resource: "vendor_accounts", action: "create" },
    { resource: "vendor_accounts", action: "read" },
    { resource: "vendor_accounts", action: "update" },
    { resource: "vendor_accounts", action: "delete" },
    { resource: "cash_receipts", action: "create" },
    { resource: "cash_receipts", action: "read" },
    { resource: "cash_receipts", action: "update" },
    { resource: "cash_receipts", action: "delete" },
    { resource: "cash_receipts", action: "post" },
    { resource: "cash_disbursements", action: "create" },
    { resource: "cash_disbursements", action: "read" },
    { resource: "cash_disbursements", action: "update" },
    { resource: "cash_disbursements", action: "delete" },
    { resource: "cash_disbursements", action: "post" },
    { resource: "official_receipts", action: "create" },
    { resource: "official_receipts", action: "read" },
    { resource: "official_receipts", action: "update" },
    { resource: "official_receipts", action: "delete" },
    { resource: "official_receipts", action: "void" },
    { resource: "fixed_assets", action: "create" },
    { resource: "fixed_assets", action: "read" },
    { resource: "fixed_assets", action: "update" },
    { resource: "fixed_assets", action: "depreciate" },
    { resource: "fixed_assets", action: "dispose" },
    { resource: "bank_reconciliation", action: "create" },
    { resource: "bank_reconciliation", action: "read" },
    { resource: "bank_reconciliation", action: "update" },
    { resource: "bank_reconciliation", action: "post" },
    { resource: "employees", action: "create" },
    { resource: "employees", action: "read" },
    { resource: "employees", action: "update" },
    { resource: "employees", action: "delete" },
    { resource: "payroll", action: "create" },
    { resource: "payroll", action: "read" },
    { resource: "payroll", action: "post" },
    { resource: "payroll", action: "void" },
    { resource: "budget", action: "create" },
    { resource: "budget", action: "read" },
    { resource: "budget", action: "update" },
    { resource: "budget", action: "delete" },
  ],
  accountant: [
    { resource: "accounts", action: "create" },
    { resource: "accounts", action: "read" },
    { resource: "accounts", action: "update" },
    { resource: "journal_entries", action: "create" },
    { resource: "journal_entries", action: "read" },
    { resource: "journal_entries", action: "post" },
    { resource: "journal_entries", action: "approve" },
    { resource: "reports", action: "read" },
    { resource: "reports", action: "export" },
    { resource: "fiscal_periods", action: "read" },
    { resource: "student_accounts", action: "create" },
    { resource: "student_accounts", action: "read" },
    { resource: "student_accounts", action: "update" },
    { resource: "vendor_accounts", action: "create" },
    { resource: "vendor_accounts", action: "read" },
    { resource: "vendor_accounts", action: "update" },
    { resource: "cash_receipts", action: "create" },
    { resource: "cash_receipts", action: "read" },
    { resource: "cash_receipts", action: "post" },
    { resource: "cash_disbursements", action: "create" },
    { resource: "cash_disbursements", action: "read" },
    { resource: "cash_disbursements", action: "post" },
    { resource: "official_receipts", action: "read" },
    { resource: "official_receipts", action: "void" },
    { resource: "fixed_assets", action: "create" },
    { resource: "fixed_assets", action: "read" },
    { resource: "fixed_assets", action: "update" },
    { resource: "fixed_assets", action: "depreciate" },
    { resource: "fixed_assets", action: "dispose" },
    { resource: "bank_reconciliation", action: "create" },
    { resource: "bank_reconciliation", action: "read" },
    { resource: "bank_reconciliation", action: "update" },
    { resource: "bank_reconciliation", action: "post" },
    { resource: "employees", action: "read" },
    { resource: "employees", action: "create" },
    { resource: "employees", action: "update" },
    { resource: "payroll", action: "create" },
    { resource: "payroll", action: "read" },
    { resource: "payroll", action: "post" },
    { resource: "payroll", action: "void" },
    { resource: "budget", action: "create" },
    { resource: "budget", action: "read" },
    { resource: "budget", action: "update" },
    { resource: "budget", action: "delete" },
  ],
  finance_officer: [
    { resource: "accounts", action: "read" },
    { resource: "cash_receipts", action: "create" },
    { resource: "cash_receipts", action: "read" },
    { resource: "cash_receipts", action: "post" },
    { resource: "cash_disbursements", action: "create" },
    { resource: "cash_disbursements", action: "read" },
    { resource: "cash_disbursements", action: "post" },
    { resource: "student_accounts", action: "create" },
    { resource: "student_accounts", action: "read" },
    { resource: "student_accounts", action: "update" },
    { resource: "vendor_accounts", action: "create" },
    { resource: "vendor_accounts", action: "read" },
    { resource: "vendor_accounts", action: "update" },
    { resource: "official_receipts", action: "read" },
    { resource: "official_receipts", action: "void" },
    { resource: "reports", action: "read" },
    { resource: "fixed_assets", action: "read" },
    { resource: "bank_reconciliation", action: "read" },
    { resource: "bank_reconciliation", action: "create" },
  ],
  auditor: [
    { resource: "accounts", action: "read" },
    { resource: "journal_entries", action: "read" },
    { resource: "cash_receipts", action: "read" },
    { resource: "cash_disbursements", action: "read" },
    { resource: "student_accounts", action: "read" },
    { resource: "vendor_accounts", action: "read" },
    { resource: "official_receipts", action: "read" },
    { resource: "reports", action: "read" },
    { resource: "reports", action: "export" },
    { resource: "audit_log", action: "read" },
    { resource: "fixed_assets", action: "read" },
    { resource: "bank_reconciliation", action: "read" },
  ],
  cashier: [
    { resource: "cash_receipts", action: "create" },
    { resource: "cash_receipts", action: "read" },
    { resource: "official_receipts", action: "create" },
    { resource: "official_receipts", action: "read" },
    { resource: "official_receipts", action: "void" },
    { resource: "student_accounts", action: "read" },
    { resource: "reports", action: "read" },
  ],
}

export function hasPermission(
  roleName: string,
  resource: Resource,
  action: Action
): boolean {
  const permissions = rolePermissions[roleName]
  if (!permissions) return false
  return permissions.some((p) => p.resource === resource && p.action === action)
}

export function getPermissionsForRole(roleName: string): { resource: Resource; action: Action }[] {
  return rolePermissions[roleName] || []
}
