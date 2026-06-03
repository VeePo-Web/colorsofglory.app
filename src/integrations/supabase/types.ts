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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          phone: string | null
          referral_code: string | null
          referred_by_user_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          referral_code?: string | null
          referred_by_user_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          referral_code?: string | null
          referred_by_user_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          created_at: string
          error: string | null
          id: string
          language: string | null
          memo_id: string
          model: string | null
          segments: Json
          song_id: string
          status: Database["public"]["Enums"]["transcription_status"]
          text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          language?: string | null
          memo_id: string
          model?: string | null
          segments?: Json
          song_id: string
          status?: Database["public"]["Enums"]["transcription_status"]
          text?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          language?: string | null
          memo_id?: string
          model?: string | null
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
      [_ in never]: never
    }
    Functions: {
      apply_storage_delta: {
        Args: { _delta: number; _owner_user_id: string }
        Returns: undefined
      }
      current_invite_expiry: { Args: never; Returns: string }
      effective_storage_limit: { Args: { _user_id: string }; Returns: number }
      generate_referral_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_invite_valid: { Args: { _invite_id: string }; Returns: boolean }
      is_song_member: {
        Args: { _song_id: string; _user_id: string }
        Returns: boolean
      }
      is_song_owner: {
        Args: { _song_id: string; _user_id: string }
        Returns: boolean
      }
      next_song_version_number: { Args: { _song_id: string }; Returns: number }
      song_role: {
        Args: { _song_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["song_member_role"]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      invite_status: "pending" | "accepted" | "revoked" | "expired"
      memo_status: "uploading" | "ready" | "failed" | "deleted"
      plan_tier: "free" | "pro"
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
      invite_status: ["pending", "accepted", "revoked", "expired"],
      memo_status: ["uploading", "ready", "failed", "deleted"],
      plan_tier: ["free", "pro"],
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
