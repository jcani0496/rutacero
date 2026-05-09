export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_notifications: {
        Row: {
          admin_id: string | null
          created_at: string | null
          id: string
          message: string | null
          metadata: Json | null
          read: boolean | null
          title: string
          type: string
        }
        Insert: {
          admin_id?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          read?: boolean | null
          title: string
          type: string
        }
        Update: {
          admin_id?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          read?: boolean | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notifications_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_reply_templates: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_reply_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_saved_views: {
        Row: {
          admin_id: string
          created_at: string
          filters: Json
          id: string
          name: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          filters?: Json
          id?: string
          name: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          filters?: Json
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_saved_views_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_support_rules: {
        Row: {
          assign_role: Database["public"]["Enums"]["admin_role"] | null
          category: Database["public"]["Enums"]["ticket_category"]
          created_at: string
          id: string
          is_active: boolean
          name: string
          plan_code: string | null
          set_priority: Database["public"]["Enums"]["ticket_priority"] | null
          updated_at: string
        }
        Insert: {
          assign_role?: Database["public"]["Enums"]["admin_role"] | null
          category: Database["public"]["Enums"]["ticket_category"]
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          plan_code?: string | null
          set_priority?: Database["public"]["Enums"]["ticket_priority"] | null
          updated_at?: string
        }
        Update: {
          assign_role?: Database["public"]["Enums"]["admin_role"] | null
          category?: Database["public"]["Enums"]["ticket_category"]
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          plan_code?: string | null
          set_priority?: Database["public"]["Enums"]["ticket_priority"] | null
          updated_at?: string
        }
        Relationships: []
      }
      admin_support_settings: {
        Row: {
          auto_assign_enabled: boolean
          auto_assign_priorities: string[]
          auto_assign_strategy: string
          id: string
          last_round_robin_index: number
          sla_escalation_enabled: boolean
          stale_reassign_enabled: boolean
          stale_reassign_hours: number
          updated_at: string
        }
        Insert: {
          auto_assign_enabled?: boolean
          auto_assign_priorities?: string[]
          auto_assign_strategy?: string
          id?: string
          last_round_robin_index?: number
          sla_escalation_enabled?: boolean
          stale_reassign_enabled?: boolean
          stale_reassign_hours?: number
          updated_at?: string
        }
        Update: {
          auto_assign_enabled?: boolean
          auto_assign_priorities?: string[]
          auto_assign_strategy?: string
          id?: string
          last_round_robin_index?: number
          sla_escalation_enabled?: boolean
          stale_reassign_enabled?: boolean
          stale_reassign_hours?: number
          updated_at?: string
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          is_active: boolean
          last_login_at: string | null
          must_rotate_password: boolean
          password_hash: string | null
          password_rotated_at: string
          role: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          must_rotate_password?: boolean
          password_hash?: string | null
          password_rotated_at?: string
          role: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          must_rotate_password?: boolean
          password_hash?: string | null
          password_rotated_at?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      alerts: {
        Row: {
          created_at: string
          id: string
          message: string
          period_start: string
          sent_at: string | null
          severity: string
          status: string
          tenant_id: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          period_start: string
          sent_at?: string | null
          severity: string
          status?: string
          tenant_id: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          period_start?: string
          sent_at?: string | null
          severity?: string
          status?: string
          tenant_id?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          admin_id: string | null
          admin_user_id: string
          created_at: string
          details: Json | null
          entity_id: string
          entity_type: string
          id: string
          ip: string
          metadata: Json
          user_agent: string
        }
        Insert: {
          action: string
          admin_id?: string | null
          admin_user_id: string
          created_at?: string
          details?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          ip?: string
          metadata?: Json
          user_agent?: string
        }
        Update: {
          action?: string
          admin_id?: string | null
          admin_user_id?: string
          created_at?: string
          details?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          ip?: string
          metadata?: Json
          user_agent?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_login_lockouts: {
        Row: {
          channel: string
          created_at: string
          failed_attempts: number
          last_failed_at: string | null
          last_ip: string | null
          lock_level: number
          locked_until: string | null
          principal: string
          updated_at: string
        }
        Insert: {
          channel: string
          created_at?: string
          failed_attempts?: number
          last_failed_at?: string | null
          last_ip?: string | null
          lock_level?: number
          locked_until?: string | null
          principal: string
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          failed_attempts?: number
          last_failed_at?: string | null
          last_ip?: string | null
          lock_level?: number
          locked_until?: string | null
          principal?: string
          updated_at?: string
        }
        Relationships: []
      }
      billing_entitlements: {
        Row: {
          created_at: string
          expires_at: string | null
          granted_at: string
          id: string
          last_verified_at: string | null
          order_id: string | null
          platform: string
          product_id: string
          provider: string
          purchase_token: string
          raw_response: Json
          status: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          id?: string
          last_verified_at?: string | null
          order_id?: string | null
          platform: string
          product_id: string
          provider: string
          purchase_token: string
          raw_response?: Json
          status?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          id?: string
          last_verified_at?: string | null
          order_id?: string | null
          platform?: string
          product_id?: string
          provider?: string
          purchase_token?: string
          raw_response?: Json
          status?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_entitlements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_documents: {
        Row: {
          created_at: string
          debt_id: string
          file_type: string
          file_url: string
          id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          debt_id: string
          file_type: string
          file_url: string
          id?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          debt_id?: string
          file_type?: string
          file_url?: string
          id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_documents_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
        ]
      }
      debts: {
        Row: {
          apr: number | null
          balance: number
          category: string | null
          created_at: string
          creditor: string
          currency: string
          due_date: number | null
          fixed_payment: number | null
          goal_extra_payment: number
          goal_target_date: string | null
          id: string
          installment_count: number | null
          installments_left: number | null
          interest_model: string | null
          min_payment: number
          min_payment_rule: Json | null
          monthly_fees: number
          next_payment_date: string
          notes: string | null
          payment_day: number | null
          statement_date: number | null
          status: string
          tags: Json | null
          tenant_id: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          apr?: number | null
          balance: number
          category?: string | null
          created_at?: string
          creditor: string
          currency?: string
          due_date?: number | null
          fixed_payment?: number | null
          goal_extra_payment?: number
          goal_target_date?: string | null
          id?: string
          installment_count?: number | null
          installments_left?: number | null
          interest_model?: string | null
          min_payment?: number
          min_payment_rule?: Json | null
          monthly_fees?: number
          next_payment_date: string
          notes?: string | null
          payment_day?: number | null
          statement_date?: number | null
          status?: string
          tags?: Json | null
          tenant_id: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          apr?: number | null
          balance?: number
          category?: string | null
          created_at?: string
          creditor?: string
          currency?: string
          due_date?: number | null
          fixed_payment?: number | null
          goal_extra_payment?: number
          goal_target_date?: string | null
          id?: string
          installment_count?: number | null
          installments_left?: number | null
          interest_model?: string | null
          min_payment?: number
          min_payment_rule?: Json | null
          monthly_fees?: number
          next_payment_date?: string
          notes?: string | null
          payment_day?: number | null
          statement_date?: number | null
          status?: string
          tags?: Json | null
          tenant_id?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      engine_configs: {
        Row: {
          activated_at: string | null
          constraints: Json
          created_at: string
          created_by_admin_id: string
          id: string
          status: string
          version: string
          weights: Json
        }
        Insert: {
          activated_at?: string | null
          constraints?: Json
          created_at?: string
          created_by_admin_id: string
          id?: string
          status?: string
          version: string
          weights?: Json
        }
        Update: {
          activated_at?: string | null
          constraints?: Json
          created_at?: string
          created_by_admin_id?: string
          id?: string
          status?: string
          version?: string
          weights?: Json
        }
        Relationships: [
          {
            foreignKeyName: "engine_configs_created_by_admin_id_fkey"
            columns: ["created_by_admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      essential_expenses: {
        Row: {
          actual_amount: number | null
          amount: number
          budget_amount: number | null
          category: string | null
          created_at: string
          currency: string
          expense_type: string | null
          frequency: string
          id: string
          name: string
          next_date: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          actual_amount?: number | null
          amount: number
          budget_amount?: number | null
          category?: string | null
          created_at?: string
          currency?: string
          expense_type?: string | null
          frequency?: string
          id?: string
          name: string
          next_date: string
          tenant_id: string
          user_id: string
        }
        Update: {
          actual_amount?: number | null
          amount?: number
          budget_amount?: number | null
          category?: string | null
          created_at?: string
          currency?: string
          expense_type?: string | null
          frequency?: string
          id?: string
          name?: string
          next_date?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          created_at: string
          id: string
          key: string
          rules: Json
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          rules?: Json
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          rules?: Json
          status?: string
        }
        Relationships: []
      }
      forecasts: {
        Row: {
          created_at: string
          engine_version: string
          horizon_periods: number
          id: string
          mae_last_period: number | null
          periods: Json
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          engine_version: string
          horizon_periods?: number
          id?: string
          mae_last_period?: number | null
          periods?: Json
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          engine_version?: string
          horizon_periods?: number
          id?: string
          mae_last_period?: number | null
          periods?: Json
          tenant_id?: string
          user_id?: string
        }
        Relationships: []
      }
      income_events: {
        Row: {
          amount: number
          created_at: string
          currency: string
          date: string
          id: string
          notes: string | null
          source: string | null
          tenant_id: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          date: string
          id?: string
          notes?: string | null
          source?: string | null
          tenant_id: string
          type?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          date?: string
          id?: string
          notes?: string | null
          source?: string | null
          tenant_id?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          currency: string
          id: string
          issued_at: string
          paid_at: string | null
          pdf_url: string | null
          status: string
          subscription_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          amount: number
          currency?: string
          id?: string
          issued_at?: string
          paid_at?: string | null
          pdf_url?: string | null
          status?: string
          subscription_id: string
          tenant_id: string
          user_id: string
        }
        Update: {
          amount?: number
          currency?: string
          id?: string
          issued_at?: string
          paid_at?: string | null
          pdf_url?: string | null
          status?: string
          subscription_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      lifecycle_touchpoints: {
        Row: {
          campaign_key: string
          channel: string
          created_at: string
          dedupe_key: string
          delivered_at: string | null
          id: string
          metadata: Json
          status: string
          tenant_id: string
          triggered_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_key: string
          channel: string
          created_at?: string
          dedupe_key: string
          delivered_at?: string | null
          id?: string
          metadata?: Json
          status?: string
          tenant_id: string
          triggered_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_key?: string
          channel?: string
          created_at?: string
          dedupe_key?: string
          delivered_at?: string | null
          id?: string
          metadata?: Json
          status?: string
          tenant_id?: string
          triggered_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lifecycle_touchpoints_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_payment_grants: {
        Row: {
          bank_reference: string
          created_at: string
          duration_days: number
          expires_at: string
          granted_by_admin_id: string
          id: string
          notes: string | null
          price_amount_q: number
          tenant_id: string
          variant_code: string
        }
        Insert: {
          bank_reference: string
          created_at?: string
          duration_days: number
          expires_at: string
          granted_by_admin_id: string
          id?: string
          notes?: string | null
          price_amount_q: number
          tenant_id: string
          variant_code: string
        }
        Update: {
          bank_reference?: string
          created_at?: string
          duration_days?: number
          expires_at?: string
          granted_by_admin_id?: string
          id?: string
          notes?: string | null
          price_amount_q?: number
          tenant_id?: string
          variant_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_payment_grants_granted_by_admin_id_fkey"
            columns: ["granted_by_admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_payment_grants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_dropoff_events: {
        Row: {
          created_at: string
          detail: string | null
          email: string | null
          id: string
          metadata: Json
          path: string | null
          reason: string
          surface: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          email?: string | null
          id?: string
          metadata?: Json
          path?: string | null
          reason: string
          surface: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          email?: string | null
          id?: string
          metadata?: Json
          path?: string | null
          reason?: string
          surface?: string
          user_id?: string | null
        }
        Relationships: []
      }
      marketing_funnel_events: {
        Row: {
          attribution_id: string
          campaign_id: string | null
          campaign_name: string | null
          created_at: string
          creative_id: string | null
          creative_name: string | null
          cta_context: string | null
          dedupe_key: string | null
          email: string | null
          event_name: string
          first_touch: Json
          id: string
          landing_variant: string | null
          last_touch: Json
          medium: string | null
          metadata: Json
          occurred_at: string
          offer_variant: string | null
          partner_slug: string | null
          path: string | null
          plan_strategy: string | null
          referral_code: string | null
          source: string | null
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          attribution_id: string
          campaign_id?: string | null
          campaign_name?: string | null
          created_at?: string
          creative_id?: string | null
          creative_name?: string | null
          cta_context?: string | null
          dedupe_key?: string | null
          email?: string | null
          event_name: string
          first_touch?: Json
          id?: string
          landing_variant?: string | null
          last_touch?: Json
          medium?: string | null
          metadata?: Json
          occurred_at?: string
          offer_variant?: string | null
          partner_slug?: string | null
          path?: string | null
          plan_strategy?: string | null
          referral_code?: string | null
          source?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          attribution_id?: string
          campaign_id?: string | null
          campaign_name?: string | null
          created_at?: string
          creative_id?: string | null
          creative_name?: string | null
          cta_context?: string | null
          dedupe_key?: string | null
          email?: string | null
          event_name?: string
          first_touch?: Json
          id?: string
          landing_variant?: string | null
          last_touch?: Json
          medium?: string | null
          metadata?: Json
          occurred_at?: string
          offer_variant?: string | null
          partner_slug?: string | null
          path?: string | null
          plan_strategy?: string | null
          referral_code?: string | null
          source?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_funnel_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          error: string | null
          external_event_id: string
          id: string
          payload: Json
          processed: boolean
          provider: string
          received_at: string
        }
        Insert: {
          error?: string | null
          external_event_id: string
          id?: string
          payload: Json
          processed?: boolean
          provider: string
          received_at?: string
        }
        Update: {
          error?: string | null
          external_event_id?: string
          id?: string
          payload?: Json
          processed?: boolean
          provider?: string
          received_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          debt_id: string
          id: string
          method: string | null
          payment_date: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          debt_id: string
          id?: string
          method?: string | null
          payment_date: string
          tenant_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          debt_id?: string
          id?: string
          method?: string | null
          payment_date?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_items: {
        Row: {
          currency: string
          debt_id: string
          id: string
          is_focus: boolean
          period_end: string
          period_start: string
          plan_id: string
          planned_amount: number
          priority_order: number
          rationale: Json
          tenant_id: string
        }
        Insert: {
          currency?: string
          debt_id: string
          id?: string
          is_focus?: boolean
          period_end: string
          period_start: string
          plan_id: string
          planned_amount: number
          priority_order: number
          rationale?: Json
          tenant_id: string
        }
        Update: {
          currency?: string
          debt_id?: string
          id?: string
          is_focus?: boolean
          period_end?: string
          period_start?: string
          plan_id?: string
          planned_amount?: number
          priority_order?: number
          rationale?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_items_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          assumptions: Json
          avg_payment: number
          created_at: string
          engine_version: string
          eta_debt_free: string
          horizon_periods: number
          id: string
          interest_estimate: number
          strategy: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          active?: boolean
          assumptions?: Json
          avg_payment?: number
          created_at?: string
          engine_version: string
          eta_debt_free: string
          horizon_periods?: number
          id?: string
          interest_estimate?: number
          strategy: string
          tenant_id: string
          user_id: string
        }
        Update: {
          active?: boolean
          assumptions?: Json
          avg_payment?: number
          created_at?: string
          engine_version?: string
          eta_debt_free?: string
          horizon_periods?: number
          id?: string
          interest_estimate?: number
          strategy?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: []
      }
      recurrente_checkout_contexts: {
        Row: {
          attribution_id: string | null
          checkout_id: string
          created_at: string
          marketing_context: Json
          plan_code: string
          purchaser_user_id: string
          tenant_id: string
        }
        Insert: {
          attribution_id?: string | null
          checkout_id: string
          created_at?: string
          marketing_context?: Json
          plan_code?: string
          purchaser_user_id: string
          tenant_id: string
        }
        Update: {
          attribution_id?: string | null
          checkout_id?: string
          created_at?: string
          marketing_context?: Json
          plan_code?: string
          purchaser_user_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurrente_checkout_contexts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          attribution_id: string | null
          billing_interval: string
          cancel_at: string | null
          external_id: string | null
          id: string
          marketing_context: Json
          payment_method: string
          plan_code: string
          price_amount_q: number | null
          provider: string
          purchaser_user_id: string | null
          renew_at: string | null
          start_at: string
          status: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attribution_id?: string | null
          billing_interval?: string
          cancel_at?: string | null
          external_id?: string | null
          id?: string
          marketing_context?: Json
          payment_method?: string
          plan_code?: string
          price_amount_q?: number | null
          provider?: string
          purchaser_user_id?: string | null
          renew_at?: string | null
          start_at?: string
          status?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attribution_id?: string | null
          billing_interval?: string
          cancel_at?: string | null
          external_id?: string | null
          id?: string
          marketing_context?: Json
          payment_method?: string
          plan_code?: string
          price_amount_q?: number | null
          provider?: string
          purchaser_user_id?: string | null
          renew_at?: string | null
          start_at?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_ticket_labels: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_labels_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_labels_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_admin_id: string | null
          assigned_to_admin_id: string | null
          body: string
          category: string
          created_at: string
          created_by_admin_id: string | null
          description: string | null
          id: string
          priority: string
          resolved_at: string | null
          status: string
          subject: string
          tenant_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          assigned_admin_id?: string | null
          assigned_to_admin_id?: string | null
          body: string
          category: string
          created_at?: string
          created_by_admin_id?: string | null
          description?: string | null
          id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          subject: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          assigned_admin_id?: string | null
          assigned_to_admin_id?: string | null
          body?: string
          category?: string
          created_at?: string
          created_by_admin_id?: string | null
          description?: string | null
          id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          subject?: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assigned_admin_id_fkey"
            columns: ["assigned_admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_assigned_to_admin_id_fkey"
            columns: ["assigned_to_admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_created_by_admin_id_fkey"
            columns: ["created_by_admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_memberships: {
        Row: {
          created_at: string
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          created_by_user_id: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          created_at: string
          id: string
          is_internal: boolean
          message: string
          sender_id: string
          sender_type: string
          tenant_id: string | null
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_internal?: boolean
          message: string
          sender_id: string
          sender_type: string
          tenant_id?: string | null
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_internal?: boolean
          message?: string
          sender_id?: string
          sender_type?: string
          tenant_id?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          created_at: string
          id: string
          message: string | null
          metadata: Json
          read: boolean
          severity: string
          tenant_id: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          metadata?: Json
          read?: boolean
          severity?: string
          tenant_id: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          metadata?: Json
          read?: boolean
          severity?: string
          tenant_id?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string
          currency_base: string
          current_tenant_id: string | null
          goal_type: string
          id: string
          last_active_at: string | null
          motivation_level: number
          onboarding_completed: boolean
          pay_dates: number[]
          pay_frequency: string
          risk_tolerance: number
          safety_buffer_pct: number
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency_base?: string
          current_tenant_id?: string | null
          goal_type?: string
          id?: string
          last_active_at?: string | null
          motivation_level?: number
          onboarding_completed?: boolean
          pay_dates?: number[]
          pay_frequency?: string
          risk_tolerance?: number
          safety_buffer_pct?: number
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency_base?: string
          current_tenant_id?: string | null
          goal_type?: string
          id?: string
          last_active_at?: string | null
          motivation_level?: number
          onboarding_completed?: boolean
          pay_dates?: number[]
          pay_frequency?: string
          risk_tolerance?: number
          safety_buffer_pct?: number
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      variable_budget_targets: {
        Row: {
          actual_amount: number
          amount: number
          category: string
          created_at: string
          currency: string
          id: string
          period: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          actual_amount?: number
          amount: number
          category: string
          created_at?: string
          currency?: string
          id?: string
          period?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          actual_amount?: number
          amount?: number
          category?: string
          created_at?: string
          currency?: string
          id?: string
          period?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_payment_atomic: {
        Args: {
          p_amount: number
          p_currency: string
          p_debt_id: string
          p_payment_date: string
          p_payment_method?: string
        }
        Returns: {
          new_debt_balance: number
          new_debt_status: string
          payment_amount: number
          payment_id: string
        }[]
      }
      notify_all_admins: {
        Args: {
          p_message?: string
          p_metadata?: Json
          p_title: string
          p_type: string
        }
        Returns: undefined
      }
    }
    Enums: {
      admin_role: "SUPER_ADMIN" | "ADMIN" | "SUPPORT" | "ANALYST"
      subscription_plan: "FREE" | "BASIC" | "PRO" | "ENTERPRISE"
      subscription_status:
        | "ACTIVE"
        | "PAST_DUE"
        | "CANCELLED"
        | "EXPIRED"
        | "TRIAL"
      ticket_category:
        | "TECHNICAL"
        | "BILLING"
        | "ACCOUNT"
        | "FEATURE_REQUEST"
        | "OTHER"
      ticket_priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
      ticket_status:
        | "OPEN"
        | "IN_PROGRESS"
        | "WAITING_USER"
        | "RESOLVED"
        | "CLOSED"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      admin_role: ["SUPER_ADMIN", "ADMIN", "SUPPORT", "ANALYST"],
      subscription_plan: ["FREE", "BASIC", "PRO", "ENTERPRISE"],
      subscription_status: [
        "ACTIVE",
        "PAST_DUE",
        "CANCELLED",
        "EXPIRED",
        "TRIAL",
      ],
      ticket_category: [
        "TECHNICAL",
        "BILLING",
        "ACCOUNT",
        "FEATURE_REQUEST",
        "OTHER",
      ],
      ticket_priority: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      ticket_status: [
        "OPEN",
        "IN_PROGRESS",
        "WAITING_USER",
        "RESOLVED",
        "CLOSED",
      ],
    },
  },
} as const

