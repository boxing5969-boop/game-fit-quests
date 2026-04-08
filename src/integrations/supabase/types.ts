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
      badges: {
        Row: {
          code: string
          description: string
          id: string
          image_url: string | null
          name: string
        }
        Insert: {
          code: string
          description?: string
          id?: string
          image_url?: string | null
          name: string
        }
        Update: {
          code?: string
          description?: string
          id?: string
          image_url?: string | null
          name?: string
        }
        Relationships: []
      }
      branches: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      coach_assignments: {
        Row: {
          coach_id: string
          created_at: string
          id: string
          member_id: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          id?: string
          member_id: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          id?: string
          member_id?: string
        }
        Relationships: []
      }
      coach_requests: {
        Row: {
          id: string
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          id?: string
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          id?: string
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      external_cert_progress: {
        Row: {
          age_gate: boolean
          coach_approval: boolean
          coach_cert_ready: boolean
          dan4_ready: boolean
          examiner_ready: boolean
          id: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          age_gate?: boolean
          coach_approval?: boolean
          coach_cert_ready?: boolean
          dan4_ready?: boolean
          examiner_ready?: boolean
          id?: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          age_gate?: boolean
          coach_approval?: boolean
          coach_cert_ready?: boolean
          dan4_ready?: boolean
          examiner_ready?: boolean
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      hidden_mastery: {
        Row: {
          conditioning_score: number
          evaluation_score: number
          id: string
          safety_score: number
          teaching_score: number
          technique_score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          conditioning_score?: number
          evaluation_score?: number
          id?: string
          safety_score?: number
          teaching_score?: number
          technique_score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          conditioning_score?: number
          evaluation_score?: number
          id?: string
          safety_score?: number
          teaching_score?: number
          technique_score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      levels: {
        Row: {
          display_order: number
          id: string
          is_boss: boolean
          level_number: number
          rank_name: Database["public"]["Enums"]["rank_name"]
          reward_name: string | null
          title: string
          xp_required: number
        }
        Insert: {
          display_order?: number
          id?: string
          is_boss?: boolean
          level_number: number
          rank_name: Database["public"]["Enums"]["rank_name"]
          reward_name?: string | null
          title: string
          xp_required?: number
        }
        Update: {
          display_order?: number
          id?: string
          is_boss?: boolean
          level_number?: number
          rank_name?: Database["public"]["Enums"]["rank_name"]
          reward_name?: string | null
          title?: string
          xp_required?: number
        }
        Relationships: []
      }
      member_badges: {
        Row: {
          awarded_at: string
          badge_id: string
          id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge_id: string
          id?: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      member_progress: {
        Row: {
          bosses_cleared: number
          current_level: number
          current_rank: Database["public"]["Enums"]["rank_name"]
          id: string
          rival_id: string | null
          streak_days: number
          total_xp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bosses_cleared?: number
          current_level?: number
          current_rank?: Database["public"]["Enums"]["rank_name"]
          id?: string
          rival_id?: string | null
          streak_days?: number
          total_xp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          bosses_cleared?: number
          current_level?: number
          current_rank?: Database["public"]["Enums"]["rank_name"]
          id?: string
          rival_id?: string | null
          streak_days?: number
          total_xp?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mission_submissions: {
        Row: {
          coach_note: string | null
          id: string
          mission_id: string
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          coach_note?: string | null
          id?: string
          mission_id: string
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          coach_note?: string | null
          id?: string
          mission_id?: string
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_submissions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_videos: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          mission_id: string
          poster_url: string | null
          source_type: string
          video_url: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          mission_id: string
          poster_url?: string | null
          source_type?: string
          video_url: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          mission_id?: string
          poster_url?: string | null
          source_type?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_videos_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          created_at: string
          description: string
          difficulty: number
          id: string
          is_active: boolean
          key_point_1: string
          key_point_2: string
          key_point_3: string
          level_id: string
          sort_order: number
          title: string
          xp_reward: number
        }
        Insert: {
          created_at?: string
          description?: string
          difficulty?: number
          id?: string
          is_active?: boolean
          key_point_1?: string
          key_point_2?: string
          key_point_3?: string
          level_id: string
          sort_order?: number
          title: string
          xp_reward?: number
        }
        Update: {
          created_at?: string
          description?: string
          difficulty?: number
          id?: string
          is_active?: boolean
          key_point_1?: string
          key_point_2?: string
          key_point_3?: string
          level_id?: string
          sort_order?: number
          title?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "missions_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_verifications: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          phone_number: string
          verified: boolean
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          id?: string
          phone_number: string
          verified?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone_number?: string
          verified?: boolean
        }
        Relationships: []
      }
      privacy_consents: {
        Row: {
          consented_at: string
          id: string
          signature_data: string
          user_id: string
        }
        Insert: {
          consented_at?: string
          id?: string
          signature_data: string
          user_id: string
        }
        Update: {
          consented_at?: string
          id?: string
          signature_data?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          branch_name: string
          created_at: string
          id: string
          name: string
          nickname: string
          phone_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          branch_name?: string
          created_at?: string
          id?: string
          name?: string
          nickname?: string
          phone_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          branch_name?: string
          created_at?: string
          id?: string
          name?: string
          nickname?: string
          phone_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quest_submissions: {
        Row: {
          coach_note: string | null
          id: string
          quest_id: string
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["submission_status"]
          user_id: string
        }
        Insert: {
          coach_note?: string | null
          id?: string
          quest_id: string
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          user_id: string
        }
        Update: {
          coach_note?: string | null
          id?: string
          quest_id?: string
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quest_submissions_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "quests"
            referencedColumns: ["id"]
          },
        ]
      }
      quests: {
        Row: {
          created_at: string
          description: string
          id: string
          is_active: boolean
          level_id: string | null
          needs_coach_approval: boolean
          quest_type: Database["public"]["Enums"]["quest_type"]
          title: string
          xp_reward: number
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          level_id?: string | null
          needs_coach_approval?: boolean
          quest_type?: Database["public"]["Enums"]["quest_type"]
          title: string
          xp_reward?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          level_id?: string | null
          needs_coach_approval?: boolean
          quest_type?: Database["public"]["Enums"]["quest_type"]
          title?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "quests_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      xp_logs: {
        Row: {
          amount: number
          created_at: string
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reason?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_coach_request: {
        Args: { _request_id: string }
        Returns: undefined
      }
      approve_mission_submission: {
        Args: { _coach_note?: string; _submission_id: string }
        Returns: Json
      }
      approve_quest_submission: {
        Args: { _coach_note?: string; _submission_id: string }
        Returns: Json
      }
      get_boss_conquerors: {
        Args: { _branch_name: string; _limit?: number }
        Returns: {
          r_avatar_url: string
          r_bosses_cleared: number
          r_current_level: number
          r_current_rank: Database["public"]["Enums"]["rank_name"]
          r_nickname: string
          r_user_id: string
          rank_position: number
        }[]
      }
      get_division_ranking: {
        Args: { _branch_name: string; _limit?: number }
        Returns: {
          r_avatar_url: string
          r_bosses_cleared: number
          r_current_level: number
          r_current_rank: Database["public"]["Enums"]["rank_name"]
          r_nickname: string
          r_streak_days: number
          r_total_xp: number
          r_user_id: string
          rank_position: number
        }[]
      }
      get_hall_of_fame: {
        Args: { _limit?: number }
        Returns: {
          r_avatar_url: string
          r_bosses_cleared: number
          r_branch_name: string
          r_current_level: number
          r_current_rank: Database["public"]["Enums"]["rank_name"]
          r_nickname: string
          r_total_xp: number
          r_user_id: string
          rank_position: number
        }[]
      }
      get_monthly_risers: {
        Args: { _branch_name: string; _limit?: number }
        Returns: {
          monthly_xp: number
          r_avatar_url: string
          r_current_level: number
          r_current_rank: Database["public"]["Enums"]["rank_name"]
          r_nickname: string
          r_user_id: string
          rank_position: number
        }[]
      }
      get_my_branch: { Args: never; Returns: string }
      get_quest_xp: {
        Args: { qt: Database["public"]["Enums"]["quest_type"] }
        Returns: number
      }
      get_rivals_above: {
        Args: { _count?: number; _user_id: string }
        Returns: {
          r_avatar_url: string
          r_bosses_cleared: number
          r_current_level: number
          r_current_rank: Database["public"]["Enums"]["rank_name"]
          r_nickname: string
          r_streak_days: number
          r_total_xp: number
          r_user_id: string
          rank_position: number
        }[]
      }
      get_streak_ranking: {
        Args: { _branch_name: string; _limit?: number }
        Returns: {
          r_avatar_url: string
          r_current_level: number
          r_current_rank: Database["public"]["Enums"]["rank_name"]
          r_nickname: string
          r_streak_days: number
          r_user_id: string
          rank_position: number
        }[]
      }
      get_weekly_activity_ranking: {
        Args: { _branch_name: string; _limit?: number }
        Returns: {
          r_avatar_url: string
          r_current_level: number
          r_current_rank: Database["public"]["Enums"]["rank_name"]
          r_nickname: string
          r_user_id: string
          rank_position: number
          weekly_xp: number
        }[]
      }
      grant_manual_xp: {
        Args: { _amount: number; _member_id: string; _reason?: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_coach_of: {
        Args: { _coach_id: string; _member_id: string }
        Returns: boolean
      }
      manual_level_down: { Args: { _member_id: string }; Returns: Json }
      manual_level_up: { Args: { _member_id: string }; Returns: Json }
      pass_boss_battle: {
        Args: { _coach_note?: string; _member_id: string }
        Returns: Json
      }
      rank_order: {
        Args: { _rank: Database["public"]["Enums"]["rank_name"] }
        Returns: number
      }
      record_attendance: { Args: { _user_id: string }; Returns: undefined }
      reject_coach_request: {
        Args: { _request_id: string }
        Returns: undefined
      }
      reject_mission_submission: {
        Args: { _coach_note?: string; _submission_id: string }
        Returns: undefined
      }
      reject_quest_submission: {
        Args: { _coach_note?: string; _submission_id: string }
        Returns: undefined
      }
      set_member_level: {
        Args: {
          _level: number
          _member_id: string
          _rank: Database["public"]["Enums"]["rank_name"]
        }
        Returns: Json
      }
      set_rival: { Args: { _rival_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "member" | "coach" | "admin"
      quest_type: "main" | "sub" | "weekly" | "boss"
      rank_name: "white" | "blue" | "red" | "black"
      submission_status: "pending" | "approved" | "rejected"
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
      app_role: ["member", "coach", "admin"],
      quest_type: ["main", "sub", "weekly", "boss"],
      rank_name: ["white", "blue", "red", "black"],
      submission_status: ["pending", "approved", "rejected"],
    },
  },
} as const
