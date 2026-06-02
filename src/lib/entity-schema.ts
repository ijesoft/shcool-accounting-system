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
      series_type VARCHAR(10) NOT NULL CHECK (series_type IN ('JE','OR','CV','CD','CDV','PO','DV','PMT','INVOICE','PR')),
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

    CREATE TABLE IF NOT EXISTS "${schemaName}".sales_invoice (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_number VARCHAR(30) NOT NULL UNIQUE,
      student_id UUID REFERENCES "${schemaName}".student(id),
      student_invoice_id UUID,
      payor_name VARCHAR(200) NOT NULL,
      payor_address TEXT,
      payor_tin VARCHAR(20),
      invoice_date DATE NOT NULL,
      due_date DATE,
      amount DECIMAL(18,2) NOT NULL,
      vat_amount DECIMAL(18,2) DEFAULT 0,
      vat_exempt_amount DECIMAL(18,2) DEFAULT 0,
      zero_rated_amount DECIMAL(18,2) DEFAULT 0,
      vat_rate DECIMAL(5,2) DEFAULT 12.00,
      is_vat_exempt BOOLEAN DEFAULT TRUE,
      bir_serial_number VARCHAR(50),
      bir_accredited_printer_tin VARCHAR(20),
      bir_permit_number VARCHAR(50),
      status VARCHAR(10) DEFAULT 'active' CHECK (status IN ('active', 'void', 'cancelled')),
      void_reason TEXT,
      journal_entry_id UUID,
      created_by UUID NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".sales_invoice_line (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sales_invoice_id UUID NOT NULL REFERENCES "${schemaName}".sales_invoice(id),
      fee_type VARCHAR(50) NOT NULL,
      description TEXT NOT NULL,
      amount DECIMAL(18,2) NOT NULL,
      vat_sales DECIMAL(18,2) DEFAULT 0,
      vat_exempt_sales DECIMAL(18,2) DEFAULT 0,
      zero_rated_sales DECIMAL(18,2) DEFAULT 0,
      vat_amount DECIMAL(18,2) DEFAULT 0
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

    CREATE TABLE IF NOT EXISTS "${schemaName}".bir_serial_range (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_type VARCHAR(30) NOT NULL CHECK (document_type IN ('invoice', 'official_receipt', 'acknowledgment_receipt')),
      series_prefix VARCHAR(10) NOT NULL,
      start_number VARCHAR(20) NOT NULL,
      end_number VARCHAR(20) NOT NULL,
      accredited_printer_tin VARCHAR(20),
      permit_number VARCHAR(50),
      bir_serial_number VARCHAR(50),
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(document_type, series_prefix)
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".withholding_tax_register (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ewt_type VARCHAR(20) NOT NULL CHECK (ewt_type IN ('expanded', 'creditable', 'final')),
      bir_form_code VARCHAR(10) NOT NULL,
      disbursement_id UUID REFERENCES "${schemaName}".disbursement(id),
      payee_name VARCHAR(200) NOT NULL,
      payee_tin VARCHAR(20) NOT NULL,
      payee_address TEXT,
      base_amount DECIMAL(18,2) NOT NULL,
      tax_rate DECIMAL(5,2) NOT NULL,
      tax_withheld DECIMAL(18,2) NOT NULL,
      withholding_date DATE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".student_invoice (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_number VARCHAR(30) NOT NULL UNIQUE,
      student_id UUID NOT NULL REFERENCES "${schemaName}".student(id),
      fiscal_year_id UUID,
      term VARCHAR(50),
      term_start_date DATE,
      term_end_date DATE,
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

    CREATE TABLE IF NOT EXISTS "${schemaName}".revenue_recognition_entry (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_invoice_id UUID NOT NULL REFERENCES "${schemaName}".student_invoice(id),
      recognition_date DATE NOT NULL,
      amount DECIMAL(18,2) NOT NULL,
      journal_entry_id UUID,
      fiscal_period_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(student_invoice_id, fiscal_period_id)
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
      payor_name VARCHAR(200),
      payor_address TEXT,
      tin VARCHAR(20),
      payment_type VARCHAR(30) DEFAULT 'tuition' CHECK (payment_type IN ('tuition','enrollment_deposit')),
      deposit_status VARCHAR(20) CHECK (deposit_status IN ('held','applied','refunded')),
      journal_entry_id UUID,
      official_receipt_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW()
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

    CREATE TABLE IF NOT EXISTS "${schemaName}".employee (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_code VARCHAR(30) NOT NULL UNIQUE,
      full_name VARCHAR(200) NOT NULL,
      position VARCHAR(100),
      department VARCHAR(100),
      tin VARCHAR(20),
      sss_number VARCHAR(20),
      philhealth_number VARCHAR(20),
      pagibig_number VARCHAR(20),
      basic_pay DECIMAL(18,2) NOT NULL DEFAULT 0,
      allowances DECIMAL(18,2) DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      hire_date DATE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".payroll_run (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      run_number VARCHAR(30) NOT NULL UNIQUE,
      run_date DATE NOT NULL,
      pay_period_start DATE NOT NULL,
      pay_period_end DATE NOT NULL,
      status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'void')),
      total_gross_pay DECIMAL(18,2) DEFAULT 0,
      total_deductions DECIMAL(18,2) DEFAULT 0,
      total_net_pay DECIMAL(18,2) DEFAULT 0,
      journal_entry_id UUID,
      created_by UUID NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".payroll_run_line (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      payroll_run_id UUID NOT NULL REFERENCES "${schemaName}".payroll_run(id),
      employee_id UUID NOT NULL REFERENCES "${schemaName}".employee(id),
      basic_pay DECIMAL(18,2) NOT NULL,
      allowances DECIMAL(18,2) DEFAULT 0,
      gross_pay DECIMAL(18,2) NOT NULL,
      sss_employee DECIMAL(18,2) DEFAULT 0,
      sss_employer DECIMAL(18,2) DEFAULT 0,
      philhealth_employee DECIMAL(18,2) DEFAULT 0,
      philhealth_employer DECIMAL(18,2) DEFAULT 0,
      pagibig_employee DECIMAL(18,2) DEFAULT 0,
      pagibig_employer DECIMAL(18,2) DEFAULT 0,
      withholding_tax DECIMAL(18,2) DEFAULT 0,
      total_deductions DECIMAL(18,2) DEFAULT 0,
      net_pay DECIMAL(18,2) NOT NULL,
      thirteenth_month_accrual DECIMAL(18,2) DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".budget (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      fiscal_year_id UUID NOT NULL,
      account_id UUID NOT NULL REFERENCES "${schemaName}".account(id),
      budgeted_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      notes TEXT,
      created_by UUID NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(fiscal_year_id, account_id)
    );

    INSERT INTO "${schemaName}".account (account_code, account_name, account_type, normal_balance, level) VALUES
      -- ===================== ASSETS =====================
      ('10000', 'ASSETS', 'asset', 'debit', 0),

      -- Current Assets
      ('11000', 'Current Assets', 'asset', 'debit', 1),

      -- Cash and Cash Equivalents
      ('11100', 'Cash and Cash Equivalents', 'asset', 'debit', 2),
      ('11110', 'Cash on Hand - Main Office', 'asset', 'debit', 3),
      ('11111', 'Cash on Hand - Bursar', 'asset', 'debit', 4),
      ('11112', 'Cash on Hand - Treasurer', 'asset', 'debit', 4),
      ('11113', 'Petty Cash - Administration', 'asset', 'debit', 4),
      ('11114', 'Petty Cash - Academics', 'asset', 'debit', 4),
      ('11115', 'Petty Cash - Student Affairs', 'asset', 'debit', 4),
      ('11120', 'Cash in Bank', 'asset', 'debit', 3),
      ('11121', 'BDO - Operating Account', 'asset', 'debit', 4),
      ('11122', 'BPI - Payroll Account', 'asset', 'debit', 4),
      ('11123', 'Landbank - Government Grants', 'asset', 'debit', 4),
      ('11124', 'UnionBank - Tuition Collection', 'asset', 'debit', 4),
      ('11125', 'BDO - Payroll Account', 'asset', 'debit', 4),
      ('11130', 'Time Deposits', 'asset', 'debit', 3),
      ('11140', 'Cash Advances - Employees', 'asset', 'debit', 3),

      -- Accounts Receivable
      ('11200', 'Accounts Receivable', 'asset', 'debit', 2),
      ('11210', 'Accounts Receivable - Tuition', 'asset', 'debit', 3),
      ('11211', 'Tuition Receivable - Regular', 'asset', 'debit', 4),
      ('11212', 'Tuition Receivable - Extension', 'asset', 'debit', 4),
      ('11213', 'Tuition Receivable - Summer', 'asset', 'debit', 4),
      ('11214', 'Tuition Receivable - Online', 'asset', 'debit', 4),
      ('11220', 'Accounts Receivable - Fees', 'asset', 'debit', 3),
      ('11230', 'Accounts Receivable - Government', 'asset', 'debit', 3),
      ('11231', 'DOST-SEI Receivable', 'asset', 'debit', 4),
      ('11232', 'CHED Grants Receivable', 'asset', 'debit', 4),
      ('11233', 'TESDA Receivable', 'asset', 'debit', 4),
      ('11240', 'Accounts Receivable - Donations', 'asset', 'debit', 3),
      ('11250', 'Accounts Receivable - Other', 'asset', 'debit', 3),
      ('11260', 'SSS/PhilHealth/Pag-IBIG Receivable', 'asset', 'debit', 3),
      ('11270', 'Withholding Tax Receivable', 'asset', 'debit', 3),
      ('11300', 'Allowance for Doubtful Accounts', 'contra_asset', 'credit', 2),

      -- Short-term Investments
      ('11400', 'Short-term Investments', 'asset', 'debit', 2),
      ('11410', 'Treasury Bills', 'asset', 'debit', 3),
      ('11420', 'Money Market Funds', 'asset', 'debit', 3),

      -- Inventories
      ('11500', 'Inventories', 'asset', 'debit', 2),
      ('11510', 'Supplies Inventory', 'asset', 'debit', 3),
      ('11511', 'Office Supplies', 'asset', 'debit', 4),
      ('11512', 'Laboratory Supplies', 'asset', 'debit', 4),
      ('11513', 'Bookstore Inventory', 'asset', 'debit', 4),
      ('11520', 'Fuel and Lubricants', 'asset', 'debit', 3),
      ('11530', 'Canteen Inventory', 'asset', 'debit', 3),

      -- Prepayments
      ('11600', 'Prepaid Expenses', 'asset', 'debit', 2),
      ('11610', 'Prepaid Insurance', 'asset', 'debit', 3),
      ('11620', 'Prepaid Rent', 'asset', 'debit', 3),
      ('11630', 'Prepaid Subscriptions', 'asset', 'debit', 3),

      -- Tax Assets
      ('11700', 'Tax Assets', 'asset', 'debit', 2),
      ('11710', 'Input VAT', 'asset', 'debit', 3),
      ('11720', 'Creditable Withholding Tax - Expanded', 'asset', 'debit', 3),
      ('11730', 'Creditable Withholding Tax - Final', 'asset', 'debit', 3),

      -- Non-Current Assets
      ('12000', 'Non-Current Assets', 'asset', 'debit', 1),

      -- Property, Plant, and Equipment
      ('12100', 'Property, Plant, and Equipment', 'asset', 'debit', 2),
      ('12110', 'Land', 'asset', 'debit', 3),
      ('12111', 'Land - Main Campus', 'asset', 'debit', 4),
      ('12112', 'Land - Extension Campus', 'asset', 'debit', 4),
      ('12113', 'Land - Dormitory Site', 'asset', 'debit', 4),
      ('12120', 'Buildings', 'asset', 'debit', 3),
      ('12121', 'Main Building', 'asset', 'debit', 4),
      ('12122', 'Science Building', 'asset', 'debit', 4),
      ('12123', 'Library Building', 'asset', 'debit', 4),
      ('12124', 'Student Center', 'asset', 'debit', 4),
      ('12125', 'Dormitory', 'asset', 'debit', 4),
      ('12126', 'Canteen Building', 'asset', 'debit', 4),
      ('12127', 'Clinic', 'asset', 'debit', 4),
      ('12130', 'Accumulated Depreciation - Buildings', 'contra_asset', 'credit', 3),
      ('12140', 'Equipment', 'asset', 'debit', 3),
      ('12141', 'Computer Equipment', 'asset', 'debit', 4),
      ('12142', 'Laboratory Equipment', 'asset', 'debit', 4),
      ('12143', 'Audio-Visual Equipment', 'asset', 'debit', 4),
      ('12144', 'Office Furniture and Fixtures', 'asset', 'debit', 4),
      ('12145', 'Kitchen Equipment', 'asset', 'debit', 4),
      ('12150', 'Accumulated Depreciation - Equipment', 'contra_asset', 'credit', 3),
      ('12160', 'Vehicles', 'asset', 'debit', 3),
      ('12161', 'School Bus', 'asset', 'debit', 4),
      ('12162', 'Service Vehicles', 'asset', 'debit', 4),
      ('12170', 'Accumulated Depreciation - Vehicles', 'contra_asset', 'credit', 3),
      ('12180', 'Construction in Progress', 'asset', 'debit', 3),

      -- Intangible Assets
      ('12200', 'Intangible Assets', 'asset', 'debit', 2),
      ('12210', 'Software Licenses', 'asset', 'debit', 3),
      ('12220', 'Patents and Trademarks', 'asset', 'debit', 3),
      ('12230', 'Accumulated Amortization', 'contra_asset', 'credit', 3),

      -- Deferred Charges
      ('12300', 'Deferred Charges', 'asset', 'debit', 2),
      ('12310', 'Organizational Costs', 'asset', 'debit', 3),
      ('12320', 'Deferred Financing Costs', 'asset', 'debit', 3),

      -- ===================== LIABILITIES =====================
      ('20000', 'LIABILITIES', 'liability', 'credit', 0),

      -- Current Liabilities
      ('21000', 'Current Liabilities', 'liability', 'credit', 1),

      -- Trade Payables
      ('21100', 'Accounts Payable', 'liability', 'credit', 2),
      ('21110', 'Accounts Payable - Trade', 'liability', 'credit', 3),
      ('21120', 'Accounts Payable - Utilities', 'liability', 'credit', 3),
      ('21130', 'Accounts Payable - Canteen Supplies', 'liability', 'credit', 3),
      ('21140', 'Accounts Payable - Bookstore', 'liability', 'credit', 3),

      -- Accrued Liabilities
      ('21200', 'Accrued Liabilities', 'liability', 'credit', 2),
      ('21210', 'Accrued Salaries and Wages', 'liability', 'credit', 3),
      ('21220', 'Accrued Expenses', 'liability', 'credit', 3),
      ('21230', 'Accrued Interest', 'liability', 'credit', 3),

      -- Unearned Revenue
      ('21300', 'Unearned Revenue', 'liability', 'credit', 2),
      ('21310', 'Unearned Tuition', 'liability', 'credit', 3),
      ('21320', 'Enrollment Deposits', 'liability', 'credit', 3),
      ('21330', 'Deferred Revenue - Grants', 'liability', 'credit', 3),

      -- Tax Payables
      ('21400', 'Tax Payables', 'liability', 'credit', 2),
      ('21410', 'Output VAT', 'liability', 'credit', 3),
      ('21420', 'VAT Payable', 'liability', 'credit', 3),
      ('21430', 'Expanded Withholding Tax Payable', 'liability', 'credit', 3),
      ('21440', 'Final Withholding Tax Payable', 'liability', 'credit', 3),
      ('21450', 'Percentage Tax Payable', 'liability', 'credit', 3),

      -- Statutory Payables
      ('21500', 'Statutory Payables', 'liability', 'credit', 2),
      ('21510', 'SSS Contributions Payable', 'liability', 'credit', 3),
      ('21520', 'PhilHealth Contributions Payable', 'liability', 'credit', 3),
      ('21530', 'Pag-IBIG Contributions Payable', 'liability', 'credit', 3),

      -- Compensation Payables
      ('21600', 'Compensation Payables', 'liability', 'credit', 2),
      ('21610', '13th Month Pay Payable', 'liability', 'credit', 3),
      ('21620', 'Leave Indemnity Payable', 'liability', 'credit', 3),
      ('21630', 'Service Incentive Leave Payable', 'liability', 'credit', 3),

      -- Government Payables
      ('21700', 'Government Payables', 'liability', 'credit', 2),
      ('21710', 'DOST-SEI Payable', 'liability', 'credit', 3),
      ('21720', 'TESDA Payable', 'liability', 'credit', 3),
      ('21730', 'CHED Payable', 'liability', 'credit', 3),

      -- Non-Current Liabilities
      ('22000', 'Non-Current Liabilities', 'liability', 'credit', 1),
      ('22100', 'Loans Payable', 'liability', 'credit', 2),
      ('22110', 'Bank Loans Payable', 'liability', 'credit', 3),
      ('22120', 'Pag-IBIG Housing Loan Payable', 'liability', 'credit', 3),
      ('22130', 'Equipment Financing Payable', 'liability', 'credit', 3),
      ('22200', 'Bonds Payable', 'liability', 'credit', 2),
      ('22300', 'Deferred Tax Liabilities', 'liability', 'credit', 2),

      -- ===================== EQUITY =====================
      ('30000', 'EQUITY', 'equity', 'credit', 0),
      ('31000', 'Contributed Equity', 'equity', 'credit', 1),
      ('31100', 'Capital', 'equity', 'credit', 2),
      ('31110', 'Founder Capital', 'equity', 'credit', 3),
      ('31120', 'Share Capital', 'equity', 'credit', 3),
      ('31200', 'Additional Paid-in Capital', 'equity', 'credit', 2),
      ('32000', 'Accumulated Earnings', 'equity', 'credit', 1),
      ('32100', 'Retained Earnings', 'equity', 'credit', 2),
      ('33000', 'Fund Balance', 'equity', 'credit', 1),
      ('33010', 'Fund Balance - Unrestricted', 'equity', 'credit', 2),
      ('33020', 'Fund Balance - Temporarily Restricted', 'equity', 'credit', 2),
      ('33030', 'Fund Balance - Permanently Restricted', 'equity', 'credit', 2),
      ('31300', 'Fund Balance', 'equity', 'credit', 2),
      ('34000', 'Board Designated Fund Balance', 'equity', 'credit', 1),
      ('39000', 'Income Summary', 'equity', 'credit', 1),

      -- ===================== REVENUE =====================
      ('40000', 'REVENUE', 'revenue', 'credit', 0),

      -- Operating Revenue - Tuition
      ('41000', 'Tuition Revenue', 'revenue', 'credit', 1),
      ('41100', 'Tuition Revenue - Regular', 'revenue', 'credit', 2),
      ('41110', 'Tuition - College', 'revenue', 'credit', 3),
      ('41120', 'Tuition - Senior High School', 'revenue', 'credit', 3),
      ('41130', 'Tuition - Junior High School', 'revenue', 'credit', 3),
      ('41200', 'Tuition Revenue - Extension', 'revenue', 'credit', 2),
      ('41300', 'Tuition Revenue - Summer', 'revenue', 'credit', 2),
      ('41400', 'Tuition Revenue - Online', 'revenue', 'credit', 2),

      -- Operating Revenue - Fees
      ('42000', 'Fee Revenue', 'revenue', 'credit', 1),
      ('42100', 'Laboratory Fees', 'revenue', 'credit', 2),
      ('42200', 'Library Fees', 'revenue', 'credit', 2),
      ('42300', 'Registration Fees', 'revenue', 'credit', 2),
      ('42400', 'Examination Fees', 'revenue', 'credit', 2),
      ('42500', 'Graduation Fees', 'revenue', 'credit', 2),
      ('42600', 'Miscellaneous Fees', 'revenue', 'credit', 2),

      -- Operating Revenue - Other
      ('43000', 'Other Operating Revenue', 'revenue', 'credit', 1),
      ('43100', 'Canteen Revenue', 'revenue', 'credit', 2),
      ('43200', 'Parking Revenue', 'revenue', 'credit', 2),
      ('43300', 'Rental Income', 'revenue', 'credit', 2),
      ('43400', 'Alumni Dues and Donations', 'revenue', 'credit', 2),
      ('43500', 'Endowment Income', 'revenue', 'credit', 2),
      ('43600', 'Bookstore Sales', 'revenue', 'credit', 2),
      ('43700', 'Training and Seminars', 'revenue', 'credit', 2),

      -- Non-Operating Revenue
      ('44000', 'Non-Operating Revenue', 'revenue', 'credit', 1),
      ('44100', 'Government Grants', 'revenue', 'credit', 2),
      ('44110', 'DOST-SEI Grants', 'revenue', 'credit', 3),
      ('44120', 'CHED Grants', 'revenue', 'credit', 3),
      ('44130', 'TESDA Grants', 'revenue', 'credit', 3),
      ('44140', 'DA-BAR Grants', 'revenue', 'credit', 3),
      ('44200', 'Donation Revenue', 'revenue', 'credit', 2),
      ('44210', 'Cash Donations', 'revenue', 'credit', 3),
      ('44220', 'In-Kind Donations', 'revenue', 'credit', 3),
      ('44300', 'Interest Income', 'revenue', 'credit', 2),
      ('44400', 'Gain on Asset Disposal', 'revenue', 'credit', 2),
      ('44500', 'Gain on Foreign Exchange', 'revenue', 'credit', 2),

      -- ===================== EXPENSES =====================
      ('50000', 'EXPENSES', 'expense', 'debit', 0),

      -- ===== INSTRUCTION =====
      ('51000', 'Instruction', 'expense', 'debit', 1),

      -- Instruction - Personnel Services
      ('51100', 'Instruction - Personnel Services', 'expense', 'debit', 2),
      ('51110', 'Basic Salaries - Instruction', 'expense', 'debit', 3),
      ('51120', 'Allowances - Instruction', 'expense', 'debit', 3),
      ('51130', 'Overtime Pay - Instruction', 'expense', 'debit', 3),
      ('51140', 'SSS Employer - Instruction', 'expense', 'debit', 3),
      ('51150', 'PhilHealth Employer - Instruction', 'expense', 'debit', 3),
      ('51160', 'Pag-IBIG Employer - Instruction', 'expense', 'debit', 3),
      ('51170', '13th Month Pay - Instruction', 'expense', 'debit', 3),

      -- Instruction - MOOE
      ('51200', 'Instruction - MOOE', 'expense', 'debit', 2),
      ('51210', 'Office Supplies - Instruction', 'expense', 'debit', 3),
      ('51220', 'Laboratory Supplies - Instruction', 'expense', 'debit', 3),
      ('51230', 'Utilities - Instruction', 'expense', 'debit', 3),
      ('51240', 'Internet and Communications - Instruction', 'expense', 'debit', 3),
      ('51250', 'Maintenance and Repairs - Instruction', 'expense', 'debit', 3),
      ('51260', 'Software Subscriptions - Instruction', 'expense', 'debit', 3),

      -- Instruction - Travel
      ('51300', 'Instruction - Travel', 'expense', 'debit', 2),
      ('51310', 'Local Travel - Instruction', 'expense', 'debit', 3),
      ('51320', 'Foreign Travel - Instruction', 'expense', 'debit', 3),

      -- Instruction - Capital Outlay
      ('51400', 'Instruction - Capital Outlay', 'expense', 'debit', 2),
      ('51410', 'Equipment Purchase - Instruction', 'expense', 'debit', 3),
      ('51420', 'Furniture Purchase - Instruction', 'expense', 'debit', 3),

      -- ===== RESEARCH AND DEVELOPMENT =====
      ('52000', 'Research and Development', 'expense', 'debit', 1),

      -- R&D - Personnel Services
      ('52100', 'R&D - Personnel Services', 'expense', 'debit', 2),
      ('52110', 'Basic Salaries - R&D', 'expense', 'debit', 3),
      ('52120', 'Research Grants to Faculty', 'expense', 'debit', 3),
      ('52130', 'SSS Employer - R&D', 'expense', 'debit', 3),
      ('52140', 'PhilHealth Employer - R&D', 'expense', 'debit', 3),
      ('52150', 'Pag-IBIG Employer - R&D', 'expense', 'debit', 3),

      -- R&D - MOOE
      ('52200', 'R&D - MOOE', 'expense', 'debit', 2),
      ('52210', 'Research Materials', 'expense', 'debit', 3),
      ('52220', 'Publication Costs', 'expense', 'debit', 3),
      ('52230', 'Conference and Forum Costs', 'expense', 'debit', 3),
      ('52240', 'Laboratory Consumables', 'expense', 'debit', 3),

      -- ===== EXTENSION AND PUBLIC SERVICE =====
      ('53000', 'Extension and Public Service', 'expense', 'debit', 1),

      -- EPS - Personnel Services
      ('53100', 'EPS - Personnel Services', 'expense', 'debit', 2),
      ('53110', 'Basic Salaries - EPS', 'expense', 'debit', 3),
      ('53120', 'SSS Employer - EPS', 'expense', 'debit', 3),
      ('53130', 'PhilHealth Employer - EPS', 'expense', 'debit', 3),
      ('53140', 'Pag-IBIG Employer - EPS', 'expense', 'debit', 3),

      -- EPS - MOOE
      ('53200', 'EPS - MOOE', 'expense', 'debit', 2),
      ('53210', 'Community Outreach Programs', 'expense', 'debit', 3),
      ('53220', 'Extension Program Materials', 'expense', 'debit', 3),
      ('53230', 'Training and Seminars', 'expense', 'debit', 3),

      -- ===== STUDENT SERVICES =====
      ('54000', 'Student Services', 'expense', 'debit', 1),

      -- Student Services - Personnel
      ('54100', 'Student Services - Personnel', 'expense', 'debit', 2),
      ('54110', 'Basic Salaries - Student Services', 'expense', 'debit', 3),
      ('54120', 'SSS Employer - Student Services', 'expense', 'debit', 3),
      ('54130', 'PhilHealth Employer - Student Services', 'expense', 'debit', 3),
      ('54140', 'Pag-IBIG Employer - Student Services', 'expense', 'debit', 3),

      -- Student Services - MOOE
      ('54200', 'Student Services - MOOE', 'expense', 'debit', 2),
      ('54210', 'Scholarships and Financial Aid', 'expense', 'debit', 3),
      ('54220', 'Student Organization Funds', 'expense', 'debit', 3),
      ('54230', 'Counseling Services', 'expense', 'debit', 3),
      ('54240', 'Admission and Placement', 'expense', 'debit', 3),
      ('54250', 'Health and Wellness', 'expense', 'debit', 3),
      ('54260', 'Sports and Athletics', 'expense', 'debit', 3),

      -- ===== ADMINISTRATION AND FINANCE =====
      ('55000', 'Administration and Finance', 'expense', 'debit', 1),

      -- Admin - Personnel Services
      ('55100', 'Admin - Personnel Services', 'expense', 'debit', 2),
      ('55110', 'Basic Salaries - Administration', 'expense', 'debit', 3),
      ('55120', 'Allowances - Administration', 'expense', 'debit', 3),
      ('55130', 'Overtime Pay - Administration', 'expense', 'debit', 3),
      ('55140', 'SSS Employer - Admin', 'expense', 'debit', 3),
      ('55150', 'PhilHealth Employer - Admin', 'expense', 'debit', 3),
      ('55160', 'Pag-IBIG Employer - Admin', 'expense', 'debit', 3),
      ('55170', '13th Month Pay - Admin', 'expense', 'debit', 3),

      -- Admin - MOOE
      ('55200', 'Admin - MOOE', 'expense', 'debit', 2),
      ('55210', 'Office Supplies - Administration', 'expense', 'debit', 3),
      ('55220', 'Utilities - Administration', 'expense', 'debit', 3),
      ('55230', 'Internet and Communications - Admin', 'expense', 'debit', 3),
      ('55240', 'Professional Fees - Admin', 'expense', 'debit', 3),
      ('55250', 'Bank Charges', 'expense', 'debit', 3),
      ('55260', 'Insurance - Administration', 'expense', 'debit', 3),
      ('55270', 'Taxes and Licenses', 'expense', 'debit', 3),
      ('55280', 'Audit and Legal Fees', 'expense', 'debit', 3),
      ('55290', 'Printing and Reproduction', 'expense', 'debit', 3),

      -- Admin - Travel
      ('55300', 'Admin - Travel', 'expense', 'debit', 2),
      ('55310', 'Local Travel - Administration', 'expense', 'debit', 3),
      ('55320', 'Foreign Travel - Administration', 'expense', 'debit', 3),

      -- ===== PLANT AND EQUIPMENT OPERATIONS =====
      ('56000', 'Plant and Equipment Operations', 'expense', 'debit', 1),

      -- PEO - Personnel Services
      ('56100', 'PEO - Personnel Services', 'expense', 'debit', 2),
      ('56110', 'Basic Salaries - PEO', 'expense', 'debit', 3),
      ('56120', 'SSS Employer - PEO', 'expense', 'debit', 3),
      ('56130', 'PhilHealth Employer - PEO', 'expense', 'debit', 3),
      ('56140', 'Pag-IBIG Employer - PEO', 'expense', 'debit', 3),

      -- PEO - MOOE
      ('56200', 'PEO - MOOE', 'expense', 'debit', 2),
      ('56210', 'Building Maintenance', 'expense', 'debit', 3),
      ('56220', 'Grounds Maintenance', 'expense', 'debit', 3),
      ('56230', 'Utilities - Plant Operations', 'expense', 'debit', 3),
      ('56240', 'Security Services', 'expense', 'debit', 3),
      ('56250', 'Janitorial Services', 'expense', 'debit', 3),
      ('56260', 'Vehicle Maintenance', 'expense', 'debit', 3),

      -- PEO - Capital Outlay
      ('56300', 'PEO - Capital Outlay', 'expense', 'debit', 2),
      ('56310', 'Building Construction', 'expense', 'debit', 3),
      ('56320', 'Building Renovation', 'expense', 'debit', 3),
      ('56330', 'Land Acquisition', 'expense', 'debit', 3),
      ('56340', 'Vehicle Purchase', 'expense', 'debit', 3),

      -- ===== NON-OPERATING EXPENSES =====
      ('57000', 'Non-Operating Expenses', 'expense', 'debit', 1),
      ('57100', 'Interest Expense', 'expense', 'debit', 2),
      ('57110', 'Interest on Bank Loans', 'expense', 'debit', 3),
      ('57120', 'Interest on Equipment Financing', 'expense', 'debit', 3),
      ('57130', 'Interest on Pag-IBIG Loan', 'expense', 'debit', 3),
      ('57200', 'Depreciation Expense', 'expense', 'debit', 2),
      ('57210', 'Depreciation - Buildings', 'expense', 'debit', 3),
      ('57220', 'Depreciation - Equipment', 'expense', 'debit', 3),
      ('57230', 'Depreciation - Vehicles', 'expense', 'debit', 3),
      ('57300', 'Amortization Expense', 'expense', 'debit', 2),
      ('57400', 'Loss on Asset Disposal', 'expense', 'debit', 2),
      ('57500', 'Loss on Foreign Exchange', 'expense', 'debit', 2),
      ('57600', 'Miscellaneous Expense', 'expense', 'debit', 2),
      ('57700', 'Bad Debt Expense', 'expense', 'debit', 2)
    ON CONFLICT (account_code) DO NOTHING;

    -- Set parent-child relationships
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '10000') WHERE account_code IN ('11000', '12000');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '11000') WHERE account_code IN ('11100', '11200', '11300', '11400', '11500', '11600', '11700');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '11100') WHERE account_code IN ('11110', '11120', '11130', '11140');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '11110') WHERE account_code LIKE '1111[1-5]';
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '11120') WHERE account_code LIKE '1112[1-5]';
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '11200') WHERE account_code IN ('11210', '11220', '11230', '11240', '11250', '11260', '11270');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '11210') WHERE account_code LIKE '1121[1-4]';
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '11230') WHERE account_code IN ('11231', '11232', '11233');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '11400') WHERE account_code IN ('11410', '11420');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '11500') WHERE account_code IN ('11510', '11520', '11530');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '11510') WHERE account_code IN ('11511', '11512', '11513');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '11600') WHERE account_code IN ('11610', '11620', '11630');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '11700') WHERE account_code IN ('11710', '11720', '11730');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '12000') WHERE account_code IN ('12100', '12200', '12300');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '12100') WHERE account_code IN ('12110', '12120', '12130', '12140', '12150', '12160', '12170', '12180');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '12110') WHERE account_code IN ('12111', '12112', '12113');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '12120') WHERE account_code IN ('12121', '12122', '12123', '12124', '12125', '12126', '12127');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '12140') WHERE account_code IN ('12141', '12142', '12143', '12144', '12145');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '12160') WHERE account_code IN ('12161', '12162');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '12200') WHERE account_code IN ('12210', '12220', '12230');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '12300') WHERE account_code IN ('12310', '12320');

    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '20000') WHERE account_code IN ('21000', '22000');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '21000') WHERE account_code IN ('21100', '21200', '21300', '21400', '21500', '21600', '21700');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '21100') WHERE account_code IN ('21110', '21120', '21130', '21140');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '21200') WHERE account_code IN ('21210', '21220', '21230');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '21300') WHERE account_code IN ('21310', '21320', '21330');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '21400') WHERE account_code IN ('21410', '21420', '21430', '21440', '21450');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '21500') WHERE account_code IN ('21510', '21520', '21530');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '21600') WHERE account_code IN ('21610', '21620', '21630');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '21700') WHERE account_code IN ('21710', '21720', '21730');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '22000') WHERE account_code IN ('22100', '22200', '22300');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '22100') WHERE account_code IN ('22110', '22120', '22130');

    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '30000') WHERE account_code IN ('31000', '32000', '33000', '34000', '39000');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '31000') WHERE account_code IN ('31100', '31200');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '31100') WHERE account_code IN ('31110', '31120');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '32000') WHERE account_code IN ('32100');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '33000') WHERE account_code IN ('33010', '33020', '33030', '31300');

    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '40000') WHERE account_code IN ('41000', '42000', '43000', '44000');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '41000') WHERE account_code IN ('41100', '41200', '41300', '41400');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '41100') WHERE account_code IN ('41110', '41120', '41130');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '42000') WHERE account_code IN ('42100', '42200', '42300', '42400', '42500', '42600');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '43000') WHERE account_code IN ('43100', '43200', '43300', '43400', '43500', '43600', '43700');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '44000') WHERE account_code IN ('44100', '44200', '44300', '44400', '44500');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '44100') WHERE account_code IN ('44110', '44120', '44130', '44140');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '44200') WHERE account_code IN ('44210', '44220');

    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '50000') WHERE account_code IN ('51000', '52000', '53000', '54000', '55000', '56000', '57000');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '51000') WHERE account_code IN ('51100', '51200', '51300', '51400');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '51100') WHERE account_code LIKE '511[1-7]';
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '51200') WHERE account_code LIKE '512[1-6]';
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '51300') WHERE account_code IN ('51310', '51320');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '51400') WHERE account_code IN ('51410', '51420');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '52000') WHERE account_code IN ('52100', '52200');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '52100') WHERE account_code LIKE '521[1-5]';
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '52200') WHERE account_code LIKE '522[1-4]';
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '53000') WHERE account_code IN ('53100', '53200');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '53100') WHERE account_code LIKE '531[1-4]';
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '53200') WHERE account_code LIKE '532[1-3]';
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '54000') WHERE account_code IN ('54100', '54200');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '54100') WHERE account_code LIKE '541[1-4]';
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '54200') WHERE account_code LIKE '542[1-6]';
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '55000') WHERE account_code IN ('55100', '55200', '55300');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '55100') WHERE account_code LIKE '551[1-7]';
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '55200') WHERE account_code LIKE '552[1-9]';
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '55300') WHERE account_code IN ('55310', '55320');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '56000') WHERE account_code IN ('56100', '56200', '56300');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '56100') WHERE account_code LIKE '561[1-4]';
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '56200') WHERE account_code LIKE '562[1-6]';
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '56300') WHERE account_code IN ('56310', '56320', '56330', '56340');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '57000') WHERE account_code IN ('57100', '57200', '57300', '57400', '57500', '57600', '57700');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '57100') WHERE account_code IN ('57110', '57120', '57130');
    UPDATE "${schemaName}".account SET parent_id = (SELECT id FROM "${schemaName}".account WHERE account_code = '57200') WHERE account_code IN ('57210', '57220', '57230');

    INSERT INTO "${schemaName}".number_series (series_type, prefix, starting_number, next_number)
    SELECT v.series_type, v.prefix, v.starting_number, v.next_number
    FROM (VALUES
      ('JE'::VARCHAR, 'JE', 1, 1),
      ('OR'::VARCHAR, 'OR', 1, 1),
      ('CV'::VARCHAR, 'CV', 1, 1),
      ('CD'::VARCHAR, 'CD', 1, 1),
      ('PMT'::VARCHAR, 'PMT', 1, 1),
      ('INVOICE'::VARCHAR, 'INV', 1, 1),
      ('PR'::VARCHAR, 'PR', 1, 1)
    ) AS v(series_type, prefix, starting_number, next_number)
    WHERE NOT EXISTS (SELECT 1 FROM "${schemaName}".number_series WHERE fiscal_year_id IS NULL);
  `

  for (const stmt of sql.split(";")) {
    const trimmed = stmt.trim()
    if (trimmed.length > 0) {
      await prisma.$executeRawUnsafe(trimmed + ";")
    }
  }

  const migrations = `
    ALTER TABLE "${schemaName}".student_invoice ADD COLUMN IF NOT EXISTS term_start_date DATE;
    ALTER TABLE "${schemaName}".student_invoice ADD COLUMN IF NOT EXISTS term_end_date DATE;
    ALTER TABLE "${schemaName}".payment_transaction ADD COLUMN IF NOT EXISTS payor_name VARCHAR(200);
    ALTER TABLE "${schemaName}".payment_transaction ADD COLUMN IF NOT EXISTS payor_address TEXT;
    ALTER TABLE "${schemaName}".payment_transaction ADD COLUMN IF NOT EXISTS tin VARCHAR(20);
    ALTER TABLE "${schemaName}".payment_transaction ADD COLUMN IF NOT EXISTS payment_type VARCHAR(30) DEFAULT 'tuition';
    ALTER TABLE "${schemaName}".payment_transaction ADD COLUMN IF NOT EXISTS deposit_status VARCHAR(20);

    CREATE TABLE IF NOT EXISTS "${schemaName}".revenue_recognition_entry (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_invoice_id UUID NOT NULL REFERENCES "${schemaName}".student_invoice(id),
      recognition_date DATE NOT NULL,
      amount DECIMAL(18,2) NOT NULL,
      journal_entry_id UUID,
      fiscal_period_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(student_invoice_id, fiscal_period_id)
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".sales_invoice (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_number VARCHAR(30) NOT NULL UNIQUE,
      student_id UUID REFERENCES "${schemaName}".student(id),
      student_invoice_id UUID,
      payor_name VARCHAR(200) NOT NULL,
      payor_address TEXT,
      payor_tin VARCHAR(20),
      invoice_date DATE NOT NULL,
      due_date DATE,
      amount DECIMAL(18,2) NOT NULL,
      vat_amount DECIMAL(18,2) DEFAULT 0,
      vat_exempt_amount DECIMAL(18,2) DEFAULT 0,
      zero_rated_amount DECIMAL(18,2) DEFAULT 0,
      vat_rate DECIMAL(5,2) DEFAULT 12.00,
      is_vat_exempt BOOLEAN DEFAULT TRUE,
      bir_serial_number VARCHAR(50),
      bir_accredited_printer_tin VARCHAR(20),
      bir_permit_number VARCHAR(50),
      status VARCHAR(10) DEFAULT 'active' CHECK (status IN ('active', 'void', 'cancelled')),
      void_reason TEXT,
      journal_entry_id UUID,
      created_by UUID NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".sales_invoice_line (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sales_invoice_id UUID NOT NULL REFERENCES "${schemaName}".sales_invoice(id),
      fee_type VARCHAR(50) NOT NULL,
      description TEXT NOT NULL,
      amount DECIMAL(18,2) NOT NULL,
      vat_sales DECIMAL(18,2) DEFAULT 0,
      vat_exempt_sales DECIMAL(18,2) DEFAULT 0,
      zero_rated_sales DECIMAL(18,2) DEFAULT 0,
      vat_amount DECIMAL(18,2) DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".bir_serial_range (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_type VARCHAR(30) NOT NULL CHECK (document_type IN ('invoice', 'official_receipt', 'acknowledgment_receipt')),
      series_prefix VARCHAR(10) NOT NULL,
      start_number VARCHAR(20) NOT NULL,
      end_number VARCHAR(20) NOT NULL,
      accredited_printer_tin VARCHAR(20),
      permit_number VARCHAR(50),
      bir_serial_number VARCHAR(50),
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(document_type, series_prefix)
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".withholding_tax_register (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ewt_type VARCHAR(20) NOT NULL CHECK (ewt_type IN ('expanded', 'creditable', 'final')),
      bir_form_code VARCHAR(10) NOT NULL,
      disbursement_id UUID REFERENCES "${schemaName}".disbursement(id),
      payee_name VARCHAR(200) NOT NULL,
      payee_tin VARCHAR(20) NOT NULL,
      payee_address TEXT,
      base_amount DECIMAL(18,2) NOT NULL,
      tax_rate DECIMAL(5,2) NOT NULL,
      tax_withheld DECIMAL(18,2) NOT NULL,
      withholding_date DATE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE "${schemaName}".official_receipt ADD COLUMN IF NOT EXISTS bir_serial_number VARCHAR(50);
    ALTER TABLE "${schemaName}".official_receipt ADD COLUMN IF NOT EXISTS bir_accredited_printer_tin VARCHAR(20);
    ALTER TABLE "${schemaName}".official_receipt ADD COLUMN IF NOT EXISTS bir_permit_number VARCHAR(50);

    CREATE TABLE IF NOT EXISTS "${schemaName}".employee (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_code VARCHAR(30) NOT NULL UNIQUE,
      full_name VARCHAR(200) NOT NULL,
      position VARCHAR(100),
      department VARCHAR(100),
      tin VARCHAR(20),
      sss_number VARCHAR(20),
      philhealth_number VARCHAR(20),
      pagibig_number VARCHAR(20),
      basic_pay DECIMAL(18,2) NOT NULL DEFAULT 0,
      allowances DECIMAL(18,2) DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      hire_date DATE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".payroll_run (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      run_number VARCHAR(30) NOT NULL UNIQUE,
      run_date DATE NOT NULL,
      pay_period_start DATE NOT NULL,
      pay_period_end DATE NOT NULL,
      status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'void')),
      total_gross_pay DECIMAL(18,2) DEFAULT 0,
      total_deductions DECIMAL(18,2) DEFAULT 0,
      total_net_pay DECIMAL(18,2) DEFAULT 0,
      journal_entry_id UUID,
      created_by UUID NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".payroll_run_line (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      payroll_run_id UUID NOT NULL REFERENCES "${schemaName}".payroll_run(id),
      employee_id UUID NOT NULL REFERENCES "${schemaName}".employee(id),
      basic_pay DECIMAL(18,2) NOT NULL,
      allowances DECIMAL(18,2) DEFAULT 0,
      gross_pay DECIMAL(18,2) NOT NULL,
      sss_employee DECIMAL(18,2) DEFAULT 0,
      sss_employer DECIMAL(18,2) DEFAULT 0,
      philhealth_employee DECIMAL(18,2) DEFAULT 0,
      philhealth_employer DECIMAL(18,2) DEFAULT 0,
      pagibig_employee DECIMAL(18,2) DEFAULT 0,
      pagibig_employer DECIMAL(18,2) DEFAULT 0,
      withholding_tax DECIMAL(18,2) DEFAULT 0,
      total_deductions DECIMAL(18,2) DEFAULT 0,
      net_pay DECIMAL(18,2) NOT NULL,
      thirteenth_month_accrual DECIMAL(18,2) DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".budget (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      fiscal_year_id UUID NOT NULL,
      account_id UUID NOT NULL REFERENCES "${schemaName}".account(id),
      budgeted_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      notes TEXT,
      created_by UUID NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(fiscal_year_id, account_id)
    );
  `

  for (const stmt of migrations.split(";")) {
    const trimmed = stmt.trim()
    if (trimmed.length > 0) {
      await prisma.$executeRawUnsafe(trimmed + ";")
    }
  }
}

export async function dropEntitySchema(schemaName: string): Promise<void> {
  await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`)
}
