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
      activity_sessions: {
        Row: {
          branch_name: string
          created_at: string
          ended_at: string | null
          expires_from_board_at: string | null
          id: string
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          branch_name: string
          created_at?: string
          ended_at?: string | null
          expires_from_board_at?: string | null
          id?: string
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          branch_name?: string
          created_at?: string
          ended_at?: string | null
          expires_from_board_at?: string | null
          id?: string
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_bulk_actions: {
        Row: {
          action_type: string
          can_rollback: boolean
          created_at: string
          executed_by: string
          id: string
          payload_json: Json
          reason: string
          summary: string
          target_user_id: string
        }
        Insert: {
          action_type?: string
          can_rollback?: boolean
          created_at?: string
          executed_by: string
          id?: string
          payload_json?: Json
          reason?: string
          summary?: string
          target_user_id: string
        }
        Update: {
          action_type?: string
          can_rollback?: boolean
          created_at?: string
          executed_by?: string
          id?: string
          payload_json?: Json
          reason?: string
          summary?: string
          target_user_id?: string
        }
        Relationships: []
      }
      attendance_logs: {
        Row: {
          branch_name: string
          checked_in_at: string
          created_at: string
          display_name_snapshot: string
          id: string
          is_duplicate: boolean
          league_snapshot: string
          level_snapshot: number
          method: string
          user_id: string
          xp_granted: number
        }
        Insert: {
          branch_name: string
          checked_in_at?: string
          created_at?: string
          display_name_snapshot?: string
          id?: string
          is_duplicate?: boolean
          league_snapshot?: string
          level_snapshot?: number
          method?: string
          user_id: string
          xp_granted?: number
        }
        Update: {
          branch_name?: string
          checked_in_at?: string
          created_at?: string
          display_name_snapshot?: string
          id?: string
          is_duplicate?: boolean
          league_snapshot?: string
          level_snapshot?: number
          method?: string
          user_id?: string
          xp_granted?: number
        }
        Relationships: []
      }
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
      branch_display_settings: {
        Row: {
          animation_level: string
          branch_name: string
          display_name_mode: string
          id: string
          show_avatar: boolean
          show_rank: boolean
          sound_enabled: boolean
          updated_at: string
        }
        Insert: {
          animation_level?: string
          branch_name: string
          display_name_mode?: string
          id?: string
          show_avatar?: boolean
          show_rank?: boolean
          sound_enabled?: boolean
          updated_at?: string
        }
        Update: {
          animation_level?: string
          branch_name?: string
          display_name_mode?: string
          id?: string
          show_avatar?: boolean
          show_rank?: boolean
          sound_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      branch_transfer_requests: {
        Row: {
          created_at: string
          from_branch: string
          id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          to_branch: string
          user_id: string
        }
        Insert: {
          created_at?: string
          from_branch: string
          id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          to_branch: string
          user_id: string
        }
        Update: {
          created_at?: string
          from_branch?: string
          id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          to_branch?: string
          user_id?: string
        }
        Relationships: []
      }
      branches: {
        Row: {
          code: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string | null
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
      level_status: {
        Row: {
          approval_note: string | null
          approved_by: string | null
          completed_at: string | null
          id: string
          level_number: number
          rank_name: Database["public"]["Enums"]["rank_name"]
          status: Database["public"]["Enums"]["level_status_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          approval_note?: string | null
          approved_by?: string | null
          completed_at?: string | null
          id?: string
          level_number: number
          rank_name: Database["public"]["Enums"]["rank_name"]
          status?: Database["public"]["Enums"]["level_status_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          approval_note?: string | null
          approved_by?: string | null
          completed_at?: string | null
          id?: string
          level_number?: number
          rank_name?: Database["public"]["Enums"]["rank_name"]
          status?: Database["public"]["Enums"]["level_status_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      level_status_history: {
        Row: {
          change_reason: string | null
          changed_by: string
          created_at: string
          id: string
          level_number: number
          level_status_id: string
          new_status: Database["public"]["Enums"]["level_status_type"]
          previous_status: Database["public"]["Enums"]["level_status_type"]
          rank_name: Database["public"]["Enums"]["rank_name"]
          user_id: string
        }
        Insert: {
          change_reason?: string | null
          changed_by: string
          created_at?: string
          id?: string
          level_number: number
          level_status_id: string
          new_status: Database["public"]["Enums"]["level_status_type"]
          previous_status: Database["public"]["Enums"]["level_status_type"]
          rank_name: Database["public"]["Enums"]["rank_name"]
          user_id: string
        }
        Update: {
          change_reason?: string | null
          changed_by?: string
          created_at?: string
          id?: string
          level_number?: number
          level_status_id?: string
          new_status?: Database["public"]["Enums"]["level_status_type"]
          previous_status?: Database["public"]["Enums"]["level_status_type"]
          rank_name?: Database["public"]["Enums"]["rank_name"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "level_status_history_level_status_id_fkey"
            columns: ["level_status_id"]
            isOneToOne: false
            referencedRelation: "level_status"
            referencedColumns: ["id"]
          },
        ]
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
      manager_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          manager_id: string
          note_type: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          manager_id: string
          note_type?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          manager_id?: string
          note_type?: string
          user_id?: string
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
          video_timestamp_comments: Json | null
          video_url: string | null
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
          video_timestamp_comments?: Json | null
          video_url?: string | null
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
          video_timestamp_comments?: Json | null
          video_url?: string | null
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
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
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
          birth_date: string | null
          branch_name: string
          created_at: string
          email: string | null
          id: string
          is_approved: boolean
          name: string
          nickname: string
          phone_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          branch_name?: string
          created_at?: string
          email?: string | null
          id?: string
          is_approved?: boolean
          name?: string
          nickname?: string
          phone_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          branch_name?: string
          created_at?: string
          email?: string | null
          id?: string
          is_approved?: boolean
          name?: string
          nickname?: string
          phone_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      qr_checkin_tokens: {
        Row: {
          branch_name: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          is_active: boolean
          token: string
        }
        Insert: {
          branch_name: string
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          is_active?: boolean
          token: string
        }
        Update: {
          branch_name?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          token?: string
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
      approve_branch_transfer: {
        Args: { _note?: string; _request_id: string }
        Returns: undefined
      }
      approve_coach_request: {
        Args: { _request_id: string }
        Returns: undefined
      }
      approve_member: { Args: { _member_id: string }; Returns: undefined }
      approve_mission_submission: {
        Args: { _coach_note?: string; _submission_id: string }
        Returns: Json
      }
      approve_quest_submission: {
        Args: { _coach_note?: string; _submission_id: string }
        Returns: Json
      }
      bulk_complete_member: {
        Args: {
          _member_id: string
          _options?: Json
          _reason?: string
          _send_notification?: boolean
        }
        Returns: Json
      }
      create_notification: {
        Args: { _body?: string; _title: string; _user_id: string }
        Returns: string
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
      get_branch_stats: { Args: { _branch_name: string }; Returns: Json }
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
      get_signup_providers: {
        Args: { _user_ids: string[] }
        Returns: {
          signup_provider: string
          user_id: string
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
      is_branch_manager_of: {
        Args: { _manager_id: string; _member_id: string }
        Returns: boolean
      }
      is_coach_of: {
        Args: { _coach_id: string; _member_id: string }
        Returns: boolean
      }
      is_same_branch: { Args: { _user_id: string }; Returns: boolean }
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
      reject_branch_transfer: {
        Args: { _note?: string; _request_id: string }
        Returns: undefined
      }
      reject_coach_request: {
        Args: { _request_id: string }
        Returns: undefined
      }
      reject_member: { Args: { _member_id: string }; Returns: undefined }
      reject_mission_submission: {
        Args: { _coach_note?: string; _submission_id: string }
        Returns: undefined
      }
      reject_quest_submission: {
        Args: { _coach_note?: string; _submission_id: string }
        Returns: undefined
      }
      request_branch_transfer: { Args: { _to_branch: string }; Returns: string }
      request_mission_revision: {
        Args: { _coach_note?: string; _submission_id: string }
        Returns: undefined
      }
      set_level_status: {
        Args: {
          _level: number
          _member_id: string
          _note?: string
          _rank: Database["public"]["Enums"]["rank_name"]
          _status: Database["public"]["Enums"]["level_status_type"]
        }
        Returns: Json
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
      app_role: "member" | "coach" | "admin" | "branch_manager" | "super_admin"
      level_status_type:
        | "locked"
        | "in_progress"
        | "pending"
        | "approved"
        | "revision_requested"
        | "rejected"
        | "boss_cleared"
      quest_type: "main" | "sub" | "weekly" | "boss"
      rank_name: "white" | "blue" | "red" | "black"
      submission_status:
        | "pending"
        | "approved"
        | "rejected"
        | "revision_requested"
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
      app_role: ["member", "coach", "admin", "branch_manager", "super_admin"],
      level_status_type: [
        "locked",
        "in_progress",
        "pending",
        "approved",
        "revision_requested",
        "rejected",
        "boss_cleared",
      ],
      quest_type: ["main", "sub", "weekly", "boss"],
      rank_name: ["white", "blue", "red", "black"],
      submission_status: [
        "pending",
        "approved",
        "rejected",
        "revision_requested",
      ],
    },
  },
} as const
