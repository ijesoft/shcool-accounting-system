import { NavLinks } from "./nav-links"
import { UserMenu } from "./user-menu"

interface SidebarProps {
  fullName: string
  roleName: string
}

export function Sidebar({ fullName, roleName }: SidebarProps) {
  return (
    <aside className="flex h-full w-64 flex-col border-r bg-background">
      <div className="flex h-14 items-center border-b px-4 font-semibold">
        School Accounting
      </div>
      <NavLinks />
      <UserMenu fullName={fullName} roleName={roleName} />
    </aside>
  )
}
