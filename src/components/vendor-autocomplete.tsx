"use client"

import { PartyAutocomplete, type PartyOption } from "./customer-autocomplete"

export function VendorAutocomplete(
  props: Omit<React.ComponentProps<typeof PartyAutocomplete>, "parties"> & {
    parties: PartyOption[]
  }
) {
  return <PartyAutocomplete {...props} placeholder={props.placeholder ?? "Search vendors…"} />
}
