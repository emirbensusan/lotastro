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
      lot_queue: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          entry_date: string
          id: string
          lot_number: string
          meters: number
          qr_code_url: string | null
          quality: string
          status: string
          updated_at: string
          warehouse_location: string
        }
        Insert: {
          color: string
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          lot_number: string
          meters: number
          qr_code_url?: string | null
          quality: string
          status?: string
          updated_at?: string
          warehouse_location: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          lot_number?: string
          meters?: number
          qr_code_url?: string | null
          quality?: string
          status?: string
          updated_at?: string
          warehouse_location?: string
        }
        Relationships: []
      }
      lots: {
        Row: {
          color: string
          created_at: string
          entry_date: string
          id: string
          invoice_date: string | null
          invoice_number: string | null
          lot_number: string
          meters: number
          notes: string | null
          production_date: string | null
          qr_code_url: string | null
          quality: string
          roll_count: number
          status: Database["public"]["Enums"]["stock_status"]
          supplier_id: string
          updated_at: string
          warehouse_location: string | null
        }
        Insert: {
          color: string
          created_at?: string
          entry_date?: string
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          lot_number: string
          meters: number
          notes?: string | null
          production_date?: string | null
          qr_code_url?: string | null
          quality: string
          roll_count?: number
          status?: Database["public"]["Enums"]["stock_status"]
          supplier_id: string
          updated_at?: string
          warehouse_location?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          entry_date?: string
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          lot_number?: string
          meters?: number
          notes?: string | null
          production_date?: string | null
          qr_code_url?: string | null
          quality?: string
          roll_count?: number
          status?: Database["public"]["Enums"]["stock_status"]
          supplier_id?: string
          updated_at?: string
          warehouse_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lots_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      order_lots: {
        Row: {
          color: string
          created_at: string
          id: string
          line_type: Database["public"]["Enums"]["order_line_type"]
          lot_id: string
          order_id: string
          quality: string
          roll_count: number
          selected_roll_ids: string | null
          selected_roll_meters: string | null
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          line_type?: Database["public"]["Enums"]["order_line_type"]
          lot_id: string
          order_id: string
          quality: string
          roll_count: number
          selected_roll_ids?: string | null
          selected_roll_meters?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          line_type?: Database["public"]["Enums"]["order_line_type"]
          lot_id?: string
          order_id?: string
          quality?: string
          roll_count?: number
          selected_roll_ids?: string | null
          selected_roll_meters?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_lots_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lots_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_queue: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          order_id: string
          rejection_reason: string | null
          status: string
          submitted_at: string
          submitted_by: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          order_id: string
          rejection_reason?: string | null
          status?: string
          submitted_at?: string
          submitted_by: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          order_id?: string
          rejection_reason?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_queue_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          created_by: string
          customer_name: string
          fulfilled_at: string | null
          fulfilled_by: string | null
          id: string
          order_number: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          customer_name: string
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          id?: string
          order_number?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          customer_name?: string
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          id?: string
          order_number?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          is_allowed: boolean
          permission_action: string
          permission_category: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_allowed?: boolean
          permission_action: string
          permission_category: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_allowed?: boolean
          permission_action?: string
          permission_category?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      rolls: {
        Row: {
          created_at: string
          id: string
          lot_id: string
          meters: number
          position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lot_id: string
          meters: number
          position: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lot_id?: string
          meters?: number
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rolls_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_dashboard_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          oldest_lot_days: number
          pending_orders: number
          total_in_stock_lots: number
          total_meters: number
          total_out_of_stock_lots: number
          total_rolls: number
        }[]
      }
      get_inventory_pivot_summary: {
        Args: Record<PropertyKey, never>
        Returns: {
          color: string
          lot_count: number
          quality: string
          total_meters: number
          total_rolls: number
        }[]
      }
      get_inventory_stats_summary: {
        Args: Record<PropertyKey, never>
        Returns: {
          total_lots: number
          total_meters: number
          total_rolls: number
        }[]
      }
      get_user_role: {
        Args: { user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      has_role: {
        Args: {
          required_role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      order_line_type: "sample" | "standard"
      stock_status: "in_stock" | "out_of_stock" | "partially_fulfilled"
      user_role: "warehouse_staff" | "accounting" | "admin" | "senior_manager"
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
      order_line_type: ["sample", "standard"],
      stock_status: ["in_stock", "out_of_stock", "partially_fulfilled"],
      user_role: ["warehouse_staff", "accounting", "admin", "senior_manager"],
    },
  },
} as const
