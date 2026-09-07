export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      analytics_events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          path: string | null
          properties: Json
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          path?: string | null
          properties?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          path?: string | null
          properties?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_table: string | null
          id: string
          meta: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_table?: string | null
          id?: string
          meta?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_table?: string | null
          id?: string
          meta?: Json | null
        }
        Relationships: []
      }
      bank_statement_imports: {
        Row: {
          created_at: string
          created_by: string | null
          file_name: string | null
          id: string
          landlord_id: string
          matched_count: number
          period_end: string | null
          period_start: string | null
          row_count: number
          source_label: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          id?: string
          landlord_id: string
          matched_count?: number
          period_end?: string | null
          period_start?: string | null
          row_count?: number
          source_label: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          id?: string
          landlord_id?: string
          matched_count?: number
          period_end?: string | null
          period_start?: string | null
          row_count?: number
          source_label?: string
        }
        Relationships: []
      }
      bank_transactions: {
        Row: {
          amount: number
          counterparty_phone: string | null
          created_at: string
          id: string
          import_id: string | null
          landlord_id: string
          matched_at: string | null
          matched_by: string | null
          matched_contribution_id: string | null
          matched_lease_id: string | null
          narrative: string
          note: string | null
          reference: string | null
          status: Database["public"]["Enums"]["bank_txn_status"]
          txn_date: string
        }
        Insert: {
          amount: number
          counterparty_phone?: string | null
          created_at?: string
          id?: string
          import_id?: string | null
          landlord_id: string
          matched_at?: string | null
          matched_by?: string | null
          matched_contribution_id?: string | null
          matched_lease_id?: string | null
          narrative: string
          note?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["bank_txn_status"]
          txn_date: string
        }
        Update: {
          amount?: number
          counterparty_phone?: string | null
          created_at?: string
          id?: string
          import_id?: string | null
          landlord_id?: string
          matched_at?: string | null
          matched_by?: string | null
          matched_contribution_id?: string | null
          matched_lease_id?: string | null
          narrative?: string
          note?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["bank_txn_status"]
          txn_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "bank_statement_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_matched_contribution_id_fkey"
            columns: ["matched_contribution_id"]
            isOneToOne: false
            referencedRelation: "contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_matched_lease_id_fkey"
            columns: ["matched_lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
        ]
      }
      contributions: {
        Row: {
          amount: number
          contributed_at: string
          created_at: string
          cycle_id: string | null
          external_ref: string | null
          id: string
          lease_id: string
          mpesa_receipt: string | null
          note: string | null
          payer_phone: string | null
          reconciled_at: string | null
          reconciled_by: string | null
          reconciliation_note: string | null
          source: Database["public"]["Enums"]["contribution_source"]
          status: Database["public"]["Enums"]["contribution_status"]
          tenant_id: string
        }
        Insert: {
          amount: number
          contributed_at?: string
          created_at?: string
          cycle_id?: string | null
          external_ref?: string | null
          id?: string
          lease_id: string
          mpesa_receipt?: string | null
          note?: string | null
          payer_phone?: string | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          reconciliation_note?: string | null
          source?: Database["public"]["Enums"]["contribution_source"]
          status?: Database["public"]["Enums"]["contribution_status"]
          tenant_id: string
        }
        Update: {
          amount?: number
          contributed_at?: string
          created_at?: string
          cycle_id?: string | null
          external_ref?: string | null
          id?: string
          lease_id?: string
          mpesa_receipt?: string | null
          note?: string | null
          payer_phone?: string | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          reconciliation_note?: string | null
          source?: Database["public"]["Enums"]["contribution_source"]
          status?: Database["public"]["Enums"]["contribution_status"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contributions_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "rent_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_tenant_profile_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      cookie_consents: {
        Row: {
          analytics: boolean
          created_at: string
          id: string
          marketing: boolean
          necessary: boolean
          session_id: string
          user_id: string | null
        }
        Insert: {
          analytics?: boolean
          created_at?: string
          id?: string
          marketing?: boolean
          necessary?: boolean
          session_id: string
          user_id?: string | null
        }
        Update: {
          analytics?: boolean
          created_at?: string
          id?: string
          marketing?: boolean
          necessary?: boolean
          session_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          billable_to_tenant: boolean
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string | null
          description: string
          expense_date: string
          id: string
          journal_entry_id: string | null
          landlord_id: string
          maintenance_request_id: string | null
          property_id: string | null
          receipt_ref: string | null
          receipt_url: string | null
          status: Database["public"]["Enums"]["expense_status"]
          unit_id: string | null
          updated_at: string
          vendor_name: string | null
        }
        Insert: {
          amount: number
          billable_to_tenant?: boolean
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          description: string
          expense_date?: string
          id?: string
          journal_entry_id?: string | null
          landlord_id: string
          maintenance_request_id?: string | null
          property_id?: string | null
          receipt_ref?: string | null
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          unit_id?: string | null
          updated_at?: string
          vendor_name?: string | null
        }
        Update: {
          amount?: number
          billable_to_tenant?: boolean
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          description?: string
          expense_date?: string
          id?: string
          journal_entry_id?: string | null
          landlord_id?: string
          maintenance_request_id?: string | null
          property_id?: string | null
          receipt_ref?: string | null
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          unit_id?: string | null
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_maintenance_request_id_fkey"
            columns: ["maintenance_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          enabled_globally: boolean
          enabled_user_ids: string[]
          flag_key: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled_globally?: boolean
          enabled_user_ids?: string[]
          flag_key: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled_globally?: boolean
          enabled_user_ids?: string[]
          flag_key?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      fuliza_applications: {
        Row: {
          advance_id: string | null
          approved_amount: number | null
          created_at: string
          decided_at: string | null
          eligibility_limit: number
          id: string
          lease_id: string
          reason: string | null
          rejection_reason: string | null
          requested_amount: number
          status: Database["public"]["Enums"]["fuliza_app_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          advance_id?: string | null
          approved_amount?: number | null
          created_at?: string
          decided_at?: string | null
          eligibility_limit: number
          id?: string
          lease_id: string
          reason?: string | null
          rejection_reason?: string | null
          requested_amount: number
          status?: Database["public"]["Enums"]["fuliza_app_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          advance_id?: string | null
          approved_amount?: number | null
          created_at?: string
          decided_at?: string | null
          eligibility_limit?: number
          id?: string
          lease_id?: string
          reason?: string | null
          rejection_reason?: string | null
          requested_amount?: number
          status?: Database["public"]["Enums"]["fuliza_app_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuliza_applications_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_accounts: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          landlord_id: string | null
          name: string
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          landlord_id?: string | null
          name: string
          type: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          landlord_id?: string | null
          name?: string
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Relationships: []
      }
      inspections: {
        Row: {
          completed_at: string | null
          created_at: string
          deductions: number
          id: string
          inspector_name: string | null
          items: Json
          kind: Database["public"]["Enums"]["inspection_kind"]
          landlord_id: string
          lease_id: string | null
          scheduled_for: string
          status: Database["public"]["Enums"]["inspection_status"]
          summary: string | null
          tenant_id: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          deductions?: number
          id?: string
          inspector_name?: string | null
          items?: Json
          kind?: Database["public"]["Enums"]["inspection_kind"]
          landlord_id: string
          lease_id?: string | null
          scheduled_for?: string
          status?: Database["public"]["Enums"]["inspection_status"]
          summary?: string | null
          tenant_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          deductions?: number
          id?: string
          inspector_name?: string | null
          items?: Json
          kind?: Database["public"]["Enums"]["inspection_kind"]
          landlord_id?: string
          lease_id?: string | null
          scheduled_for?: string
          status?: Database["public"]["Enums"]["inspection_status"]
          summary?: string | null
          tenant_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspections_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_due: number
          amount_paid: number
          created_at: string
          cycle_id: string | null
          due_date: string
          id: string
          invoice_number: string
          landlord_id: string
          lease_id: string
          period_end: string
          period_start: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_due: number
          amount_paid?: number
          created_at?: string
          cycle_id?: string | null
          due_date: string
          id?: string
          invoice_number: string
          landlord_id: string
          lease_id: string
          period_end: string
          period_start: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          created_at?: string
          cycle_id?: string | null
          due_date?: string
          id?: string
          invoice_number?: string
          landlord_id?: string
          lease_id?: string
          period_end?: string
          period_start?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: true
            referencedRelation: "rent_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string
          entry_date: string
          id: string
          landlord_id: string
          lease_id: string | null
          memo: string | null
          posted_by: string | null
          property_id: string | null
          reverses_entry_id: string | null
          source: Database["public"]["Enums"]["journal_source"]
          source_id: string | null
          source_table: string | null
        }
        Insert: {
          created_at?: string
          entry_date?: string
          id?: string
          landlord_id: string
          lease_id?: string | null
          memo?: string | null
          posted_by?: string | null
          property_id?: string | null
          reverses_entry_id?: string | null
          source?: Database["public"]["Enums"]["journal_source"]
          source_id?: string | null
          source_table?: string | null
        }
        Update: {
          created_at?: string
          entry_date?: string
          id?: string
          landlord_id?: string
          lease_id?: string | null
          memo?: string | null
          posted_by?: string | null
          property_id?: string | null
          reverses_entry_id?: string | null
          source?: Database["public"]["Enums"]["journal_source"]
          source_id?: string | null
          source_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_reverses_entry_id_fkey"
            columns: ["reverses_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_id: string
          created_at: string
          credit: number
          debit: number
          description: string | null
          entry_id: string
          id: string
          lease_id: string | null
          property_id: string | null
          unit_id: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          entry_id: string
          id?: string
          lease_id?: string | null
          property_id?: string | null
          unit_id?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          entry_id?: string
          id?: string
          lease_id?: string | null
          property_id?: string | null
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_submissions: {
        Row: {
          country: string
          created_at: string
          document_url: string | null
          full_name: string
          id: string
          id_number: string
          id_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          selfie_url: string | null
          status: Database["public"]["Enums"]["kyc_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          country?: string
          created_at?: string
          document_url?: string | null
          full_name: string
          id?: string
          id_number: string
          id_type: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          country?: string
          created_at?: string
          document_url?: string | null
          full_name?: string
          id?: string
          id_number?: string
          id_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      landlord_tax_settings: {
        Row: {
          business_address: string | null
          business_email: string | null
          business_name: string | null
          business_phone: string | null
          created_at: string
          invoice_footer: string | null
          kra_pin: string | null
          landlord_id: string
          management_fee_rate: number
          payout_account: string | null
          payout_bank_name: string | null
          payout_phone: string | null
          updated_at: string
          vat_registered: boolean
          wht_rate: number
        }
        Insert: {
          business_address?: string | null
          business_email?: string | null
          business_name?: string | null
          business_phone?: string | null
          created_at?: string
          invoice_footer?: string | null
          kra_pin?: string | null
          landlord_id: string
          management_fee_rate?: number
          payout_account?: string | null
          payout_bank_name?: string | null
          payout_phone?: string | null
          updated_at?: string
          vat_registered?: boolean
          wht_rate?: number
        }
        Update: {
          business_address?: string | null
          business_email?: string | null
          business_name?: string | null
          business_phone?: string | null
          created_at?: string
          invoice_footer?: string | null
          kra_pin?: string | null
          landlord_id?: string
          management_fee_rate?: number
          payout_account?: string | null
          payout_bank_name?: string | null
          payout_phone?: string | null
          updated_at?: string
          vat_registered?: boolean
          wht_rate?: number
        }
        Relationships: []
      }
      landlord_team_members: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invite_code: string
          invited_at: string
          landlord_id: string
          member_name: string | null
          member_phone: string
          member_user_id: string | null
          property_ids: string[]
          revoked_at: string | null
          role: Database["public"]["Enums"]["team_member_role"]
          status: Database["public"]["Enums"]["team_member_status"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invite_code?: string
          invited_at?: string
          landlord_id: string
          member_name?: string | null
          member_phone: string
          member_user_id?: string | null
          property_ids?: string[]
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["team_member_role"]
          status?: Database["public"]["Enums"]["team_member_status"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invite_code?: string
          invited_at?: string
          landlord_id?: string
          member_name?: string | null
          member_phone?: string
          member_user_id?: string | null
          property_ids?: string[]
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["team_member_role"]
          status?: Database["public"]["Enums"]["team_member_status"]
          updated_at?: string
        }
        Relationships: []
      }
      late_fee_charges: {
        Row: {
          amount: number
          charged_on: string
          created_at: string
          cycle_id: string | null
          id: string
          journal_entry_id: string | null
          landlord_id: string
          lease_id: string
          rule_id: string | null
          tenant_id: string
          waive_reason: string | null
          waived_at: string | null
          waived_by: string | null
        }
        Insert: {
          amount: number
          charged_on?: string
          created_at?: string
          cycle_id?: string | null
          id?: string
          journal_entry_id?: string | null
          landlord_id: string
          lease_id: string
          rule_id?: string | null
          tenant_id: string
          waive_reason?: string | null
          waived_at?: string | null
          waived_by?: string | null
        }
        Update: {
          amount?: number
          charged_on?: string
          created_at?: string
          cycle_id?: string | null
          id?: string
          journal_entry_id?: string | null
          landlord_id?: string
          lease_id?: string
          rule_id?: string | null
          tenant_id?: string
          waive_reason?: string | null
          waived_at?: string | null
          waived_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "late_fee_charges_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "rent_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "late_fee_charges_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "late_fee_charges_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "late_fee_charges_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "late_fee_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      late_fee_rules: {
        Row: {
          amount: number
          created_at: string
          enabled: boolean
          grace_days: number
          id: string
          kind: Database["public"]["Enums"]["late_fee_kind"]
          landlord_id: string
          max_cap: number | null
          name: string
          property_id: string | null
          recurring_monthly: boolean
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          enabled?: boolean
          grace_days?: number
          id?: string
          kind?: Database["public"]["Enums"]["late_fee_kind"]
          landlord_id: string
          max_cap?: number | null
          name?: string
          property_id?: string | null
          recurring_monthly?: boolean
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          enabled?: boolean
          grace_days?: number
          id?: string
          kind?: Database["public"]["Enums"]["late_fee_kind"]
          landlord_id?: string
          max_cap?: number | null
          name?: string
          property_id?: string | null
          recurring_monthly?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "late_fee_rules_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      lease_documents: {
        Row: {
          body: string
          created_at: string
          id: string
          landlord_id: string
          landlord_signature: string | null
          landlord_signed_at: string | null
          lease_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["lease_doc_status"]
          tenant_id: string | null
          tenant_signature: string | null
          tenant_signed_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          landlord_id: string
          landlord_signature?: string | null
          landlord_signed_at?: string | null
          lease_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["lease_doc_status"]
          tenant_id?: string | null
          tenant_signature?: string | null
          tenant_signed_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          landlord_id?: string
          landlord_signature?: string | null
          landlord_signed_at?: string | null
          lease_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["lease_doc_status"]
          tenant_id?: string | null
          tenant_signature?: string | null
          tenant_signed_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lease_documents_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
        ]
      }
      lease_renewals: {
        Row: {
          created_at: string
          current_rent: number
          id: string
          landlord_id: string
          lease_id: string
          message: string | null
          new_end_date: string | null
          new_rent: number
          responded_at: string | null
          response_note: string | null
          status: Database["public"]["Enums"]["renewal_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_rent: number
          id?: string
          landlord_id: string
          lease_id: string
          message?: string | null
          new_end_date?: string | null
          new_rent: number
          responded_at?: string | null
          response_note?: string | null
          status?: Database["public"]["Enums"]["renewal_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_rent?: number
          id?: string
          landlord_id?: string
          lease_id?: string
          message?: string | null
          new_end_date?: string | null
          new_rent?: number
          responded_at?: string | null
          response_note?: string | null
          status?: Database["public"]["Enums"]["renewal_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lease_renewals_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
        ]
      }
      leases: {
        Row: {
          auto_payout: boolean
          created_at: string
          deposit_amount: number
          end_date: string | null
          id: string
          landlord_id: string
          rent_amount: number
          rent_due_day: number
          start_date: string
          status: Database["public"]["Enums"]["lease_status"]
          tenant_id: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          auto_payout?: boolean
          created_at?: string
          deposit_amount?: number
          end_date?: string | null
          id?: string
          landlord_id: string
          rent_amount: number
          rent_due_day?: number
          start_date: string
          status?: Database["public"]["Enums"]["lease_status"]
          tenant_id: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          auto_payout?: boolean
          created_at?: string
          deposit_amount?: number
          end_date?: string | null
          id?: string
          landlord_id?: string
          rent_amount?: number
          rent_due_day?: number
          start_date?: string
          status?: Database["public"]["Enums"]["lease_status"]
          tenant_id?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leases_tenant_profile_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "leases_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          created_by: string | null
          description: string | null
          entry_type: Database["public"]["Enums"]["ledger_type"]
          id: string
          lease_id: string
          ref_id: string | null
          ref_table: string | null
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_type: Database["public"]["Enums"]["ledger_type"]
          id?: string
          lease_id: string
          ref_id?: string | null
          ref_table?: string | null
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_type?: Database["public"]["Enums"]["ledger_type"]
          id?: string
          lease_id?: string
          ref_id?: string | null
          ref_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_requests: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          landlord_id: string | null
          landlord_note: string | null
          photo_url: string | null
          priority: Database["public"]["Enums"]["maintenance_priority"]
          property_id: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["maintenance_status"]
          tenant_id: string
          title: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          id?: string
          landlord_id?: string | null
          landlord_note?: string | null
          photo_url?: string | null
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          property_id?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          tenant_id: string
          title: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          landlord_id?: string | null
          landlord_note?: string | null
          photo_url?: string | null
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          property_id?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          tenant_id?: string
          title?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_tenant_profile_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "maintenance_requests_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          phone: string | null
          referrer: string | null
          source: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          phone?: string | null
          referrer?: string | null
          source?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          phone?: string | null
          referrer?: string | null
          source?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      message_reads: {
        Row: {
          last_read_at: string
          thread_id: string
          user_id: string
        }
        Insert: {
          last_read_at?: string
          thread_id: string
          user_id: string
        }
        Update: {
          last_read_at?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reads_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      message_threads: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          landlord_id: string
          last_message_at: string
          lease_id: string | null
          property_id: string | null
          subject: string
          tenant_id: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          landlord_id: string
          last_message_at?: string
          lease_id?: string | null
          property_id?: string | null
          subject: string
          tenant_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          landlord_id?: string
          last_message_at?: string
          lease_id?: string | null
          property_id?: string | null
          subject?: string
          tenant_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          body: string
          created_at: string
          id: string
          sender_id: string
          thread_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          body?: string
          created_at?: string
          id?: string
          sender_id: string
          thread_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          body?: string
          created_at?: string
          id?: string
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          channel_email: boolean
          channel_in_app: boolean
          channel_sms: boolean
          created_at: string
          event_application_status: boolean
          event_deposit_changes: boolean
          event_inspections: boolean
          event_lease_signature: boolean
          event_maintenance: boolean
          event_messages: boolean
          event_renewals: boolean
          payout_updates: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          rent_reminder_days_before: number[]
          rent_reminder_on_due_day: boolean
          rent_reminder_overdue: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          channel_email?: boolean
          channel_in_app?: boolean
          channel_sms?: boolean
          created_at?: string
          event_application_status?: boolean
          event_deposit_changes?: boolean
          event_inspections?: boolean
          event_lease_signature?: boolean
          event_maintenance?: boolean
          event_messages?: boolean
          event_renewals?: boolean
          payout_updates?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          rent_reminder_days_before?: number[]
          rent_reminder_on_due_day?: boolean
          rent_reminder_overdue?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          channel_email?: boolean
          channel_in_app?: boolean
          channel_sms?: boolean
          created_at?: string
          event_application_status?: boolean
          event_deposit_changes?: boolean
          event_inspections?: boolean
          event_lease_signature?: boolean
          event_maintenance?: boolean
          event_messages?: boolean
          event_renewals?: boolean
          payout_updates?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          rent_reminder_days_before?: number[]
          rent_reminder_on_due_day?: boolean
          rent_reminder_overdue?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          id: string
          link_url: string | null
          payload: Json | null
          read_at: string | null
          sent_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          link_url?: string | null
          payload?: Json | null
          read_at?: string | null
          sent_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          link_url?: string | null
          payload?: Json | null
          read_at?: string | null
          sent_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      owner_statements: {
        Row: {
          arrears_closing: number
          breakdown: Json
          created_at: string
          expenses_total: number
          finalised_at: string | null
          generated_by: string | null
          gross_rent: number
          id: string
          landlord_id: string
          management_fee: number
          net_payout: number
          other_income: number
          paid_at: string | null
          period_end: string
          period_start: string
          property_id: string | null
          status: Database["public"]["Enums"]["statement_status"]
          updated_at: string
          wht_amount: number
        }
        Insert: {
          arrears_closing?: number
          breakdown?: Json
          created_at?: string
          expenses_total?: number
          finalised_at?: string | null
          generated_by?: string | null
          gross_rent?: number
          id?: string
          landlord_id: string
          management_fee?: number
          net_payout?: number
          other_income?: number
          paid_at?: string | null
          period_end: string
          period_start: string
          property_id?: string | null
          status?: Database["public"]["Enums"]["statement_status"]
          updated_at?: string
          wht_amount?: number
        }
        Update: {
          arrears_closing?: number
          breakdown?: Json
          created_at?: string
          expenses_total?: number
          finalised_at?: string | null
          generated_by?: string | null
          gross_rent?: number
          id?: string
          landlord_id?: string
          management_fee?: number
          net_payout?: number
          other_income?: number
          paid_at?: string | null
          period_end?: string
          period_start?: string
          property_id?: string | null
          status?: Database["public"]["Enums"]["statement_status"]
          updated_at?: string
          wht_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "owner_statements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          created_at: string
          cycle_id: string | null
          external_ref: string | null
          id: string
          landlord_id: string
          lease_id: string
          mpesa_receipt: string | null
          paid_at: string | null
          status: Database["public"]["Enums"]["payout_status"]
        }
        Insert: {
          amount: number
          created_at?: string
          cycle_id?: string | null
          external_ref?: string | null
          id?: string
          landlord_id: string
          lease_id: string
          mpesa_receipt?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          cycle_id?: string | null
          external_ref?: string | null
          id?: string
          landlord_id?: string
          lease_id?: string
          mpesa_receipt?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payouts_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "rent_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_identity: {
        Row: {
          created_at: string
          national_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          national_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          national_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          phone: string | null
          preferred_role: Database["public"]["Enums"]["app_role"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          phone?: string | null
          preferred_role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          phone?: string | null
          preferred_role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string | null
          city: string | null
          county: string | null
          created_at: string
          id: string
          landlord_id: string
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          portfolio_id: string | null
          property_type: Database["public"]["Enums"]["property_type"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          county?: string | null
          created_at?: string
          id?: string
          landlord_id: string
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          portfolio_id?: string | null
          property_type?: Database["public"]["Enums"]["property_type"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          county?: string | null
          created_at?: string
          id?: string
          landlord_id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          portfolio_id?: string | null
          property_type?: Database["public"]["Enums"]["property_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "property_portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      property_portfolios: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          landlord_id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          landlord_id: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          landlord_id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      property_tag_assignments: {
        Row: {
          created_at: string
          property_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          property_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          property_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "property_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      property_tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          label: string
          landlord_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          label: string
          landlord_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          label?: string
          landlord_id?: string
        }
        Relationships: []
      }
      rent_advances: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          cycle_id: string | null
          due_date: string
          fee: number
          id: string
          landlord_id: string
          lease_id: string
          outstanding: number
          principal: number
          reason: string | null
          repaid_at: string | null
          status: Database["public"]["Enums"]["fuliza_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          cycle_id?: string | null
          due_date: string
          fee?: number
          id?: string
          landlord_id: string
          lease_id: string
          outstanding: number
          principal: number
          reason?: string | null
          repaid_at?: string | null
          status?: Database["public"]["Enums"]["fuliza_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          cycle_id?: string | null
          due_date?: string
          fee?: number
          id?: string
          landlord_id?: string
          lease_id?: string
          outstanding?: number
          principal?: number
          reason?: string | null
          repaid_at?: string | null
          status?: Database["public"]["Enums"]["fuliza_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_advances_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_cycles: {
        Row: {
          accumulated_amount: number
          closed_at: string | null
          created_at: string
          due_date: string
          id: string
          lease_id: string
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["cycle_status"]
          target_amount: number
        }
        Insert: {
          accumulated_amount?: number
          closed_at?: string | null
          created_at?: string
          due_date: string
          id?: string
          lease_id: string
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["cycle_status"]
          target_amount: number
        }
        Update: {
          accumulated_amount?: number
          closed_at?: string | null
          created_at?: string
          due_date?: string
          id?: string
          lease_id?: string
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["cycle_status"]
          target_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "rent_cycles_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_applications: {
        Row: {
          applicant_email: string | null
          applicant_name: string
          applicant_phone: string
          applicant_user_id: string | null
          created_at: string
          decided_at: string | null
          dependents: number
          employer: string | null
          employment_status: string | null
          id: string
          landlord_id: string
          lease_id: string | null
          monthly_income: number
          notes: string | null
          previous_landlord_phone: string | null
          property_id: string | null
          screened_at: string | null
          screening_notes: string | null
          screening_score: number | null
          status: Database["public"]["Enums"]["application_status"]
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          applicant_email?: string | null
          applicant_name: string
          applicant_phone: string
          applicant_user_id?: string | null
          created_at?: string
          decided_at?: string | null
          dependents?: number
          employer?: string | null
          employment_status?: string | null
          id?: string
          landlord_id: string
          lease_id?: string | null
          monthly_income?: number
          notes?: string | null
          previous_landlord_phone?: string | null
          property_id?: string | null
          screened_at?: string | null
          screening_notes?: string | null
          screening_score?: number | null
          status?: Database["public"]["Enums"]["application_status"]
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          applicant_email?: string | null
          applicant_name?: string
          applicant_phone?: string
          applicant_user_id?: string | null
          created_at?: string
          decided_at?: string | null
          dependents?: number
          employer?: string | null
          employment_status?: string | null
          id?: string
          landlord_id?: string
          lease_id?: string | null
          monthly_income?: number
          notes?: string | null
          previous_landlord_phone?: string | null
          property_id?: string | null
          screened_at?: string | null
          screening_notes?: string | null
          screening_score?: number | null
          status?: Database["public"]["Enums"]["application_status"]
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_applications_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_applications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_applications_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          deposit_amount: number
          expires_at: string
          id: string
          invite_code: string
          landlord_id: string
          last_sent_at: string
          rent_amount: number
          rent_due_day: number
          resent_count: number
          start_date: string
          tenant_name: string | null
          tenant_phone: string
          unit_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          deposit_amount?: number
          expires_at?: string
          id?: string
          invite_code?: string
          landlord_id: string
          last_sent_at?: string
          rent_amount: number
          rent_due_day?: number
          resent_count?: number
          start_date: string
          tenant_name?: string | null
          tenant_phone: string
          unit_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          deposit_amount?: number
          expires_at?: string
          id?: string
          invite_code?: string
          landlord_id?: string
          last_sent_at?: string
          rent_amount?: number
          rent_due_day?: number
          resent_count?: number
          start_date?: string
          tenant_name?: string | null
          tenant_phone?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invites_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_blackouts: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          landlord_id: string
          reason: string | null
          starts_at: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          landlord_id: string
          reason?: string | null
          starts_at: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          landlord_id?: string
          reason?: string | null
          starts_at?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_blackouts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_viewing_slots: {
        Row: {
          booked_count: number
          capacity: number
          contact_phone: string | null
          created_at: string
          ends_at: string
          id: string
          instructions: string | null
          landlord_id: string
          mode: Database["public"]["Enums"]["viewing_mode"]
          starts_at: string
          status: Database["public"]["Enums"]["viewing_slot_status"]
          unit_id: string
          updated_at: string
        }
        Insert: {
          booked_count?: number
          capacity?: number
          contact_phone?: string | null
          created_at?: string
          ends_at: string
          id?: string
          instructions?: string | null
          landlord_id: string
          mode?: Database["public"]["Enums"]["viewing_mode"]
          starts_at: string
          status?: Database["public"]["Enums"]["viewing_slot_status"]
          unit_id: string
          updated_at?: string
        }
        Update: {
          booked_count?: number
          capacity?: number
          contact_phone?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          instructions?: string | null
          landlord_id?: string
          mode?: Database["public"]["Enums"]["viewing_mode"]
          starts_at?: string
          status?: Database["public"]["Enums"]["viewing_slot_status"]
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_viewing_slots_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          available_from: string | null
          bedrooms: number | null
          created_at: string
          deposit_amount: number
          id: string
          label: string
          listed: boolean
          listing_amenities: string[]
          listing_description: string | null
          listing_photos: string[]
          listing_title: string | null
          property_id: string
          rent_amount: number
          status: Database["public"]["Enums"]["unit_status"]
          updated_at: string
        }
        Insert: {
          available_from?: string | null
          bedrooms?: number | null
          created_at?: string
          deposit_amount?: number
          id?: string
          label: string
          listed?: boolean
          listing_amenities?: string[]
          listing_description?: string | null
          listing_photos?: string[]
          listing_title?: string | null
          property_id: string
          rent_amount: number
          status?: Database["public"]["Enums"]["unit_status"]
          updated_at?: string
        }
        Update: {
          available_from?: string | null
          bedrooms?: number | null
          created_at?: string
          deposit_amount?: number
          id?: string
          label?: string
          listed?: boolean
          listing_amenities?: string[]
          listing_description?: string | null
          listing_photos?: string[]
          listing_title?: string | null
          property_id?: string
          rent_amount?: number
          status?: Database["public"]["Enums"]["unit_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      viewing_bookings: {
        Row: {
          applicant_email: string | null
          applicant_name: string
          applicant_phone: string
          applicant_user_id: string | null
          cancelled_at: string | null
          confirmation_code: string
          created_at: string
          id: string
          landlord_id: string
          note: string | null
          reminder_sent_at: string | null
          slot_id: string
          status: Database["public"]["Enums"]["viewing_booking_status"]
          unit_id: string
          updated_at: string
        }
        Insert: {
          applicant_email?: string | null
          applicant_name: string
          applicant_phone: string
          applicant_user_id?: string | null
          cancelled_at?: string | null
          confirmation_code: string
          created_at?: string
          id?: string
          landlord_id: string
          note?: string | null
          reminder_sent_at?: string | null
          slot_id: string
          status?: Database["public"]["Enums"]["viewing_booking_status"]
          unit_id: string
          updated_at?: string
        }
        Update: {
          applicant_email?: string | null
          applicant_name?: string
          applicant_phone?: string
          applicant_user_id?: string | null
          cancelled_at?: string | null
          confirmation_code?: string
          created_at?: string
          id?: string
          landlord_id?: string
          note?: string | null
          reminder_sent_at?: string | null
          slot_id?: string
          status?: Database["public"]["Enums"]["viewing_booking_status"]
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "viewing_bookings_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "unit_viewing_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewing_bookings_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_tenant_invite: { Args: { _invite_code: string }; Returns: string }
      admin_access_log: {
        Args: {
          _entity?: string
          _from?: string
          _limit?: number
          _search?: string
          _to?: string
        }
        Returns: {
          action: string
          actor_id: string
          actor_name: string
          actor_phone: string
          created_at: string
          entity_id: string
          entity_table: string
          id: string
          meta: Json
        }[]
      }
      admin_assign_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      admin_backfill_notifications: { Args: never; Returns: Json }
      admin_landlord_directory: {
        Args: {
          _corridor?: string
          _limit?: number
          _search?: string
          _segment?: string
        }
        Returns: {
          corridors: string[]
          estates: string[]
          full_name: string
          landlord_id: string
          monthly_rent: number
          occupied: number
          phone: string
          properties: number
          segment: string
          units: number
        }[]
      }
      admin_ledger_consistency: {
        Args: never
        Returns: {
          contributions_total: number
          drift: number
          expected_balance: number
          landlord_id: string
          last_ledger_at: string
          lease_id: string
          ledger_balance: number
          payouts_total: number
          tenant_id: string
        }[]
      }
      admin_list_users: {
        Args: { _role?: Database["public"]["Enums"]["app_role"] }
        Returns: {
          created_at: string
          full_name: string
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          lease_count: number
          phone: string
          property_count: number
          roles: string[]
          user_id: string
        }[]
      }
      admin_properties_directory: {
        Args: { _corridor?: string; _limit?: number; _search?: string }
        Returns: {
          city: string
          corridor: string
          estate: string
          landlord_id: string
          landlord_name: string
          monthly_rent: number
          name: string
          occupied: number
          property_id: string
          units: number
          vacant: number
        }[]
      }
      admin_property_activity: {
        Args: { _limit?: number; _property_id: string }
        Returns: {
          actor_name: string
          detail: string
          kind: string
          occurred_at: string
          title: string
        }[]
      }
      admin_revoke_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      admin_tenant_directory: {
        Args: {
          _corridor?: string
          _estate?: string
          _limit?: number
          _search?: string
        }
        Returns: {
          corridor: string
          estate: string
          full_name: string
          landlord_name: string
          lease_status: Database["public"]["Enums"]["lease_status"]
          phone: string
          property_name: string
          rent_amount: number
          tenant_id: string
          unit_label: string
        }[]
      }
      admin_topup_open_cycles: { Args: never; Returns: Json }
      admin_wipe_demo_data: { Args: never; Returns: Json }
      apply_late_fees: { Args: { _landlord_id?: string }; Returns: Json }
      apply_payment_to_invoices: {
        Args: { _amount: number; _lease_id: string }
        Returns: undefined
      }
      auto_match_bank_transactions: {
        Args: { _import_id: string }
        Returns: Json
      }
      book_viewing: {
        Args: {
          _email?: string
          _name: string
          _note?: string
          _phone: string
          _slot_id: string
        }
        Returns: Json
      }
      can_access_thread: { Args: { _thread_id: string }; Returns: boolean }
      cancel_viewing_booking: {
        Args: { _code: string; _phone: string }
        Returns: Json
      }
      current_user_has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      dispatch_viewing_reminders: {
        Args: { _within_hours?: number }
        Returns: Json
      }
      ensure_open_cycle: { Args: { _lease_id: string }; Returns: string }
      generate_owner_statement: {
        Args: {
          _landlord_id: string
          _period_start: string
          _property_id?: string
        }
        Returns: string
      }
      get_invite_by_code: {
        Args: { _invite_code: string }
        Returns: {
          accepted_at: string
          deposit_amount: number
          expires_at: string
          id: string
          landlord_name: string
          last_sent_at: string
          property_name: string
          rent_amount: number
          rent_due_day: number
          resent_count: number
          start_date: string
          tenant_name: string
          tenant_phone: string
          unit_label: string
        }[]
      }
      get_viewing_booking: {
        Args: { _code: string; _phone: string }
        Returns: Json
      }
      gl_account_id: {
        Args: { _code: string; _landlord: string }
        Returns: string
      }
      gl_account_ledger: {
        Args: {
          _account_id: string
          _from?: string
          _landlord_id?: string
          _limit?: number
          _to?: string
        }
        Returns: {
          credit: number
          debit: number
          description: string
          entry_date: string
          entry_id: string
          memo: string
          property_name: string
          source: Database["public"]["Enums"]["journal_source"]
        }[]
      }
      gl_profit_and_loss: {
        Args: {
          _from?: string
          _landlord_id?: string
          _property_id?: string
          _to?: string
        }
        Returns: {
          amount: number
          code: string
          name: string
          section: string
        }[]
      }
      gl_trial_balance: {
        Args: { _from?: string; _landlord_id?: string; _to?: string }
        Returns: {
          account_id: string
          balance: number
          code: string
          credits: number
          debits: number
          name: string
          type: Database["public"]["Enums"]["account_type"]
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_property_tenant: {
        Args: { _property_id: string; _user_id: string }
        Returns: boolean
      }
      landlord_create_lease: {
        Args: {
          _deposit_amount?: number
          _rent_amount: number
          _rent_due_day?: number
          _start_date?: string
          _tenant_phone: string
          _unit_id: string
        }
        Returns: string
      }
      landlord_property_map: {
        Args: { _landlord_id?: string }
        Returns: {
          address: string
          arrears_total: number
          city: string
          landlord_id: string
          latitude: number
          longitude: number
          name: string
          portfolio_id: string
          property_id: string
          revenue_30d: number
          units_occupied: number
          units_total: number
          units_vacant: number
        }[]
      }
      landlord_record_payment: {
        Args: {
          _amount: number
          _lease_id: string
          _paid_at?: string
          _reference?: string
          _source?: string
        }
        Returns: string
      }
      lease_arrears: { Args: { _lease_id: string }; Returns: number }
      list_reconciliation_audit: {
        Args: { _limit?: number }
        Returns: {
          amount: number
          contribution_id: string
          external_ref: string
          lease_id: string
          property_name: string
          reconciled_at: string
          reconciled_by: string
          reconciled_by_name: string
          reconciliation_note: string
          source: Database["public"]["Enums"]["contribution_source"]
          status: Database["public"]["Enums"]["contribution_status"]
          tenant_id: string
          tenant_name: string
          unit_label: string
        }[]
      }
      log_data_access: {
        Args: {
          _action?: string
          _entity_id?: string
          _entity_table: string
          _meta?: Json
        }
        Returns: undefined
      }
      market_estate_stats: {
        Args: never
        Returns: {
          avg_rent: number
          corridor: string
          estate: string
          institutional_landlords: number
          landlords: number
          large_landlords: number
          medium_landlords: number
          monthly_rent: number
          occupied: number
          properties: number
          small_landlords: number
          tenants: number
          units: number
          vacant: number
        }[]
      }
      match_bank_transaction: {
        Args: { _contribution_id: string; _txn_id: string }
        Returns: undefined
      }
      post_journal: {
        Args: {
          _date: string
          _landlord: string
          _lease: string
          _lines: Json
          _memo: string
          _property: string
          _source: Database["public"]["Enums"]["journal_source"]
          _source_id: string
          _source_table: string
        }
        Returns: string
      }
      public_unit_slots: {
        Args: { _unit_id: string }
        Returns: {
          booked_count: number
          capacity: number
          ends_at: string
          instructions: string
          mode: Database["public"]["Enums"]["viewing_mode"]
          seats_left: number
          slot_id: string
          starts_at: string
        }[]
      }
      public_vacancies: {
        Args: {
          _bedrooms?: number
          _city?: string
          _county?: string
          _limit?: number
          _max_rent?: number
          _min_rent?: number
          _property_type?: Database["public"]["Enums"]["property_type"]
          _search?: string
        }
        Returns: {
          address: string
          available_from: string
          bedrooms: number
          city: string
          county: string
          deposit_amount: number
          label: string
          latitude: number
          listing_amenities: string[]
          listing_photos: string[]
          listing_title: string
          longitude: number
          property_name: string
          property_type: Database["public"]["Enums"]["property_type"]
          rent_amount: number
          unit_id: string
          viewing_slots: number
        }[]
      }
      public_vacancy_detail: {
        Args: { _unit_id: string }
        Returns: {
          address: string
          available_from: string
          bedrooms: number
          city: string
          county: string
          deposit_amount: number
          label: string
          latitude: number
          listing_amenities: string[]
          listing_description: string
          listing_photos: string[]
          listing_title: string
          longitude: number
          property_name: string
          property_type: Database["public"]["Enums"]["property_type"]
          rent_amount: number
          unit_id: string
        }[]
      }
      reconcile_contribution: {
        Args: { _contribution_id: string; _decision: string; _note?: string }
        Returns: string
      }
      record_fuliza_contribution: {
        Args: { _advance_id: string }
        Returns: string
      }
      record_mock_contribution: {
        Args: { _amount: number; _lease_id: string; _phone: string }
        Returns: string
      }
      record_payout: {
        Args: { _amount: number; _cycle_id: string; _lease_id: string }
        Returns: string
      }
      repay_rent_fuliza: {
        Args: { _advance_id: string; _amount: number }
        Returns: Json
      }
      request_invite_resend: { Args: { _invite_code: string }; Returns: string }
      request_rent_fuliza: {
        Args: { _amount: number; _lease_id: string; _reason?: string }
        Returns: string
      }
      reschedule_viewing_booking: {
        Args: { _code: string; _new_slot_id: string; _phone: string }
        Returns: Json
      }
      resend_invite: {
        Args: { _extend_days?: number; _invite_id: string }
        Returns: string
      }
      screen_application: { Args: { _application_id: string }; Returns: Json }
      submit_public_application: {
        Args: {
          _dependents?: number
          _email?: string
          _employer?: string
          _employment_status?: string
          _monthly_income?: number
          _name: string
          _notes?: string
          _phone: string
          _unit_id: string
        }
        Returns: string
      }
      tenant_fuliza_eligibility: { Args: { _lease_id: string }; Returns: Json }
      waive_late_fee: {
        Args: { _charge_id: string; _reason: string }
        Returns: undefined
      }
    }
    Enums: {
      account_type: "asset" | "liability" | "equity" | "income" | "expense"
      app_role: "tenant" | "landlord" | "caretaker" | "admin"
      application_status:
        | "submitted"
        | "screening"
        | "approved"
        | "rejected"
        | "withdrawn"
        | "converted"
      bank_txn_status: "unmatched" | "matched" | "ignored"
      contribution_source:
        | "mpesa_stk"
        | "mpesa_paybill"
        | "card"
        | "bank"
        | "cash"
        | "diaspora"
        | "payroll"
        | "manual_adjustment"
      contribution_status: "pending" | "success" | "failed" | "reversed"
      cycle_status: "open" | "completed" | "partial" | "overdue" | "closed"
      expense_category:
        | "repairs"
        | "utilities"
        | "security"
        | "cleaning"
        | "insurance"
        | "levies"
        | "legal"
        | "staff"
        | "management"
        | "marketing"
        | "tax"
        | "other"
      expense_status: "draft" | "approved" | "paid" | "void"
      fuliza_app_status: "pending" | "approved" | "rejected" | "disbursed"
      fuliza_status: "active" | "repaid" | "written_off" | "cancelled"
      inspection_kind: "move_in" | "move_out" | "routine"
      inspection_status: "scheduled" | "in_progress" | "completed" | "cancelled"
      journal_source:
        | "contribution"
        | "payout"
        | "expense"
        | "late_fee"
        | "deposit"
        | "adjustment"
        | "advance"
        | "fee"
        | "opening_balance"
        | "wht"
      kyc_status: "unverified" | "pending" | "verified" | "rejected"
      late_fee_kind: "fixed" | "percent"
      lease_doc_status: "draft" | "sent" | "signed" | "void"
      lease_status: "pending" | "active" | "ended" | "terminated"
      ledger_type: "contribution" | "payout" | "adjustment" | "fee" | "refund"
      maintenance_priority: "low" | "normal" | "high" | "urgent"
      maintenance_status:
        | "open"
        | "acknowledged"
        | "in_progress"
        | "resolved"
        | "closed"
      notification_channel: "in_app" | "sms" | "email" | "push"
      payout_status: "pending" | "processing" | "paid" | "failed"
      property_type:
        | "apartment"
        | "bedsitter"
        | "studio"
        | "maisonette"
        | "bungalow"
        | "commercial"
        | "mixed_use"
      renewal_status: "offered" | "accepted" | "declined" | "expired"
      statement_status: "draft" | "finalised" | "paid"
      team_member_role: "caretaker" | "manager"
      team_member_status: "invited" | "active" | "revoked"
      unit_status: "vacant" | "occupied" | "maintenance" | "reserved"
      viewing_booking_status:
        | "booked"
        | "confirmed"
        | "cancelled"
        | "attended"
        | "no_show"
      viewing_mode: "self_guided" | "guided"
      viewing_slot_status: "open" | "closed" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_type: ["asset", "liability", "equity", "income", "expense"],
      app_role: ["tenant", "landlord", "caretaker", "admin"],
      application_status: [
        "submitted",
        "screening",
        "approved",
        "rejected",
        "withdrawn",
        "converted",
      ],
      bank_txn_status: ["unmatched", "matched", "ignored"],
      contribution_source: [
        "mpesa_stk",
        "mpesa_paybill",
        "card",
        "bank",
        "cash",
        "diaspora",
        "payroll",
        "manual_adjustment",
      ],
      contribution_status: ["pending", "success", "failed", "reversed"],
      cycle_status: ["open", "completed", "partial", "overdue", "closed"],
      expense_category: [
        "repairs",
        "utilities",
        "security",
        "cleaning",
        "insurance",
        "levies",
        "legal",
        "staff",
        "management",
        "marketing",
        "tax",
        "other",
      ],
      expense_status: ["draft", "approved", "paid", "void"],
      fuliza_app_status: ["pending", "approved", "rejected", "disbursed"],
      fuliza_status: ["active", "repaid", "written_off", "cancelled"],
      inspection_kind: ["move_in", "move_out", "routine"],
      inspection_status: ["scheduled", "in_progress", "completed", "cancelled"],
      journal_source: [
        "contribution",
        "payout",
        "expense",
        "late_fee",
        "deposit",
        "adjustment",
        "advance",
        "fee",
        "opening_balance",
        "wht",
      ],
      kyc_status: ["unverified", "pending", "verified", "rejected"],
      late_fee_kind: ["fixed", "percent"],
      lease_doc_status: ["draft", "sent", "signed", "void"],
      lease_status: ["pending", "active", "ended", "terminated"],
      ledger_type: ["contribution", "payout", "adjustment", "fee", "refund"],
      maintenance_priority: ["low", "normal", "high", "urgent"],
      maintenance_status: [
        "open",
        "acknowledged",
        "in_progress",
        "resolved",
        "closed",
      ],
      notification_channel: ["in_app", "sms", "email", "push"],
      payout_status: ["pending", "processing", "paid", "failed"],
      property_type: [
        "apartment",
        "bedsitter",
        "studio",
        "maisonette",
        "bungalow",
        "commercial",
        "mixed_use",
      ],
      renewal_status: ["offered", "accepted", "declined", "expired"],
      statement_status: ["draft", "finalised", "paid"],
      team_member_role: ["caretaker", "manager"],
      team_member_status: ["invited", "active", "revoked"],
      unit_status: ["vacant", "occupied", "maintenance", "reserved"],
      viewing_booking_status: [
        "booked",
        "confirmed",
        "cancelled",
        "attended",
        "no_show",
      ],
      viewing_mode: ["self_guided", "guided"],
      viewing_slot_status: ["open", "closed", "cancelled"],
    },
  },
} as const
