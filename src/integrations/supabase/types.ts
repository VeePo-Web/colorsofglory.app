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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_referral_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_song_member: {
        Args: { _song_id: string; _user_id: string }
        Returns: boolean
      }
      is_song_owner: {
        Args: { _song_id: string; _user_id: string }
        Returns: boolean
      }
      song_role: {
        Args: { _song_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["song_member_role"]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
    },
  },
} as const
