export interface CashFlowEntry {
  section: "operating" | "investing" | "financing"
  label: string
  amount: number
  accountCode?: string
}
