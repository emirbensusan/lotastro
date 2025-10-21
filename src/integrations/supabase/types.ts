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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action_type"]
          changed_fields: Json | null
          created_at: string | null
          entity_id: string
          entity_identifier: string | null
          entity_type: Database["public"]["Enums"]["audit_entity_type"]
          id: string
          is_reversed: boolean | null
          new_data: Json | null
          notes: string | null
          old_data: Json | null
          reversal_audit_id: string | null
          reversed_at: string | null
          reversed_by: string | null
          user_email: string
          user_id: string
          user_role: string
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action_type"]
          changed_fields?: Json | null
          created_at?: string | null
          entity_id: string
          entity_identifier?: string | null
          entity_type: Database["public"]["Enums"]["audit_entity_type"]
          id?: string
          is_reversed?: boolean | null
          new_data?: Json | null
          notes?: string | null
          old_data?: Json | null
          reversal_audit_id?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          user_email: string
          user_id: string
          user_role: string
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action_type"]
          changed_fields?: Json | null
          created_at?: string | null
          entity_id?: string
          entity_identifier?: string | null
          entity_type?: Database["public"]["Enums"]["audit_entity_type"]
          id?: string
          is_reversed?: boolean | null
          new_data?: Json | null
          notes?: string | null
          old_data?: Json | null
          reversal_audit_id?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          user_email?: string
          user_id?: string
          user_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_reversal_audit_id_fkey"
            columns: ["reversal_audit_id"]
            isOneToOne: false
            referencedRelation: "audit_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      field_edit_queue: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          field_name: string
          id: string
          new_value: string
          old_value: string | null
          record_id: string
          rejection_reason: string | null
          status: string
          submitted_at: string
          submitted_by: string
          table_name: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          field_name: string
          id?: string
          new_value: string
          old_value?: string | null
          record_id: string
          rejection_reason?: string | null
          status?: string
          submitted_at?: string
          submitted_by: string
          table_name: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          field_name?: string
          id?: string
          new_value?: string
          old_value?: string | null
          record_id?: string
          rejection_reason?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string
          table_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      goods_in_receipts: {
        Row: {
          created_at: string
          defect_notes: string | null
          id: string
          incoming_stock_id: string | null
          received_at: string
          received_by: string
        }
        Insert: {
          created_at?: string
          defect_notes?: string | null
          id?: string
          incoming_stock_id?: string | null
          received_at?: string
          received_by: string
        }
        Update: {
          created_at?: string
          defect_notes?: string | null
          id?: string
          incoming_stock_id?: string | null
          received_at?: string
          received_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "goods_in_receipts_incoming_stock_id_fkey"
            columns: ["incoming_stock_id"]
            isOneToOne: false
            referencedRelation: "incoming_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_in_receipts_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      goods_in_rows: {
        Row: {
          color: string
          created_at: string
          id: string
          lot_id: string
          meters: number
          quality: string
          receipt_id: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          lot_id: string
          meters: number
          quality: string
          receipt_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          lot_id?: string
          meters?: number
          quality?: string
          receipt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goods_in_rows_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_in_rows_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "goods_in_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      incoming_stock: {
        Row: {
          color: string
          created_at: string
          created_by: string
          expected_arrival_date: string | null
          expected_meters: number
          id: string
          invoice_date: string | null
          invoice_number: string | null
          notes: string | null
          quality: string
          received_meters: number
          reserved_meters: number
          status: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          color: string
          created_at?: string
          created_by: string
          expected_arrival_date?: string | null
          expected_meters: number
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          notes?: string | null
          quality: string
          received_meters?: number
          reserved_meters?: number
          status?: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string
          expected_arrival_date?: string | null
          expected_meters?: number
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          notes?: string | null
          quality?: string
          received_meters?: number
          reserved_meters?: number
          status?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incoming_stock_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "incoming_stock_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
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
          reserved_meters: number
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
          reserved_meters?: number
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
          reserved_meters?: number
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
          active: boolean
          created_at: string
          deleted_at: string | null
          email: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          email: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reservation_lines: {
        Row: {
          color: string
          created_at: string
          id: string
          incoming_stock_id: string | null
          lot_id: string | null
          quality: string
          reservation_id: string
          reserved_meters: number
          roll_ids: string | null
          scope: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          incoming_stock_id?: string | null
          lot_id?: string | null
          quality: string
          reservation_id: string
          reserved_meters: number
          roll_ids?: string | null
          scope: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          incoming_stock_id?: string | null
          lot_id?: string | null
          quality?: string
          reservation_id?: string
          reserved_meters?: number
          roll_ids?: string | null
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_lines_incoming_stock_id_fkey"
            columns: ["incoming_stock_id"]
            isOneToOne: false
            referencedRelation: "incoming_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_lines_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_lines_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          cancel_other_text: string | null
          cancel_reason:
            | Database["public"]["Enums"]["cancel_reason_type"]
            | null
          canceled_at: string | null
          canceled_by: string | null
          convert_reason:
            | Database["public"]["Enums"]["convert_reason_type"]
            | null
          converted_at: string | null
          converted_by: string | null
          created_at: string
          created_by: string
          customer_id: string | null
          customer_name: string
          hold_until: string | null
          id: string
          notes: string | null
          reservation_number: string
          reserved_date: string
          status: Database["public"]["Enums"]["reservation_status"]
          updated_at: string
        }
        Insert: {
          cancel_other_text?: string | null
          cancel_reason?:
            | Database["public"]["Enums"]["cancel_reason_type"]
            | null
          canceled_at?: string | null
          canceled_by?: string | null
          convert_reason?:
            | Database["public"]["Enums"]["convert_reason_type"]
            | null
          converted_at?: string | null
          converted_by?: string | null
          created_at?: string
          created_by: string
          customer_id?: string | null
          customer_name: string
          hold_until?: string | null
          id?: string
          notes?: string | null
          reservation_number?: string
          reserved_date?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Update: {
          cancel_other_text?: string | null
          cancel_reason?:
            | Database["public"]["Enums"]["cancel_reason_type"]
            | null
          canceled_at?: string | null
          canceled_by?: string | null
          convert_reason?:
            | Database["public"]["Enums"]["convert_reason_type"]
            | null
          converted_at?: string | null
          converted_by?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          customer_name?: string
          hold_until?: string | null
          id?: string
          notes?: string | null
          reservation_number?: string
          reserved_date?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_canceled_by_fkey"
            columns: ["canceled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reservations_converted_by_fkey"
            columns: ["converted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reservations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
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
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lot_id: string
          meters: number
          position: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lot_id?: string
          meters?: number
          position?: number
          status?: string
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
      user_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          email_error: string | null
          email_sent: boolean | null
          expires_at: string
          id: string
          invite_link: string | null
          invited_at: string
          invited_by: string
          last_attempt_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          email_error?: string | null
          email_sent?: boolean | null
          expires_at?: string
          id?: string
          invite_link?: string | null
          invited_at?: string
          invited_by: string
          last_attempt_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: string
          token: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          email_error?: string | null
          email_sent?: boolean | null
          expires_at?: string
          id?: string
          invite_link?: string | null
          invited_at?: string
          invited_by?: string
          last_attempt_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_reverse_action: {
        Args:
          | { p_audit_id: string }
          | { p_audit_id: string; p_bypass_auth_check?: boolean }
        Returns: {
          can_reverse: boolean
          reason: string
          reversal_strategy: string
        }[]
      }
      check_user_dependencies: {
        Args: { target_user_id: string }
        Returns: {
          dependency_count: number
          table_name: string
        }[]
      }
      generate_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_reservation_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_available_rolls_count: {
        Args: { p_lot_id: string }
        Returns: number
      }
      get_available_rolls_meters: {
        Args: { p_lot_id: string }
        Returns: number
      }
      get_dashboard_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          active_reservations_count: number
          oldest_lot_days: number
          pending_orders: number
          total_in_stock_lots: number
          total_incoming_meters: number
          total_meters: number
          total_out_of_stock_lots: number
          total_reserved_meters: number
          total_rolls: number
        }[]
      }
      get_incoming_reserved_stock_summary: {
        Args: Record<PropertyKey, never>
        Returns: {
          color: string
          customer_name: string
          expected_meters: number
          incoming_stock_id: string
          quality: string
          reservation_number: string
          reserved_meters: number
          supplier_name: string
        }[]
      }
      get_incoming_stock_summary: {
        Args: Record<PropertyKey, never>
        Returns: {
          color: string
          expected_meters: number
          incoming_stock_id: string
          invoice_number: string
          open_meters: number
          quality: string
          received_meters: number
          reserved_meters: number
          status: string
          supplier_name: string
        }[]
      }
      get_inventory_pivot_summary: {
        Args: Record<PropertyKey, never>
        Returns: {
          available_meters: number
          color: string
          incoming_meters: number
          incoming_reserved_meters: number
          lot_count: number
          normalized_quality: string
          physical_reserved_meters: number
          quality: string
          total_meters: number
          total_reserved_meters: number
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
      get_inventory_with_reservations: {
        Args: Record<PropertyKey, never>
        Returns: {
          available_meters: number
          color: string
          incoming_meters: number
          incoming_reserved_meters: number
          instock_meters: number
          physical_reserved_meters: number
          quality: string
          total_reserved_meters: number
        }[]
      }
      get_lots_by_normalized_quality: {
        Args: { target_normalized_quality: string }
        Returns: {
          color: string
          meters: number
          quality: string
          roll_count: number
        }[]
      }
      get_reservations_summary: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_by_name: string
          customer_name: string
          lines_count: number
          reservation_id: string
          reservation_number: string
          reserved_date: string
          status: Database["public"]["Enums"]["reservation_status"]
          total_reserved_meters: number
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
      log_audit_action: {
        Args: {
          p_action: Database["public"]["Enums"]["audit_action_type"]
          p_changed_fields?: Json
          p_entity_id: string
          p_entity_identifier: string
          p_entity_type: Database["public"]["Enums"]["audit_entity_type"]
          p_new_data?: Json
          p_notes?: string
          p_old_data?: Json
        }
        Returns: string
      }
      log_security_event: {
        Args: {
          details?: Json
          event_type: string
          target_user_id?: string
          user_id: string
        }
        Returns: undefined
      }
      normalize_quality: {
        Args: { quality_input: string }
        Returns: string
      }
    }
    Enums: {
      audit_action_type:
        | "CREATE"
        | "UPDATE"
        | "DELETE"
        | "STATUS_CHANGE"
        | "FULFILL"
        | "APPROVE"
        | "REJECT"
      audit_entity_type:
        | "lot"
        | "roll"
        | "order"
        | "order_lot"
        | "supplier"
        | "lot_queue"
        | "order_queue"
        | "field_edit_queue"
        | "profile"
        | "role_permission"
      cancel_reason_type:
        | "no_payment"
        | "customer_canceled"
        | "incorrect_entry"
        | "other"
      convert_reason_type: "payment_confirmation" | "manager_confirmation"
      order_line_type: "sample" | "standard"
      reservation_status: "active" | "released" | "converted" | "canceled"
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
      audit_action_type: [
        "CREATE",
        "UPDATE",
        "DELETE",
        "STATUS_CHANGE",
        "FULFILL",
        "APPROVE",
        "REJECT",
      ],
      audit_entity_type: [
        "lot",
        "roll",
        "order",
        "order_lot",
        "supplier",
        "lot_queue",
        "order_queue",
        "field_edit_queue",
        "profile",
        "role_permission",
      ],
      cancel_reason_type: [
        "no_payment",
        "customer_canceled",
        "incorrect_entry",
        "other",
      ],
      convert_reason_type: ["payment_confirmation", "manager_confirmation"],
      order_line_type: ["sample", "standard"],
      reservation_status: ["active", "released", "converted", "canceled"],
      stock_status: ["in_stock", "out_of_stock", "partially_fulfilled"],
      user_role: ["warehouse_staff", "accounting", "admin", "senior_manager"],
    },
  },
} as const
