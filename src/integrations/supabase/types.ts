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
      avatar_item_categories: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      avatar_items: {
        Row: {
          asset_url: string | null
          category_code: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          is_default: boolean
          league_requirement: string | null
          name: string
          price_gems: number
          rarity: string
          sort_order: number
          thumb_url: string | null
        }
        Insert: {
          asset_url?: string | null
          category_code: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          league_requirement?: string | null
          name: string
          price_gems?: number
          rarity?: string
          sort_order?: number
          thumb_url?: string | null
        }
        Update: {
          asset_url?: string | null
          category_code?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          league_requirement?: string | null
          name?: string
          price_gems?: number
          rarity?: string
          sort_order?: number
          thumb_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avatar_items_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "avatar_item_categories"
            referencedColumns: ["code"]
          },
        ]
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
      boxing_cheers: {
        Row: {
          cheer_type: string
          created_at: string
          gems_granted_to_receiver: number
          id: string
          message: string | null
          metadata: Json
          receiver_user_id: string
          respect_granted: number
          sender_user_id: string
          source_id: string | null
          source_type: string | null
        }
        Insert: {
          cheer_type: string
          created_at?: string
          gems_granted_to_receiver?: number
          id?: string
          message?: string | null
          metadata?: Json
          receiver_user_id: string
          respect_granted?: number
          sender_user_id: string
          source_id?: string | null
          source_type?: string | null
        }
        Update: {
          cheer_type?: string
          created_at?: string
          gems_granted_to_receiver?: number
          id?: string
          message?: string | null
          metadata?: Json
          receiver_user_id?: string
          respect_granted?: number
          sender_user_id?: string
          source_id?: string | null
          source_type?: string | null
        }
        Relationships: []
      }
      boxing_condition_logs: {
        Row: {
          condition_type: string
          created_at: string
          energy_level: number | null
          id: string
          note: string | null
          pain_area: string[]
          selected_at: string
          user_id: string
        }
        Insert: {
          condition_type: string
          created_at?: string
          energy_level?: number | null
          id?: string
          note?: string | null
          pain_area?: string[]
          selected_at?: string
          user_id: string
        }
        Update: {
          condition_type?: string
          created_at?: string
          energy_level?: number | null
          id?: string
          note?: string | null
          pain_area?: string[]
          selected_at?: string
          user_id?: string
        }
        Relationships: []
      }
      boxing_cornerman_daily_syncs: {
        Row: {
          bonus_claimed: boolean
          created_at: string
          gems_granted: number
          id: string
          pair_id: string
          quest_xp_granted: number
          respect_granted: number
          sync_date: string
          updated_at: string
          user_a_completed: boolean
          user_a_id: string
          user_b_completed: boolean
          user_b_id: string
        }
        Insert: {
          bonus_claimed?: boolean
          created_at?: string
          gems_granted?: number
          id?: string
          pair_id: string
          quest_xp_granted?: number
          respect_granted?: number
          sync_date?: string
          updated_at?: string
          user_a_completed?: boolean
          user_a_id: string
          user_b_completed?: boolean
          user_b_id: string
        }
        Update: {
          bonus_claimed?: boolean
          created_at?: string
          gems_granted?: number
          id?: string
          pair_id?: string
          quest_xp_granted?: number
          respect_granted?: number
          sync_date?: string
          updated_at?: string
          user_a_completed?: boolean
          user_a_id?: string
          user_b_completed?: boolean
          user_b_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boxing_cornerman_daily_syncs_pair_id_fkey"
            columns: ["pair_id"]
            isOneToOne: false
            referencedRelation: "boxing_cornerman_pairs"
            referencedColumns: ["id"]
          },
        ]
      }
      boxing_cornerman_pairs: {
        Row: {
          accepted_at: string | null
          branch_name: string | null
          created_at: string
          ended_at: string | null
          id: string
          metadata: Json
          receiver_user_id: string
          requested_at: string
          requester_user_id: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          branch_name?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          metadata?: Json
          receiver_user_id: string
          requested_at?: string
          requester_user_id: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          branch_name?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          metadata?: Json
          receiver_user_id?: string
          requested_at?: string
          requester_user_id?: string
          status?: string
        }
        Relationships: []
      }
      boxing_engagement_events: {
        Row: {
          action: string
          created_at: string
          event_type: string
          gems_delta: number
          id: string
          idempotency_key: string
          metadata: Json
          quest_xp_delta: number
          respect_delta: number
          source_id: string | null
          source_type: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          event_type: string
          gems_delta?: number
          id?: string
          idempotency_key: string
          metadata?: Json
          quest_xp_delta?: number
          respect_delta?: number
          source_id?: string | null
          source_type: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          event_type?: string
          gems_delta?: number
          id?: string
          idempotency_key?: string
          metadata?: Json
          quest_xp_delta?: number
          respect_delta?: number
          source_id?: string | null
          source_type?: string
          user_id?: string
        }
        Relationships: []
      }
      boxing_engagement_profiles: {
        Row: {
          best_quiz_streak: number
          challenge_attempt_count: number
          challenge_clear_count: number
          cheer_received_count: number
          cheer_sent_count: number
          created_at: string
          current_quiz_streak: number
          journal_count: number
          last_daily_briefing_date: string | null
          metadata: Json
          quest_xp: number
          quiz_attempt_count: number
          quiz_correct_count: number
          respect_points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          best_quiz_streak?: number
          challenge_attempt_count?: number
          challenge_clear_count?: number
          cheer_received_count?: number
          cheer_sent_count?: number
          created_at?: string
          current_quiz_streak?: number
          journal_count?: number
          last_daily_briefing_date?: string | null
          metadata?: Json
          quest_xp?: number
          quiz_attempt_count?: number
          quiz_correct_count?: number
          respect_points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          best_quiz_streak?: number
          challenge_attempt_count?: number
          challenge_clear_count?: number
          cheer_received_count?: number
          cheer_sent_count?: number
          created_at?: string
          current_quiz_streak?: number
          journal_count?: number
          last_daily_briefing_date?: string | null
          metadata?: Json
          quest_xp?: number
          quiz_attempt_count?: number
          quiz_correct_count?: number
          respect_points?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      boxing_fun_challenge_attempts: {
        Row: {
          challenge_id: string
          created_at: string
          difficulty: string
          gems_granted: number
          id: string
          metadata: Json
          note: string | null
          pain_check_passed: boolean
          quest_xp_granted: number
          status: string
          submitted_value: number
          target_value: number
          user_id: string
        }
        Insert: {
          challenge_id: string
          created_at?: string
          difficulty: string
          gems_granted?: number
          id?: string
          metadata?: Json
          note?: string | null
          pain_check_passed?: boolean
          quest_xp_granted?: number
          status?: string
          submitted_value?: number
          target_value?: number
          user_id: string
        }
        Update: {
          challenge_id?: string
          created_at?: string
          difficulty?: string
          gems_granted?: number
          id?: string
          metadata?: Json
          note?: string | null
          pain_check_passed?: boolean
          quest_xp_granted?: number
          status?: string
          submitted_value?: number
          target_value?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boxing_fun_challenge_attempts_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "boxing_fun_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      boxing_fun_challenges: {
        Row: {
          active: boolean
          category: string
          code: string
          created_at: string
          description: string
          difficulty_targets: Json
          duration_seconds: number | null
          high_intensity: boolean
          id: string
          metadata: Json
          pain_check_required: string[]
          rewards_by_difficulty: Json
          safety_note: string | null
          sort_order: number
          target_metric: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          code: string
          created_at?: string
          description: string
          difficulty_targets?: Json
          duration_seconds?: number | null
          high_intensity?: boolean
          id?: string
          metadata?: Json
          pain_check_required?: string[]
          rewards_by_difficulty?: Json
          safety_note?: string | null
          sort_order?: number
          target_metric: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          code?: string
          created_at?: string
          description?: string
          difficulty_targets?: Json
          duration_seconds?: number | null
          high_intensity?: boolean
          id?: string
          metadata?: Json
          pain_check_required?: string[]
          rewards_by_difficulty?: Json
          safety_note?: string | null
          sort_order?: number
          target_metric?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      boxing_gym_raid_contributions: {
        Row: {
          contributed_at: string
          contribution_type: string
          contribution_value: number
          id: string
          metadata: Json
          raid_id: string
          source_id: string | null
          source_type: string | null
          user_id: string
        }
        Insert: {
          contributed_at?: string
          contribution_type: string
          contribution_value?: number
          id?: string
          metadata?: Json
          raid_id: string
          source_id?: string | null
          source_type?: string | null
          user_id: string
        }
        Update: {
          contributed_at?: string
          contribution_type?: string
          contribution_value?: number
          id?: string
          metadata?: Json
          raid_id?: string
          source_id?: string | null
          source_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boxing_gym_raid_contributions_raid_id_fkey"
            columns: ["raid_id"]
            isOneToOne: false
            referencedRelation: "boxing_gym_raids"
            referencedColumns: ["id"]
          },
        ]
      }
      boxing_gym_raid_reward_claims: {
        Row: {
          claimed_at: string
          contribution_count: number
          gems_granted: number
          id: string
          metadata: Json
          quest_xp_granted: number
          raid_id: string
          respect_granted: number
          user_id: string
        }
        Insert: {
          claimed_at?: string
          contribution_count?: number
          gems_granted?: number
          id?: string
          metadata?: Json
          quest_xp_granted?: number
          raid_id: string
          respect_granted?: number
          user_id: string
        }
        Update: {
          claimed_at?: string
          contribution_count?: number
          gems_granted?: number
          id?: string
          metadata?: Json
          quest_xp_granted?: number
          raid_id?: string
          respect_granted?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boxing_gym_raid_reward_claims_raid_id_fkey"
            columns: ["raid_id"]
            isOneToOne: false
            referencedRelation: "boxing_gym_raids"
            referencedColumns: ["id"]
          },
        ]
      }
      boxing_gym_raids: {
        Row: {
          branch_name: string
          created_at: string
          current_value: number
          description: string
          end_date: string
          id: string
          metadata: Json
          raid_type: string
          reward_gems: number
          reward_quest_xp: number
          reward_respect: number
          start_date: string
          status: string
          target_value: number
          title: string
          updated_at: string
        }
        Insert: {
          branch_name: string
          created_at?: string
          current_value?: number
          description: string
          end_date: string
          id?: string
          metadata?: Json
          raid_type: string
          reward_gems?: number
          reward_quest_xp?: number
          reward_respect?: number
          start_date: string
          status?: string
          target_value: number
          title: string
          updated_at?: string
        }
        Update: {
          branch_name?: string
          created_at?: string
          current_value?: number
          description?: string
          end_date?: string
          id?: string
          metadata?: Json
          raid_type?: string
          reward_gems?: number
          reward_quest_xp?: number
          reward_respect?: number
          start_date?: string
          status?: string
          target_value?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      boxing_hidden_mission_claims: {
        Row: {
          claimed_at: string
          gems_granted: number
          id: string
          metadata: Json
          mission_id: string
          quest_xp_granted: number
          respect_granted: number
          user_id: string
        }
        Insert: {
          claimed_at?: string
          gems_granted?: number
          id?: string
          metadata?: Json
          mission_id: string
          quest_xp_granted?: number
          respect_granted?: number
          user_id: string
        }
        Update: {
          claimed_at?: string
          gems_granted?: number
          id?: string
          metadata?: Json
          mission_id?: string
          quest_xp_granted?: number
          respect_granted?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boxing_hidden_mission_claims_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "boxing_hidden_missions"
            referencedColumns: ["id"]
          },
        ]
      }
      boxing_hidden_missions: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string
          id: string
          metadata: Json
          reward_gems: number
          reward_quest_xp: number
          reward_respect: number
          sort_order: number
          title: string
          trigger_type: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description: string
          id?: string
          metadata?: Json
          reward_gems?: number
          reward_quest_xp?: number
          reward_respect?: number
          sort_order?: number
          title: string
          trigger_type: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string
          id?: string
          metadata?: Json
          reward_gems?: number
          reward_quest_xp?: number
          reward_respect?: number
          sort_order?: number
          title?: string
          trigger_type?: string
        }
        Relationships: []
      }
      boxing_quiz_attempts: {
        Row: {
          attempt_no: number
          created_at: string
          gems_granted: number
          id: string
          is_correct: boolean
          quest_xp_granted: number
          question_id: string
          selected_answer: string
          user_id: string
        }
        Insert: {
          attempt_no?: number
          created_at?: string
          gems_granted?: number
          id?: string
          is_correct: boolean
          quest_xp_granted?: number
          question_id: string
          selected_answer: string
          user_id: string
        }
        Update: {
          attempt_no?: number
          created_at?: string
          gems_granted?: number
          id?: string
          is_correct?: boolean
          quest_xp_granted?: number
          question_id?: string
          selected_answer?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boxing_quiz_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "boxing_quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      boxing_quiz_questions: {
        Row: {
          active: boolean
          category: string
          correct_answer: string
          created_at: string
          difficulty: string
          explanation: string | null
          id: string
          lesson_text: string
          metadata: Json
          options: Json
          question: string
          question_type: string
          retry_reward_gems: number
          retry_reward_quest_xp: number
          reward_gems: number
          reward_quest_xp: number
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          correct_answer: string
          created_at?: string
          difficulty?: string
          explanation?: string | null
          id?: string
          lesson_text: string
          metadata?: Json
          options?: Json
          question: string
          question_type?: string
          retry_reward_gems?: number
          retry_reward_quest_xp?: number
          reward_gems?: number
          reward_quest_xp?: number
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          correct_answer?: string
          created_at?: string
          difficulty?: string
          explanation?: string | null
          id?: string
          lesson_text?: string
          metadata?: Json
          options?: Json
          question?: string
          question_type?: string
          retry_reward_gems?: number
          retry_reward_quest_xp?: number
          reward_gems?: number
          reward_quest_xp?: number
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      boxing_return_round_claims: {
        Row: {
          claimed_at: string
          gems_granted: number
          id: string
          inactive_days: number
          metadata: Json
          mission_code: string
          quest_xp_granted: number
          return_type: string
          user_id: string
        }
        Insert: {
          claimed_at?: string
          gems_granted?: number
          id?: string
          inactive_days: number
          metadata?: Json
          mission_code: string
          quest_xp_granted?: number
          return_type: string
          user_id: string
        }
        Update: {
          claimed_at?: string
          gems_granted?: number
          id?: string
          inactive_days?: number
          metadata?: Json
          mission_code?: string
          quest_xp_granted?: number
          return_type?: string
          user_id?: string
        }
        Relationships: []
      }
      boxing_shadow_boxer_claims: {
        Row: {
          claimed_at: string
          comparison_window: string
          current_score: number
          gems_granted: number
          growth_rate: number
          id: string
          improved: boolean
          metadata: Json
          quest_xp_granted: number
          respect_granted: number
          shadow_score: number
          user_id: string
        }
        Insert: {
          claimed_at?: string
          comparison_window?: string
          current_score?: number
          gems_granted?: number
          growth_rate?: number
          id?: string
          improved?: boolean
          metadata?: Json
          quest_xp_granted?: number
          respect_granted?: number
          shadow_score?: number
          user_id: string
        }
        Update: {
          claimed_at?: string
          comparison_window?: string
          current_score?: number
          gems_granted?: number
          growth_rate?: number
          id?: string
          improved?: boolean
          metadata?: Json
          quest_xp_granted?: number
          respect_granted?: number
          shadow_score?: number
          user_id?: string
        }
        Relationships: []
      }
      boxing_story_cards: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string
          effect_code: string | null
          effect_metadata: Json
          is_consumable: boolean
          metadata: Json
          name: string
          rarity: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description: string
          effect_code?: string | null
          effect_metadata?: Json
          is_consumable?: boolean
          metadata?: Json
          name: string
          rarity?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string
          effect_code?: string | null
          effect_metadata?: Json
          is_consumable?: boolean
          metadata?: Json
          name?: string
          rarity?: string
        }
        Relationships: []
      }
      boxing_story_chapters: {
        Row: {
          active: boolean
          chapter_number: number
          code: string
          completion_condition: Json
          created_at: string
          description: string
          id: string
          metadata: Json
          obstacle_code: string | null
          reward_card_code: string | null
          reward_gems: number
          reward_quest_xp: number
          reward_title: string | null
          route_id: string
          subtitle: string | null
          title: string
          unlock_condition: Json
          updated_at: string
          world_node_code: string
        }
        Insert: {
          active?: boolean
          chapter_number: number
          code: string
          completion_condition?: Json
          created_at?: string
          description: string
          id?: string
          metadata?: Json
          obstacle_code?: string | null
          reward_card_code?: string | null
          reward_gems?: number
          reward_quest_xp?: number
          reward_title?: string | null
          route_id: string
          subtitle?: string | null
          title: string
          unlock_condition?: Json
          updated_at?: string
          world_node_code: string
        }
        Update: {
          active?: boolean
          chapter_number?: number
          code?: string
          completion_condition?: Json
          created_at?: string
          description?: string
          id?: string
          metadata?: Json
          obstacle_code?: string | null
          reward_card_code?: string | null
          reward_gems?: number
          reward_quest_xp?: number
          reward_title?: string | null
          route_id?: string
          subtitle?: string | null
          title?: string
          unlock_condition?: Json
          updated_at?: string
          world_node_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "boxing_story_chapters_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "boxing_story_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      boxing_story_dialogues: {
        Row: {
          active: boolean
          body: string
          chapter_id: string | null
          choices: Json
          created_at: string
          dialogue_type: string
          id: string
          metadata: Json
          route_id: string | null
          sort_order: number
          speaker: string
        }
        Insert: {
          active?: boolean
          body: string
          chapter_id?: string | null
          choices?: Json
          created_at?: string
          dialogue_type?: string
          id?: string
          metadata?: Json
          route_id?: string | null
          sort_order?: number
          speaker?: string
        }
        Update: {
          active?: boolean
          body?: string
          chapter_id?: string | null
          choices?: Json
          created_at?: string
          dialogue_type?: string
          id?: string
          metadata?: Json
          route_id?: string | null
          sort_order?: number
          speaker?: string
        }
        Relationships: [
          {
            foreignKeyName: "boxing_story_dialogues_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "boxing_story_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boxing_story_dialogues_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "boxing_story_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      boxing_story_ending_claims: {
        Row: {
          claimed_at: string
          ending_code: string
          id: string
          metadata: Json
          real_gems_granted: number
          reward_badge_code: string | null
          reward_card_code: string | null
          reward_title: string | null
          ring_coins_granted: number
          route_id: string
          story_xp_granted: number
          user_id: string
        }
        Insert: {
          claimed_at?: string
          ending_code: string
          id?: string
          metadata?: Json
          real_gems_granted?: number
          reward_badge_code?: string | null
          reward_card_code?: string | null
          reward_title?: string | null
          ring_coins_granted?: number
          route_id: string
          story_xp_granted?: number
          user_id: string
        }
        Update: {
          claimed_at?: string
          ending_code?: string
          id?: string
          metadata?: Json
          real_gems_granted?: number
          reward_badge_code?: string | null
          reward_card_code?: string | null
          reward_title?: string | null
          ring_coins_granted?: number
          route_id?: string
          story_xp_granted?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boxing_story_ending_claims_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "boxing_story_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      boxing_story_enemies: {
        Row: {
          active: boolean
          attack: number
          code: string
          created_at: string
          defense: number
          description: string | null
          hp: number
          is_boss: boolean
          metadata: Json
          name: string
          pattern_code: string
          pattern_metadata: Json
          reward_card_code: string | null
          reward_ring_coins: number
          reward_story_xp: number
          updated_at: string
          weakness: Json
        }
        Insert: {
          active?: boolean
          attack?: number
          code: string
          created_at?: string
          defense?: number
          description?: string | null
          hp?: number
          is_boss?: boolean
          metadata?: Json
          name: string
          pattern_code: string
          pattern_metadata?: Json
          reward_card_code?: string | null
          reward_ring_coins?: number
          reward_story_xp?: number
          updated_at?: string
          weakness?: Json
        }
        Update: {
          active?: boolean
          attack?: number
          code?: string
          created_at?: string
          defense?: number
          description?: string | null
          hp?: number
          is_boss?: boolean
          metadata?: Json
          name?: string
          pattern_code?: string
          pattern_metadata?: Json
          reward_card_code?: string | null
          reward_ring_coins?: number
          reward_story_xp?: number
          updated_at?: string
          weakness?: Json
        }
        Relationships: []
      }
      boxing_story_inventory: {
        Row: {
          card_code: string
          count: number
          first_acquired_at: string
          id: string
          metadata: Json
          user_id: string
        }
        Insert: {
          card_code: string
          count?: number
          first_acquired_at?: string
          id?: string
          metadata?: Json
          user_id: string
        }
        Update: {
          card_code?: string
          count?: number
          first_acquired_at?: string
          id?: string
          metadata?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boxing_story_inventory_card_code_fkey"
            columns: ["card_code"]
            isOneToOne: false
            referencedRelation: "boxing_story_cards"
            referencedColumns: ["code"]
          },
        ]
      }
      boxing_story_nodes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string
          icon: string | null
          id: string
          metadata: Json
          node_type: string
          sort_order: number
          title: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description: string
          icon?: string | null
          id?: string
          metadata?: Json
          node_type: string
          sort_order?: number
          title: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string
          icon?: string | null
          id?: string
          metadata?: Json
          node_type?: string
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      boxing_story_reward_claims: {
        Row: {
          chapter_id: string
          claimed_at: string
          gems_granted: number
          id: string
          metadata: Json
          quest_xp_granted: number
          reward_card_code: string | null
          reward_title: string | null
          route_id: string
          user_id: string
        }
        Insert: {
          chapter_id: string
          claimed_at?: string
          gems_granted?: number
          id?: string
          metadata?: Json
          quest_xp_granted?: number
          reward_card_code?: string | null
          reward_title?: string | null
          route_id: string
          user_id: string
        }
        Update: {
          chapter_id?: string
          claimed_at?: string
          gems_granted?: number
          id?: string
          metadata?: Json
          quest_xp_granted?: number
          reward_card_code?: string | null
          reward_title?: string | null
          route_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boxing_story_reward_claims_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "boxing_story_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boxing_story_reward_claims_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "boxing_story_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      boxing_story_routes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string
          id: string
          metadata: Json
          route_type: string
          sort_order: number
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description: string
          id?: string
          metadata?: Json
          route_type: string
          sort_order?: number
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string
          id?: string
          metadata?: Json
          route_type?: string
          sort_order?: number
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      boxing_story_scenes: {
        Row: {
          active: boolean
          chapter_id: string | null
          created_at: string
          id: string
          metadata: Json
          next_scene_defeat: number | null
          next_scene_index: number | null
          next_scene_victory: number | null
          payload: Json
          route_id: string | null
          scene_index: number
          scene_type: string
          scope: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          chapter_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          next_scene_defeat?: number | null
          next_scene_index?: number | null
          next_scene_victory?: number | null
          payload?: Json
          route_id?: string | null
          scene_index: number
          scene_type: string
          scope?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          chapter_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          next_scene_defeat?: number | null
          next_scene_index?: number | null
          next_scene_victory?: number | null
          payload?: Json
          route_id?: string | null
          scene_index?: number
          scene_type?: string
          scope?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "boxing_story_scenes_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "boxing_story_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boxing_story_scenes_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "boxing_story_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      boxing_user_player_stats: {
        Row: {
          active_route_code: string | null
          battle_state: Json
          created_at: string
          earned_badges: Json
          earned_endings: Json
          earned_titles: Json
          focus: number
          focus_max: number
          grit: number
          grit_max: number
          guard: number
          guard_max: number
          hp: number
          hp_max: number
          last_played_at: string | null
          metadata: Json
          prologue_completed: boolean
          respect: number
          respect_max: number
          ring_coins: number
          skill: number
          skill_max: number
          story_xp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active_route_code?: string | null
          battle_state?: Json
          created_at?: string
          earned_badges?: Json
          earned_endings?: Json
          earned_titles?: Json
          focus?: number
          focus_max?: number
          grit?: number
          grit_max?: number
          guard?: number
          guard_max?: number
          hp?: number
          hp_max?: number
          last_played_at?: string | null
          metadata?: Json
          prologue_completed?: boolean
          respect?: number
          respect_max?: number
          ring_coins?: number
          skill?: number
          skill_max?: number
          story_xp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active_route_code?: string | null
          battle_state?: Json
          created_at?: string
          earned_badges?: Json
          earned_endings?: Json
          earned_titles?: Json
          focus?: number
          focus_max?: number
          grit?: number
          grit_max?: number
          guard?: number
          guard_max?: number
          hp?: number
          hp_max?: number
          last_played_at?: string | null
          metadata?: Json
          prologue_completed?: boolean
          respect?: number
          respect_max?: number
          ring_coins?: number
          skill?: number
          skill_max?: number
          story_xp?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      boxing_user_scene_progress: {
        Row: {
          chapter_id: string | null
          completed_chapter_codes: Json
          created_at: string
          current_scene_index: number
          ending_code: string | null
          ending_reached: boolean
          first_clear_at: string | null
          id: string
          last_played_at: string | null
          metadata: Json
          play_count: number
          route_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chapter_id?: string | null
          completed_chapter_codes?: Json
          created_at?: string
          current_scene_index?: number
          ending_code?: string | null
          ending_reached?: boolean
          first_clear_at?: string | null
          id?: string
          last_played_at?: string | null
          metadata?: Json
          play_count?: number
          route_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chapter_id?: string | null
          completed_chapter_codes?: Json
          created_at?: string
          current_scene_index?: number
          ending_code?: string | null
          ending_reached?: boolean
          first_clear_at?: string | null
          id?: string
          last_played_at?: string | null
          metadata?: Json
          play_count?: number
          route_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boxing_user_scene_progress_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "boxing_story_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boxing_user_scene_progress_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "boxing_story_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      boxing_user_story_progress: {
        Row: {
          completed_chapter_count: number
          created_at: string
          current_chapter_id: string | null
          current_chapter_number: number
          id: string
          last_synced_at: string | null
          metadata: Json
          route_completed: boolean
          route_id: string
          selected_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_chapter_count?: number
          created_at?: string
          current_chapter_id?: string | null
          current_chapter_number?: number
          id?: string
          last_synced_at?: string | null
          metadata?: Json
          route_completed?: boolean
          route_id: string
          selected_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_chapter_count?: number
          created_at?: string
          current_chapter_id?: string | null
          current_chapter_number?: number
          id?: string
          last_synced_at?: string | null
          metadata?: Json
          route_completed?: boolean
          route_id?: string
          selected_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boxing_user_story_progress_current_chapter_id_fkey"
            columns: ["current_chapter_id"]
            isOneToOne: false
            referencedRelation: "boxing_story_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boxing_user_story_progress_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "boxing_story_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      boxing_user_story_route_state: {
        Row: {
          active_route_id: string | null
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_route_id?: string | null
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_route_id?: string | null
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boxing_user_story_route_state_active_route_id_fkey"
            columns: ["active_route_id"]
            isOneToOne: false
            referencedRelation: "boxing_story_routes"
            referencedColumns: ["id"]
          },
        ]
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
      champion_journal_comments: {
        Row: {
          commenter_user_id: string
          content: string
          created_at: string
          entry_id: string
          id: string
          metadata: Json
        }
        Insert: {
          commenter_user_id: string
          content: string
          created_at?: string
          entry_id: string
          id?: string
          metadata?: Json
        }
        Update: {
          commenter_user_id?: string
          content?: string
          created_at?: string
          entry_id?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "champion_journal_comments_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "champion_journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      champion_journal_entries: {
        Row: {
          content: string
          created_at: string
          gems_granted: number
          id: string
          metadata: Json
          mood: string | null
          prompt: string
          quest_xp_granted: number
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          gems_granted?: number
          id?: string
          metadata?: Json
          mood?: string | null
          prompt: string
          quest_xp_granted?: number
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          gems_granted?: number
          id?: string
          metadata?: Json
          mood?: string | null
          prompt?: string
          quest_xp_granted?: number
          user_id?: string
        }
        Relationships: []
      }
      character_part_categories: {
        Row: {
          code: string
          created_at: string
          id: string
          is_required: boolean
          layer_order: number
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_required?: boolean
          layer_order?: number
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_required?: boolean
          layer_order?: number
          name?: string
        }
        Relationships: []
      }
      character_parts: {
        Row: {
          asset_key: string
          category_code: string
          created_at: string
          gender_group: string
          id: string
          image_url: string | null
          is_active: boolean
          is_placeholder: boolean
          label: string
          sort_order: number
          style_group: string
        }
        Insert: {
          asset_key: string
          category_code: string
          created_at?: string
          gender_group?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_placeholder?: boolean
          label: string
          sort_order?: number
          style_group?: string
        }
        Update: {
          asset_key?: string
          category_code?: string
          created_at?: string
          gender_group?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_placeholder?: boolean
          label?: string
          sort_order?: number
          style_group?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_parts_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "character_part_categories"
            referencedColumns: ["code"]
          },
        ]
      }
      character_presets: {
        Row: {
          created_at: string
          created_by: string | null
          flattened_image_url: string | null
          id: string
          is_template: boolean
          name: string
          parts_json: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          flattened_image_url?: string | null
          id?: string
          is_template?: boolean
          name?: string
          parts_json?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          flattened_image_url?: string | null
          id?: string
          is_template?: boolean
          name?: string
          parts_json?: Json
          updated_at?: string
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
      diet_analytics_events: {
        Row: {
          created_at: string
          event_data: Json
          event_type: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_data?: Json
          event_type: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_data?: Json
          event_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      diet_coach_notes: {
        Row: {
          author_id: string
          created_at: string
          enrollment_id: string
          id: string
          note_text: string
          recipient_user_id: string
          related_log_id: string | null
          template_type: Database["public"]["Enums"]["diet_coach_note_template"]
          visibility: string
        }
        Insert: {
          author_id: string
          created_at?: string
          enrollment_id: string
          id?: string
          note_text: string
          recipient_user_id: string
          related_log_id?: string | null
          template_type?: Database["public"]["Enums"]["diet_coach_note_template"]
          visibility?: string
        }
        Update: {
          author_id?: string
          created_at?: string
          enrollment_id?: string
          id?: string
          note_text?: string
          recipient_user_id?: string
          related_log_id?: string | null
          template_type?: Database["public"]["Enums"]["diet_coach_note_template"]
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "diet_coach_notes_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "diet_program_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diet_coach_notes_related_log_id_fkey"
            columns: ["related_log_id"]
            isOneToOne: false
            referencedRelation: "diet_daily_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_daily_log_photos: {
        Row: {
          id: string
          log_id: string
          meal_slot: Database["public"]["Enums"]["diet_meal_slot"]
          storage_path: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          id?: string
          log_id: string
          meal_slot: Database["public"]["Enums"]["diet_meal_slot"]
          storage_path: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          id?: string
          log_id?: string
          meal_slot?: Database["public"]["Enums"]["diet_meal_slot"]
          storage_path?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diet_daily_log_photos_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "diet_daily_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_daily_logs: {
        Row: {
          coach_feedback: string | null
          coach_reviewed: boolean
          day_number: number
          enrollment_id: string
          gym_attended: boolean | null
          id: string
          late_night_snack_avoided: boolean | null
          log_date: string
          memo: string | null
          mood: string | null
          protein_first: boolean | null
          reviewed_at: string | null
          reviewed_by: string | null
          sleep_hours: number | null
          status: Database["public"]["Enums"]["diet_log_status"]
          step_count: number | null
          submitted_at: string
          sugary_drink_avoided: boolean | null
          updated_at: string
          user_id: string
          veggies_natural: boolean | null
          water_ml: number | null
        }
        Insert: {
          coach_feedback?: string | null
          coach_reviewed?: boolean
          day_number: number
          enrollment_id: string
          gym_attended?: boolean | null
          id?: string
          late_night_snack_avoided?: boolean | null
          log_date: string
          memo?: string | null
          mood?: string | null
          protein_first?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sleep_hours?: number | null
          status?: Database["public"]["Enums"]["diet_log_status"]
          step_count?: number | null
          submitted_at?: string
          sugary_drink_avoided?: boolean | null
          updated_at?: string
          user_id: string
          veggies_natural?: boolean | null
          water_ml?: number | null
        }
        Update: {
          coach_feedback?: string | null
          coach_reviewed?: boolean
          day_number?: number
          enrollment_id?: string
          gym_attended?: boolean | null
          id?: string
          late_night_snack_avoided?: boolean | null
          log_date?: string
          memo?: string | null
          mood?: string | null
          protein_first?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sleep_hours?: number | null
          status?: Database["public"]["Enums"]["diet_log_status"]
          step_count?: number | null
          submitted_at?: string
          sugary_drink_avoided?: boolean | null
          updated_at?: string
          user_id?: string
          veggies_natural?: boolean | null
          water_ml?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "diet_daily_logs_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "diet_program_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_nutrition_profiles: {
        Row: {
          activity_level: string | null
          created_at: string
          dietary_restrictions: string[]
          disliked_ingredients: string[]
          height_cm: number | null
          meals_per_day: number
          sex: string | null
          target_weight_kg: number | null
          updated_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          activity_level?: string | null
          created_at?: string
          dietary_restrictions?: string[]
          disliked_ingredients?: string[]
          height_cm?: number | null
          meals_per_day?: number
          sex?: string | null
          target_weight_kg?: number | null
          updated_at?: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          activity_level?: string | null
          created_at?: string
          dietary_restrictions?: string[]
          disliked_ingredients?: string[]
          height_cm?: number | null
          meals_per_day?: number
          sex?: string | null
          target_weight_kg?: number | null
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      diet_post_program_checkins: {
        Row: {
          adherence_score: number | null
          attended_workouts: number
          checkin_date: string
          created_at: string
          flexible_meals_count: number
          id: string
          late_binge_count: number
          needs_recovery: boolean
          plan_id: string
          protein_first_days: number
          recovery_reason: string | null
          reflection: string | null
          user_id: string
          waist_cm: number | null
          week_index: number
          weight_kg: number | null
        }
        Insert: {
          adherence_score?: number | null
          attended_workouts?: number
          checkin_date: string
          created_at?: string
          flexible_meals_count?: number
          id?: string
          late_binge_count?: number
          needs_recovery?: boolean
          plan_id: string
          protein_first_days?: number
          recovery_reason?: string | null
          reflection?: string | null
          user_id: string
          waist_cm?: number | null
          week_index: number
          weight_kg?: number | null
        }
        Update: {
          adherence_score?: number | null
          attended_workouts?: number
          checkin_date?: string
          created_at?: string
          flexible_meals_count?: number
          id?: string
          late_binge_count?: number
          needs_recovery?: boolean
          plan_id?: string
          protein_first_days?: number
          recovery_reason?: string | null
          reflection?: string | null
          user_id?: string
          waist_cm?: number | null
          week_index?: number
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "diet_post_program_checkins_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "diet_post_program_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_post_program_plans: {
        Row: {
          coach_recommendation_note: string | null
          coach_recommended_at: string | null
          coach_recommended_by: string | null
          coach_recommended_path:
            | Database["public"]["Enums"]["diet_post_program_recommendation"]
            | null
          completion_summary: Json
          created_at: string
          enrollment_id: string
          extend_ended_at: string | null
          extend_goals: Json | null
          extend_result: string | null
          extend_started_at: string | null
          extension_cycle_index: number
          extension_cycle_length: number
          follow_up_status: Database["public"]["Enums"]["diet_post_program_follow_up"]
          id: string
          maintenance_range_kg: number
          maintenance_target_weight_kg: number | null
          maintenance_waist_range_cm: number
          maintenance_waist_target_cm: number | null
          next_cycle_start_date: string | null
          pattern_tags: string[]
          reassessment: Json | null
          recommended_path: Database["public"]["Enums"]["diet_post_program_recommendation"]
          regain_alert_threshold_kg: number
          selected_at: string | null
          selected_path: Database["public"]["Enums"]["diet_post_program_path"]
          target_achieved: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          coach_recommendation_note?: string | null
          coach_recommended_at?: string | null
          coach_recommended_by?: string | null
          coach_recommended_path?:
            | Database["public"]["Enums"]["diet_post_program_recommendation"]
            | null
          completion_summary?: Json
          created_at?: string
          enrollment_id: string
          extend_ended_at?: string | null
          extend_goals?: Json | null
          extend_result?: string | null
          extend_started_at?: string | null
          extension_cycle_index?: number
          extension_cycle_length?: number
          follow_up_status?: Database["public"]["Enums"]["diet_post_program_follow_up"]
          id?: string
          maintenance_range_kg?: number
          maintenance_target_weight_kg?: number | null
          maintenance_waist_range_cm?: number
          maintenance_waist_target_cm?: number | null
          next_cycle_start_date?: string | null
          pattern_tags?: string[]
          reassessment?: Json | null
          recommended_path?: Database["public"]["Enums"]["diet_post_program_recommendation"]
          regain_alert_threshold_kg?: number
          selected_at?: string | null
          selected_path?: Database["public"]["Enums"]["diet_post_program_path"]
          target_achieved?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          coach_recommendation_note?: string | null
          coach_recommended_at?: string | null
          coach_recommended_by?: string | null
          coach_recommended_path?:
            | Database["public"]["Enums"]["diet_post_program_recommendation"]
            | null
          completion_summary?: Json
          created_at?: string
          enrollment_id?: string
          extend_ended_at?: string | null
          extend_goals?: Json | null
          extend_result?: string | null
          extend_started_at?: string | null
          extension_cycle_index?: number
          extension_cycle_length?: number
          follow_up_status?: Database["public"]["Enums"]["diet_post_program_follow_up"]
          id?: string
          maintenance_range_kg?: number
          maintenance_target_weight_kg?: number | null
          maintenance_waist_range_cm?: number
          maintenance_waist_target_cm?: number | null
          next_cycle_start_date?: string | null
          pattern_tags?: string[]
          reassessment?: Json | null
          recommended_path?: Database["public"]["Enums"]["diet_post_program_recommendation"]
          regain_alert_threshold_kg?: number
          selected_at?: string | null
          selected_path?: Database["public"]["Enums"]["diet_post_program_path"]
          target_achieved?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diet_post_program_plans_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "diet_program_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_preferences: {
        Row: {
          settings: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          settings?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          settings?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      diet_program_enrollments: {
        Row: {
          advanced_feature_enabled: boolean
          branch_name: string | null
          coach_assigned_id: string | null
          created_at: string
          current_day: number
          current_stage: Database["public"]["Enums"]["diet_stage"]
          finished_at: string | null
          id: string
          screening_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["diet_enrollment_status"]
          track: Database["public"]["Enums"]["diet_track"]
          updated_at: string
          user_id: string
          warning_flags: Json
        }
        Insert: {
          advanced_feature_enabled?: boolean
          branch_name?: string | null
          coach_assigned_id?: string | null
          created_at?: string
          current_day?: number
          current_stage?: Database["public"]["Enums"]["diet_stage"]
          finished_at?: string | null
          id?: string
          screening_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["diet_enrollment_status"]
          track: Database["public"]["Enums"]["diet_track"]
          updated_at?: string
          user_id: string
          warning_flags?: Json
        }
        Update: {
          advanced_feature_enabled?: boolean
          branch_name?: string | null
          coach_assigned_id?: string | null
          created_at?: string
          current_day?: number
          current_stage?: Database["public"]["Enums"]["diet_stage"]
          finished_at?: string | null
          id?: string
          screening_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["diet_enrollment_status"]
          track?: Database["public"]["Enums"]["diet_track"]
          updated_at?: string
          user_id?: string
          warning_flags?: Json
        }
        Relationships: [
          {
            foreignKeyName: "diet_program_enrollments_screening_id_fkey"
            columns: ["screening_id"]
            isOneToOne: false
            referencedRelation: "diet_safety_screenings"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_progress_snapshots: {
        Row: {
          approved_days_total: number
          best_streak: number
          current_streak: number
          enrollment_id: string
          habit_score: number | null
          last_log_date: string | null
          milestone_14_reached: boolean
          milestone_21_reached: boolean
          milestone_7_reached: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_days_total?: number
          best_streak?: number
          current_streak?: number
          enrollment_id: string
          habit_score?: number | null
          last_log_date?: string | null
          milestone_14_reached?: boolean
          milestone_21_reached?: boolean
          milestone_7_reached?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_days_total?: number
          best_streak?: number
          current_streak?: number
          enrollment_id?: string
          habit_score?: number | null
          last_log_date?: string | null
          milestone_14_reached?: boolean
          milestone_21_reached?: boolean
          milestone_7_reached?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diet_progress_snapshots_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "diet_program_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_quest_events: {
        Row: {
          base_score: number
          completed_at: string
          created_at: string
          day_number: number
          enrollment_id: string
          id: string
          log_date: string
          meal_slot: string | null
          meta: Json
          mission_id: string
          mission_label: string
          source_kind: string
          timing_bonus: number
          timing_grade: string
          total_score: number
          user_id: string
        }
        Insert: {
          base_score?: number
          completed_at?: string
          created_at?: string
          day_number: number
          enrollment_id: string
          id?: string
          log_date: string
          meal_slot?: string | null
          meta?: Json
          mission_id: string
          mission_label: string
          source_kind: string
          timing_bonus?: number
          timing_grade: string
          total_score?: number
          user_id: string
        }
        Update: {
          base_score?: number
          completed_at?: string
          created_at?: string
          day_number?: number
          enrollment_id?: string
          id?: string
          log_date?: string
          meal_slot?: string | null
          meta?: Json
          mission_id?: string
          mission_label?: string
          source_kind?: string
          timing_bonus?: number
          timing_grade?: string
          total_score?: number
          user_id?: string
        }
        Relationships: []
      }
      diet_safety_screenings: {
        Row: {
          age_group: Database["public"]["Enums"]["diet_age_group"]
          consent_accepted: boolean
          consent_version: number
          created_at: string
          diabetes_medication: boolean
          eating_disorder_risk: boolean
          id: string
          is_youth: boolean
          other_conditions: string | null
          pregnancy_breastfeeding: boolean
          user_id: string
        }
        Insert: {
          age_group: Database["public"]["Enums"]["diet_age_group"]
          consent_accepted?: boolean
          consent_version?: number
          created_at?: string
          diabetes_medication?: boolean
          eating_disorder_risk?: boolean
          id?: string
          is_youth: boolean
          other_conditions?: string | null
          pregnancy_breastfeeding?: boolean
          user_id: string
        }
        Update: {
          age_group?: Database["public"]["Enums"]["diet_age_group"]
          consent_accepted?: boolean
          consent_version?: number
          created_at?: string
          diabetes_medication?: boolean
          eating_disorder_risk?: boolean
          id?: string
          is_youth?: boolean
          other_conditions?: string | null
          pregnancy_breastfeeding?: boolean
          user_id?: string
        }
        Relationships: []
      }
      diet_weekly_reviews: {
        Row: {
          adherence_summary: Json
          body_photo_url: string | null
          created_at: string
          enrollment_id: string
          id: string
          next_week_focus: string | null
          reflection: string | null
          user_id: string
          waist_cm: number | null
          week_index: number
        }
        Insert: {
          adherence_summary?: Json
          body_photo_url?: string | null
          created_at?: string
          enrollment_id: string
          id?: string
          next_week_focus?: string | null
          reflection?: string | null
          user_id: string
          waist_cm?: number | null
          week_index: number
        }
        Update: {
          adherence_summary?: Json
          body_photo_url?: string | null
          created_at?: string
          enrollment_id?: string
          id?: string
          next_week_focus?: string | null
          reflection?: string | null
          user_id?: string
          waist_cm?: number | null
          week_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "diet_weekly_reviews_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "diet_program_enrollments"
            referencedColumns: ["id"]
          },
        ]
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
      hof_reward_claims: {
        Row: {
          amount: number
          granted_at: string
          id: string
          kind: string
          period_key: string
          user_id: string
        }
        Insert: {
          amount: number
          granted_at?: string
          id?: string
          kind: string
          period_key: string
          user_id: string
        }
        Update: {
          amount?: number
          granted_at?: string
          id?: string
          kind?: string
          period_key?: string
          user_id?: string
        }
        Relationships: []
      }
      hof_reward_config: {
        Row: {
          amount: number
          description: string | null
          kind: string
          updated_at: string
        }
        Insert: {
          amount: number
          description?: string | null
          kind: string
          updated_at?: string
        }
        Update: {
          amount?: number
          description?: string | null
          kind?: string
          updated_at?: string
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
      master_boss_attempts: {
        Row: {
          attempted_at: string
          coach_note: string | null
          id: string
          passed: boolean
          retained_xp: number
          target_master_level: number
          user_id: string
          xp_snapshot: number
        }
        Insert: {
          attempted_at?: string
          coach_note?: string | null
          id?: string
          passed: boolean
          retained_xp?: number
          target_master_level: number
          user_id: string
          xp_snapshot?: number
        }
        Update: {
          attempted_at?: string
          coach_note?: string | null
          id?: string
          passed?: boolean
          retained_xp?: number
          target_master_level?: number
          user_id?: string
          xp_snapshot?: number
        }
        Relationships: []
      }
      master_level_definitions: {
        Row: {
          aura_reward: string | null
          created_at: string
          days_required: number
          description: string | null
          fail_retention_pct: number
          frame_reward: string | null
          gem_reward: number
          is_boss: boolean
          master_level: number
          overall_level: number | null
          sessions_required: number
          title: string
          title_reward: string | null
          xp_required: number
        }
        Insert: {
          aura_reward?: string | null
          created_at?: string
          days_required?: number
          description?: string | null
          fail_retention_pct?: number
          frame_reward?: string | null
          gem_reward?: number
          is_boss?: boolean
          master_level: number
          overall_level?: number | null
          sessions_required?: number
          title: string
          title_reward?: string | null
          xp_required?: number
        }
        Update: {
          aura_reward?: string | null
          created_at?: string
          days_required?: number
          description?: string | null
          fail_retention_pct?: number
          frame_reward?: string | null
          gem_reward?: number
          is_boss?: boolean
          master_level?: number
          overall_level?: number | null
          sessions_required?: number
          title?: string
          title_reward?: string | null
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
      member_character_assignments: {
        Row: {
          created_at: string
          display_mode: string
          id: string
          is_active: boolean
          preset_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_mode?: string
          id?: string
          is_active?: boolean
          preset_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_mode?: string
          id?: string
          is_active?: boolean
          preset_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_character_assignments_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "character_presets"
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
          master_level: number
          master_track_unlocked: boolean
          overall_level: number | null
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
          master_level?: number
          master_track_unlocked?: boolean
          overall_level?: number | null
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
          master_level?: number
          master_track_unlocked?: boolean
          overall_level?: number | null
          rival_id?: string | null
          streak_days?: number
          total_xp?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      minigame_records: {
        Row: {
          accuracy: number | null
          avg_reaction_ms: number | null
          best_reaction_ms: number | null
          combo_peak: number | null
          game_type: string
          id: string
          played_at: string
          player_name: string
          score: number
          tier: string | null
          total_punches: number | null
          user_id: string
          xp_earned: number | null
        }
        Insert: {
          accuracy?: number | null
          avg_reaction_ms?: number | null
          best_reaction_ms?: number | null
          combo_peak?: number | null
          game_type: string
          id?: string
          played_at?: string
          player_name: string
          score?: number
          tier?: string | null
          total_punches?: number | null
          user_id: string
          xp_earned?: number | null
        }
        Update: {
          accuracy?: number | null
          avg_reaction_ms?: number | null
          best_reaction_ms?: number | null
          combo_peak?: number | null
          game_type?: string
          id?: string
          played_at?: string
          player_name?: string
          score?: number
          tier?: string | null
          total_punches?: number | null
          user_id?: string
          xp_earned?: number | null
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
      preset_customization_variants: {
        Row: {
          anchor_x: number
          anchor_y: number
          asset_url: string | null
          category_code: string
          created_at: string
          id: string
          is_active: boolean
          option_key: string
          preset_style: string
          preview_order: number
          rotation: number
          scale: number
          z_order: number
        }
        Insert: {
          anchor_x?: number
          anchor_y?: number
          asset_url?: string | null
          category_code: string
          created_at?: string
          id?: string
          is_active?: boolean
          option_key: string
          preset_style: string
          preview_order?: number
          rotation?: number
          scale?: number
          z_order?: number
        }
        Update: {
          anchor_x?: number
          anchor_y?: number
          asset_url?: string | null
          category_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          option_key?: string
          preset_style?: string
          preview_order?: number
          rotation?: number
          scale?: number
          z_order?: number
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
          diet_program_enabled: boolean
          email: string | null
          id: string
          is_approved: boolean
          last_unlock_check_level: number
          name: string
          nickname: string
          onboarding_done: boolean
          phone_number: string | null
          safety_done: boolean
          tutorial_completed: boolean
          tutorial_completed_at: string | null
          tutorial_reward_claimed: boolean
          tutorial_skipped: boolean
          tutorial_started_at: string | null
          tutorial_step: number
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          branch_name?: string
          created_at?: string
          diet_program_enabled?: boolean
          email?: string | null
          id?: string
          is_approved?: boolean
          last_unlock_check_level?: number
          name?: string
          nickname?: string
          onboarding_done?: boolean
          phone_number?: string | null
          safety_done?: boolean
          tutorial_completed?: boolean
          tutorial_completed_at?: string | null
          tutorial_reward_claimed?: boolean
          tutorial_skipped?: boolean
          tutorial_started_at?: string | null
          tutorial_step?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          branch_name?: string
          created_at?: string
          diet_program_enabled?: boolean
          email?: string | null
          id?: string
          is_approved?: boolean
          last_unlock_check_level?: number
          name?: string
          nickname?: string
          onboarding_done?: boolean
          phone_number?: string | null
          safety_done?: boolean
          tutorial_completed?: boolean
          tutorial_completed_at?: string | null
          tutorial_reward_claimed?: boolean
          tutorial_skipped?: boolean
          tutorial_started_at?: string | null
          tutorial_step?: number
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
      tutorial_global_overrides: {
        Row: {
          custom_steps: Json
          id: number
          step_order: Json
          step_overrides: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          custom_steps?: Json
          id?: number
          step_order?: Json
          step_overrides?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          custom_steps?: Json
          id?: number
          step_order?: Json
          step_overrides?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      tutorial_step_claims: {
        Row: {
          amount: number
          granted_at: string
          id: string
          step_order: number
          user_id: string
        }
        Insert: {
          amount: number
          granted_at?: string
          id?: string
          step_order: number
          user_id: string
        }
        Update: {
          amount?: number
          granted_at?: string
          id?: string
          step_order?: number
          user_id?: string
        }
        Relationships: []
      }
      user_avatar_equipment: {
        Row: {
          category_code: string
          equipped_at: string
          id: string
          item_id: string
          user_id: string
        }
        Insert: {
          category_code: string
          equipped_at?: string
          id?: string
          item_id: string
          user_id: string
        }
        Update: {
          category_code?: string
          equipped_at?: string
          id?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_avatar_equipment_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "avatar_item_categories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "user_avatar_equipment_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
        ]
      }
      user_owned_customizations: {
        Row: {
          category: string
          id: string
          item_key: string
          purchased_at: string | null
          user_id: string
        }
        Insert: {
          category: string
          id?: string
          item_key: string
          purchased_at?: string | null
          user_id: string
        }
        Update: {
          category?: string
          id?: string
          item_key?: string
          purchased_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_owned_items: {
        Row: {
          acquired_at: string
          id: string
          item_id: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          id?: string
          item_id: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          id?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_owned_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
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
      user_wallets: {
        Row: {
          gems_balance: number
          id: string
          total_earned: number
          total_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          gems_balance?: number
          id?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          gems_balance?: number
          id?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          meta_json: Json
          reason: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          meta_json?: Json
          reason?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          meta_json?: Json
          reason?: string
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
      _grant_hof_reward_once: {
        Args: { _kind: string; _period_key: string; _user_id: string }
        Returns: Json
      }
      _story_clamp_int: {
        Args: { hi: number; lo: number; v: number }
        Returns: number
      }
      add_diet_coach_feedback: {
        Args: { _feedback: string; _log_id: string }
        Returns: Json
      }
      add_diet_log_photo: {
        Args: {
          _log_id: string
          _meal_slot: Database["public"]["Enums"]["diet_meal_slot"]
          _storage_path: string
        }
        Returns: Json
      }
      add_journal_comment: {
        Args: { p_content: string; p_entry_id: string }
        Returns: {
          comment_id: string
          message: string
          success: boolean
        }[]
      }
      advance_master_level:
        | { Args: { _member_id: string }; Returns: Json }
        | {
            Args: { _expected_current?: number; _member_id: string }
            Returns: Json
          }
      apply_choice: {
        Args: { p_choice_index: number; p_scene_id: string }
        Returns: Json
      }
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
      attempt_master_boss:
        | {
            Args: { _coach_note?: string; _member_id: string; _passed: boolean }
            Returns: Json
          }
        | {
            Args: {
              _coach_note?: string
              _expected_current?: number
              _member_id: string
              _passed: boolean
            }
            Returns: Json
          }
      boxing_calc_inactive_days: {
        Args: { p_user_id: string }
        Returns: number
      }
      boxing_cornerman_expire_stale_pending: { Args: never; Returns: undefined }
      boxing_cornerman_has_active_pair: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      boxing_cornerman_user_branch: {
        Args: { p_user_id: string }
        Returns: string
      }
      boxing_cornerman_user_completed_today: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      boxing_gym_raid_lazy_expire: { Args: never; Returns: undefined }
      boxing_return_type_for_days: { Args: { p_days: number }; Returns: string }
      boxing_shadow_metric_period: {
        Args: { p_end: string; p_start: string; p_user_id: string }
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
      change_story_route: { Args: { p_route_code: string }; Returns: Json }
      check_and_claim_hidden_missions: { Args: never; Returns: Json }
      check_customization_unlock: {
        Args: { _category: string; _item_key: string }
        Returns: boolean
      }
      choose_story_route: { Args: { p_route_code: string }; Returns: Json }
      claim_card_reward: {
        Args: { p_card_code: string; p_source: string }
        Returns: Json
      }
      claim_cornerman_daily_bonus: { Args: never; Returns: Json }
      claim_gym_raid_reward: { Args: { p_raid_id: string }; Returns: Json }
      claim_hof_first_entry: { Args: never; Returns: Json }
      claim_hof_monthly_reward: { Args: never; Returns: Json }
      claim_hof_season_reward: { Args: never; Returns: Json }
      claim_hof_weekly_reward: { Args: never; Returns: Json }
      claim_return_round_reward: {
        Args: { p_mission_code: string }
        Returns: Json
      }
      claim_shadow_boxer_reward: {
        Args: { p_window_days?: number }
        Returns: Json
      }
      claim_tutorial_step_reward: { Args: { _step: number }; Returns: Json }
      coach_list_post_program_members: {
        Args: { _filter?: string }
        Returns: Json
      }
      coach_recommend_post_program_path: {
        Args: {
          _note?: string
          _path: Database["public"]["Enums"]["diet_post_program_recommendation"]
          _plan_id: string
        }
        Returns: Json
      }
      coach_tag_pattern: {
        Args: { _action: string; _plan_id: string; _tag: string }
        Returns: Json
      }
      complete_chapter: {
        Args: { p_chapter_id: string; p_route_id: string }
        Returns: Json
      }
      complete_ending: {
        Args: { p_ending_code: string; p_route_id: string }
        Returns: Json
      }
      complete_tutorial_and_grant_reward: { Args: never; Returns: Json }
      complete_tutorial_once: { Args: { _final_step?: number }; Returns: Json }
      contribute_to_gym_raid: {
        Args: { p_source_id?: string; p_source_type: string }
        Returns: Json
      }
      create_diet_coach_note: {
        Args: {
          _enrollment_id: string
          _note_text: string
          _related_log_id?: string
          _template_type?: Database["public"]["Enums"]["diet_coach_note_template"]
          _visibility?: string
        }
        Returns: Json
      }
      create_notification: {
        Args: { _body?: string; _title: string; _user_id: string }
        Returns: string
      }
      delete_journal_comment: {
        Args: { p_comment_id: string }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      early_start_post_program: {
        Args: { _enrollment_id: string }
        Returns: Json
      }
      end_cornerman_pair: { Args: { p_pair_id: string }; Returns: Json }
      end_extend_cycle: {
        Args: { _plan_id: string; _result: string }
        Returns: Json
      }
      enroll_diet_program: {
        Args: { _coach_assigned_id?: string; _screening_id: string }
        Returns: Json
      }
      ensure_boxing_engagement_profile: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      ensure_post_program_plan: {
        Args: { _enrollment_id: string }
        Returns: Json
      }
      enter_master_track: { Args: { _member_id: string }; Returns: Json }
      equip_avatar_item: { Args: { _item_id: string }; Returns: undefined }
      get_153_challenge_leaderboard: {
        Args: { p_limit?: number; p_period?: string }
        Returns: {
          branch_name: string
          display_name: string
          is_me: boolean
          rank: number
          score: number
          user_id: string
        }[]
      }
      get_active_gym_raids: { Args: never; Returns: Json }
      get_boss_conquerors: {
        Args: { _branch_name?: string; _limit?: number }
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
      get_boxing_iq_league_summary: { Args: never; Returns: Json }
      get_branch_stats: { Args: { _branch_name: string }; Returns: Json }
      get_caller_age: { Args: never; Returns: number }
      get_caller_user_level: { Args: never; Returns: number }
      get_coach_quest_dashboard: {
        Args: { p_branch_name?: string }
        Returns: Json
      }
      get_cornerman_candidates: {
        Args: { p_limit?: number }
        Returns: {
          branch_name: string
          current_level: number
          current_rank: string
          display_name: string
          user_id: string
        }[]
      }
      get_customization_required_level: {
        Args: { _category: string; _item_key: string }
        Returns: number
      }
      get_diet_preferences: { Args: never; Returns: Json }
      get_diet_progress: { Args: { _user_id?: string }; Returns: Json }
      get_diet_ranking: {
        Args: { _branch_name: string; _limit?: number }
        Returns: {
          r_approved_days: number
          r_avatar_url: string
          r_best_streak: number
          r_completion_rate: number
          r_habit_score: number
          r_nickname: string
          r_user_id: string
          rank_position: number
        }[]
      }
      get_division_ranking: {
        Args: { _branch_name?: string; _limit?: number }
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
        Args: { _branch_name?: string; _limit?: number }
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
      get_my_153_challenge_rank: {
        Args: { p_period?: string }
        Returns: {
          my_rank: number
          my_score: number
          period: string
          total_participants: number
        }[]
      }
      get_my_boxing_engagement_summary: { Args: never; Returns: Json }
      get_my_branch: { Args: never; Returns: string }
      get_my_cornerman_status: { Args: never; Returns: Json }
      get_my_hidden_mission_progress: { Args: never; Returns: Json }
      get_my_story_rpg_state: { Args: never; Returns: Json }
      get_nutrition_profile: { Args: { _user_id?: string }; Returns: Json }
      get_partner_journal_feed: {
        Args: { p_limit?: number }
        Returns: {
          comment_count: number
          content: string
          created_at: string
          display_name: string
          id: string
          mood: string
          prompt: string
          relation: string
          user_id: string
        }[]
      }
      get_post_program_plan: { Args: { _user_id?: string }; Returns: Json }
      get_quest_xp: {
        Args: { qt: Database["public"]["Enums"]["quest_type"] }
        Returns: number
      }
      get_recent_boxing_conditions: {
        Args: { p_days?: number }
        Returns: {
          condition_type: string
          created_at: string
          energy_level: number | null
          id: string
          note: string | null
          pain_area: string[]
          selected_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "boxing_condition_logs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_return_round_status: { Args: never; Returns: Json }
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
      get_second_cheer_candidates: {
        Args: { p_limit?: number }
        Returns: {
          branch_name: string
          current_level: number
          current_rank: string
          display_name: string
          user_id: string
        }[]
      }
      get_shadow_boxer_snapshot: {
        Args: { p_window_days?: number }
        Returns: Json
      }
      get_signup_providers: {
        Args: { _user_ids: string[] }
        Returns: {
          signup_provider: string
          user_id: string
        }[]
      }
      get_streak_ranking: {
        Args: { _branch_name?: string; _limit?: number }
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
      get_today_boxing_condition: { Args: never; Returns: Json }
      get_tutorial_global_overrides: {
        Args: never
        Returns: {
          custom_steps: Json
          step_order: Json
          step_overrides: Json
          updated_at: string
        }[]
      }
      get_weekly_activity_ranking: {
        Args: { _branch_name?: string; _limit?: number }
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
      grant_gems: {
        Args: { _amount: number; _reason?: string; _user_id: string }
        Returns: undefined
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
      is_caller_in_hall_of_fame: { Args: never; Returns: boolean }
      is_coach_of: {
        Args: { _coach_id: string; _member_id: string }
        Returns: boolean
      }
      is_hof_required_item: {
        Args: { _category: string; _item_key: string }
        Returns: boolean
      }
      is_journal_partner: {
        Args: { p_owner: string; p_viewer: string }
        Returns: boolean
      }
      is_same_branch: { Args: { _user_id: string }; Returns: boolean }
      list_journal_comments: {
        Args: { p_entry_id: string }
        Returns: {
          commenter_name: string
          commenter_user_id: string
          content: string
          created_at: string
          entry_id: string
          id: string
          is_mine: boolean
        }[]
      }
      log_diet_event: {
        Args: { _event_data?: Json; _event_type: string }
        Returns: Json
      }
      manual_level_down: { Args: { _member_id: string }; Returns: Json }
      manual_level_up: { Args: { _member_id: string }; Returns: Json }
      mark_tutorial_skipped: { Args: never; Returns: Json }
      pass_boss_battle: {
        Args: { _coach_note?: string; _member_id: string }
        Returns: Json
      }
      progress_to_scene: {
        Args: {
          p_chapter_id: string
          p_route_id: string
          p_scene_index: number
        }
        Returns: Json
      }
      publish_tutorial_global_overrides: {
        Args: { p_payload: Json }
        Returns: {
          message: string
          success: boolean
          updated_at: string
        }[]
      }
      purchase_avatar_item: { Args: { _item_id: string }; Returns: Json }
      purchase_customization: {
        Args: { p_category: string; p_item_key: string; p_price: number }
        Returns: Json
      }
      purge_my_old_diet_photos: {
        Args: { _older_than_days?: number }
        Returns: Json
      }
      rank_order: {
        Args: { _rank: Database["public"]["Enums"]["rank_name"] }
        Returns: number
      }
      record_attendance: { Args: { _user_id: string }; Returns: undefined }
      record_diet_safety_screening: {
        Args: {
          _consent_accepted: boolean
          _consent_version: number
          _diabetes_medication: boolean
          _eating_disorder_risk: boolean
          _other_conditions: string
          _pregnancy_breastfeeding: boolean
        }
        Returns: Json
      }
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
      request_cornerman_pair: {
        Args: { p_receiver_user_id: string }
        Returns: Json
      }
      request_mission_revision: {
        Args: { _coach_note?: string; _submission_id: string }
        Returns: undefined
      }
      reset_story_route: { Args: { p_route_id: string }; Returns: Json }
      resolve_diet_track: {
        Args: never
        Returns: Database["public"]["Enums"]["diet_track"]
      }
      respond_cornerman_pair: {
        Args: { p_action: string; p_pair_id: string }
        Returns: Json
      }
      restart_tutorial: { Args: never; Returns: Json }
      review_diet_log: {
        Args: {
          _action: Database["public"]["Enums"]["diet_log_status"]
          _feedback?: string
          _log_id: string
        }
        Returns: Json
      }
      save_member_customization: {
        Args: { _customization: Json; _style: string }
        Returns: Json
      }
      select_post_program_path: {
        Args: {
          _extension_cycle_length?: number
          _maintenance_target_waist_cm?: number
          _maintenance_target_weight_kg?: number
          _path: Database["public"]["Enums"]["diet_post_program_path"]
          _plan_id: string
          _target_achieved?: boolean
        }
        Returns: Json
      }
      send_boxing_cheer: {
        Args: {
          p_cheer_type: string
          p_message?: string
          p_receiver_user_id: string
          p_source_id?: string
          p_source_type?: string
        }
        Returns: Json
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
      spend_gems: {
        Args: { _amount: number; _reason?: string; _user_id: string }
        Returns: undefined
      }
      start_battle: {
        Args: { p_chapter_id: string; p_enemy_code: string }
        Returns: Json
      }
      start_story_session: { Args: never; Returns: Json }
      submit_boxing_condition: {
        Args: {
          p_condition_type: string
          p_energy_level?: number
          p_note?: string
          p_pain_area?: string[]
        }
        Returns: Json
      }
      submit_boxing_fun_challenge_attempt: {
        Args: {
          p_challenge_id: string
          p_difficulty: string
          p_note?: string
          p_pain_check_passed?: boolean
          p_submitted_value: number
        }
        Returns: Json
      }
      submit_boxing_quiz_attempt: {
        Args: { p_question_id: string; p_selected_answer: string }
        Returns: Json
      }
      submit_champion_journal_entry: {
        Args: { p_content: string; p_mood?: string; p_prompt: string }
        Returns: Json
      }
      submit_diet_daily_log: {
        Args: { _habits: Json; _log_date: string; _note?: string }
        Returns: Json
      }
      submit_diet_weekly_review: {
        Args: {
          _body_photo_url?: string
          _enrollment_id: string
          _next_week_focus?: string
          _reflection?: string
          _waist_cm?: number
          _week_index: number
        }
        Returns: Json
      }
      submit_extend_reassessment: {
        Args: {
          _biggest_obstacle: string
          _eating_out_weekly: number
          _extend_goals: Json
          _late_binge_weekly: number
          _plan_id: string
          _recent_21d_adherence: number
          _sleep_hours: number
          _user_pattern_overrides?: string[]
          _weakest_habit: string
          _weekly_workouts: number
        }
        Returns: Json
      }
      submit_player_command: {
        Args: { p_command: string; p_target_data: Json }
        Returns: Json
      }
      submit_post_program_checkin: {
        Args: {
          _adherence_score?: number
          _attended_workouts?: number
          _flexible_meals_count?: number
          _late_binge_count?: number
          _plan_id: string
          _protein_first_days?: number
          _reflection?: string
          _waist_cm?: number
          _week_index: number
          _weight_kg?: number
        }
        Returns: Json
      }
      tutorial_step_reward_amount: { Args: { _step: number }; Returns: number }
      unequip_avatar_item: {
        Args: { _category_code: string }
        Returns: undefined
      }
      update_diet_enrollment_status: {
        Args: {
          _enrollment_id: string
          _next_status: Database["public"]["Enums"]["diet_enrollment_status"]
        }
        Returns: Json
      }
      update_last_unlock_check_level: {
        Args: { _level: number }
        Returns: number
      }
      update_tutorial_step: { Args: { _step: number }; Returns: number }
      upsert_diet_preferences: { Args: { _settings: Json }; Returns: Json }
      upsert_nutrition_profile: {
        Args: {
          _activity_level: string
          _dietary_restrictions?: string[]
          _disliked_ingredients?: string[]
          _height_cm: number
          _meals_per_day?: number
          _sex: string
          _target_weight_kg: number
          _weight_kg: number
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "member" | "coach" | "admin" | "branch_manager" | "super_admin"
      diet_age_group: "youth" | "adult"
      diet_coach_note_template:
        | "general"
        | "warning"
        | "celebration"
        | "correction"
        | "weekly"
      diet_enrollment_status:
        | "not_started"
        | "active"
        | "paused"
        | "completed"
        | "dropped"
      diet_log_status:
        | "pending"
        | "approved"
        | "rejected"
        | "revision_requested"
      diet_meal_slot: "breakfast" | "lunch" | "dinner" | "snack"
      diet_post_program_follow_up:
        | "pending"
        | "active"
        | "paused"
        | "abandoned"
        | "succeeded"
      diet_post_program_path: "pending" | "maintenance" | "extend"
      diet_post_program_recommendation: "maintenance" | "extend" | "either"
      diet_stage: "reset" | "burning" | "lifestyle"
      diet_track: "adult_standard" | "adult_advanced_hidden" | "youth_habit"
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
      diet_age_group: ["youth", "adult"],
      diet_coach_note_template: [
        "general",
        "warning",
        "celebration",
        "correction",
        "weekly",
      ],
      diet_enrollment_status: [
        "not_started",
        "active",
        "paused",
        "completed",
        "dropped",
      ],
      diet_log_status: [
        "pending",
        "approved",
        "rejected",
        "revision_requested",
      ],
      diet_meal_slot: ["breakfast", "lunch", "dinner", "snack"],
      diet_post_program_follow_up: [
        "pending",
        "active",
        "paused",
        "abandoned",
        "succeeded",
      ],
      diet_post_program_path: ["pending", "maintenance", "extend"],
      diet_post_program_recommendation: ["maintenance", "extend", "either"],
      diet_stage: ["reset", "burning", "lifestyle"],
      diet_track: ["adult_standard", "adult_advanced_hidden", "youth_habit"],
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
