import { NavLinks } from "./nav-links"
import { UserMenu } from "./user-menu"
import { EntitySelector } from "./entity-selector"

interface SidebarProps {
  fullName: string
  roleName: string
  entityId?: string
}

export function Sidebar({ fullName, roleName, entityId }: SidebarProps) {
  return (
    <aside className="flex h-full w-64 flex-col border-r bg-background">
      <div className="flex h-14 items-center border-b px-4 font-semibold">
        School Accounting
      </div>
      <NavLinks />
      <EntitySelector currentEntityId={entityId} />
      <UserMenu fullName={fullName} roleName={roleName} />
    </aside>
  )
}
