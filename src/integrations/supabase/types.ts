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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          last_used_at: string | null
          name: string
          owner_id: string
          prefix: string
          revoked_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          last_used_at?: string | null
          name: string
          owner_id?: string
          prefix: string
          revoked_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          last_used_at?: string | null
          name?: string
          owner_id?: string
          prefix?: string
          revoked_at?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          archived_at: string | null
          color: string
          created_at: string
          icon: string
          id: string
          name: string
          owner_id: string
          parent_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          color?: string
          created_at?: string
          icon?: string
          id?: string
          name: string
          owner_id?: string
          parent_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          color?: string
          created_at?: string
          icon?: string
          id?: string
          name?: string
          owner_id?: string
          parent_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_owner_id_parent_id_fkey"
            columns: ["owner_id", "parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["owner_id", "id"]
          },
        ]
      }
      cleanup_jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          id: string
          kind: string
          last_error: string | null
          object_paths: string[]
          state: string
          transaction_id: string | null
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          kind: string
          last_error?: string | null
          object_paths?: string[]
          state?: string
          transaction_id?: string | null
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          kind?: string
          last_error?: string | null
          object_paths?: string[]
          state?: string
          transaction_id?: string | null
        }
        Relationships: []
      }
      monthly_budgets: {
        Row: {
          amount_vnd: number
          created_at: string
          id: string
          month: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          amount_vnd: number
          created_at?: string
          id?: string
          month: string
          owner_id?: string
          updated_at?: string
        }
        Update: {
          amount_vnd?: number
          created_at?: string
          id?: string
          month?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          accent: string
          avatar_path: string | null
          created_at: string
          display_name: string | null
          font: string
          hide_amounts: boolean
          id: string
          theme: string
          tutorial_status: string
          updated_at: string
        }
        Insert: {
          accent?: string
          avatar_path?: string | null
          created_at?: string
          display_name?: string | null
          font?: string
          hide_amounts?: boolean
          id: string
          theme?: string
          tutorial_status?: string
          updated_at?: string
        }
        Update: {
          accent?: string
          avatar_path?: string | null
          created_at?: string
          display_name?: string | null
          font?: string
          hide_amounts?: boolean
          id?: string
          theme?: string
          tutorial_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      telegram_codes: {
        Row: {
          approved_user_id: string | null
          code_hash: string
          created_at: string
          expires_at: string
          poll_hash: string | null
          purpose: string
          status: string
          user_id: string | null
        }
        Insert: {
          approved_user_id?: string | null
          code_hash: string
          created_at?: string
          expires_at?: string
          poll_hash?: string | null
          purpose: string
          status?: string
          user_id?: string | null
        }
        Update: {
          approved_user_id?: string | null
          code_hash?: string
          created_at?: string
          expires_at?: string
          poll_hash?: string | null
          purpose?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      telegram_drafts: {
        Row: {
          chat_id: number
          created_at: string
          draft: Json
          id: string
          message_id: number | null
          user_id: string
        }
        Insert: {
          chat_id: number
          created_at?: string
          draft: Json
          id?: string
          message_id?: number | null
          user_id: string
        }
        Update: {
          chat_id?: number
          created_at?: string
          draft?: Json
          id?: string
          message_id?: number | null
          user_id?: string
        }
        Relationships: []
      }
      telegram_links: {
        Row: {
          budget_alert_level: number
          budget_alert_month: string | null
          chat_id: number
          first_name: string | null
          last_daily_on: string | null
          last_reminder_on: string | null
          last_weekly_on: string | null
          linked_at: string
          notify_budget: boolean
          notify_daily: boolean
          notify_reminder: boolean
          notify_weekly: boolean
          user_id: string
          username: string | null
        }
        Insert: {
          budget_alert_level?: number
          budget_alert_month?: string | null
          chat_id: number
          first_name?: string | null
          last_daily_on?: string | null
          last_reminder_on?: string | null
          last_weekly_on?: string | null
          linked_at?: string
          notify_budget?: boolean
          notify_daily?: boolean
          notify_reminder?: boolean
          notify_weekly?: boolean
          user_id: string
          username?: string | null
        }
        Update: {
          budget_alert_level?: number
          budget_alert_month?: string | null
          chat_id?: number
          first_name?: string | null
          last_daily_on?: string | null
          last_reminder_on?: string | null
          last_weekly_on?: string | null
          linked_at?: string
          notify_budget?: boolean
          notify_daily?: boolean
          notify_reminder?: boolean
          notify_weekly?: boolean
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_updates: {
        Row: {
          created_at: string
          update_id: number
        }
        Insert: {
          created_at?: string
          update_id: number
        }
        Update: {
          created_at?: string
          update_id?: number
        }
        Relationships: []
      }
      transaction_photos: {
        Row: {
          created_at: string
          id: string
          original_path: string
          owner_id: string
          sort_order: number
          thumb_path: string
          transaction_id: string
        }
        Insert: {
          created_at?: string
          id: string
          original_path: string
          owner_id: string
          sort_order?: number
          thumb_path: string
          transaction_id: string
        }
        Update: {
          created_at?: string
          id?: string
          original_path?: string
          owner_id?: string
          sort_order?: number
          thumb_path?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_photos_owner_id_transaction_id_fkey"
            columns: ["owner_id", "transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["owner_id", "id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount_vnd: number
          category_id: string | null
          create_fingerprint: string
          created_at: string
          deleted_at: string | null
          dest_wallet_id: string | null
          id: string
          note: string | null
          occurred_at: string
          owner_id: string
          source_wallet_id: string | null
          type: string
          updated_at: string
          version: number
        }
        Insert: {
          amount_vnd: number
          category_id?: string | null
          create_fingerprint: string
          created_at?: string
          deleted_at?: string | null
          dest_wallet_id?: string | null
          id: string
          note?: string | null
          occurred_at: string
          owner_id: string
          source_wallet_id?: string | null
          type: string
          updated_at?: string
          version?: number
        }
        Update: {
          amount_vnd?: number
          category_id?: string | null
          create_fingerprint?: string
          created_at?: string
          deleted_at?: string | null
          dest_wallet_id?: string | null
          id?: string
          note?: string | null
          occurred_at?: string
          owner_id?: string
          source_wallet_id?: string | null
          type?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "transactions_owner_id_category_id_fkey"
            columns: ["owner_id", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["owner_id", "id"]
          },
          {
            foreignKeyName: "transactions_owner_id_dest_wallet_id_fkey"
            columns: ["owner_id", "dest_wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["owner_id", "id"]
          },
          {
            foreignKeyName: "transactions_owner_id_source_wallet_id_fkey"
            columns: ["owner_id", "source_wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["owner_id", "id"]
          },
        ]
      }
      wallets: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          kind: string
          name: string
          opening_at: string
          opening_balance_vnd: number
          owner_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          kind: string
          name: string
          opening_at?: string
          opening_balance_vnd?: number
          owner_id?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          kind?: string
          name?: string
          opening_at?: string
          opening_balance_vnd?: number
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _agent_dispatch: {
        Args: { p_action: string; p_args: Json; uid: string }
        Returns: Json
      }
      _photos_validate: {
        Args: { _photos: Json; _tx: string; _uid: string }
        Returns: undefined
      }
      _tx_validate: {
        Args: {
          _amount: number
          _at: string
          _cat: string
          _dst: string
          _note: string
          _old_cat: string
          _old_dst: string
          _old_src: string
          _src: string
          _type: string
          _uid: string
        }
        Returns: undefined
      }
      api_dispatch: {
        Args: { p_action: string; p_args: Json; p_key: string }
        Returns: Json
      }
      archive_category: {
        Args: { p_archived: boolean; p_id: string }
        Returns: undefined
      }
      archive_wallet: {
        Args: { p_archived: boolean; p_id: string }
        Returns: undefined
      }
      claim_expired_trash: { Args: { p_limit?: number }; Returns: number }
      commit_transaction: {
        Args: {
          p_amount: number
          p_category: string
          p_dest: string
          p_id: string
          p_note: string
          p_occurred_at: string
          p_photos: Json
          p_source: string
          p_type: string
        }
        Returns: Json
      }
      create_api_key: { Args: { p_name: string }; Returns: Json }
      create_category: {
        Args: {
          p_icon: string
          p_name: string
          p_parent_id: string
          p_type: string
        }
        Returns: string
      }
      create_wallet: {
        Args: {
          p_kind: string
          p_name: string
          p_opening_at: string
          p_opening_balance_vnd: number
        }
        Returns: string
      }
      delete_monthly_budget: { Args: { p_month: string }; Returns: undefined }
      find_orphan_objects: {
        Args: { p_limit?: number }
        Returns: {
          name: string
        }[]
      }
      month_category_expense: {
        Args: { p_month: string }
        Returns: {
          category_id: string
          total_vnd: number
        }[]
      }
      month_daily: {
        Args: { p_month: string }
        Returns: {
          day: string
          expense_vnd: number
          income_vnd: number
        }[]
      }
      month_summary: {
        Args: { p_month: string; p_wallet?: string }
        Returns: {
          all_wallets_expense_vnd: number
          budget_vnd: number
          expense_vnd: number
          income_vnd: number
        }[]
      }
      rename_wallet: {
        Args: { p_id: string; p_name: string }
        Returns: undefined
      }
      restore_transaction: {
        Args: { p_id: string; p_version: number }
        Returns: Json
      }
      revoke_api_key: { Args: { p_id: string }; Returns: undefined }
      telegram_set_prefs: {
        Args: {
          p_budget: boolean
          p_daily: boolean
          p_reminder: boolean
          p_weekly: boolean
        }
        Returns: undefined
      }
      telegram_unlink: { Args: never; Returns: undefined }
      trash_transaction: {
        Args: { p_id: string; p_version: number }
        Returns: Json
      }
      update_profile: { Args: { p_patch: Json }; Returns: undefined }
      update_transaction: {
        Args: {
          p_amount: number
          p_category: string
          p_dest: string
          p_id: string
          p_note: string
          p_occurred_at: string
          p_photos: Json
          p_source: string
          p_version: number
        }
        Returns: Json
      }
      upsert_monthly_budget: {
        Args: { p_amount_vnd: number; p_month: string }
        Returns: string
      }
      wallet_balances: {
        Args: never
        Returns: {
          balance_vnd: number
          wallet_id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
