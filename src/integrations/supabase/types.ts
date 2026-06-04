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
      app_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          reason: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          reason?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      billing_events: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          external_event_id: string
          id: string
          invoice_external_id: string | null
          kind: Database["public"]["Enums"]["billing_event_kind"]
          occurred_at: string
          payload: Json
          processed_at: string | null
          processing_error: string | null
          subscription_id: string | null
          user_id: string | null
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          currency?: string
          external_event_id: string
          id?: string
          invoice_external_id?: string | null
          kind: Database["public"]["Enums"]["billing_event_kind"]
          occurred_at?: string
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          subscription_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          external_event_id?: string
          id?: string
          invoice_external_id?: string | null
          kind?: Database["public"]["Enums"]["billing_event_kind"]
          occurred_at?: string
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          subscription_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      chord_progressions: {
        Row: {
          chords: Json
          created_at: string
          created_by_user_id: string
          id: string
          label: string | null
          section_id: string | null
          song_id: string
          updated_at: string
        }
        Insert: {
          chords?: Json
          created_at?: string
          created_by_user_id: string
          id?: string
          label?: string | null
          section_id?: string | null
          song_id: string
          updated_at?: string
        }
        Update: {
          chords?: Json
          created_at?: string
          created_by_user_id?: string
          id?: string
          label?: string | null
          section_id?: string | null
          song_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chord_progressions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "song_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chord_progressions_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      codes: {
        Row: {
          created_at: string
          created_by_user_id: string
          discount_cents: number
          expires_at: string | null
          id: string
          kind: Database["public"]["Enums"]["code_kind"]
          max_redemptions: number | null
          owner_founder_id: string | null
          owner_user_id: string | null
          redemption_count: number
          status: Database["public"]["Enums"]["code_status"]
          stripe_promotion_code_id: string | null
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          discount_cents?: number
          expires_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["code_kind"]
          max_redemptions?: number | null
          owner_founder_id?: string | null
          owner_user_id?: string | null
          redemption_count?: number
          status?: Database["public"]["Enums"]["code_status"]
          stripe_promotion_code_id?: string | null
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          discount_cents?: number
          expires_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["code_kind"]
          max_redemptions?: number | null
          owner_founder_id?: string | null
          owner_user_id?: string | null
          redemption_count?: number
          status?: Database["public"]["Enums"]["code_status"]
          stripe_promotion_code_id?: string | null
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "codes_owner_founder_id_fkey"
            columns: ["owner_founder_id"]
            isOneToOne: false
            referencedRelation: "founders"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          project: string
          services: string[] | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          phone?: string | null
          project: string
          services?: string[] | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          project?: string
          services?: string[] | null
        }
        Relationships: []
      }
      credit_ledger: {
        Row: {
          amount_cents: number
          applied_at: string | null
          applied_to_invoice_external_id: string | null
          available_at: string | null
          created_at: string
          id: string
          idempotency_key: string
          reversed_at: string | null
          source_reward_event_id: string | null
          status: Database["public"]["Enums"]["credit_status"]
          user_id: string
        }
        Insert: {
          amount_cents: number
          applied_at?: string | null
          applied_to_invoice_external_id?: string | null
          available_at?: string | null
          created_at?: string
          id?: string
          idempotency_key: string
          reversed_at?: string | null
          source_reward_event_id?: string | null
          status?: Database["public"]["Enums"]["credit_status"]
          user_id: string
        }
        Update: {
          amount_cents?: number
          applied_at?: string | null
          applied_to_invoice_external_id?: string | null
          available_at?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          reversed_at?: string | null
          source_reward_event_id?: string | null
          status?: Database["public"]["Enums"]["credit_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_source_reward_event_id_fkey"
            columns: ["source_reward_event_id"]
            isOneToOne: false
            referencedRelation: "reward_events"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          label: string | null
          max_uses: number
          perks: Json
          updated_at: string
          uses: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          label?: string | null
          max_uses: number
          perks?: Json
          updated_at?: string
          uses?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          label?: string | null
          max_uses?: number
          perks?: Json
          updated_at?: string
          uses?: number
        }
        Relationships: []
      }
      founder_redemptions: {
        Row: {
          code: string
          perks_snapshot: Json
          redeemed_at: string
          user_id: string
        }
        Insert: {
          code: string
          perks_snapshot: Json
          redeemed_at?: string
          user_id: string
        }
        Update: {
          code?: string
          perks_snapshot?: Json
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "founder_redemptions_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "founder_codes"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "founder_redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      founders: {
        Row: {
          created_at: string
          created_by_user_id: string
          display_name: string
          id: string
          notes: string | null
          paused_at: string | null
          payout_method_status: string
          revoked_at: string | null
          reward_profile: Json
          slug: string
          status: Database["public"]["Enums"]["founder_status"]
          tier: Database["public"]["Enums"]["founder_tier"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          display_name: string
          id?: string
          notes?: string | null
          paused_at?: string | null
          payout_method_status?: string
          revoked_at?: string | null
          reward_profile?: Json
          slug: string
          status?: Database["public"]["Enums"]["founder_status"]
          tier?: Database["public"]["Enums"]["founder_tier"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          display_name?: string
          id?: string
          notes?: string | null
          paused_at?: string | null
          payout_method_status?: string
          revoked_at?: string | null
          reward_profile?: Json
          slug?: string
          status?: Database["public"]["Enums"]["founder_status"]
          tier?: Database["public"]["Enums"]["founder_tier"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      fraud_flags: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          id: string
          reason: string
          resolution_note: string | null
          resolved_at: string | null
          severity: string
          subject_id: string
          subject_type: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          reason: string
          resolution_note?: string | null
          resolved_at?: string | null
          severity?: string
          subject_id: string
          subject_type: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          reason?: string
          resolution_note?: string | null
          resolved_at?: string | null
          severity?: string
          subject_id?: string
          subject_type?: string
        }
        Relationships: []
      }
      payouts: {
        Row: {
          amount_cents: number
          approved_at: string | null
          approved_by_user_id: string | null
          created_at: string
          currency: string
          failure_reason: string | null
          founder_id: string | null
          id: string
          paid_at: string | null
          period_end: string
          period_start: string
          provider: string | null
          provider_payout_id: string | null
          status: Database["public"]["Enums"]["payout_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount_cents?: number
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          currency?: string
          failure_reason?: string | null
          founder_id?: string | null
          id?: string
          paid_at?: string | null
          period_end: string
          period_start: string
          provider?: string | null
          provider_payout_id?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          currency?: string
          failure_reason?: string | null
          founder_id?: string | null
          id?: string
          paid_at?: string | null
          period_end?: string
          period_start?: string
          provider?: string | null
          provider_payout_id?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payouts_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "founders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          first_song_id: string | null
          id: string
          onboarding_state: Json
          onboarding_step: Database["public"]["Enums"]["onboarding_step"]
          onboarding_updated_at: string
          payout_country: string | null
          payout_email: string | null
          payout_method:
            | Database["public"]["Enums"]["payout_method_kind"]
            | null
          phone_e164: string | null
          referral_code: string | null
          referred_by_user_id: string | null
          stripe_connect_account_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          first_song_id?: string | null
          id?: string
          onboarding_state?: Json
          onboarding_step?: Database["public"]["Enums"]["onboarding_step"]
          onboarding_updated_at?: string
          payout_country?: string | null
          payout_email?: string | null
          payout_method?:
            | Database["public"]["Enums"]["payout_method_kind"]
            | null
          phone_e164?: string | null
          referral_code?: string | null
          referred_by_user_id?: string | null
          stripe_connect_account_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          first_song_id?: string | null
          id?: string
          onboarding_state?: Json
          onboarding_step?: Database["public"]["Enums"]["onboarding_step"]
          onboarding_updated_at?: string
          payout_country?: string | null
          payout_email?: string | null
          payout_method?:
            | Database["public"]["Enums"]["payout_method_kind"]
            | null
          phone_e164?: string | null
          referral_code?: string | null
          referred_by_user_id?: string | null
          stripe_connect_account_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_attributions: {
        Row: {
          attributed_at: string
          code_id: string | null
          id: string
          locked: boolean
          override_by_user_id: string | null
          override_reason: string | null
          referred_user_id: string
          referrer_founder_id: string | null
          referrer_type: Database["public"]["Enums"]["referrer_type"]
          referrer_user_id: string | null
          source: Database["public"]["Enums"]["attribution_source"]
        }
        Insert: {
          attributed_at?: string
          code_id?: string | null
          id?: string
          locked?: boolean
          override_by_user_id?: string | null
          override_reason?: string | null
          referred_user_id: string
          referrer_founder_id?: string | null
          referrer_type: Database["public"]["Enums"]["referrer_type"]
          referrer_user_id?: string | null
          source: Database["public"]["Enums"]["attribution_source"]
        }
        Update: {
          attributed_at?: string
          code_id?: string | null
          id?: string
          locked?: boolean
          override_by_user_id?: string | null
          override_reason?: string | null
          referred_user_id?: string
          referrer_founder_id?: string | null
          referrer_type?: Database["public"]["Enums"]["referrer_type"]
          referrer_user_id?: string | null
          source?: Database["public"]["Enums"]["attribution_source"]
        }
        Relationships: [
          {
            foreignKeyName: "referral_attributions_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_attributions_referrer_founder_id_fkey"
            columns: ["referrer_founder_id"]
            isOneToOne: false
            referencedRelation: "founders"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_events: {
        Row: {
          amount_cents: number
          created_at: string
          hold_until: string
          id: string
          idempotency_key: string
          invoice_external_id: string
          paid_month_index: number | null
          payout_id: string | null
          period_end: string | null
          period_start: string | null
          referred_user_id: string
          referrer_founder_id: string | null
          referrer_type: Database["public"]["Enums"]["referrer_type"]
          referrer_user_id: string | null
          reversed_at: string | null
          reversed_by_event_id: string | null
          reversed_reason: string | null
          reward_kind: Database["public"]["Enums"]["reward_kind"]
          status: Database["public"]["Enums"]["reward_status"]
          subscription_id: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          hold_until?: string
          id?: string
          idempotency_key: string
          invoice_external_id: string
          paid_month_index?: number | null
          payout_id?: string | null
          period_end?: string | null
          period_start?: string | null
          referred_user_id: string
          referrer_founder_id?: string | null
          referrer_type: Database["public"]["Enums"]["referrer_type"]
          referrer_user_id?: string | null
          reversed_at?: string | null
          reversed_by_event_id?: string | null
          reversed_reason?: string | null
          reward_kind: Database["public"]["Enums"]["reward_kind"]
          status?: Database["public"]["Enums"]["reward_status"]
          subscription_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          hold_until?: string
          id?: string
          idempotency_key?: string
          invoice_external_id?: string
          paid_month_index?: number | null
          payout_id?: string | null
          period_end?: string | null
          period_start?: string | null
          referred_user_id?: string
          referrer_founder_id?: string | null
          referrer_type?: Database["public"]["Enums"]["referrer_type"]
          referrer_user_id?: string | null
          reversed_at?: string | null
          reversed_by_event_id?: string | null
          reversed_reason?: string | null
          reward_kind?: Database["public"]["Enums"]["reward_kind"]
          status?: Database["public"]["Enums"]["reward_status"]
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reward_events_payout_fk"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_events_referrer_founder_id_fkey"
            columns: ["referrer_founder_id"]
            isOneToOne: false
            referencedRelation: "founders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_events_reversed_by_event_id_fkey"
            columns: ["reversed_by_event_id"]
            isOneToOne: false
            referencedRelation: "reward_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      song_invites: {
        Row: {
          accepted_at: string | null
          accepted_by_user_id: string | null
          created_at: string
          created_by_user_id: string
          expires_at: string
          id: string
          invited_email: string | null
          invited_phone: string | null
          max_uses: number
          message: string | null
          role: Database["public"]["Enums"]["song_member_role"]
          song_id: string
          status: Database["public"]["Enums"]["invite_status"]
          token: string
          updated_at: string
          use_count: number
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          created_at?: string
          created_by_user_id: string
          expires_at?: string
          id?: string
          invited_email?: string | null
          invited_phone?: string | null
          max_uses?: number
          message?: string | null
          role?: Database["public"]["Enums"]["song_member_role"]
          song_id: string
          status?: Database["public"]["Enums"]["invite_status"]
          token: string
          updated_at?: string
          use_count?: number
        }
        Update: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          created_at?: string
          created_by_user_id?: string
          expires_at?: string
          id?: string
          invited_email?: string | null
          invited_phone?: string | null
          max_uses?: number
          message?: string | null
          role?: Database["public"]["Enums"]["song_member_role"]
          song_id?: string
          status?: Database["public"]["Enums"]["invite_status"]
          token?: string
          updated_at?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "song_invites_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      song_lyrics: {
        Row: {
          content: Json
          created_at: string
          id: string
          plain_text: string
          section_id: string
          song_id: string
          updated_at: string
          updated_by_user_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          plain_text?: string
          section_id: string
          song_id: string
          updated_at?: string
          updated_by_user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          plain_text?: string
          section_id?: string
          song_id?: string
          updated_at?: string
          updated_by_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "song_lyrics_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: true
            referencedRelation: "song_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "song_lyrics_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      song_members: {
        Row: {
          id: string
          invited_by_user_id: string | null
          joined_at: string
          role: Database["public"]["Enums"]["song_member_role"]
          song_id: string
          user_id: string
        }
        Insert: {
          id?: string
          invited_by_user_id?: string | null
          joined_at?: string
          role?: Database["public"]["Enums"]["song_member_role"]
          song_id: string
          user_id: string
        }
        Update: {
          id?: string
          invited_by_user_id?: string | null
          joined_at?: string
          role?: Database["public"]["Enums"]["song_member_role"]
          song_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "song_members_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      song_notes: {
        Row: {
          author_user_id: string
          body: string
          created_at: string
          id: string
          section_id: string | null
          song_id: string
          updated_at: string
        }
        Insert: {
          author_user_id: string
          body?: string
          created_at?: string
          id?: string
          section_id?: string | null
          song_id: string
          updated_at?: string
        }
        Update: {
          author_user_id?: string
          body?: string
          created_at?: string
          id?: string
          section_id?: string | null
          song_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "song_notes_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "song_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "song_notes_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      song_sections: {
        Row: {
          created_at: string
          created_by_user_id: string
          id: string
          kind: Database["public"]["Enums"]["section_kind"]
          label: string | null
          position: number
          song_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          id?: string
          kind?: Database["public"]["Enums"]["section_kind"]
          label?: string | null
          position?: number
          song_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["section_kind"]
          label?: string | null
          position?: number
          song_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "song_sections_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      song_versions: {
        Row: {
          created_at: string
          created_by_user_id: string
          description: string | null
          id: string
          kind: Database["public"]["Enums"]["version_kind"]
          label: string | null
          parent_version_id: string | null
          snapshot: Json
          song_id: string
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["version_kind"]
          label?: string | null
          parent_version_id?: string | null
          snapshot?: Json
          song_id: string
          version_number?: number
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["version_kind"]
          label?: string | null
          parent_version_id?: string | null
          snapshot?: Json
          song_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "song_versions_parent_version_id_fkey"
            columns: ["parent_version_id"]
            isOneToOne: false
            referencedRelation: "song_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "song_versions_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      songs: {
        Row: {
          cover_color: string | null
          created_at: string
          id: string
          is_locked: boolean
          key_signature: string | null
          last_activity_at: string
          owner_user_id: string
          status: Database["public"]["Enums"]["song_status"]
          tags: string[]
          tempo_bpm: number | null
          time_signature: string | null
          title: string
          updated_at: string
        }
        Insert: {
          cover_color?: string | null
          created_at?: string
          id?: string
          is_locked?: boolean
          key_signature?: string | null
          last_activity_at?: string
          owner_user_id: string
          status?: Database["public"]["Enums"]["song_status"]
          tags?: string[]
          tempo_bpm?: number | null
          time_signature?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          cover_color?: string | null
          created_at?: string
          id?: string
          is_locked?: boolean
          key_signature?: string | null
          last_activity_at?: string
          owner_user_id?: string
          status?: Database["public"]["Enums"]["song_status"]
          tags?: string[]
          tempo_bpm?: number | null
          time_signature?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      storage_addons: {
        Row: {
          bytes_granted: number
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          external_id: string
          id: string
          lookup_key: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bytes_granted?: number
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          external_id: string
          id?: string
          lookup_key: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bytes_granted?: number
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          external_id?: string
          id?: string
          lookup_key?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      storage_usage: {
        Row: {
          bytes_limit: number | null
          bytes_used: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bytes_limit?: number | null
          bytes_used?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          bytes_limit?: number | null
          bytes_used?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancelled_at: string | null
          code_id: string | null
          created_at: string
          currency: string
          current_period_end: string | null
          current_period_start: string | null
          external_id: string | null
          id: string
          plan: Database["public"]["Enums"]["sub_plan"]
          started_at: string
          status: string
          unit_amount_cents: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          code_id?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          external_id?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["sub_plan"]
          started_at?: string
          status?: string
          unit_amount_cents?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          code_id?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          external_id?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["sub_plan"]
          started_at?: string
          status?: string
          unit_amount_cents?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "codes"
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
      voice_memo_transcripts: {
        Row: {
          attempt_count: number
          created_at: string
          error: string | null
          id: string
          language: string | null
          last_attempt_at: string | null
          last_error: string | null
          max_attempts: number
          memo_id: string
          model: string | null
          next_attempt_at: string
          segments: Json
          song_id: string
          status: Database["public"]["Enums"]["transcription_status"]
          text: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          error?: string | null
          id?: string
          language?: string | null
          last_attempt_at?: string | null
          last_error?: string | null
          max_attempts?: number
          memo_id: string
          model?: string | null
          next_attempt_at?: string
          segments?: Json
          song_id: string
          status?: Database["public"]["Enums"]["transcription_status"]
          text?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          error?: string | null
          id?: string
          language?: string | null
          last_attempt_at?: string | null
          last_error?: string | null
          max_attempts?: number
          memo_id?: string
          model?: string | null
          next_attempt_at?: string
          segments?: Json
          song_id?: string
          status?: Database["public"]["Enums"]["transcription_status"]
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_memo_transcripts_memo_id_fkey"
            columns: ["memo_id"]
            isOneToOne: true
            referencedRelation: "voice_memos"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_memos: {
        Row: {
          author_user_id: string
          byte_size: number
          created_at: string
          duration_ms: number | null
          failure_reason: string | null
          id: string
          mime_type: string
          section_id: string | null
          song_id: string
          status: Database["public"]["Enums"]["memo_status"]
          storage_path: string
          title: string | null
          updated_at: string
          waveform_peaks: Json | null
        }
        Insert: {
          author_user_id: string
          byte_size?: number
          created_at?: string
          duration_ms?: number | null
          failure_reason?: string | null
          id?: string
          mime_type: string
          section_id?: string | null
          song_id: string
          status?: Database["public"]["Enums"]["memo_status"]
          storage_path: string
          title?: string | null
          updated_at?: string
          waveform_peaks?: Json | null
        }
        Update: {
          author_user_id?: string
          byte_size?: number
          created_at?: string
          duration_ms?: number | null
          failure_reason?: string | null
          id?: string
          mime_type?: string
          section_id?: string | null
          song_id?: string
          status?: Database["public"]["Enums"]["memo_status"]
          storage_path?: string
          title?: string | null
          updated_at?: string
          waveform_peaks?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_memos_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "song_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_memos_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      onboarding_funnel_v1: {
        Row: {
          day: string | null
          onboarding_step: Database["public"]["Enums"]["onboarding_step"] | null
          users: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _assert_admin: { Args: never; Returns: undefined }
      accept_song_invite: {
        Args: { _token: string; _user_id: string }
        Returns: {
          already_member: boolean
          code: string
          role: Database["public"]["Enums"]["song_member_role"]
          song_id: string
        }[]
      }
      admin_create_founder: {
        Args: {
          _display_name: string
          _notes?: string
          _reward_profile?: Json
          _slug: string
        }
        Returns: {
          created_at: string
          created_by_user_id: string
          display_name: string
          id: string
          notes: string | null
          paused_at: string | null
          payout_method_status: string
          revoked_at: string | null
          reward_profile: Json
          slug: string
          status: Database["public"]["Enums"]["founder_status"]
          tier: Database["public"]["Enums"]["founder_tier"]
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "founders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_create_founder_code: {
        Args: {
          _code: string
          _expires_at?: string
          _founder_id: string
          _label?: string
          _max_redemptions?: number
        }
        Returns: {
          created_at: string
          created_by_user_id: string
          discount_cents: number
          expires_at: string | null
          id: string
          kind: Database["public"]["Enums"]["code_kind"]
          max_redemptions: number | null
          owner_founder_id: string | null
          owner_user_id: string | null
          redemption_count: number
          status: Database["public"]["Enums"]["code_status"]
          stripe_promotion_code_id: string | null
          updated_at: string
          value: string
        }
        SetofOptions: {
          from: "*"
          to: "codes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_deactivate_code: {
        Args: { _code_id: string }
        Returns: {
          created_at: string
          created_by_user_id: string
          discount_cents: number
          expires_at: string | null
          id: string
          kind: Database["public"]["Enums"]["code_kind"]
          max_redemptions: number | null
          owner_founder_id: string | null
          owner_user_id: string | null
          redemption_count: number
          status: Database["public"]["Enums"]["code_status"]
          stripe_promotion_code_id: string | null
          updated_at: string
          value: string
        }
        SetofOptions: {
          from: "*"
          to: "codes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_founder_detail: { Args: { _founder_id: string }; Returns: Json }
      admin_founder_summary: {
        Args: never
        Returns: {
          active_codes: number
          attributed_users: number
          code_count: number
          display_name: string
          founder_id: string
          last_payout_at: string
          paid_cents: number
          payable_cents: number
          pending_cents: number
          slug: string
          status: string
          total_redemptions: number
        }[]
      }
      admin_monthly_payouts: {
        Args: { _month_start?: string }
        Returns: {
          display_name: string
          founder_id: string
          invoice_count: number
          payable_cents: number
          pending_cents: number
          reward_event_ids: string[]
        }[]
      }
      admin_override_attribution: {
        Args: {
          _new_referrer_id: string
          _new_referrer_type: Database["public"]["Enums"]["referrer_type"]
          _reason: string
          _referred_user: string
        }
        Returns: {
          attributed_at: string
          code_id: string | null
          id: string
          locked: boolean
          override_by_user_id: string | null
          override_reason: string | null
          referred_user_id: string
          referrer_founder_id: string | null
          referrer_type: Database["public"]["Enums"]["referrer_type"]
          referrer_user_id: string | null
          source: Database["public"]["Enums"]["attribution_source"]
        }
        SetofOptions: {
          from: "*"
          to: "referral_attributions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_referrals_recent: {
        Args: { _limit?: number }
        Returns: {
          code_value: string
          created_at: string
          founder_name: string
          referred_user_id: string
          referrer_founder_id: string
          referrer_type: string
        }[]
      }
      advance_onboarding: {
        Args: {
          _patch: Json
          _source: string
          _to: Database["public"]["Enums"]["onboarding_step"]
          _user_id: string
        }
        Returns: string
      }
      advance_onboarding_for_song_owner: {
        Args: {
          _song_id: string
          _source: string
          _to: Database["public"]["Enums"]["onboarding_step"]
        }
        Returns: undefined
      }
      apply_credit_to_invoice: {
        Args: {
          _invoice_amount_cents: number
          _invoice_external_id: string
          _user: string
        }
        Returns: number
      }
      apply_storage_delta: {
        Args: { _delta: number; _owner_user_id: string }
        Returns: undefined
      }
      approve_payout: {
        Args: { _payout: string }
        Returns: {
          amount_cents: number
          approved_at: string | null
          approved_by_user_id: string | null
          created_at: string
          currency: string
          failure_reason: string | null
          founder_id: string | null
          id: string
          paid_at: string | null
          period_end: string
          period_start: string
          provider: string | null
          provider_payout_id: string | null
          status: Database["public"]["Enums"]["payout_status"]
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "payouts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      attribute_referral: {
        Args: {
          _code_value: string
          _referred_user: string
          _source: Database["public"]["Enums"]["attribution_source"]
        }
        Returns: {
          attributed_at: string
          code_id: string | null
          id: string
          locked: boolean
          override_by_user_id: string | null
          override_reason: string | null
          referred_user_id: string
          referrer_founder_id: string | null
          referrer_type: Database["public"]["Enums"]["referrer_type"]
          referrer_user_id: string | null
          source: Database["public"]["Enums"]["attribution_source"]
        }
        SetofOptions: {
          from: "*"
          to: "referral_attributions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_create_song: { Args: { _user_id: string }; Returns: boolean }
      can_invite: {
        Args: { _song_id: string; _user_id: string }
        Returns: boolean
      }
      can_unarchive_song: {
        Args: { _song_id: string; _user_id: string }
        Returns: boolean
      }
      can_upload_bytes: {
        Args: { _bytes: number; _owner_user_id: string }
        Returns: boolean
      }
      claim_transcript_attempt: {
        Args: { _memo_id: string }
        Returns: {
          attempt_count: number
          max_attempts: number
          memo_id: string
          song_id: string
        }[]
      }
      complete_onboarding: { Args: { _user_id: string }; Returns: string }
      create_payout_batch: {
        Args: { _founder: string; _period_end: string; _period_start: string }
        Returns: string
      }
      create_user_payout_batch: {
        Args: { _period_end: string; _period_start: string; _user: string }
        Returns: string
      }
      current_invite_expiry: { Args: never; Returns: string }
      current_plan: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["sub_plan"]
      }
      effective_storage_limit: { Args: { _user_id: string }; Returns: number }
      expire_pending_invites: { Args: never; Returns: number }
      generate_referral_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _uid: string }; Returns: boolean }
      is_invite_valid: { Args: { _invite_id: string }; Returns: boolean }
      is_last_owner: {
        Args: { _song_id: string; _user_id: string }
        Returns: boolean
      }
      is_pro_user: { Args: { _user_id: string }; Returns: boolean }
      is_song_member: {
        Args: { _song_id: string; _user_id: string }
        Returns: boolean
      }
      is_song_owner: {
        Args: { _song_id: string; _user_id: string }
        Returns: boolean
      }
      mark_memo_failed: {
        Args: { _memo_id: string; _reason: string }
        Returns: undefined
      }
      mark_memo_transcribed: { Args: { _memo_id: string }; Returns: undefined }
      mark_payout_failed: {
        Args: { _payout: string; _reason: string }
        Returns: {
          amount_cents: number
          approved_at: string | null
          approved_by_user_id: string | null
          created_at: string
          currency: string
          failure_reason: string | null
          founder_id: string | null
          id: string
          paid_at: string | null
          period_end: string
          period_start: string
          provider: string | null
          provider_payout_id: string | null
          status: Database["public"]["Enums"]["payout_status"]
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "payouts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_payout_paid: {
        Args: { _payout: string; _provider_id: string }
        Returns: {
          amount_cents: number
          approved_at: string | null
          approved_by_user_id: string | null
          created_at: string
          currency: string
          failure_reason: string | null
          founder_id: string | null
          id: string
          paid_at: string | null
          period_end: string
          period_start: string
          provider: string | null
          provider_payout_id: string | null
          status: Database["public"]["Enums"]["payout_status"]
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "payouts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mature_holds: { Args: never; Returns: number }
      next_paid_month_index: {
        Args: { _referred_user: string; _referrer_founder: string }
        Returns: number
      }
      next_song_version_number: { Args: { _song_id: string }; Returns: number }
      on_auth_user_confirmed: {
        Args: { _phone: string; _user_id: string }
        Returns: undefined
      }
      onboarding_legal_next: {
        Args: { _from: Database["public"]["Enums"]["onboarding_step"] }
        Returns: Database["public"]["Enums"]["onboarding_step"][]
      }
      onboarding_step_rank: {
        Args: { _s: Database["public"]["Enums"]["onboarding_step"] }
        Returns: number
      }
      owned_active_song_count: { Args: { _user_id: string }; Returns: number }
      record_chargeback: { Args: { _event: Json }; Returns: number }
      record_invoice_paid: { Args: { _event: Json }; Returns: string }
      record_invoice_refunded: { Args: { _event: Json }; Returns: number }
      redeem_code: {
        Args: { _code_value: string; _user: string }
        Returns: {
          created_at: string
          created_by_user_id: string
          discount_cents: number
          expires_at: string | null
          id: string
          kind: Database["public"]["Enums"]["code_kind"]
          max_redemptions: number | null
          owner_founder_id: string | null
          owner_user_id: string | null
          redemption_count: number
          status: Database["public"]["Enums"]["code_status"]
          stripe_promotion_code_id: string | null
          updated_at: string
          value: string
        }
        SetofOptions: {
          from: "*"
          to: "codes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      redeem_founder_code: {
        Args: { _code: string; _user_id: string }
        Returns: Json
      }
      reset_transcript_attempts: {
        Args: { _memo_id: string }
        Returns: undefined
      }
      resolve_code: {
        Args: { _value: string }
        Returns: {
          created_at: string
          created_by_user_id: string
          discount_cents: number
          expires_at: string | null
          id: string
          kind: Database["public"]["Enums"]["code_kind"]
          max_redemptions: number | null
          owner_founder_id: string | null
          owner_user_id: string | null
          redemption_count: number
          status: Database["public"]["Enums"]["code_status"]
          stripe_promotion_code_id: string | null
          updated_at: string
          value: string
        }
        SetofOptions: {
          from: "*"
          to: "codes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reverse_reward_for_invoice: {
        Args: { _invoice: string; _reason: string }
        Returns: number
      }
      reward_hold_days: { Args: never; Returns: number }
      safe_leave_song: {
        Args: { _song_id: string; _user_id: string }
        Returns: string
      }
      safe_transfer_song_owner: {
        Args: { _actor: string; _new_owner: string; _song_id: string }
        Returns: string
      }
      safe_unarchive_song: {
        Args: { _song_id: string; _user_id: string }
        Returns: string
      }
      song_role: {
        Args: { _song_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["song_member_role"]
      }
      write_audit: {
        Args: {
          _action: string
          _actor: string
          _after: Json
          _before: Json
          _entity_id: string
          _entity_type: string
          _reason: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      attribution_source:
        | "founder_code"
        | "user_referral_code"
        | "invite_link"
        | "admin_override"
      billing_event_kind:
        | "invoice_paid"
        | "invoice_refunded"
        | "chargeback_created"
        | "subscription_created"
        | "subscription_cancelled"
        | "hold_elapsed"
        | "manual_adjustment"
      code_kind: "founder" | "user_referral" | "internal"
      code_status: "active" | "paused" | "revoked" | "expired" | "exhausted"
      credit_status:
        | "pending"
        | "available"
        | "applied"
        | "reversed"
        | "expired"
      founder_status: "active" | "paused" | "revoked" | "internal"
      founder_tier: "standard" | "strategic" | "internal"
      invite_status: "pending" | "accepted" | "revoked" | "expired"
      memo_status:
        | "uploading"
        | "ready"
        | "failed"
        | "deleted"
        | "uploaded"
        | "finalized"
        | "transcribed"
      onboarding_step:
        | "not_started"
        | "intent_selected"
        | "referral_program_seen"
        | "founder_code_seen"
        | "first_song_created"
        | "first_idea_captured"
        | "first_voice_memo_added"
        | "first_lyrics_added"
        | "first_collaborator_invited"
        | "completed"
        | "dismissed"
      payout_method_kind: "manual" | "paypal" | "stripe_connect"
      payout_status:
        | "draft"
        | "approved"
        | "processing"
        | "paid"
        | "failed"
        | "cancelled"
      plan_tier: "free" | "pro"
      referrer_type: "founder" | "user"
      reward_kind: "cash" | "service_credit"
      reward_status: "pending" | "payable" | "paid" | "reversed" | "void"
      section_kind:
        | "verse"
        | "chorus"
        | "bridge"
        | "pre_chorus"
        | "intro"
        | "outro"
        | "hook"
        | "tag"
        | "other"
      song_member_role: "owner" | "collaborator" | "viewer"
      song_status: "active" | "archived" | "deleted"
      sub_plan: "free" | "pro" | "founder_pro"
      transcription_status:
        | "pending"
        | "processing"
        | "ready"
        | "failed"
        | "skipped"
      version_kind: "manual" | "auto" | "restore_point"
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
      app_role: ["admin", "moderator", "user"],
      attribution_source: [
        "founder_code",
        "user_referral_code",
        "invite_link",
        "admin_override",
      ],
      billing_event_kind: [
        "invoice_paid",
        "invoice_refunded",
        "chargeback_created",
        "subscription_created",
        "subscription_cancelled",
        "hold_elapsed",
        "manual_adjustment",
      ],
      code_kind: ["founder", "user_referral", "internal"],
      code_status: ["active", "paused", "revoked", "expired", "exhausted"],
      credit_status: ["pending", "available", "applied", "reversed", "expired"],
      founder_status: ["active", "paused", "revoked", "internal"],
      founder_tier: ["standard", "strategic", "internal"],
      invite_status: ["pending", "accepted", "revoked", "expired"],
      memo_status: [
        "uploading",
        "ready",
        "failed",
        "deleted",
        "uploaded",
        "finalized",
        "transcribed",
      ],
      onboarding_step: [
        "not_started",
        "intent_selected",
        "referral_program_seen",
        "founder_code_seen",
        "first_song_created",
        "first_idea_captured",
        "first_voice_memo_added",
        "first_lyrics_added",
        "first_collaborator_invited",
        "completed",
        "dismissed",
      ],
      payout_method_kind: ["manual", "paypal", "stripe_connect"],
      payout_status: [
        "draft",
        "approved",
        "processing",
        "paid",
        "failed",
        "cancelled",
      ],
      plan_tier: ["free", "pro"],
      referrer_type: ["founder", "user"],
      reward_kind: ["cash", "service_credit"],
      reward_status: ["pending", "payable", "paid", "reversed", "void"],
      section_kind: [
        "verse",
        "chorus",
        "bridge",
        "pre_chorus",
        "intro",
        "outro",
        "hook",
        "tag",
        "other",
      ],
      song_member_role: ["owner", "collaborator", "viewer"],
      song_status: ["active", "archived", "deleted"],
      sub_plan: ["free", "pro", "founder_pro"],
      transcription_status: [
        "pending",
        "processing",
        "ready",
        "failed",
        "skipped",
      ],
      version_kind: ["manual", "auto", "restore_point"],
    },
  },
} as const
