"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export function UserMenu({ fullName, roleName }: { fullName: string; roleName: string }) {
  const router = useRouter()

  async function handleLogout() {
    await fetch("/api/v1/auth/logout", { method: "POST" })
    router.push("/login")
  }

  return (
    <div className="flex items-center gap-4 px-4 py-3 border-t">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{fullName}</p>
        <p className="text-xs text-muted-foreground capitalize">{roleName.replace("_", " ")}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={handleLogout}>
        Logout
      </Button>
    </div>
  )
}
