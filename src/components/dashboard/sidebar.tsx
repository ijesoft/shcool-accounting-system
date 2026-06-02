"use client"

import { useState, useEffect } from "react"
import { NavLinks } from "./nav-links"
import { UserMenu } from "./user-menu"
import { EntitySelector } from "./entity-selector"

interface SidebarProps {
  fullName: string
  roleName: string
  entityId?: string
}

export function Sidebar({ fullName, roleName, entityId }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile) setIsOpen(false)
      else setIsOpen(true)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  const toggle = () => setIsOpen((prev) => !prev)

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile hamburger trigger (rendered outside the aside, in the main area) */}
      {isMobile && !isOpen && (
        <button
          onClick={toggle}
          className="fixed top-4 left-4 z-30 rounded-md border bg-background p-2 shadow-sm md:hidden"
          aria-label="Open menu"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      )}

      <aside
        className={[
          "flex flex-col border-r bg-background transition-all duration-200 ease-in-out",
          isMobile
            ? `fixed top-0 left-0 h-full z-30 ${isOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full"}`
            : `h-full ${isOpen ? "w-64" : "w-16"}`,
        ].join(" ")}
      >
        {/* Header with toggle */}
        <div className="flex h-14 items-center border-b px-3 gap-2">
          <button
            onClick={toggle}
            className="rounded-md p-1.5 hover:bg-accent transition-colors flex-shrink-0"
            aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {isOpen ? (
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            ) : (
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
          {isOpen && <span className="font-semibold text-sm truncate">School Accounting</span>}
        </div>

        <NavLinks collapsed={!isOpen} />
        {isOpen && (
          <>
            <EntitySelector currentEntityId={entityId} />
            <UserMenu fullName={fullName} roleName={roleName} />
          </>
        )}
        {!isOpen && !isMobile && (
          <div className="mt-auto border-t px-2 py-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary mx-auto">
              {fullName.charAt(0).toUpperCase()}
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
