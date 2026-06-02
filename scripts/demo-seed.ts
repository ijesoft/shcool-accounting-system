/**
 * Demo Seed v2 — SY 2025-2026, Q1 (July–September 2025)
 * Uses correct account codes from the CHED-compliant chart of accounts.
 * Run: npx tsx scripts/demo-seed.ts
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const SCHEMA = "entity_main"

async function exec(sql: string, ...p: any[]) {
  await prisma.$executeRawUnsafe(sql, ...p)
}
async function q<T = any>(sql: string, ...p: any[]): Promise<T[]> {
  return prisma.$queryRawUnsafe<T[]>(sql, ...p)
}

async function getAccounts(): Promise<Record<string, string>> {
  const rows = await q<{ account_code: string; id: string }>(
    `SELECT account_code, id FROM "${SCHEMA}".account WHERE is_active = TRUE`
  )
  return Object.fromEntries(rows.map(r => [r.account_code, r.id]))
}

async function getFP(date: string): Promise<string | null> {
  const rows = await q<{ id: string }>(
    `SELECT fp.id FROM public.fiscal_period fp
     JOIN public.fiscal_year fy ON fy.id = fp.fiscal_year_id
     JOIN public.entity e ON e.id = fy.entity_id
     WHERE e.schema_name = $1 AND $2::date BETWEEN fp.start_date AND fp.end_date LIMIT 1`,
    SCHEMA, date
  )
  return rows[0]?.id ?? null
}

async function postJE(opts: {
  date: string; src: "JE"|"AR"|"AP"|"CM"|"CD"|"FA"|"BR"|"DR"
  desc: string; uid: string; fp: string|null
  lines: { acc: string; dr: number; cr: number; d?: string }[]
}): Promise<string> {
  const [ns] = await q<{ prefix: string; next_number: number }>(
    `SELECT prefix, next_number FROM "${SCHEMA}".number_series WHERE series_type = 'JE' AND fiscal_year_id IS NULL LIMIT 1`
  )
  const num = `${ns?.prefix ?? "JE"}-${String(ns?.next_number ?? 1).padStart(5,"0")}`
  await exec(`UPDATE "${SCHEMA}".number_series SET next_number = next_number + 1 WHERE series_type = 'JE' AND fiscal_year_id IS NULL`)
  const [je] = await q<{ id: string }>(
    `INSERT INTO "${SCHEMA}".journal_entry
       (entry_number, entry_date, source_module, description, status, posted_at, posted_by, fiscal_period_id, created_by)
     VALUES ($1, $2::date, $3, $4, 'posted', NOW(), $5::uuid, $6::uuid, $5::uuid) RETURNING id`,
    num, opts.date, opts.src, opts.desc, opts.uid, opts.fp
  )
  for (let i = 0; i < opts.lines.length; i++) {
    const l = opts.lines[i]
    await exec(
      `INSERT INTO "${SCHEMA}".journal_entry_line
         (journal_entry_id, account_id, debit, credit, line_description, line_order)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)`,
      je.id, l.acc, l.dr, l.cr, l.d ?? opts.desc, i + 1
    )
  }
  return je.id
}

async function main() {
  console.log("🌱  Demo seed v2 …")

  const guard = await q<{ cnt: string }>(`SELECT COUNT(*)::text AS cnt FROM "${SCHEMA}".student`)
  if (Number(guard[0].cnt) > 0) {
    console.log("⚠️  Students exist — run cleanup first then retry.")
    return
  }

  const [adminUser] = await q<{ id: string }>(`SELECT id FROM public.user_account WHERE email = 'admin@school.edu' LIMIT 1`)
  if (!adminUser) throw new Error("Admin user not found")
  const uid = adminUser.id

  const A = await getAccounts()
  const check = (code: string) => { if (!A[code]) throw new Error(`Account ${code} not found`) }

  // Verify key accounts exist
  for (const c of ["11111","11121","11211","33010","41120","42100","42300",
                    "55110","55140","55150","55160","55170","55210","55220",
                    "56210","57220","57230","21110","21430","21510","21520",
                    "21530","21610","12141","12142","12150","12162","12170"]) {
    check(c)
  }
  console.log("  ✓ All account codes verified")

  const fpJul = await getFP("2025-07-01")
  const fpAug = await getFP("2025-08-01")
  const fpSep = await getFP("2025-09-01")
  const fpOct = await getFP("2025-10-01")

  // ── 1. Opening balance ────────────────────────────────────────────────────
  console.log("  → Opening balance …")
  await postJE({ date:"2025-07-01", src:"JE", uid, fp:fpJul, desc:"Opening balance — SY 2025-2026",
    lines:[
      { acc:A["11121"], dr:850000, cr:0,      d:"Cash in Bank — BDO Operating" },
      { acc:A["11111"], dr: 50000, cr:0,      d:"Cash on Hand — Main Office" },
      { acc:A["33010"], dr:0,      cr:900000, d:"Fund Balance — Unrestricted" },
    ]
  })

  // ── 2. Bank accounts ──────────────────────────────────────────────────────
  console.log("  → Bank accounts …")
  await q(`INSERT INTO "${SCHEMA}".bank_account (bank_name, account_number, account_type) VALUES ('Land Bank of the Philippines','1234-5678-90','savings')`)
  await q(`INSERT INTO "${SCHEMA}".bank_account (bank_name, account_number, account_type) VALUES ('BDO Unibank','9876-5432-10','checking')`)

  // ── 3. Students ───────────────────────────────────────────────────────────
  console.log("  → Students …")
  const STUDENTS = [
    { num:"2025-0001", name:"Maria Cristina Santos",    grade:"Grade 11", course:"STEM" },
    { num:"2025-0002", name:"Juan Paolo Cruz",           grade:"Grade 12", course:"ABM" },
    { num:"2025-0003", name:"Ana Liza Reyes",            grade:"Grade 11", course:"HUMSS" },
    { num:"2025-0004", name:"Pedro Jose Dela Cruz",      grade:"Grade 12", course:"STEM" },
    { num:"2025-0005", name:"Elena Marie Garcia",        grade:"Grade 11", course:"ABM" },
    { num:"2025-0006", name:"Miguel Angel Torres",       grade:"Grade 12", course:"HUMSS" },
    { num:"2025-0007", name:"Sofia Isabella Mendoza",    grade:"Grade 11", course:"STEM" },
    { num:"2025-0008", name:"Carlos Roberto Flores",     grade:"Grade 12", course:"ABM" },
    { num:"2025-0009", name:"Isabella Grace Ramos",      grade:"Grade 11", course:"HUMSS" },
    { num:"2025-0010", name:"Antonio Miguel Bautista",   grade:"Grade 12", course:"STEM" },
  ]
  const SID: Record<string,string> = {}
  for (const s of STUDENTS) {
    const [r] = await q<{id:string}>(`INSERT INTO "${SCHEMA}".student (student_number, full_name, grade_level, course, status) VALUES ($1,$2,$3,$4,'enrolled') RETURNING id`, s.num, s.name, s.grade, s.course)
    SID[s.num] = r.id
  }

  // ── 4. Student invoices + JEs ─────────────────────────────────────────────
  console.log("  → Student invoices …")
  const INVOICES = [
    { num:"2025-0001", paid:30000 }, { num:"2025-0002", paid:30000 },
    { num:"2025-0003", paid:30000 }, { num:"2025-0004", paid:30000 },
    { num:"2025-0005", paid:15000 }, // partial → AR balance PHP 15,000
    { num:"2025-0006", paid:30000 }, { num:"2025-0007", paid:30000 },
    { num:"2025-0008", paid:10000 }, // partial → AR balance PHP 20,000
    { num:"2025-0009", paid:30000 }, { num:"2025-0010", paid:30000 },
  ]
  const tuition = 25000, misc = 2000, lab = 3000, total = tuition + misc + lab

  const INVID: Record<string,string> = {}
  let invSeq = 1, pmtSeq = 1, orSeq = 1
  for (const inv of INVOICES) {
    const sid = SID[inv.num]
    const invNum = `INV-${String(invSeq++).padStart(5,"0")}`
    const invDate = "2025-07-05"
    const [invRow] = await q<{id:string}>(
      `INSERT INTO "${SCHEMA}".student_invoice
         (invoice_number, student_id, term, term_start_date, term_end_date, invoice_date, due_date, total_amount, balance, status)
       VALUES ($1,$2::uuid,'1st Sem SY 2025-2026','2025-07-01','2025-12-31',$3::date,'2025-07-31',$4,$4,'unpaid') RETURNING id`,
      invNum, sid, invDate, total
    )
    INVID[inv.num] = invRow.id

    await exec(
      `INSERT INTO "${SCHEMA}".student_invoice_line (invoice_id, fee_type, amount) VALUES ($1::uuid,'tuition',$2), ($1::uuid,'misc',$3), ($1::uuid,'lab',$4)`,
      invRow.id, tuition, misc, lab
    )

    // Billing JE: DR AR, CR Revenue
    const fpInv = await getFP(invDate)
    await postJE({ date:invDate, src:"AR", uid, fp:fpInv, desc:`Tuition billing — ${STUDENTS.find(s=>s.num===inv.num)!.name}`,
      lines:[
        { acc:A["11211"], dr:total,  cr:0,    d:"AR — Tuition receivable" },
        { acc:A["41120"], dr:0,      cr:25000, d:"Tuition Revenue — SHS" },
        { acc:A["42300"], dr:0,      cr:2000,  d:"Registration Fees" },
        { acc:A["42100"], dr:0,      cr:3000,  d:"Laboratory Fees" },
      ]
    })
  }

  // ── 5. Payments + ORs ─────────────────────────────────────────────────────
  console.log("  → Payments & official receipts …")
  const PAY_DATES: Record<string,string> = {
    "2025-0001":"2025-07-08","2025-0002":"2025-07-09","2025-0003":"2025-07-10",
    "2025-0004":"2025-07-11","2025-0005":"2025-07-14","2025-0006":"2025-07-15",
    "2025-0007":"2025-07-16","2025-0008":"2025-07-17","2025-0009":"2025-08-05",
    "2025-0010":"2025-08-06",
  }
  for (const inv of INVOICES) {
    if (inv.paid === 0) continue
    const sid = SID[inv.num]
    const invId = INVID[inv.num]
    const student = STUDENTS.find(s => s.num === inv.num)!
    const payDate = PAY_DATES[inv.num]
    const orNum = `OR-${String(orSeq++).padStart(5,"0")}`
    const pmtNum = `PMT-${String(pmtSeq++).padStart(5,"0")}`

    const [orRow] = await q<{id:string}>(
      `INSERT INTO "${SCHEMA}".official_receipt
         (or_number, or_date, student_id, payor_name, amount, vat_exempt_amount, status, created_by)
       VALUES ($1,$2::date,$3::uuid,$4,$5,$5,'active',$6::uuid) RETURNING id`,
      orNum, payDate, sid, student.name, inv.paid, uid
    )
    await exec(
      `INSERT INTO "${SCHEMA}".official_receipt_line (official_receipt_id, description, amount, vat_exempt_sales) VALUES ($1::uuid,'Tuition & Fees',$2,$2)`,
      orRow.id, inv.paid
    )
    await exec(
      `INSERT INTO "${SCHEMA}".payment_transaction (transaction_number, student_id, invoice_id, payment_date, amount, payment_method, payor_name, official_receipt_id) VALUES ($1,$2::uuid,$3::uuid,$4::date,$5,'cash',$6,$7::uuid)`,
      pmtNum, sid, invId, payDate, inv.paid, student.name, orRow.id
    )
    await exec(
      `UPDATE "${SCHEMA}".student_invoice SET balance = balance - $1, status = CASE WHEN balance - $1 <= 0 THEN 'paid' ELSE 'partial' END WHERE id = $2::uuid`,
      inv.paid, invId
    )
    // Cash receipt JE: DR Cash, CR AR
    const fpPmt = await getFP(payDate)
    await postJE({ date:payDate, src:"CM", uid, fp:fpPmt, desc:`Cash receipt — ${student.name} (${orNum})`,
      lines:[
        { acc:A["11121"], dr:inv.paid, cr:0,        d:`OR ${orNum}` },
        { acc:A["11211"], dr:0,        cr:inv.paid, d:"AR cleared" },
      ]
    })
  }

  // ── 6. Vendors ────────────────────────────────────────────────────────────
  console.log("  → Vendors …")
  const VENDORS: Record<string,{id:string; name:string}> = {}
  for (const v of [
    { key:"meralco", code:"V-001", name:"Manila Electric Company (MERALCO)", tin:"000-111-222-000" },
    { key:"mwater",  code:"V-002", name:"Manila Water Corporation",          tin:"000-222-333-000" },
    { key:"dataone", code:"V-003", name:"DataOne Internet Services",         tin:"000-333-444-000" },
    { key:"abcsup",  code:"V-004", name:"ABC Office Supplies Inc.",          tin:"000-444-555-000" },
    { key:"xyzmaint",code:"V-005", name:"XYZ Maintenance Services",         tin:"000-555-666-000" },
  ]) {
    const [r] = await q<{id:string}>(
      `INSERT INTO "${SCHEMA}".vendor_account (vendor_code, vendor_name, tin, payment_terms, is_active) VALUES ($1,$2,$3,'Net 30',TRUE) RETURNING id`,
      v.code, v.name, v.tin
    )
    VENDORS[v.key] = { id: r.id, name: v.name }
  }

  // ── 7. Vendor invoices + disbursements ────────────────────────────────────
  console.log("  → Disbursements …")
  type DisbDef = { vk:string; date:string; amount:number; desc:string; expAcc:string; ewt?:number }
  const DISBS: DisbDef[] = [
    { vk:"meralco",  date:"2025-07-31", amount:18500, desc:"Electricity July 2025",    expAcc:"55220" },
    { vk:"meralco",  date:"2025-08-31", amount:17200, desc:"Electricity August 2025",  expAcc:"55220" },
    { vk:"mwater",   date:"2025-07-31", amount: 5800, desc:"Water July 2025",          expAcc:"55220" },
    { vk:"dataone",  date:"2025-08-15", amount: 3500, desc:"Internet August 2025",     expAcc:"55220" },
    { vk:"abcsup",   date:"2025-09-05", amount:12400, desc:"Office Supplies",          expAcc:"55210" },
    { vk:"xyzmaint", date:"2025-10-10", amount:45000, desc:"Building Maintenance Q1",  expAcc:"56210", ewt:2 },
  ]
  let viSeq = 1, cvSeq = 1
  for (const d of DISBS) {
    const vendor = VENDORS[d.vk]
    const ewt = d.ewt ? d.amount * d.ewt / 100 : 0
    const net = d.amount - ewt
    const viNum = `VI-${String(viSeq++).padStart(5,"0")}`
    const cvNum = `CV-${String(cvSeq++).padStart(5,"0")}`

    const [vi] = await q<{id:string}>(
      `INSERT INTO "${SCHEMA}".vendor_invoice (invoice_number, vendor_id, invoice_date, due_date, total_amount, balance, status) VALUES ($1,$2::uuid,$3::date,$3::date,$4,0,'paid') RETURNING id`,
      viNum, vendor.id, d.date, d.amount
    )
    const [cv] = await q<{id:string}>(
      `INSERT INTO "${SCHEMA}".disbursement (cv_number, cv_date, payee_type, payee_name, amount, payment_method, withholding_tax_amount, withholding_tax_rate, status, ap_invoice_id, created_by) VALUES ($1,$2::date,'vendor',$3,$4,'check',$5,$6,'paid',$7::uuid,$8::uuid) RETURNING id`,
      cvNum, d.date, vendor.name, d.amount, ewt, d.ewt ?? null, vi.id, uid
    )

    if (d.ewt && ewt > 0) {
      await exec(
        `INSERT INTO "${SCHEMA}".withholding_tax_register (ewt_type, bir_form_code, disbursement_id, payee_name, payee_tin, base_amount, tax_rate, tax_withheld, withholding_date) VALUES ('expanded','2307',$1::uuid,$2,$3,$4,$5,$6,$7::date)`,
        cv.id, vendor.name, "000-555-666-000", d.amount, d.ewt, ewt, d.date
      )
    }

    // Disbursement JE: DR Expense, (CR EWT Payable), CR Cash
    const fpD = await getFP(d.date)
    const jelines: any[] = [{ acc:A[d.expAcc], dr:d.amount, cr:0, d:d.desc }]
    if (ewt > 0) jelines.push({ acc:A["21430"], dr:0, cr:ewt,  d:`EWT 2% withheld` })
    jelines.push({ acc:A["11121"], dr:0, cr:net, d:`${cvNum} net payment` })
    await postJE({ date:d.date, src:"CD", uid, fp:fpD, desc:d.desc, lines:jelines })
  }

  // ── 8. Employees ─────────────────────────────────────────────────────────
  console.log("  → Employees …")
  const EMP_DEFS = [
    { code:"EMP-001", name:"Lourdes A. Villanueva", pos:"School Principal",    dept:"Administration", tin:"111-222-333-001", basic:65000, allow:5000 },
    { code:"EMP-002", name:"Roberto M. Castillo",   pos:"Senior Teacher",      dept:"Academic",       tin:"111-222-333-002", basic:35000, allow:2000 },
    { code:"EMP-003", name:"Maribel F. Santos",     pos:"Teacher",             dept:"Academic",       tin:"111-222-333-003", basic:32000, allow:2000 },
    { code:"EMP-004", name:"Jose P. Peralta",       pos:"Accountant",          dept:"Finance",        tin:"111-222-333-004", basic:28000, allow:1500 },
    { code:"EMP-005", name:"Nelia R. Aquino",       pos:"Admin Staff",         dept:"Administration", tin:"111-222-333-005", basic:22000, allow:1000 },
  ]
  const EMPIDS: string[] = []
  for (const e of EMP_DEFS) {
    const [r] = await q<{id:string}>(
      `INSERT INTO "${SCHEMA}".employee (employee_code, full_name, position, department, tin, basic_pay, allowances, is_active, hire_date) VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,'2024-06-01') RETURNING id`,
      e.code, e.name, e.pos, e.dept, e.tin, e.basic, e.allow
    )
    EMPIDS.push(r.id)
  }

  // ── 9. Payroll (July + August) ─────────────────────────────────────────────
  console.log("  → Payroll runs …")
  const PAY_LINES = [
    { idx:0, basic:65000, allow:5000, sssEE:1350, sssER:2850, phEE:1625, phER:1625, hdmfEE:100, hdmfER:100, wht:12000 },
    { idx:1, basic:35000, allow:2000, sssEE:1350, sssER:2850, phEE:875,  phER:875,  hdmfEE:100, hdmfER:100, wht:2000  },
    { idx:2, basic:32000, allow:2000, sssEE:1350, sssER:2850, phEE:800,  phER:800,  hdmfEE:100, hdmfER:100, wht:1500  },
    { idx:3, basic:28000, allow:1500, sssEE:1260, sssER:2660, phEE:700,  phER:700,  hdmfEE:100, hdmfER:100, wht:500   },
    { idx:4, basic:22000, allow:1000, sssEE:990,  sssER:2090, phEE:550,  phER:550,  hdmfEE:100, hdmfER:100, wht:0     },
  ]
  const sumBasic  = PAY_LINES.reduce((s,l) => s + l.basic,  0)
  const sumAllow  = PAY_LINES.reduce((s,l) => s + l.allow,  0)
  const sumGross  = sumBasic + sumAllow
  const sumSssEE  = PAY_LINES.reduce((s,l) => s + l.sssEE,  0)
  const sumSssER  = PAY_LINES.reduce((s,l) => s + l.sssER,  0)
  const sumPhEE   = PAY_LINES.reduce((s,l) => s + l.phEE,   0)
  const sumPhER   = PAY_LINES.reduce((s,l) => s + l.phER,   0)
  const sumHdmfEE = PAY_LINES.reduce((s,l) => s + l.hdmfEE, 0)
  const sumHdmfER = PAY_LINES.reduce((s,l) => s + l.hdmfER, 0)
  const sumWHT    = PAY_LINES.reduce((s,l) => s + l.wht,    0)
  const sumEEDed  = sumSssEE + sumPhEE + sumHdmfEE + sumWHT
  const sumNet    = sumGross - sumEEDed
  const sum13th   = Math.round(sumBasic / 12)

  let prSeq = 1
  for (const [month, prDate, pStart, pEnd, fpPR] of [
    ["July",   "2025-07-31","2025-07-01","2025-07-31", fpJul],
    ["August", "2025-08-31","2025-08-01","2025-08-31", fpAug],
  ]) {
    const runNum = `PR-${String(prSeq++).padStart(5,"0")}`
    const [prRow] = await q<{id:string}>(
      `INSERT INTO "${SCHEMA}".payroll_run (run_number, run_date, pay_period_start, pay_period_end, status, total_gross_pay, total_deductions, total_net_pay, created_by) VALUES ($1,$2::date,$3::date,$4::date,'posted',$5,$6,$7,$8::uuid) RETURNING id`,
      runNum, prDate, pStart, pEnd, sumGross, sumEEDed, sumNet, uid
    )
    for (const pl of PAY_LINES) {
      const gross = pl.basic + pl.allow
      const eed = pl.sssEE + pl.phEE + pl.hdmfEE + pl.wht
      await exec(
        `INSERT INTO "${SCHEMA}".payroll_run_line (payroll_run_id, employee_id, basic_pay, allowances, gross_pay, sss_employee, sss_employer, philhealth_employee, philhealth_employer, pagibig_employee, pagibig_employer, withholding_tax, total_deductions, net_pay, thirteenth_month_accrual) VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        prRow.id, EMPIDS[pl.idx], pl.basic, pl.allow, gross, pl.sssEE, pl.sssER, pl.phEE, pl.phER, pl.hdmfEE, pl.hdmfER, pl.wht, eed, gross-eed, Math.round(pl.basic/12)
      )
    }
    // Payroll JE (split contributions by type)
    await postJE({ date:prDate as string, src:"DR", uid, fp:fpPR??null, desc:`Payroll — ${month} 2025 (${runNum})`,
      lines:[
        { acc:A["55110"], dr:sumGross,   cr:0,        d:"Salaries & wages — gross pay" },
        { acc:A["55140"], dr:sumSssER,   cr:0,        d:"SSS employer contribution" },
        { acc:A["55150"], dr:sumPhER,    cr:0,        d:"PhilHealth employer contribution" },
        { acc:A["55160"], dr:sumHdmfER,  cr:0,        d:"Pag-IBIG employer contribution" },
        { acc:A["11121"], dr:0, cr:sumNet,     d:"Cash — net pay disbursed" },
        { acc:A["21510"], dr:0, cr:sumSssEE+sumSssER, d:"SSS contributions payable" },
        { acc:A["21520"], dr:0, cr:sumPhEE+sumPhER,   d:"PhilHealth contributions payable" },
        { acc:A["21530"], dr:0, cr:sumHdmfEE+sumHdmfER,d:"Pag-IBIG contributions payable" },
        { acc:A["21430"], dr:0, cr:sumWHT,    d:"Withholding tax on compensation" },
      ]
    })
    // 13th month accrual JE
    await postJE({ date:prDate as string, src:"JE", uid, fp:fpPR??null, desc:`13th month accrual — ${month} 2025`,
      lines:[
        { acc:A["55170"], dr:sum13th, cr:0,       d:"13th month expense accrual" },
        { acc:A["21610"], dr:0,       cr:sum13th, d:"13th month payable" },
      ]
    })
  }

  // ── 10. Fixed assets ───────────────────────────────────────────────────────
  console.log("  → Fixed assets …")
  const [fa1] = await q<{id:string}>(`INSERT INTO "${SCHEMA}".fixed_asset (asset_code, asset_name, asset_category, acquisition_date, acquisition_cost, estimated_life_years, salvage_value, depreciation_method, status) VALUES ('FA-001','Dell Computer Lab (20 units)','computer','2025-07-15',480000,5,0,'straight_line','active') RETURNING id`)
  await postJE({ date:"2025-07-15", src:"FA", uid, fp:fpJul, desc:"Purchase — Computer Lab",
    lines:[ { acc:A["12141"], dr:480000, cr:0 }, { acc:A["11121"], dr:0, cr:480000 } ]})

  const [fa2] = await q<{id:string}>(`INSERT INTO "${SCHEMA}".fixed_asset (asset_code, asset_name, asset_category, acquisition_date, acquisition_cost, estimated_life_years, salvage_value, depreciation_method, status) VALUES ('FA-002','Carrier Air Conditioning (5 units)','equipment','2025-07-01',125000,10,0,'straight_line','active') RETURNING id`)
  await postJE({ date:"2025-07-01", src:"FA", uid, fp:fpJul, desc:"Purchase — Air Conditioning",
    lines:[ { acc:A["12142"], dr:125000, cr:0 }, { acc:A["11121"], dr:0, cr:125000 } ]})

  const [fa3] = await q<{id:string}>(`INSERT INTO "${SCHEMA}".fixed_asset (asset_code, asset_name, asset_category, acquisition_date, acquisition_cost, estimated_life_years, salvage_value, depreciation_method, status) VALUES ('FA-003','Toyota HiAce School Service','vehicle','2025-08-01',750000,8,50000,'straight_line','active') RETURNING id`)
  await postJE({ date:"2025-08-01", src:"FA", uid, fp:fpAug, desc:"Purchase — Toyota HiAce",
    lines:[ { acc:A["12162"], dr:750000, cr:0 }, { acc:A["11121"], dr:0, cr:750000 } ]})

  // Monthly depreciation
  type DeprEntry = { asId:string; date:string; fp:string|null; amt:number; accumAcc:string; expAcc:string }
  const DEPR: DeprEntry[] = [
    { asId:fa1.id, date:"2025-07-31", fp:fpJul, amt:8000, accumAcc:"12150", expAcc:"57220" },
    { asId:fa1.id, date:"2025-08-31", fp:fpAug, amt:8000, accumAcc:"12150", expAcc:"57220" },
    { asId:fa1.id, date:"2025-09-30", fp:fpSep, amt:8000, accumAcc:"12150", expAcc:"57220" },
    { asId:fa2.id, date:"2025-07-31", fp:fpJul, amt:1042, accumAcc:"12150", expAcc:"57220" },
    { asId:fa2.id, date:"2025-08-31", fp:fpAug, amt:1042, accumAcc:"12150", expAcc:"57220" },
    { asId:fa2.id, date:"2025-09-30", fp:fpSep, amt:1042, accumAcc:"12150", expAcc:"57220" },
    { asId:fa3.id, date:"2025-08-31", fp:fpAug, amt:7813, accumAcc:"12170", expAcc:"57230" },
    { asId:fa3.id, date:"2025-09-30", fp:fpSep, amt:7813, accumAcc:"12170", expAcc:"57230" },
  ]
  let totalDepr = 0
  for (const d of DEPR) {
    await exec(`INSERT INTO "${SCHEMA}".depreciation_entry (fixed_asset_id, depreciation_amount) VALUES ($1::uuid,$2)`, d.asId, d.amt)
    await exec(`UPDATE "${SCHEMA}".fixed_asset SET accumulated_depreciation = accumulated_depreciation + $1 WHERE id = $2::uuid`, d.amt, d.asId)
    totalDepr += d.amt
    await postJE({ date:d.date, src:"FA", uid, fp:d.fp, desc:`Monthly depreciation — ${d.date}`,
      lines:[ { acc:A[d.expAcc], dr:d.amt, cr:0 }, { acc:A[d.accumAcc], dr:0, cr:d.amt } ]})
  }

  // ── 11. Budgets ────────────────────────────────────────────────────────────
  console.log("  → Budgets …")
  const [fyRow] = await q<{id:string}>(`SELECT fy.id FROM public.fiscal_year fy JOIN public.entity e ON e.id = fy.entity_id WHERE e.schema_name = $1 ORDER BY fy.start_date DESC LIMIT 1`, SCHEMA)
  if (fyRow) {
    for (const [code, amount] of [
      ["41120",1800000],["42100",180000],["42300",240000],
      ["55110",2400000],["55140",264000],["55150",264000],["55160",72000],["55170",200000],
      ["55210",120000],["55220",360000],["56210",180000],["57220",240000],["57230",112500],
    ]) {
      if (!A[code as string]) continue
      await exec(
        `INSERT INTO "${SCHEMA}".budget (fiscal_year_id, account_id, budgeted_amount, notes, created_by) VALUES ($1::uuid,$2::uuid,$3,'Annual Budget SY 2025-2026',$4::uuid) ON CONFLICT (fiscal_year_id, account_id) DO UPDATE SET budgeted_amount = $3`,
        fyRow.id, A[code as string], amount, uid
      )
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const [jeC] = await q<{n:string}>(`SELECT COUNT(*)::text n FROM "${SCHEMA}".journal_entry WHERE status='posted'`)
  const [orC] = await q<{n:string}>(`SELECT COUNT(*)::text n FROM "${SCHEMA}".official_receipt`)
  const [stC] = await q<{n:string}>(`SELECT COUNT(*)::text n FROM "${SCHEMA}".student`)

  console.log("\n✅  Demo seed complete!")
  console.log(`   Students             : ${stC.n}`)
  console.log(`   Official Receipts    : ${orC.n}`)
  console.log(`   Posted JEs           : ${jeC.n}`)
  console.log(`   Fixed Assets         : 3  (total depr PHP ${totalDepr.toLocaleString()})`)
  console.log(`   Payroll Runs         : 2  (July + August 2025)`)
  console.log(`   AR outstanding       : PHP 35,000 (2 students partial payment)`)
  console.log("\n  Reports to verify:")
  console.log("  Trial Balance     → /reports/trial-balance")
  console.log("  Income Statement  → /reports/income-statement  (set Jul–Sep 2025)")
  console.log("  Balance Sheet     → /reports/balance-sheet     (as of Sep 30 2025)")
  console.log("  Cash Flow         → /reports/cash-flow         (Jul–Sep 2025)")
  console.log("  AR Aging          → /reports/ar-aging")
  console.log("  Budget vs Actual  → /budget-vs-actual")
  console.log("  SAWT (EWT)        → /bir/sawt  (Oct 2025)")
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
