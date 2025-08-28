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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      current_round: {
        Row: {
          away: string | null
          away_id: number | null
          away_logo: string | null
          date: string | null
          game_id: number
          home: string | null
          home_id: number | null
          home_logo: string | null
          id: string
          round: number | null
          score: string | null
          time: string | null
        }
        Insert: {
          away?: string | null
          away_id?: number | null
          away_logo?: string | null
          date?: string | null
          game_id: number
          home?: string | null
          home_id?: number | null
          home_logo?: string | null
          id?: string
          round?: number | null
          score?: string | null
          time?: string | null
        }
        Update: {
          away?: string | null
          away_id?: number | null
          away_logo?: string | null
          date?: string | null
          game_id?: number
          home?: string | null
          home_id?: number | null
          home_logo?: string | null
          id?: string
          round?: number | null
          score?: string | null
          time?: string | null
        }
        Relationships: []
      }
      games: {
        Row: {
          away_goals: number | null
          away_id: string
          away_logo: string | null
          away_name: string
          created_at: string | null
          events_url: string
          game_id: number
          home_goals: number | null
          home_id: string
          home_logo: string | null
          home_name: string
          id: string
          round: number
          time: string | null
          updated_at: string | null
        }
        Insert: {
          away_goals?: number | null
          away_id: string
          away_logo?: string | null
          away_name: string
          created_at?: string | null
          events_url: string
          game_id: number
          home_goals?: number | null
          home_id: string
          home_logo?: string | null
          home_name: string
          id?: string
          round: number
          time?: string | null
          updated_at?: string | null
        }
        Update: {
          away_goals?: number | null
          away_id?: string
          away_logo?: string | null
          away_name?: string
          created_at?: string | null
          events_url?: string
          game_id?: number
          home_goals?: number | null
          home_id?: string
          home_logo?: string | null
          home_name?: string
          id?: string
          round?: number
          time?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      leaderboard: {
        Row: {
          created_at: string
          id: number
          points: number | null
          username: string | null
        }
        Insert: {
          created_at?: string
          id: number
          points?: number | null
          username?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          points?: number | null
          username?: string | null
        }
        Relationships: []
      }
      memory: {
        Row: {
          created_at: string
          id: string
          session: string | null
        }
        Insert: {
          created_at?: string
          id: string
          session?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          session?: string | null
        }
        Relationships: []
      }
      predictions: {
        Row: {
          away_goals: number | null
          away_team: string | null
          created_at: string
          game_id: number | null
          home_goals: number | null
          home_team: string | null
          id: string
          round: number | null
          status: Database["public"]["Enums"]["status"] | null
          user_id: number | null
          username: string | null
        }
        Insert: {
          away_goals?: number | null
          away_team?: string | null
          created_at?: string
          game_id?: number | null
          home_goals?: number | null
          home_team?: string | null
          id?: string
          round?: number | null
          status?: Database["public"]["Enums"]["status"] | null
          user_id?: number | null
          username?: string | null
        }
        Update: {
          away_goals?: number | null
          away_team?: string | null
          created_at?: string
          game_id?: number | null
          home_goals?: number | null
          home_team?: string | null
          id?: string
          round?: number | null
          status?: Database["public"]["Enums"]["status"] | null
          user_id?: number | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      status: "score" | "difference" | "winner"
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
      status: ["score", "difference", "winner"],
    },
  },
} as const
