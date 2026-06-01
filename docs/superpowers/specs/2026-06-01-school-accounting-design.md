# School Accounting System — Design Specification

**Date:** 2026-06-01
**Status:** Draft
**Version:** 1.0

---

## 1. Business Context

### 1.1 Overview
The School Accounting System is a standalone financial management system for Philippine educational institutions (mixed K-12 + College) with multi-entity support (multiple campuses/schools). It is **not** a Student Information System — student data is limited to accounting-relevant information (billing, receivables, payments).

### 1.2 Key Requirements
- Full double-entry bookkeeping per PH GAAP (based on IFRS)
- BIR compliance (VAT 12%, Withholding Tax, Percentage Tax, Official Receipts)
- Multi-entity: each school/campus operates as an independent accounting entity
- Mixed school type: K-12 and College programs with different fee structures
- ~100 concurrent users, ~100,000 transactions/month
- On-premise deployment via Docker Compose with Nginx

### 1.3 Functional Modules
1. Chart of Accounts
2. Journal Entries
3. General Ledger
4. Trial Balance
5. Balance Sheet
6. Income Statement
7. Cash Flow Statement
8. Student Accounts Receivable
9. Accounts Payable
10. Cash Receipts
11. Cash Disbursements
12. Official Receipts
13. Bank Reconciliation
14. Fixed Assets
15. Depreciation
16. Audit Trail
17. Financial Reports
18. User Roles & Permissions

---

## 2. Architecture

### 2.1 Approach: Modular Monolith + Event-Driven Posting
Selected over microservices (overkill, distributed tx risk) and DB-centric (traps logic in stored procedures).

### 2.2 Component Stack
```
Nginx (reverse proxy, TLS, rate limiting)
  └── Next.js Application Server (API + Web)
        ├── App Router (pages + API routes)
        ├── Service Layer (business logic)
        ├── Domain Layer (entities, value objects)
        └── Repository Layer (Prisma ORM)
              └── PostgreSQL (single database, schema-per-entity)
                    └── Redis (session cache, job queue)
```

### 2.3 Multi-Tenancy: PostgreSQL Schema-Per-Entity
Each school/campus gets its own PostgreSQL schema. The `public` schema holds cross-cutting data (entities, users, global settings). This provides:
- Strong data isolation
- Entity-specific backup/restore
- No cross-entity data leakage
- Simplified per-entity fiscal year management

### 2.4 Key Architectural Decisions
| Decision | Rationale |
|----------|-----------|
| Modular monolith | Fits 100 users/100k txns; single deployable for on-premise |
| Event-driven posting via DB outbox | Audit trail without message broker complexity |
| Prisma ORM | Type-safe queries, migrations, multi-schema support |
| Schema-per-entity | Cleaner than row-level tenant_id for accounting data |
| Redis | Lightweight: session cache + rate limiting + report job queue |

---

## 3. Database Design

### 3.1 Entity / Tenant Model (public schema)
```sql
entity (
  id UUID PK DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  tin VARCHAR(20),                           -- BIR Tax Identification Number
  address TEXT,
  fiscal_year_start DATE NOT NULL,           -- e.g. '2024-07-01'
  status ENUM('active','inactive') DEFAULT 'active',
  schema_name VARCHAR(63) UNIQUE NOT NULL,    -- PostgreSQL schema name
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

fiscal_year (
  id UUID PK,
  entity_id UUID FK NOT NULL,
  label VARCHAR(20) NOT NULL,                -- e.g. "SY 2024-2025"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_closed BOOLEAN DEFAULT FALSE,
  UNIQUE(entity_id, label)
)

fiscal_period (
  id UUID PK,
  fiscal_year_id UUID FK NOT NULL,
  period_number INT NOT NULL,                -- 1-12 (or 1-13 for 4-4-5 calendar)
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_closed BOOLEAN DEFAULT FALSE,
  UNIQUE(fiscal_year_id, period_number)
)
```

### 3.2 Chart of Accounts (per-entity schema)
```sql
account (
  id UUID PK DEFAULT gen_random_uuid(),
  account_code VARCHAR(20) NOT NULL,
  account_name VARCHAR(200) NOT NULL,
  account_type ENUM(
    'asset','liability','equity','revenue','expense','contra_asset','contra_revenue','contra_liability'
  ) NOT NULL,
  normal_balance ENUM('debit','credit') NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  parent_id UUID REFERENCES account(id),
  level INT NOT NULL DEFAULT 0,              -- 0=root, 1=group, 2=sub-group, 3=postable
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_code)
)
```

### 3.3 Journal Entry (Source of Truth — per-entity schema)
```sql
journal_entry (
  id UUID PK DEFAULT gen_random_uuid(),
  entry_number VARCHAR(30) NOT NULL,          -- e.g. "JE-2024-00001"
  entry_date DATE NOT NULL,
  reference VARCHAR(50),                      -- OR#, CV#, DV#, etc.
  source_module ENUM('JE','AR','AP','CM','CD','FA','BR') NOT NULL,
  description TEXT,
  status ENUM('draft','posted','void') DEFAULT 'draft',
  posted_at TIMESTAMPTZ,
  posted_by UUID,                             -- user id
  approved_by UUID,
  fiscal_period_id UUID FK NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entry_number),
  UNIQUE(source_module, reference) WHERE reference IS NOT NULL  -- anti-duplicate
)

journal_entry_line (
  id UUID PK DEFAULT gen_random_uuid(),
  journal_entry_id UUID FK NOT NULL,
  account_id UUID FK NOT NULL,
  debit DECIMAL(18,2) DEFAULT 0,
  credit DECIMAL(18,2) DEFAULT 0,
  line_description TEXT,
  line_order INT NOT NULL,
  CONSTRAINT chk_non_negative CHECK (debit >= 0 AND credit >= 0),
  CONSTRAINT chk_at_least_one CHECK (debit > 0 OR credit > 0)
)
```

### 3.4 General Ledger (Derived — per-entity schema)
```sql
general_ledger (
  id UUID PK DEFAULT gen_random_uuid(),
  account_id UUID FK NOT NULL,
  fiscal_period_id UUID FK NOT NULL,
  normal_balance ENUM('debit','credit') NOT NULL,
  beginning_balance DECIMAL(18,2) NOT NULL,
  total_debits DECIMAL(18,2) DEFAULT 0,
  total_credits DECIMAL(18,2) DEFAULT 0,
  ending_balance DECIMAL(18,2) GENERATED ALWAYS AS (
    CASE WHEN normal_balance = 'debit'
      THEN beginning_balance + total_debits - total_credits
      ELSE beginning_balance - total_debits + total_credits
    END
  ) STORED,
  last_journal_entry_id UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, fiscal_period_id)
)
```

### 3.5 Number Series (per-entity schema)
```sql
number_series (
  id UUID PK,
  series_type ENUM('JE','OR','CV','CDV','PO','DV') NOT NULL,
  prefix VARCHAR(10) NOT NULL,               -- e.g. "JE", "OR"
  starting_number INT NOT NULL DEFAULT 1,
  next_number INT NOT NULL DEFAULT 1,
  suffix VARCHAR(10),                        -- e.g. fiscal year suffix
  fiscal_year_id UUID FK,
  UNIQUE(series_type, fiscal_year_id)
)
```

### 3.6 Official Receipts (per-entity schema)
```sql
official_receipt (
  id UUID PK,
  or_number VARCHAR(30) NOT NULL UNIQUE,
  or_date DATE NOT NULL,
  cash_receipt_id UUID FK,
  student_id UUID,                            -- optional for non-student payors
  payor_name VARCHAR(200) NOT NULL,
  payor_address TEXT,
  tin VARCHAR(20),
  amount DECIMAL(18,2) NOT NULL,
  vat_amount DECIMAL(18,2) DEFAULT 0,
  vat_exempt_amount DECIMAL(18,2) DEFAULT 0,
  vat_rate DECIMAL(5,2) DEFAULT 12.00,
  is_zero_rated BOOLEAN DEFAULT FALSE,
  journal_entry_id UUID FK,                   -- links to the underlying JE
  status ENUM('active','void') DEFAULT 'active',
  void_reason TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- BIR-mandated fields
  bir_serial_number VARCHAR(50),
  bir_ Accredited_printer TIN VARCHAR(20),
  bir_permit_number VARCHAR(50)
)

official_receipt_line (
  id UUID PK,
  official_receipt_id UUID FK NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  vat_sales DECIMAL(18,2) DEFAULT 0,
  vat_exempt_sales DECIMAL(18,2) DEFAULT 0,
  zero_rated_sales DECIMAL(18,2) DEFAULT 0,
  vat_amount DECIMAL(18,2) DEFAULT 0
)
```

### 3.7 Student Accounts (per-entity schema)
```sql
student (
  id UUID PK,
  student_number VARCHAR(30) NOT NULL UNIQUE,
  full_name VARCHAR(200) NOT NULL,
  course VARCHAR(100),                         -- for college
  grade_level VARCHAR(20),                     -- for K-12
  status ENUM('enrolled','graduated','transferred','withdrawn') NOT NULL,
  contact_info JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

student_invoice (
  id UUID PK,
  invoice_number VARCHAR(30) NOT NULL UNIQUE,
  student_id UUID FK NOT NULL,
  fiscal_year_id UUID FK NOT NULL,
  term VARCHAR(50),                            -- "1st Sem", "2nd Sem", "Summer", "Monthly"
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  total_amount DECIMAL(18,2) NOT NULL,
  balance DECIMAL(18,2) NOT NULL,
  status ENUM('unpaid','partial','paid','overpaid','cancelled') DEFAULT 'unpaid',
  journal_entry_id UUID FK,                    -- the JE that created this invoice
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

student_invoice_line (
  id UUID PK,
  invoice_id UUID FK NOT NULL,
  fee_type VARCHAR(50) NOT NULL,               -- Tuition, Misc, Lab, etc.
  amount DECIMAL(18,2) NOT NULL,
  discount_type VARCHAR(50),                   -- scholarship, early-bird, sibling, etc.
  discount_amount DECIMAL(18,2) DEFAULT 0,
  net_amount DECIMAL(18,2) GENERATED ALWAYS AS (amount - discount_amount) STORED
)

payment_transaction (
  id UUID PK,
  transaction_number VARCHAR(30) NOT NULL UNIQUE,
  student_id UUID FK,
  invoice_id UUID FK,
  payment_date DATE NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  payment_method ENUM('cash','check','bank_transfer','gcash','paymaya') NOT NULL,
  check_number VARCHAR(50),
  check_date DATE,
  bank_name VARCHAR(100),
  reference VARCHAR(50),
  journal_entry_id UUID FK,
  official_receipt_id UUID FK,
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

### 3.8 Cash Disbursements (per-entity schema)
```sql
disbursement (
  id UUID PK,
  cv_number VARCHAR(30) NOT NULL UNIQUE,        -- Check Voucher Number
  cv_date DATE NOT NULL,
  payee_type ENUM('vendor','employee','student','other') NOT NULL,
  payee_name VARCHAR(200) NOT NULL,
  payee_address TEXT,
  tin VARCHAR(20),
  amount DECIMAL(18,2) NOT NULL,
  payment_method ENUM('check','cash','bank_transfer') NOT NULL,
  check_number VARCHAR(50),
  check_date DATE,
  bank_account VARCHAR(50),
  status ENUM('draft','approved','paid','void') DEFAULT 'draft',
  journal_entry_id UUID FK,
  ap_invoice_id UUID FK,                       -- if paying an AP invoice
  withholding_tax_amount DECIMAL(18,2) DEFAULT 0,
  withholding_tax_rate DECIMAL(5,2),
  created_by UUID NOT NULL,
  approved_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)
```

### 3.9 Fixed Assets (per-entity schema)
```sql
fixed_asset (
  id UUID PK,
  asset_code VARCHAR(30) NOT NULL UNIQUE,
  asset_name VARCHAR(200) NOT NULL,
  asset_category ENUM('building','equipment','furniture','vehicle','computer','land','other'),
  acquisition_date DATE NOT NULL,
  acquisition_cost DECIMAL(18,2) NOT NULL,
  estimated_life_years INT NOT NULL,
  salvage_value DECIMAL(18,2) DEFAULT 0,
  depreciation_method ENUM('straight_line','declining_balance') DEFAULT 'straight_line',
  accumulated_depreciation DECIMAL(18,2) DEFAULT 0,
  net_book_value DECIMAL(18,2) GENERATED ALWAYS AS (acquisition_cost - accumulated_depreciation) STORED,
  status ENUM('active','fully_depreciated','disposed') DEFAULT 'active',
  journal_entry_id UUID FK,                   -- capitalization JE
  disposal_date DATE,
  disposal_amount DECIMAL(18,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

depreciation_entry (
  id UUID PK,
  fixed_asset_id UUID FK NOT NULL,
  fiscal_period_id UUID FK NOT NULL,
  depreciation_amount DECIMAL(18,2) NOT NULL,
  journal_entry_id UUID FK,                    -- the JE that recorded this depreciation
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fixed_asset_id, fiscal_period_id)
)
```

### 3.10 Bank Reconciliation (per-entity schema)
```sql
bank_account (
  id UUID PK,
  account_code VARCHAR(20) UNIQUE,              -- links to chart of accounts
  bank_name VARCHAR(100) NOT NULL,
  account_number VARCHAR(50) NOT NULL,
  account_type ENUM('checking','savings','time_deposit') NOT NULL,
  currency VARCHAR(3) DEFAULT 'PHP',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

bank_reconciliation (
  id UUID PK,
  bank_account_id UUID FK NOT NULL,
  statement_date DATE NOT NULL,
  statement_ending_balance DECIMAL(18,2) NOT NULL,
  book_ending_balance DECIMAL(18,2) NOT NULL,
  status ENUM('in_progress','completed') DEFAULT 'in_progress',
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

reconciliation_item (
  id UUID PK,
  reconciliation_id UUID FK NOT NULL,
  type ENUM('deposit_in_transit','outstanding_check','bank_error','book_error','bank_charge','interest','nsf') NOT NULL,
  reference VARCHAR(50),
  amount DECIMAL(18,2) NOT NULL,
  is_cleared BOOLEAN DEFAULT FALSE,
  journal_entry_id UUID FK,                   -- adjusting JE if book error/bank charge
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

### 3.11 Audit Trail (separate schema: audit)
```sql
audit_log (
  id UUID PK DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL,                     -- which school/campus
  user_id UUID NOT NULL,
  action ENUM('create','update','delete','post','reverse','void','approve','reject') NOT NULL,
  table_name VARCHAR(63) NOT NULL,
  record_id UUID NOT NULL,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
)
CREATE INDEX idx_audit_entity_table ON audit_log(entity_id, table_name, created_at DESC);
-- Audit log is INSERT-ONLY — no UPDATE or DELETE permitted
-- (enforced via triggers or application-level checks)
```

### 3.12 Approval Workflow (per-entity schema)
```sql
approval_rule (
  id UUID PK,
  module ENUM('JE','CD','AP','AR','FA') NOT NULL,
  min_amount DECIMAL(18,2) DEFAULT 0,
  max_amount DECIMAL(18,2),
  required_approvals INT DEFAULT 1,
  approver_roles JSONB NOT NULL,                -- ["finance_officer", "accountant", "director"]
  created_at TIMESTAMPTZ DEFAULT NOW()
)

approval_request (
  id UUID PK,
  record_type VARCHAR(30) NOT NULL,             -- journal_entry, disbursement, etc.
  record_id UUID NOT NULL,
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  requested_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

approval_action (
  id UUID PK,
  approval_request_id UUID FK NOT NULL,
  approver_id UUID NOT NULL,
  action ENUM('approved','rejected') NOT NULL,
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

### 3.13 Users & Roles (public schema)
```sql
role (
  id UUID PK,
  name VARCHAR(50) UNIQUE NOT NULL,             -- super_admin, accountant, finance_officer, etc.
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

permission (
  id UUID PK,
  resource VARCHAR(50) NOT NULL,                -- journal_entries, accounts, reports, etc.
  action ENUM('create','read','update','delete','post','approve','export') NOT NULL,
  UNIQUE(resource, action)
)

role_permission (
  role_id UUID FK NOT NULL,
  permission_id UUID FK NOT NULL,
  PRIMARY KEY (role_id, permission_id)
)

user_account (
  id UUID PK DEFAULT gen_random_uuid(),
  email VARCHAR(200) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  role_id UUID FK NOT NULL,
  entity_id UUID FK,                            -- NULL = access to all entities (super_admin)
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)
```

---

## 4. API Design

### 4.1 Base URL
All API endpoints: `/api/v1`

### 4.2 Standard Response Envelope
```typescript
{
  success: boolean;
  data: T | null;
  meta?: { page: number; pageSize: number; total: number };
  error?: { code: string; message: string; details?: any };
}
```

### 4.3 Endpoint Summary

| Module | Method | Path | Description |
|--------|--------|------|-------------|
| Auth | POST | `/auth/login` | Authenticate user |
| Auth | POST | `/auth/logout` | Invalidate session |
| Auth | GET | `/auth/me` | Current user + permissions |
| Entities | GET | `/entities` | List all entities |
| Entities | POST | `/entities` | Create entity (schema + setup) |
| Entities | GET | `/entities/:id` | Entity details |
| Accounts | GET | `/accounts` | Chart of accounts (tree) |
| Accounts | POST | `/accounts` | Create account |
| Accounts | PATCH | `/accounts/:id` | Update account |
| Accounts | DELETE | `/accounts/:id` | Deactivate account |
| JE | GET | `/journal-entries` | List (paginated, filterable) |
| JE | POST | `/journal-entries` | Create draft entry |
| JE | GET | `/journal-entries/:id` | Get with lines |
| JE | PATCH | `/journal-entries/:id` | Update draft |
| JE | POST | `/journal-entries/:id/post` | Post journal entry |
| JE | POST | `/journal-entries/:id/reverse` | Create reversing entry |
| OR | GET | `/official-receipts` | List ORs |
| OR | POST | `/official-receipts` | Issue OR |
| OR | GET | `/official-receipts/:id` | OR details |
| CR | GET | `/cash-receipts` | List cash receipts |
| CR | POST | `/cash-receipts` | Record payment → JE + OR |
| CD | GET | `/cash-disbursements` | List disbursements |
| CD | POST | `/cash-disbursements` | Record disbursement → JE + CV |
| SA | GET | `/student-accounts` | List students with balances |
| SA | GET | `/student-accounts/:id/invoices` | Student invoices |
| SA | GET | `/student-accounts/:id/payments` | Student payments |
| SA | GET | `/student-accounts/:id/aging` | AR aging schedule |
| VA | GET | `/vendor-accounts` | List vendors |
| VA | POST | `/vendor-accounts` | Create vendor |
| AP | GET | `/vendor-accounts/:id/invoices` | Vendor invoices |
| FA | GET | `/fixed-assets` | List assets |
| FA | POST | `/fixed-assets` | Capitalize asset |
| FA | POST | `/fixed-assets/:id/depreciate` | Run depreciation |
| FA | POST | `/fixed-assets/:id/dispose` | Dispose asset |
| BR | POST | `/bank-reconciliation/upload` | Upload statement CSV |
| BR | GET | `/bank-reconciliation/:id/matches` | Suggested matches |
| BR | POST | `/bank-reconciliation/:id/reconcile` | Confirm reconciliation |
| RP | GET | `/financial-reports/trial-balance` | Trial balance |
| RP | GET | `/financial-reports/income-statement` | P&L for period |
| RP | GET | `/financial-reports/balance-sheet` | Balance sheet as-of |
| RP | GET | `/financial-reports/cash-flow` | Cash flow statement |
| RP | GET | `/financial-reports/export/:type` | Export (PDF/CSV/XLSX) |
| AD | GET | `/admin/audit-log` | Query audit trail |
| AD | POST | `/admin/periods/close` | Close fiscal period |
| AD | POST | `/admin/periods/open` | Reopen period |
| AD | GET | `/admin/number-series` | Manage OR/CV/JE numbers |
| US | GET | `/users` | List users |
| US | POST | `/users` | Create user |
| US | PATCH | `/users/:id/roles` | Update user role |

### 4.4 Standard Error Codes

| Code | Meaning |
|------|---------|
| `ERR_UNBALANCED_ENTRY` | Debits do not equal credits |
| `ERR_PERIOD_CLOSED` | Fiscal period is closed |
| `ERR_ACCOUNT_INACTIVE` | Account is deactivated |
| `ERR_ACCOUNT_NOT_POSTABLE` | Account is a header (level < 3) |
| `ERR_ENTRY_ALREADY_POSTED` | Cannot modify a posted entry |
| `ERR_INSUFFICIENT_PERMISSIONS` | User lacks required role |
| `ERR_DUPLICATE_REFERENCE` | OR/CV/JE reference already exists |
| `ERR_INVALID_AMOUNT` | Negative or zero amount where not allowed |
| `ERR_APPROVAL_REQUIRED` | Transaction exceeds approval threshold |

---

## 5. Accounting Workflows

### 5.1 Journal Posting Flow
```
1. User creates draft journal entry (status='draft')
2. System validates:
   a. All accounts exist, are active, and are postable (level >= 3)
   b. Sum(debits) = Sum(credits) (within 0.01 tolerance)
   c. Fiscal period is open
   d. User has 'journal_entries:create' permission
3. User or approver triggers POST /:id/post
4. Posting engine within a DB transaction:
   a. Set entry_number from number_series
   b. UPDATE journal_entry SET status='posted', posted_at=NOW()
   c. FOR EACH line: UPSERT general_ledger (update running totals)
   d. INSERT INTO audit_log (action='post', ...)
5. Post-completion:
   a. If source_module='AR': update invoice balance
   b. If source_module='AP': update vendor balance
   c. If source_module='FA': update asset accumulated depreciation
```

### 5.2 Billing Workflow
```
1. Generate student invoices (bulk per term)
2. For each invoice:
   a. INSERT journal_entry (source_module='AR')
      - Dr. Accounts Receivable - Student
      - Cr. Tuition Revenue / Misc Revenue (per fee type)
   b. INSERT student_invoice + lines
3. Post journal entries
4. Track: invoice.balance decreases with each payment
```

### 5.3 Cash Receipt Workflow
```
1. User records payment against invoice(s)
2. System:
   a. INSERT journal_entry (source_module='CM')
      - Dr. Cash in Bank
      - Cr. Accounts Receivable - Student
   b. POST journal entry
   c. UPDATE invoice.balance
   d. INSERT official_receipt (with BIR fields)
   e. INSERT payment_transaction
3. If overpayment: create credit memo (Dr. AR, Cr. Customer Deposit)
```

### 5.4 Cash Disbursement Workflow
```
1. User creates disbursement voucher (draft)
2. If amount > threshold: create approval_request
3. Upon approval/if no approval needed:
   a. INSERT journal_entry (source_module='CD')
      - Dr. Expense/Asset/AP (depending on payee/purpose)
      - Cr. Cash in Bank
   b. POST journal entry
   c. UPDATE disbursement status='paid'
   d. Generate CV number
```

### 5.5 Financial Statement Generation
```
All statements are computed ON-DEMAND from journal entries — never cached:
- Trial Balance: SELECT account, SUM(debit), SUM(credit) FROM journal_entry_line
  JOIN journal_entry WHERE status='posted' AND fiscal_period_id = :id
- Income Statement: Trial Balance filtered to revenue/expense accounts
- Balance Sheet: Trial Balance filtered to asset/liability/equity accounts
- Cash Flow: Analysis of cash account movements classified by nature
```

---

## 6. Security

### 6.1 Role-Based Access Control (RBAC)
| Role | Scope | Key Permissions |
|------|-------|-----------------|
| super_admin | All entities | System config, user management, period management |
| accountant | Assigned entity | All financial modules, journal posting, reports |
| finance_officer | Assigned entity | AR/AP management, cash receipts/disbursements |
| auditor | All entities | Read-only: journals, ledgers, audit logs, reports |
| cashier | Assigned entity | Cash receipts, OR issuance (cannot post journals) |
| department_head | Assigned entity | View reports, budget inquiries |

### 6.2 Segregation of Duties (SoD) — Critical Rules
- Same user cannot create AND approve the same transaction
- Cashier cannot post journal entries directly
- Accountant cannot delete audit logs
- Only super_admin can close fiscal periods
- Journal posting requires separate create and post actions

### 6.3 Audit Requirements (per your spec)
Every transaction stores:
- User (created_by / posted_by / approved_by)
- Timestamp (created_at / posted_at / approved_at)
- Reference Number (entry_number / or_number / cv_number)
- Source Module (JE, AR, AP, CM, CD, FA, BR)
- Remarks (description / line_description)

### 6.4 Data Protection
- Passwords: bcrypt (cost factor 12)
- Session tokens: HTTP-only cookies with secure flag
- Rate limiting: 100 req/min per user on POST endpoints
- SQL injection: prevented by Prisma parameterized queries
- XSS: prevented by React server components + Content-Security-Policy headers
- Audit logs: INSERT-only, no UPDATE/DELETE permitted

---

## 7. Infrastructure

### 7.1 Docker Compose Services
```yaml
services:
  app:
    build: .
    ports: ["3000:3000"]
    depends_on: [db, redis]
    environment:
      - DATABASE_URL
      - REDIS_URL
    volumes:
      - uploads:/app/public/uploads

  db:
    image: postgres:16
    ports: ["5432:5432"]
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      - POSTGRES_PASSWORD

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf
    depends_on: [app]
```

### 7.2 Backup Strategy
- **Daily:** `pg_dump` per entity schema + full DB dump → encrypted archive
- **Continuous:** WAL archiving for point-in-time recovery
- **Retention:** 30 daily, 12 monthly, 7 yearly
- **Verification:** Monthly restore test to separate environment

---

## 8. Project Folder Structure

```
school-accounting/
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── nginx/default.conf
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── scripts/
│   ├── seed.ts                          # Seed chart of accounts + roles
│   └── backup.sh
├── src/
│   ├── app/
│   │   ├── (auth)/login/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── page.tsx                 # Dashboard
│   │   │   ├── accounts/
│   │   │   ├── journal-entries/
│   │   │   ├── official-receipts/
│   │   │   ├── cash-receipts/
│   │   │   ├── cash-disbursements/
│   │   │   ├── student-accounts/
│   │   │   ├── vendor-accounts/
│   │   │   ├── fixed-assets/
│   │   │   ├── bank-reconciliation/
│   │   │   ├── reports/
│   │   │   └── admin/
│   │   └── api/v1/
│   │       ├── auth/
│   │       ├── entities/
│   │       ├── accounts/
│   │       ├── journal-entries/
│   │       ├── official-receipts/
│   │       ├── cash-receipts/
│   │       ├── cash-disbursements/
│   │       ├── student-accounts/
│   │       ├── vendor-accounts/
│   │       ├── fixed-assets/
│   │       ├── bank-reconciliation/
│   │       ├── financial-reports/
│   │       └── admin/
│   ├── components/
│   │   ├── ui/                          # shadcn components
│   │   ├── forms/
│   │   ├── tables/
│   │   └── reports/
│   ├── lib/
│   │   ├── accounting/
│   │   │   ├── posting-engine.ts
│   │   │   ├── financial-statements.ts
│   │   │   ├── depreciation.ts
│   │   │   ├── bank-reconciliation.ts
│   │   │   └── tax.ts
│   │   ├── auth/
│   │   │   ├── session.ts
│   │   │   └── rbac.ts
│   │   ├── audit/
│   │   │   └── audit-log.ts
│   │   ├── approval/
│   │   │   └── workflow.ts
│   │   ├── export/
│   │   │   ├── pdf.ts
│   │   │   ├── csv.ts
│   │   │   └── xlsx.ts
│   │   ├── validators/
│   │   ├── db.ts
│   │   ├── entity-schema.ts              # Multi-tenant schema management
│   │   └── utils.ts
│   ├── services/
│   │   ├── account.service.ts
│   │   ├── journal-entry.service.ts
│   │   ├── ledger.service.ts
│   │   ├── cash-receipts.service.ts
│   │   ├── cash-disbursements.service.ts
│   │   ├── student-account.service.ts
│   │   ├── vendor-account.service.ts
│   │   ├── fixed-asset.service.ts
│   │   ├── bank-reconciliation.service.ts
│   │   ├── report.service.ts
│   │   └── approval.service.ts
│   ├── repositories/
│   │   ├── account.repository.ts
│   │   ├── journal-entry.repository.ts
│   │   ├── ledger.repository.ts
│   │   └── ...
│   ├── types/
│   │   ├── accounting.ts
│   │   ├── entities.ts
│   │   └── api.ts
│   └── middleware.ts
├── public/
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── components.json
```

---

## 9. Tech Stack Summary

| Layer | Technology | Justification |
|-------|-----------|---------------|
| Framework | Next.js 14+ (App Router) | Full-stack, server components, API routes |
| Language | TypeScript 5+ | Type safety for accounting domains |
| Styling | TailwindCSS + shadcn | Consistent design system |
| ORM | Prisma | Type-safe, multi-schema migrations |
| Database | PostgreSQL 16 | ACID, JSONB, CTEs for reporting |
| Cache/Queue | Redis 7 | Sessions, rate limiting, report jobs |
| Auth | next-auth / iron-session | Session-based auth |
| Validation | Zod | Runtime type checking |
| API | REST (Next.js Route Handlers) | KISS principle |
| Export | pdfmake / exceljs | PDF + XLSX generation |
| Testing | Vitest + Playwright | Unit + E2E |
| Container | Docker + Docker Compose | On-premise deployment |
| Proxy | Nginx | TLS, caching, static serving |

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Schema-per-entity complexity | Migrations must run per schema | Prisma multi-schema preview; migration script iterates all schemas |
| Posting performance at scale | 100k txns may slow GL updates | Indexed GL, batch posting mode, periodic GL rebuild |
| BIR compliance changes | Regulatory updates | Tax rules in config (not hardcoded); versioned templates |
| Fiscal period errors | Restatement risk | Period reopen requires super_admin + audit trail |
| Data loss | Business continuity risk | Daily + WAL backups, monthly restore verification |
| Concurrent posting race | Unbalanced entries | Serialized posting per entity via advisory locks |

---

## 11. Out of Scope (for this phase)

- Payroll module (handled separately)
- Budgeting and forecasting
- Inventory management
- Procurement / Purchase Order system
- Tax filing automation (BIR 1700, 1601, etc.)

---

## 12. Implementation Order

The system should be built in 5 phases:

| Phase | Modules | Rationale |
|-------|---------|-----------|
| **1. Foundation** | Auth, Entities, Chart of Accounts, Users/Roles | Everything depends on this |
| **2. Core Accounting** | Journal Entry, Posting Engine, GL, Trial Balance | The accounting engine |
| **3. Financial Reporting** | Balance Sheet, Income Statement, Cash Flow, Export | Reports from core data |
| **4. Operational** | AR, AP, Cash Receipts, Cash Disbursements, OR, Student Accounts | Day-to-day operations |
| **5. Advanced** | FA, Depreciation, Bank Reconciliation, Audit Trail | Specialized features |
