#!/usr/bin/env node
/**
 * E2E Tests for School Accounting System
 * Tests: CRUD operations, RBAC, API routes
 */

const BASE_URL = "http://localhost:3000"
let cookie = ""
const FY2026_ID = "a00770a5-be77-46fa-9cfe-7a913880e142"
const TUITION_ACCT_ID = "db555d6f-b68c-49bb-92b2-e521a7b3f040"
const SALARY_ACCT_ID = "1c8f0e6d-5e0f-4f1a-9b3c-2d4e5f6a7b8c" // will be discovered at runtime

async function login(email, password) {
  const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  const cookies = res.headers.getSetCookie()
  const newCookie = cookies.find((c) => c.startsWith("school_acct_session="))?.split(";")[0]
  if (newCookie) cookie = newCookie
  const json = await res.json().catch(() => null)
  return { ok: res.ok, data: json?.data ?? json, status: res.status }
}

async function req(path, opts = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "Cookie": cookie,
      ...opts.headers,
    },
  })
  const json = await res.json().catch(() => null)
  return { ok: res.ok, data: json?.data ?? json, status: res.status }
}

const results = { pass: 0, fail: 0, errors: [] }

function ok(name) { results.pass++; console.log(`  ✓ ${name}`) }
function fail(name, msg) {
  results.fail++
  results.errors.push(`${name}: ${msg}`)
  console.log(`  ✗ ${name} — ${msg}`)
}

// ============ AUTH ============
async function testAuth() {
  console.log("\n=== AUTH ===")
  const r = await login("admin@school.edu", "admin123")
  if (r.ok && r.data?.id) ok("Admin login"); else fail("Admin login", `status ${r.status}`)

  const r2 = await login("admin@school.edu", "wrong")
  if (!r2.ok) ok("Wrong password rejected"); else fail("Wrong password", "should fail")

  const r3 = await login("nobody@x.com", "x")
  if (!r3.ok) ok("Unknown user rejected"); else fail("Unknown user", "should fail")

  // Session persistence
  const afterLogin = await req("/api/v1/employees")
  if (afterLogin.ok || afterLogin.status === 403) ok("Session persists after login"); else fail("Session", `status ${afterLogin.status}`)
}

// ============ EMPLOYEE CRUD ============
async function testEmployeeCRUD() {
  console.log("\n=== EMPLOYEE CRUD ===")
  const empCode = `EMP${Date.now()}`

  // CREATE
  const c = await req("/api/v1/employees", {
    method: "POST",
    body: JSON.stringify({ employeeCode: empCode, fullName: "Juan DC", basicPay: 25000 }),
  })
  if (c.ok && c.data?.id) ok("Create employee"); else { fail("Create employee", `status ${c.status}`); return }
  const empId = c.data.id

  // READ all
  const l = await req("/api/v1/employees")
  if (l.ok && Array.isArray(l.data) && l.data.length > 0) ok("List employees"); else fail("List employees", `status ${l.status}`)

  // READ by ID
  const g = await req(`/api/v1/employees/${empId}`)
  if (g.ok && (g.data?.fullName === "Juan DC" || g.data?.full_name === "Juan DC")) ok("Get employee by ID"); else fail("Get employee", `status ${g.status}, name: ${g.data?.fullName || g.data?.full_name}`)

  // UPDATE
  const u = await req(`/api/v1/employees/${empId}`, {
    method: "PUT",
    body: JSON.stringify({ basicPay: 30000 }),
  })
  const updated = u.data?.basicPay === 30000 || u.data?.basic_pay === "30000" || u.data?.basic_pay === 30000
  if (u.ok && updated) ok("Update employee"); else fail("Update employee", `status ${u.status}, data: ${JSON.stringify(u.data).slice(0, 100)}`)

  // DELETE (soft delete)
  const d = await req(`/api/v1/employees/${empId}`, { method: "DELETE" })
  if (d.ok) ok("Delete employee (soft)"); else fail("Delete employee", `status ${d.status}`)

  // Verify soft delete - should return 404 or inactive
  const v = await req(`/api/v1/employees/${empId}`)
  if (v.status === 404 || !v.data?.id || v.data?.is_active === false || v.data?.isActive === false) ok("Soft delete verified"); else fail("Soft delete", "still active")
}

// ============ PAYROLL CRUD ============
async function testPayrollCRUD() {
  console.log("\n=== PAYROLL CRUD ===")
  const empCode = `EMP${Date.now()}`

  // Create employee
  const e = await req("/api/v1/employees", {
    method: "POST",
    body: JSON.stringify({ employeeCode: empCode, fullName: "Maria S", basicPay: 35000 }),
  })
  if (!e.ok || !e.data?.id) { fail("Payroll: create employee", `status ${e.status}`); return }
  const empId = e.data.id

  // CREATE pay run
  const p = await req("/api/v1/payroll-runs", {
    method: "POST",
    body: JSON.stringify({ runDate: "2026-06-15", payPeriodStart: "2026-06-01", payPeriodEnd: "2026-06-15", employeeIds: [empId] }),
  })
  if (!p.ok || !p.data?.id) { fail("Create payroll run", `status ${p.status}, ${JSON.stringify(p.data).slice(0, 200)}`); return }
  const prId = p.data.id

  // READ pay run
  const g = await req(`/api/v1/payroll-runs/${prId}`)
  if (g.ok && g.data?.id === prId) ok("Get payroll run"); else fail("Get payroll run", `status ${g.status}`)

  // List pay runs
  const list = await req("/api/v1/payroll-runs")
  if (list.ok) ok("List payroll runs"); else fail("List payroll runs", `status ${list.status}`)

  // Payslip
  const ps = await req(`/api/v1/payroll-runs/${prId}/payslip?employeeId=${empId}`)
  if (ps.ok) ok("Payslip HTML"); else fail("Payslip", `status ${ps.status}`)

  // Register CSV
  const rc = await req(`/api/v1/payroll-runs/${prId}/register?format=csv`)
  if (rc.ok) ok("Register CSV"); else fail("Register CSV", `status ${rc.status}`)

  // Register XLSX
  const rx = await req(`/api/v1/payroll-runs/${prId}/register?format=xlsx`)
  if (rx.ok) ok("Register XLSX"); else fail("Register XLSX", `status ${rx.status}`)

  // POST to GL
  const po = await req(`/api/v1/payroll-runs/${prId}/post`, { method: "POST" })
  if (po.ok) ok("Post to GL"); else fail("Post to GL", `status ${po.status}, ${JSON.stringify(po.data).slice(0, 200)}`)

  // VOID
  const vo = await req(`/api/v1/payroll-runs/${prId}/void`, {
    method: "POST",
    body: JSON.stringify({ reason: "Test void" }),
  })
  if (vo.ok) ok("Void pay run"); else fail("Void pay run", `status ${vo.status}, ${JSON.stringify(vo.data).slice(0, 200)}`)
}

// ============ BUDGET CRUD ============
async function testBudgetCRUD() {
  console.log("\n=== BUDGET CRUD ===")
  // CREATE
  const c = await req("/api/v1/budgets", {
    method: "POST",
    body: JSON.stringify({ fiscalYearId: FY2026_ID, accountId: TUITION_ACCT_ID, budgetedAmount: 5000000 }),
  })
  if (!c.ok || !c.data?.id) { fail("Create budget", `status ${c.status}, ${JSON.stringify(c.data).slice(0, 200)}`); return }
  const bId = c.data.id

  // READ
  const g = await req(`/api/v1/budgets/${bId}`)
  if (g.ok && g.data?.id === bId) ok("Get budget"); else fail("Get budget", `status ${g.status}`)

  // UPDATE
  const u = await req(`/api/v1/budgets/${bId}`, {
    method: "PUT",
    body: JSON.stringify({ budgetedAmount: 6000000 }),
  })
  if (u.ok && (u.data?.budgetedAmount === 6000000 || u.data?.budgeted_amount === "6000000" || u.data?.budgeted_amount === 6000000 || u.data?.budgeted_amount === "6000000.00")) ok("Update budget"); else fail("Update budget", `status ${u.status}, data: ${JSON.stringify(u.data).slice(0, 200)}`)

  // Compare
  const cmp = await req(`/api/v1/budgets/compare?fiscalYearId=${FY2026_ID}`)
  if (cmp.ok) ok("Budget vs Actual"); else fail("Budget vs Actual", `status ${cmp.status}`)

  // DELETE
  const d = await req(`/api/v1/budgets/${bId}`, { method: "DELETE" })
  if (d.ok || d.status === 204) ok("Delete budget"); else fail("Delete budget", `status ${d.status}`)
}

// ============ JOURNAL ENTRY ROUTES ============
async function testJournalEntryRoutes() {
  console.log("\n=== JOURNAL ENTRY ROUTES ===")
  // List JEs
  const list = await req("/api/v1/journal-entries")
  if (list.ok) ok("List journal entries"); else fail("List JEs", `status ${list.status}`)
}

// ============ CHART OF ACCOUNTS ROUTE ============
async function testAccountRoutes() {
  console.log("\n=== ACCOUNT ROUTES ===")
  const list = await req("/api/v1/accounts")
  if (list.ok && Array.isArray(list.data)) ok("List accounts"); else fail("List accounts", `status ${list.status}`)
}

// ============ RBAC ============
async function testRBAC() {
  console.log("\n=== RBAC ===")
  // Re-login to ensure session
  await login("admin@school.edu", "admin123")

  // Admin access to all resources
  const e = await req("/api/v1/employees")
  if (e.ok) ok("Admin: employees accessible"); else fail("Admin: employees", `status ${e.status}`)

  const b = await req("/api/v1/budgets")
  if (b.ok) ok("Admin: budgets accessible"); else fail("Admin: budgets", `status ${b.status}`)

  const p = await req("/api/v1/payroll-runs")
  if (p.ok) ok("Admin: payroll accessible"); else fail("Admin: payroll", `status ${p.status}`)

  const j = await req("/api/v1/journal-entries")
  if (j.ok) ok("Admin: journal entries accessible"); else fail("Admin: JEs", `status ${j.status}`)

  const a = await req("/api/v1/accounts")
  if (a.ok) ok("Admin: accounts accessible"); else fail("Admin: accounts", `status ${a.status}`)

  // Unauthenticated access denied
  cookie = ""
  const routes = ["/api/v1/employees", "/api/v1/budgets", "/api/v1/payroll-runs", "/api/v1/journal-entries", "/api/v1/accounts"]
  for (const path of routes) {
    const u = await req(path)
    if (!u.ok && u.status !== 200) ok(`Unauthenticated: ${path} denied`); else fail(`Unauthenticated: ${path}`, `status ${u.status}`)
  }
}

// ============ PAGE ROUTES ============
async function testPageRoutes() {
  console.log("\n=== PAGE ROUTES ===")
  // Re-login
  await login("admin@school.edu", "admin123")

  const pages = [
    { path: "/", name: "Dashboard" },
    { path: "/accounts", name: "Chart of Accounts" },
    { path: "/journal-entries", name: "Journal Entries" },
    { path: "/payroll", name: "Payroll" },
    { path: "/budget-vs-actual", name: "Budget vs Actual" },
  ]

  for (const page of pages) {
    const res = await fetch(`${BASE_URL}${page.path}`, { headers: { Cookie: cookie } })
    if (res.status === 200 || res.status === 307) ok(`${page.name} (${page.path})`); else fail(`${page.name}`, `status ${res.status}`)
  }
}

// ============ 404 ROUTES ============
async function testNotFoundRoutes() {
  console.log("\n=== 404 ROUTES ===")
  const res = await fetch(`${BASE_URL}/nonexistent-route`)
  if (res.status === 404) ok("Unknown route returns 404"); else fail("Unknown route", `status ${res.status}`)
}

// ============ API ERROR HANDLING ============
async function testApiErrors() {
  console.log("\n=== API ERROR HANDLING ===")
  // Re-login
  await login("admin@school.edu", "admin123")

  // Invalid JSON
  const res = await fetch(`${BASE_URL}/api/v1/employees`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: "not-json",
  })
  if (!res.ok) ok("Invalid JSON rejected"); else fail("Invalid JSON", "should fail")

  // Missing required fields
  const r2 = await req("/api/v1/employees", {
    method: "POST",
    body: JSON.stringify({}),
  })
  if (!r2.ok) ok("Missing required fields rejected"); else fail("Missing fields", "should fail")
}

// ============ MAIN ============
async function main() {
  console.log("Starting E2E tests...\n")
  try {
    await testAuth()
    await testEmployeeCRUD()
    await testPayrollCRUD()
    await testBudgetCRUD()
    await testJournalEntryRoutes()
    await testAccountRoutes()
    await testRBAC()
    await testPageRoutes()
    await testNotFoundRoutes()
    await testApiErrors()
  } catch (err) {
    fail("Unhandled", err.message)
  }
  console.log("\n=== RESULTS ===")
  console.log(`Passed: ${results.pass}`)
  console.log(`Failed: ${results.fail}`)
  if (results.errors.length) {
    console.log("\nFailures:")
    for (const e of results.errors) console.log(`  - ${e}`)
  }
  console.log(`\nTotal: ${results.pass + results.fail}`)
  process.exit(results.fail > 0 ? 1 : 0)
}

main()
