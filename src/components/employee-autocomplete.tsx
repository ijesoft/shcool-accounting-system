"use client"

import { PartyAutocomplete } from "./customer-autocomplete"

export function EmployeeAutocomplete(
  props: React.ComponentProps<typeof PartyAutocomplete>
) {
  return <PartyAutocomplete {...props} placeholder={props.placeholder ?? "Search employees…"} />
}
