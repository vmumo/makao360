-- ============================================================
-- BATCH 1: MONEY CORE — double-entry accounting foundation
-- ============================================================

-- ---------- enums ----------
DO $$ BEGIN
  CREATE TYPE public.account_type AS ENUM ('asset','liability','equity','income','expense');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.journal_source AS ENUM
    ('contribution','payout','expense','late_fee','deposit','adjustment','advance','fee','opening_balance','wht');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.expense_category AS ENUM
    ('repairs','utilities','security','cleaning','insurance','levies','legal','staff','management','marketing','tax','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.expense_status AS ENUM ('draft','approved','paid','void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.late_fee_kind AS ENUM ('fixed','percent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.bank_txn_status AS ENUM ('unmatched','matched','ignored');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.statement_status AS ENUM ('draft','finalised','paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- chart of accounts ----------
CREATE TABLE public.gl_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  type public.account_type NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX gl_accounts_system_code ON public.gl_accounts(code) WHERE landlord_id IS NULL;
CREATE UNIQUE INDEX gl_accounts_landlord_code ON public.gl_accounts(landlord_id, code) WHERE landlord_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gl_accounts TO authenticated;
GRANT ALL ON public.gl_accounts TO service_role;
ALTER TABLE public.gl_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY gl_accounts_read ON public.gl_accounts FOR SELECT TO authenticated
  USING (landlord_id IS NULL OR landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY gl_accounts_write ON public.gl_accounts FOR INSERT TO authenticated
  WITH CHECK ((landlord_id = auth.uid() AND is_system = false) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY gl_accounts_update ON public.gl_accounts FOR UPDATE TO authenticated
  USING ((landlord_id = auth.uid() AND is_system = false) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK ((landlord_id = auth.uid() AND is_system = false) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY gl_accounts_delete ON public.gl_accounts FOR DELETE TO authenticated
  USING ((landlord_id = auth.uid() AND is_system = false) OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER gl_accounts_touch BEFORE UPDATE ON public.gl_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- journals ----------
CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT current_date,
  memo text,
  source public.journal_source NOT NULL DEFAULT 'adjustment',
  source_table text,
  source_id uuid,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  lease_id uuid REFERENCES public.leases(id) ON DELETE SET NULL,
  reverses_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  posted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX journal_entries_landlord_date ON public.journal_entries(landlord_id, entry_date DESC);
CREATE INDEX journal_entries_source ON public.journal_entries(source_table, source_id);

GRANT SELECT ON public.journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO service_role;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY journal_entries_read ON public.journal_entries FOR SELECT TO authenticated
  USING (landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.gl_accounts(id),
  debit numeric(14,2) NOT NULL DEFAULT 0,
  credit numeric(14,2) NOT NULL DEFAULT 0,
  description text,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  lease_id uuid REFERENCES public.leases(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journal_lines_nonneg CHECK (debit >= 0 AND credit >= 0),
  CONSTRAINT journal_lines_one_side CHECK (NOT (debit > 0 AND credit > 0))
);
CREATE INDEX journal_lines_entry ON public.journal_lines(entry_id);
CREATE INDEX journal_lines_account ON public.journal_lines(account_id);

GRANT SELECT ON public.journal_lines TO authenticated;
GRANT ALL ON public.journal_lines TO service_role;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY journal_lines_read ON public.journal_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.journal_entries e
                  WHERE e.id = entry_id
                    AND (e.landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- balanced-entry enforcement (deferred to commit)
CREATE OR REPLACE FUNCTION public.assert_journal_balanced()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_d numeric(14,2); v_c numeric(14,2); v_entry uuid;
BEGIN
  v_entry := COALESCE(NEW.entry_id, OLD.entry_id);
  SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0) INTO v_d, v_c
    FROM public.journal_lines WHERE entry_id = v_entry;
  IF v_d <> v_c THEN
    RAISE EXCEPTION 'Journal entry % is unbalanced (debits %, credits %)', v_entry, v_d, v_c;
  END IF;
  RETURN NULL;
END; $$;

CREATE CONSTRAINT TRIGGER journal_lines_balanced
  AFTER INSERT OR UPDATE OR DELETE ON public.journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.assert_journal_balanced();

-- ---------- expenses ----------
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  category public.expense_category NOT NULL DEFAULT 'repairs',
  vendor_name text,
  description text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  expense_date date NOT NULL DEFAULT current_date,
  receipt_ref text,
  receipt_url text,
  status public.expense_status NOT NULL DEFAULT 'approved',
  billable_to_tenant boolean NOT NULL DEFAULT false,
  maintenance_request_id uuid REFERENCES public.maintenance_requests(id) ON DELETE SET NULL,
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX expenses_landlord_date ON public.expenses(landlord_id, expense_date DESC);
CREATE INDEX expenses_property ON public.expenses(property_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY expenses_all ON public.expenses FOR ALL TO authenticated
  USING (landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER expenses_touch BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- late fee rules ----------
CREATE TABLE public.late_fee_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Default late fee',
  grace_days integer NOT NULL DEFAULT 5 CHECK (grace_days >= 0),
  kind public.late_fee_kind NOT NULL DEFAULT 'percent',
  amount numeric(10,2) NOT NULL DEFAULT 5 CHECK (amount >= 0),
  max_cap numeric(12,2),
  recurring_monthly boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX late_fee_rules_landlord ON public.late_fee_rules(landlord_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.late_fee_rules TO authenticated;
GRANT ALL ON public.late_fee_rules TO service_role;
ALTER TABLE public.late_fee_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY late_fee_rules_all ON public.late_fee_rules FOR ALL TO authenticated
  USING (landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER late_fee_rules_touch BEFORE UPDATE ON public.late_fee_rules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.late_fee_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES public.leases(id) ON DELETE CASCADE,
  cycle_id uuid REFERENCES public.rent_cycles(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES public.late_fee_rules(id) ON DELETE SET NULL,
  landlord_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  charged_on date NOT NULL DEFAULT current_date,
  waived_at timestamptz,
  waived_by uuid REFERENCES auth.users(id),
  waive_reason text,
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX late_fee_charges_cycle_once
  ON public.late_fee_charges(cycle_id, charged_on) WHERE cycle_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON public.late_fee_charges TO authenticated;
GRANT ALL ON public.late_fee_charges TO service_role;
ALTER TABLE public.late_fee_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY late_fee_charges_read ON public.late_fee_charges FOR SELECT TO authenticated
  USING (landlord_id = auth.uid() OR tenant_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY late_fee_charges_manage ON public.late_fee_charges FOR UPDATE TO authenticated
  USING (landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- ---------- bank / M-Pesa statement import ----------
CREATE TABLE public.bank_statement_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_label text NOT NULL,
  file_name text,
  period_start date,
  period_end date,
  row_count integer NOT NULL DEFAULT 0,
  matched_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_statement_imports TO authenticated;
GRANT ALL ON public.bank_statement_imports TO service_role;
ALTER TABLE public.bank_statement_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY bank_imports_all ON public.bank_statement_imports FOR ALL TO authenticated
  USING (landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid REFERENCES public.bank_statement_imports(id) ON DELETE CASCADE,
  landlord_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  txn_date date NOT NULL,
  narrative text NOT NULL,
  reference text,
  counterparty_phone text,
  amount numeric(14,2) NOT NULL,
  status public.bank_txn_status NOT NULL DEFAULT 'unmatched',
  matched_contribution_id uuid REFERENCES public.contributions(id) ON DELETE SET NULL,
  matched_lease_id uuid REFERENCES public.leases(id) ON DELETE SET NULL,
  matched_by uuid REFERENCES auth.users(id),
  matched_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bank_txn_landlord_status ON public.bank_transactions(landlord_id, status, txn_date DESC);
CREATE INDEX bank_txn_reference ON public.bank_transactions(reference);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_transactions TO authenticated;
GRANT ALL ON public.bank_transactions TO service_role;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY bank_txn_all ON public.bank_transactions FOR ALL TO authenticated
  USING (landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- ---------- tax / fee settings ----------
CREATE TABLE public.landlord_tax_settings (
  landlord_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  kra_pin text,
  wht_rate numeric(5,2) NOT NULL DEFAULT 7.50 CHECK (wht_rate >= 0 AND wht_rate <= 100),
  management_fee_rate numeric(5,2) NOT NULL DEFAULT 0 CHECK (management_fee_rate >= 0 AND management_fee_rate <= 100),
  vat_registered boolean NOT NULL DEFAULT false,
  payout_bank_name text,
  payout_account text,
  payout_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.landlord_tax_settings TO authenticated;
GRANT ALL ON public.landlord_tax_settings TO service_role;
ALTER TABLE public.landlord_tax_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY tax_settings_all ON public.landlord_tax_settings FOR ALL TO authenticated
  USING (landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER tax_settings_touch BEFORE UPDATE ON public.landlord_tax_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- owner statements ----------
CREATE TABLE public.owner_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  gross_rent numeric(14,2) NOT NULL DEFAULT 0,
  other_income numeric(14,2) NOT NULL DEFAULT 0,
  expenses_total numeric(14,2) NOT NULL DEFAULT 0,
  management_fee numeric(14,2) NOT NULL DEFAULT 0,
  wht_amount numeric(14,2) NOT NULL DEFAULT 0,
  net_payout numeric(14,2) NOT NULL DEFAULT 0,
  arrears_closing numeric(14,2) NOT NULL DEFAULT 0,
  status public.statement_status NOT NULL DEFAULT 'draft',
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  finalised_at timestamptz,
  paid_at timestamptz,
  generated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX owner_statements_unique_period
  ON public.owner_statements(landlord_id, COALESCE(property_id,'00000000-0000-0000-0000-000000000000'::uuid), period_start);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_statements TO authenticated;
GRANT ALL ON public.owner_statements TO service_role;
ALTER TABLE public.owner_statements ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_statements_all ON public.owner_statements FOR ALL TO authenticated
  USING (landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (landlord_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER owner_statements_touch BEFORE UPDATE ON public.owner_statements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- seed system chart of accounts ----------
INSERT INTO public.gl_accounts (landlord_id, code, name, type, is_system, description) VALUES
  (NULL,'1000','Bank / M-Pesa','asset',true,'Cash held in bank or mobile money'),
  (NULL,'1100','Rent receivable','asset',true,'Rent invoiced but not yet collected'),
  (NULL,'1200','Tenant advances receivable','asset',true,'Rent Fuliza advances outstanding'),
  (NULL,'2000','Tenant deposits held','liability',true,'Refundable security deposits'),
  (NULL,'2100','Owner payable','liability',true,'Funds collected and owed to the landlord'),
  (NULL,'2200','Withholding tax payable','liability',true,'Rental income WHT due to KRA'),
  (NULL,'3000','Owner equity','equity',true,'Owner capital and drawings'),
  (NULL,'4000','Rent income','income',true,'Rent earned from tenants'),
  (NULL,'4100','Late fee income','income',true,'Penalties charged on overdue rent'),
  (NULL,'4200','Advance fee income','income',true,'Rent Fuliza service fees'),
  (NULL,'4300','Other income','income',true,'Parking, water surcharge and other charges'),
  (NULL,'5000','Repairs & maintenance','expense',true,NULL),
  (NULL,'5100','Utilities','expense',true,NULL),
  (NULL,'5200','Security','expense',true,NULL),
  (NULL,'5300','Cleaning','expense',true,NULL),
  (NULL,'5400','Insurance','expense',true,NULL),
  (NULL,'5500','Service charge & levies','expense',true,NULL),
  (NULL,'5600','Legal & professional','expense',true,NULL),
  (NULL,'5700','Staff costs','expense',true,NULL),
  (NULL,'5800','Management fees','expense',true,NULL),
  (NULL,'5900','Marketing','expense',true,NULL),
  (NULL,'6000','Other expenses','expense',true,NULL);
