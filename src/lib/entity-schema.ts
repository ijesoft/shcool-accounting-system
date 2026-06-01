import { prisma } from "@/lib/db"

export async function createEntitySchema(schemaName: string): Promise<void> {
  const sql = `
    CREATE SCHEMA IF NOT EXISTS "${schemaName}";

    CREATE TABLE IF NOT EXISTS "${schemaName}".account (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_code VARCHAR(20) NOT NULL UNIQUE,
      account_name VARCHAR(200) NOT NULL,
      account_type VARCHAR(20) NOT NULL CHECK (account_type IN (
        'asset', 'liability', 'equity', 'revenue', 'expense',
        'contra_asset', 'contra_revenue', 'contra_liability'
      )),
      normal_balance VARCHAR(10) NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
  is_active BOOLEAN DEFAULT TRUE,
     is_postable BOOLEAN DEFAULT TRUE,
     parent_id UUID REFERENCES "${schemaName}".account(id),
      level INT NOT NULL DEFAULT 0,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".journal_entry (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      entry_number VARCHAR(30) NOT NULL UNIQUE,
      entry_date DATE NOT NULL,
      reference VARCHAR(50),
      source_module VARCHAR(20) NOT NULL CHECK (source_module IN ('JE','AR','AP','CM','CD','FA','BR','DR')),
      description TEXT,
      status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'posted', 'void')),
      posted_at TIMESTAMPTZ,
   posted_by UUID,
     approved_by UUID,
     current_approval_level INT DEFAULT 0,
     rejected_at TIMESTAMPTZ,
     rejection_reason TEXT,
     fiscal_period_id UUID,
      created_by UUID NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_by UUID,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".journal_entry_line (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      journal_entry_id UUID NOT NULL REFERENCES "${schemaName}".journal_entry(id),
      account_id UUID NOT NULL REFERENCES "${schemaName}".account(id),
      debit DECIMAL(18,2) DEFAULT 0 CHECK (debit >= 0),
      credit DECIMAL(18,2) DEFAULT 0 CHECK (credit >= 0),
      line_description TEXT,
      line_order INT NOT NULL,
      CHECK (debit > 0 OR credit > 0)
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".general_ledger (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL REFERENCES "${schemaName}".account(id),
      fiscal_period_id UUID,
      normal_balance VARCHAR(10) NOT NULL,
      beginning_balance DECIMAL(18,2) NOT NULL DEFAULT 0,
      total_debits DECIMAL(18,2) DEFAULT 0,
      total_credits DECIMAL(18,2) DEFAULT 0,
      last_journal_entry_id UUID,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(account_id, fiscal_period_id)
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".number_series (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      series_type VARCHAR(10) NOT NULL CHECK (series_type IN ('JE','OR','CV','CD','CDV','PO','DV','PMT')),
      prefix VARCHAR(10) NOT NULL,
      starting_number INT NOT NULL DEFAULT 1,
      next_number INT NOT NULL DEFAULT 1,
      suffix VARCHAR(10),
      fiscal_year_id UUID,
      UNIQUE(series_type, fiscal_year_id)
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".official_receipt (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      or_number VARCHAR(30) NOT NULL UNIQUE,
      or_date DATE NOT NULL,
      cash_receipt_id UUID,
      student_id UUID,
      payor_name VARCHAR(200) NOT NULL,
      payor_address TEXT,
      tin VARCHAR(20),
      amount DECIMAL(18,2) NOT NULL,
      vat_amount DECIMAL(18,2) DEFAULT 0,
      vat_exempt_amount DECIMAL(18,2) DEFAULT 0,
      vat_rate DECIMAL(5,2) DEFAULT 12.00,
      is_zero_rated BOOLEAN DEFAULT FALSE,
      journal_entry_id UUID,
      status VARCHAR(10) DEFAULT 'active' CHECK (status IN ('active', 'void')),
      void_reason TEXT,
      created_by UUID NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      bir_serial_number VARCHAR(50),
      bir_accredited_printer_tin VARCHAR(20),
      bir_permit_number VARCHAR(50)
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".official_receipt_line (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      official_receipt_id UUID NOT NULL REFERENCES "${schemaName}".official_receipt(id),
      description TEXT NOT NULL,
      amount DECIMAL(18,2) NOT NULL,
      vat_sales DECIMAL(18,2) DEFAULT 0,
      vat_exempt_sales DECIMAL(18,2) DEFAULT 0,
      zero_rated_sales DECIMAL(18,2) DEFAULT 0,
      vat_amount DECIMAL(18,2) DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".student (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_number VARCHAR(30) NOT NULL UNIQUE,
      full_name VARCHAR(200) NOT NULL,
      course VARCHAR(100),
      grade_level VARCHAR(20),
      status VARCHAR(20) NOT NULL CHECK (status IN ('enrolled','graduated','transferred','withdrawn')),
      contact_info JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".student_invoice (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_number VARCHAR(30) NOT NULL UNIQUE,
      student_id UUID NOT NULL REFERENCES "${schemaName}".student(id),
      fiscal_year_id UUID,
      term VARCHAR(50),
      invoice_date DATE NOT NULL,
      due_date DATE NOT NULL,
      total_amount DECIMAL(18,2) NOT NULL,
      balance DECIMAL(18,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'unpaid' CHECK (status IN ('unpaid','partial','paid','overpaid','cancelled')),
      journal_entry_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".student_invoice_line (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id UUID NOT NULL REFERENCES "${schemaName}".student_invoice(id),
      fee_type VARCHAR(50) NOT NULL,
      amount DECIMAL(18,2) NOT NULL,
      discount_type VARCHAR(50),
      discount_amount DECIMAL(18,2) DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".payment_transaction (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      transaction_number VARCHAR(30) NOT NULL UNIQUE,
      student_id UUID REFERENCES "${schemaName}".student(id),
      invoice_id UUID REFERENCES "${schemaName}".student_invoice(id),
      payment_date DATE NOT NULL,
      amount DECIMAL(18,2) NOT NULL,
      payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash','check','bank_transfer','gcash','paymaya')),
      check_number VARCHAR(50),
      check_date DATE,
      bank_name VARCHAR(100),
      reference VARCHAR(50),
      journal_entry_id UUID,
      official_receipt_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".disbursement (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cv_number VARCHAR(30) NOT NULL UNIQUE,
      cv_date DATE NOT NULL,
      payee_type VARCHAR(10) NOT NULL CHECK (payee_type IN ('vendor','employee','student','other')),
      payee_name VARCHAR(200) NOT NULL,
      payee_address TEXT,
      tin VARCHAR(20),
      amount DECIMAL(18,2) NOT NULL,
      payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('check','cash','bank_transfer')),
      check_number VARCHAR(50),
      check_date DATE,
      bank_account VARCHAR(50),
      status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','approved','paid','void')),
      journal_entry_id UUID,
      ap_invoice_id UUID,
      withholding_tax_amount DECIMAL(18,2) DEFAULT 0,
      withholding_tax_rate DECIMAL(5,2),
      created_by UUID NOT NULL,
      approved_by UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".vendor_account (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      vendor_code VARCHAR(30) NOT NULL UNIQUE,
      vendor_name VARCHAR(200) NOT NULL,
      contact_person VARCHAR(200),
      address TEXT,
      tin VARCHAR(20),
      contact_number VARCHAR(50),
      email VARCHAR(100),
      payment_terms VARCHAR(50),
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".vendor_invoice (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_number VARCHAR(30) NOT NULL UNIQUE,
      vendor_id UUID NOT NULL REFERENCES "${schemaName}".vendor_account(id),
      invoice_date DATE NOT NULL,
      due_date DATE NOT NULL,
      total_amount DECIMAL(18,2) NOT NULL,
      balance DECIMAL(18,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'unpaid' CHECK (status IN ('unpaid','partial','paid','cancelled')),
      journal_entry_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".fixed_asset (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      asset_code VARCHAR(30) NOT NULL UNIQUE,
      asset_name VARCHAR(200) NOT NULL,
      asset_category VARCHAR(20) NOT NULL CHECK (asset_category IN ('building','equipment','furniture','vehicle','computer','land','other')),
      acquisition_date DATE NOT NULL,
      acquisition_cost DECIMAL(18,2) NOT NULL,
      estimated_life_years INT NOT NULL,
      salvage_value DECIMAL(18,2) DEFAULT 0,
      depreciation_method VARCHAR(30) DEFAULT 'straight_line' CHECK (depreciation_method IN ('straight_line','declining_balance','sum_of_years')),
      accumulated_depreciation DECIMAL(18,2) DEFAULT 0,
      status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','fully_depreciated','disposed')),
      journal_entry_id UUID,
      disposal_date DATE,
      disposal_amount DECIMAL(18,2),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".depreciation_entry (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      fixed_asset_id UUID NOT NULL REFERENCES "${schemaName}".fixed_asset(id),
      fiscal_period_id UUID,
      depreciation_amount DECIMAL(18,2) NOT NULL,
      journal_entry_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(fixed_asset_id, fiscal_period_id)
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".bank_account (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_code VARCHAR(20) UNIQUE,
      bank_name VARCHAR(100) NOT NULL,
      account_number VARCHAR(50) NOT NULL,
      account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('checking','savings','time_deposit')),
      currency VARCHAR(3) DEFAULT 'PHP',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".bank_reconciliation (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      bank_account_id UUID NOT NULL,
      statement_date DATE NOT NULL,
      statement_ending_balance DECIMAL(18,2) NOT NULL,
      book_ending_balance DECIMAL(18,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
      completed_at TIMESTAMPTZ,
      created_by UUID NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".reconciliation_item (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      reconciliation_id UUID NOT NULL,
      type VARCHAR(20) NOT NULL CHECK (type IN ('deposit_in_transit','outstanding_check','bank_error','book_error','bank_charge','interest','nsf')),
      reference VARCHAR(50),
      amount DECIMAL(18,2) NOT NULL,
      is_cleared BOOLEAN DEFAULT FALSE,
      journal_entry_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".approval_rule (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      module VARCHAR(10) NOT NULL CHECK (module IN ('JE','CD','AP','AR','FA','DR')),
      min_amount DECIMAL(18,2) DEFAULT 0,
      max_amount DECIMAL(18,2),
      required_approvals INT DEFAULT 1,
      approver_roles JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".approval_request (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      record_type VARCHAR(30) NOT NULL,
      record_id UUID NOT NULL,
      level INT NOT NULL DEFAULT 1,
      approver_role_id UUID NOT NULL,
      approval_rule_id UUID,
      status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
      requested_by UUID NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".approval_action (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      approval_request_id UUID NOT NULL,
      approver_id UUID NOT NULL,
      action VARCHAR(20) NOT NULL CHECK (action IN ('approved','rejected')),
      comments TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    INSERT INTO "${schemaName}".account (account_code, account_name, account_type, normal_balance, level) VALUES
      ('10000', 'ASSETS', 'asset', 'debit', 0),
      ('11000', 'Current Assets', 'asset', 'debit', 1),
      ('11100', 'Cash and Cash Equivalents', 'asset', 'debit', 2),
      ('11110', 'Cash on Hand', 'asset', 'debit', 3),
      ('11120', 'Cash in Bank', 'asset', 'debit', 3),
      ('11200', 'Accounts Receivable', 'asset', 'debit', 2),
      ('11210', 'Accounts Receivable - Students', 'asset', 'debit', 3),
      ('11300', 'Allowance for Doubtful Accounts', 'contra_asset', 'credit', 3),
      ('12000', 'Non-Current Assets', 'asset', 'debit', 1),
      ('12100', 'Property, Plant, and Equipment', 'asset', 'debit', 2),
      ('12110', 'Land', 'asset', 'debit', 3),
      ('12120', 'Buildings', 'asset', 'debit', 3),
      ('12130', 'Accumulated Depreciation - Buildings', 'contra_asset', 'credit', 3),
      ('12140', 'Office Equipment', 'asset', 'debit', 3),
      ('12150', 'Accumulated Depreciation - Equipment', 'contra_asset', 'credit', 3),
      ('20000', 'LIABILITIES', 'liability', 'credit', 0),
      ('21000', 'Current Liabilities', 'liability', 'credit', 1),
      ('21100', 'Accounts Payable', 'liability', 'credit', 2),
      ('21110', 'Accounts Payable - Trade', 'liability', 'credit', 3),
      ('21200', 'Accrued Expenses', 'liability', 'credit', 3),
      ('21300', 'Unearned Tuition', 'liability', 'credit', 3),
      ('21400', 'VAT Payable', 'liability', 'credit', 3),
      ('21500', 'Withholding Tax Payable', 'liability', 'credit', 3),
      ('22000', 'Non-Current Liabilities', 'liability', 'credit', 1),
      ('22100', 'Loans Payable', 'liability', 'credit', 3),
      ('30000', 'EQUITY', 'equity', 'credit', 0),
      ('31100', 'Capital', 'equity', 'credit', 3),
      ('31200', 'Retained Earnings', 'equity', 'credit', 3),
      ('39000', 'Income Summary', 'equity', 'credit', 3),
      ('40000', 'REVENUE', 'revenue', 'credit', 0),
      ('41100', 'Tuition Revenue', 'revenue', 'credit', 3),
      ('41200', 'Miscellaneous Fees', 'revenue', 'credit', 3),
      ('41300', 'Laboratory Fees', 'revenue', 'credit', 3),
      ('41400', 'Other Income', 'revenue', 'credit', 3),
      ('50000', 'EXPENSES', 'expense', 'debit', 0),
      ('51100', 'Salaries and Wages', 'expense', 'debit', 3),
      ('51200', 'Utilities Expense', 'expense', 'debit', 3),
      ('51300', 'Rent Expense', 'expense', 'debit', 3),
      ('51400', 'Depreciation Expense', 'expense', 'debit', 3),
      ('51500', 'Supplies Expense', 'expense', 'debit', 3),
      ('51600', 'Professional Fees', 'expense', 'debit', 3),
      ('51700', 'Taxes and Licenses', 'expense', 'debit', 3),
      ('51800', 'Miscellaneous Expense', 'expense', 'debit', 3);

    INSERT INTO "${schemaName}".number_series (series_type, prefix, starting_number, next_number) VALUES
      ('JE', 'JE', 1, 1),
      ('OR', 'OR', 1, 1),
      ('CV', 'CV', 1, 1),
      ('CD', 'CD', 1, 1),
      ('PMT', 'PMT', 1, 1);
  `

  for (const stmt of sql.split(";")) {
    const trimmed = stmt.trim()
    if (trimmed.length > 0) {
      await prisma.$executeRawUnsafe(trimmed + ";")
    }
  }
}

export async function dropEntitySchema(schemaName: string): Promise<void> {
  await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`)
}
