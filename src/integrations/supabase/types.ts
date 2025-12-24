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
      admin_ip_whitelist: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          ip_address: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          ip_address: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          ip_address?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          created_at: string
          draft_id: string | null
          id: number
          tokens_in: number | null
          tokens_out: number | null
          used_vision: boolean | null
        }
        Insert: {
          created_at?: string
          draft_id?: string | null
          id?: number
          tokens_in?: number | null
          tokens_out?: number | null
          used_vision?: boolean | null
        }
        Update: {
          created_at?: string
          draft_id?: string | null
          id?: number
          tokens_in?: number | null
          tokens_out?: number | null
          used_vision?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "po_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
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
      catalog_approval_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      catalog_custom_field_definitions: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          display_order: number | null
          field_key: string
          field_type: string
          help_text: string | null
          id: string
          is_active: boolean
          is_required: boolean
          label: string
          options: Json | null
          scope: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          display_order?: number | null
          field_key: string
          field_type: string
          help_text?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          label: string
          options?: Json | null
          scope?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          display_order?: number | null
          field_key?: string
          field_type?: string
          help_text?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          label?: string
          options?: Json | null
          scope?: string
          updated_at?: string
        }
        Relationships: []
      }
      catalog_custom_field_values: {
        Row: {
          catalog_item_id: string
          created_at: string
          field_definition_id: string
          id: string
          updated_at: string
          value: string | null
        }
        Insert: {
          catalog_item_id: string
          created_at?: string
          field_definition_id: string
          id?: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          catalog_item_id?: string
          created_at?: string
          field_definition_id?: string
          id?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_custom_field_values_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_custom_field_values_field_definition_id_fkey"
            columns: ["field_definition_id"]
            isOneToOne: false
            referencedRelation: "catalog_custom_field_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_item_audit_logs: {
        Row: {
          catalog_item_id: string
          change_type: string
          changed_at: string
          changed_by_user_id: string | null
          field_changes: Json | null
          id: string
        }
        Insert: {
          catalog_item_id: string
          change_type: string
          changed_at?: string
          changed_by_user_id?: string | null
          field_changes?: Json | null
          id?: string
        }
        Update: {
          catalog_item_id?: string
          change_type?: string
          changed_at?: string
          changed_by_user_id?: string | null
          field_changes?: Json | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_item_audit_logs_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_item_suppliers: {
        Row: {
          catalog_item_id: string
          created_at: string
          id: string
          last_update_date: string | null
          lead_time_days: number | null
          moq: number | null
          supplier_code: string | null
          supplier_name: string
          supplier_notes: string | null
          updated_at: string
        }
        Insert: {
          catalog_item_id: string
          created_at?: string
          id?: string
          last_update_date?: string | null
          lead_time_days?: number | null
          moq?: number | null
          supplier_code?: string | null
          supplier_name: string
          supplier_notes?: string | null
          updated_at?: string
        }
        Update: {
          catalog_item_id?: string
          created_at?: string
          id?: string
          last_update_date?: string | null
          lead_time_days?: number | null
          moq?: number | null
          supplier_code?: string | null
          supplier_name?: string
          supplier_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_item_suppliers_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_items: {
        Row: {
          approved_at: string | null
          approved_by_user_id: string | null
          care_instructions: string | null
          code: string
          color_name: string
          composition: Json | null
          created_at: string
          created_by_user_id: string | null
          description: string | null
          dyeing_batch_size: number | null
          eu_origin: boolean | null
          extra_attributes: Json | null
          fabric_type: string | null
          id: string
          is_active: boolean
          last_inbound_date: string | null
          last_update_date: string | null
          lastro_sku_code: string
          logo_sku_code: string | null
          photo_of_design_url: string | null
          produced_unit: Database["public"]["Enums"]["catalog_unit"] | null
          product_notes: string | null
          shade_range_image_url: string | null
          sold_unit: Database["public"]["Enums"]["catalog_unit"] | null
          spec_sheet_file: string | null
          spec_sheet_url: string | null
          status: Database["public"]["Enums"]["catalog_item_status"]
          suppliers: string | null
          sustainable_notes: string | null
          test_report_file: string | null
          test_report_url: string | null
          type: Database["public"]["Enums"]["catalog_item_type"]
          updated_at: string
          updated_by_user_id: string | null
          weaving_knitted: string | null
          weight_g_m2: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          care_instructions?: string | null
          code: string
          color_name: string
          composition?: Json | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          dyeing_batch_size?: number | null
          eu_origin?: boolean | null
          extra_attributes?: Json | null
          fabric_type?: string | null
          id?: string
          is_active?: boolean
          last_inbound_date?: string | null
          last_update_date?: string | null
          lastro_sku_code: string
          logo_sku_code?: string | null
          photo_of_design_url?: string | null
          produced_unit?: Database["public"]["Enums"]["catalog_unit"] | null
          product_notes?: string | null
          shade_range_image_url?: string | null
          sold_unit?: Database["public"]["Enums"]["catalog_unit"] | null
          spec_sheet_file?: string | null
          spec_sheet_url?: string | null
          status?: Database["public"]["Enums"]["catalog_item_status"]
          suppliers?: string | null
          sustainable_notes?: string | null
          test_report_file?: string | null
          test_report_url?: string | null
          type?: Database["public"]["Enums"]["catalog_item_type"]
          updated_at?: string
          updated_by_user_id?: string | null
          weaving_knitted?: string | null
          weight_g_m2?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          care_instructions?: string | null
          code?: string
          color_name?: string
          composition?: Json | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          dyeing_batch_size?: number | null
          eu_origin?: boolean | null
          extra_attributes?: Json | null
          fabric_type?: string | null
          id?: string
          is_active?: boolean
          last_inbound_date?: string | null
          last_update_date?: string | null
          lastro_sku_code?: string
          logo_sku_code?: string | null
          photo_of_design_url?: string | null
          produced_unit?: Database["public"]["Enums"]["catalog_unit"] | null
          product_notes?: string | null
          shade_range_image_url?: string | null
          sold_unit?: Database["public"]["Enums"]["catalog_unit"] | null
          spec_sheet_file?: string | null
          spec_sheet_url?: string | null
          status?: Database["public"]["Enums"]["catalog_item_status"]
          suppliers?: string | null
          sustainable_notes?: string | null
          test_report_file?: string | null
          test_report_url?: string | null
          type?: Database["public"]["Enums"]["catalog_item_type"]
          updated_at?: string
          updated_by_user_id?: string | null
          weaving_knitted?: string | null
          weight_g_m2?: number | null
        }
        Relationships: []
      }
      catalog_user_views: {
        Row: {
          created_at: string
          filters: Json | null
          id: string
          is_default: boolean
          selected_columns: Json
          sort_order: Json | null
          updated_at: string
          user_id: string
          view_name: string
        }
        Insert: {
          created_at?: string
          filters?: Json | null
          id?: string
          is_default?: boolean
          selected_columns?: Json
          sort_order?: Json | null
          updated_at?: string
          user_id: string
          view_name: string
        }
        Update: {
          created_at?: string
          filters?: Json | null
          id?: string
          is_default?: boolean
          selected_columns?: Json
          sort_order?: Json | null
          updated_at?: string
          user_id?: string
          view_name?: string
        }
        Relationships: []
      }
      count_rolls: {
        Row: {
          admin_color: string | null
          admin_lot_number: string | null
          admin_meters: number | null
          admin_notes: string | null
          admin_quality: string | null
          capture_sequence: number
          captured_at: string
          captured_by: string
          counter_color: string
          counter_confirmed_at: string
          counter_lot_number: string
          counter_meters: number
          counter_quality: string
          created_at: string
          duplicate_of_roll_id: string | null
          fields_manually_edited: string[] | null
          id: string
          is_manual_entry: boolean
          is_not_label_warning: boolean
          is_possible_duplicate: boolean
          manual_edit_reason:
            | Database["public"]["Enums"]["stock_take_edit_reason"]
            | null
          manual_edit_reason_other: string | null
          ocr_color: string | null
          ocr_confidence_level:
            | Database["public"]["Enums"]["stock_take_confidence_level"]
            | null
          ocr_confidence_score: number | null
          ocr_lot_number: string | null
          ocr_meters: number | null
          ocr_processed_at: string | null
          ocr_quality: string | null
          ocr_raw_text: string | null
          ocr_status: string | null
          original_roll_id: string | null
          photo_hash_perceptual: string | null
          photo_hash_sha256: string
          photo_path: string
          recount_reason: string | null
          recount_version: number
          reviewed_at: string | null
          reviewed_by: string | null
          session_id: string
          status: Database["public"]["Enums"]["stock_take_roll_status"]
          updated_at: string
        }
        Insert: {
          admin_color?: string | null
          admin_lot_number?: string | null
          admin_meters?: number | null
          admin_notes?: string | null
          admin_quality?: string | null
          capture_sequence: number
          captured_at?: string
          captured_by: string
          counter_color: string
          counter_confirmed_at?: string
          counter_lot_number: string
          counter_meters: number
          counter_quality: string
          created_at?: string
          duplicate_of_roll_id?: string | null
          fields_manually_edited?: string[] | null
          id?: string
          is_manual_entry?: boolean
          is_not_label_warning?: boolean
          is_possible_duplicate?: boolean
          manual_edit_reason?:
            | Database["public"]["Enums"]["stock_take_edit_reason"]
            | null
          manual_edit_reason_other?: string | null
          ocr_color?: string | null
          ocr_confidence_level?:
            | Database["public"]["Enums"]["stock_take_confidence_level"]
            | null
          ocr_confidence_score?: number | null
          ocr_lot_number?: string | null
          ocr_meters?: number | null
          ocr_processed_at?: string | null
          ocr_quality?: string | null
          ocr_raw_text?: string | null
          ocr_status?: string | null
          original_roll_id?: string | null
          photo_hash_perceptual?: string | null
          photo_hash_sha256: string
          photo_path: string
          recount_reason?: string | null
          recount_version?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id: string
          status?: Database["public"]["Enums"]["stock_take_roll_status"]
          updated_at?: string
        }
        Update: {
          admin_color?: string | null
          admin_lot_number?: string | null
          admin_meters?: number | null
          admin_notes?: string | null
          admin_quality?: string | null
          capture_sequence?: number
          captured_at?: string
          captured_by?: string
          counter_color?: string
          counter_confirmed_at?: string
          counter_lot_number?: string
          counter_meters?: number
          counter_quality?: string
          created_at?: string
          duplicate_of_roll_id?: string | null
          fields_manually_edited?: string[] | null
          id?: string
          is_manual_entry?: boolean
          is_not_label_warning?: boolean
          is_possible_duplicate?: boolean
          manual_edit_reason?:
            | Database["public"]["Enums"]["stock_take_edit_reason"]
            | null
          manual_edit_reason_other?: string | null
          ocr_color?: string | null
          ocr_confidence_level?:
            | Database["public"]["Enums"]["stock_take_confidence_level"]
            | null
          ocr_confidence_score?: number | null
          ocr_lot_number?: string | null
          ocr_meters?: number | null
          ocr_processed_at?: string | null
          ocr_quality?: string | null
          ocr_raw_text?: string | null
          ocr_status?: string | null
          original_roll_id?: string | null
          photo_hash_perceptual?: string | null
          photo_hash_sha256?: string
          photo_path?: string
          recount_reason?: string | null
          recount_version?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["stock_take_roll_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "count_rolls_duplicate_of_roll_id_fkey"
            columns: ["duplicate_of_roll_id"]
            isOneToOne: false
            referencedRelation: "count_rolls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "count_rolls_original_roll_id_fkey"
            columns: ["original_roll_id"]
            isOneToOne: false
            referencedRelation: "count_rolls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "count_rolls_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "count_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      count_sessions: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          closed_at: string | null
          completed_at: string | null
          created_at: string
          id: string
          last_activity_at: string
          manual_entry_count: number
          notes: string | null
          ocr_high_confidence_count: number
          ocr_low_confidence_count: number
          ocr_medium_confidence_count: number
          reconciled_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          rolls_approved: number
          rolls_pending_review: number
          rolls_recount_requested: number
          rolls_rejected: number
          session_number: string
          started_at: string
          started_by: string
          status: Database["public"]["Enums"]["stock_take_session_status"]
          total_rolls_counted: number
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          closed_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          last_activity_at?: string
          manual_entry_count?: number
          notes?: string | null
          ocr_high_confidence_count?: number
          ocr_low_confidence_count?: number
          ocr_medium_confidence_count?: number
          reconciled_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rolls_approved?: number
          rolls_pending_review?: number
          rolls_recount_requested?: number
          rolls_rejected?: number
          session_number: string
          started_at?: string
          started_by: string
          status?: Database["public"]["Enums"]["stock_take_session_status"]
          total_rolls_counted?: number
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          closed_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          last_activity_at?: string
          manual_entry_count?: number
          notes?: string | null
          ocr_high_confidence_count?: number
          ocr_low_confidence_count?: number
          ocr_medium_confidence_count?: number
          reconciled_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rolls_approved?: number
          rolls_pending_review?: number
          rolls_recount_requested?: number
          rolls_rejected?: number
          session_number?: string
          started_at?: string
          started_by?: string
          status?: Database["public"]["Enums"]["stock_take_session_status"]
          total_rolls_counted?: number
          updated_at?: string
        }
        Relationships: []
      }
      demand_history: {
        Row: {
          amount: number
          color_code: string
          created_at: string
          created_by: string | null
          demand_date: string
          document_status: string
          id: string
          import_batch_id: string | null
          import_row_number: number | null
          quality_code: string
          source: string
          unit: string
        }
        Insert: {
          amount: number
          color_code: string
          created_at?: string
          created_by?: string | null
          demand_date: string
          document_status: string
          id?: string
          import_batch_id?: string | null
          import_row_number?: number | null
          quality_code: string
          source?: string
          unit: string
        }
        Update: {
          amount?: number
          color_code?: string
          created_at?: string
          created_by?: string | null
          demand_date?: string
          document_status?: string
          id?: string
          import_batch_id?: string | null
          import_row_number?: number | null
          quality_code?: string
          source?: string
          unit?: string
        }
        Relationships: []
      }
      email_alert_acknowledgments: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          email_log_id: string | null
          id: string
          notes: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          email_log_id?: string | null
          id?: string
          notes?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          email_log_id?: string | null
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_alert_acknowledgments_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "email_alert_acknowledgments_email_log_id_fkey"
            columns: ["email_log_id"]
            isOneToOne: false
            referencedRelation: "email_log"
            referencedColumns: ["id"]
          },
        ]
      }
      email_digest_configs: {
        Row: {
          cooldown_hours: number | null
          created_at: string | null
          digest_type: string
          id: string
          is_enabled: boolean | null
          last_sent_at: string | null
          recipients: Json | null
          schedule_config: Json | null
          schedule_type: string | null
          updated_at: string | null
        }
        Insert: {
          cooldown_hours?: number | null
          created_at?: string | null
          digest_type: string
          id?: string
          is_enabled?: boolean | null
          last_sent_at?: string | null
          recipients?: Json | null
          schedule_config?: Json | null
          schedule_type?: string | null
          updated_at?: string | null
        }
        Update: {
          cooldown_hours?: number | null
          created_at?: string | null
          digest_type?: string
          id?: string
          is_enabled?: boolean | null
          last_sent_at?: string | null
          recipients?: Json | null
          schedule_config?: Json | null
          schedule_type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      email_log: {
        Row: {
          acknowledged_at: string | null
          attachments: Json | null
          clicked_at: string | null
          created_at: string
          digest_type: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          next_retry_at: string | null
          opened_at: string | null
          recipient: string
          requires_acknowledgment: boolean | null
          retry_count: number | null
          schedule_id: string | null
          sent_at: string | null
          status: string
          subject: string
          template_id: string | null
          template_key: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          attachments?: Json | null
          clicked_at?: string | null
          created_at?: string
          digest_type?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          next_retry_at?: string | null
          opened_at?: string | null
          recipient: string
          requires_acknowledgment?: boolean | null
          retry_count?: number | null
          schedule_id?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          template_id?: string | null
          template_key?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          attachments?: Json | null
          clicked_at?: string | null
          created_at?: string
          digest_type?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          next_retry_at?: string | null
          opened_at?: string | null
          recipient?: string
          requires_acknowledgment?: boolean | null
          retry_count?: number | null
          schedule_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          template_id?: string | null
          template_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_log_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "email_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_recipient_preferences: {
        Row: {
          consent_given_at: string | null
          consent_source: string | null
          created_at: string | null
          email: string
          frequency: string | null
          id: string
          is_subscribed: boolean | null
          template_category: string | null
          unsubscribed_at: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          consent_given_at?: string | null
          consent_source?: string | null
          created_at?: string | null
          email: string
          frequency?: string | null
          id?: string
          is_subscribed?: boolean | null
          template_category?: string | null
          unsubscribed_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          consent_given_at?: string | null
          consent_source?: string | null
          created_at?: string | null
          email?: string
          frequency?: string | null
          id?: string
          is_subscribed?: boolean | null
          template_category?: string | null
          unsubscribed_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_recipient_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      email_recipients: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          recipient_type: string
          recipient_value: string
          schedule_id: string | null
          template_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          recipient_type: string
          recipient_value: string
          schedule_id?: string | null
          template_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          recipient_type?: string
          recipient_value?: string
          schedule_id?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_recipients_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "email_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_recipients_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_report_configs: {
        Row: {
          calculated_fields: Json | null
          columns: Json
          columns_config: Json | null
          comparison_period: string | null
          created_at: string | null
          created_by: string | null
          data_source: string | null
          description: string | null
          filters: Json | null
          generation_count: number | null
          grouping: Json | null
          id: string
          include_charts: boolean | null
          is_system: boolean | null
          last_generated_at: string | null
          name: string
          output_formats: string[] | null
          report_type: string
          schedule_config: Json | null
          schedule_id: string | null
          selected_joins: Json | null
          sorting: Json | null
          styling: Json | null
          updated_at: string | null
        }
        Insert: {
          calculated_fields?: Json | null
          columns?: Json
          columns_config?: Json | null
          comparison_period?: string | null
          created_at?: string | null
          created_by?: string | null
          data_source?: string | null
          description?: string | null
          filters?: Json | null
          generation_count?: number | null
          grouping?: Json | null
          id?: string
          include_charts?: boolean | null
          is_system?: boolean | null
          last_generated_at?: string | null
          name: string
          output_formats?: string[] | null
          report_type: string
          schedule_config?: Json | null
          schedule_id?: string | null
          selected_joins?: Json | null
          sorting?: Json | null
          styling?: Json | null
          updated_at?: string | null
        }
        Update: {
          calculated_fields?: Json | null
          columns?: Json
          columns_config?: Json | null
          comparison_period?: string | null
          created_at?: string | null
          created_by?: string | null
          data_source?: string | null
          description?: string | null
          filters?: Json | null
          generation_count?: number | null
          grouping?: Json | null
          id?: string
          include_charts?: boolean | null
          is_system?: boolean | null
          last_generated_at?: string | null
          name?: string
          output_formats?: string[] | null
          report_type?: string
          schedule_config?: Json | null
          schedule_id?: string | null
          selected_joins?: Json | null
          sorting?: Json | null
          styling?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_report_configs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "email_report_configs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "email_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      email_schedules: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          last_run_at: string | null
          last_run_status: string | null
          name: string
          next_run_at: string | null
          report_config_id: string | null
          schedule_config: Json
          schedule_type: string
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          last_run_status?: string | null
          name: string
          next_run_at?: string | null
          report_config_id?: string | null
          schedule_config?: Json
          schedule_type?: string
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          last_run_status?: string | null
          name?: string
          next_run_at?: string | null
          report_config_id?: string | null
          schedule_config?: Json
          schedule_type?: string
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "email_schedules_report_config_id_fkey"
            columns: ["report_config_id"]
            isOneToOne: false
            referencedRelation: "email_report_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_schedules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_settings: {
        Row: {
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      email_template_usage: {
        Row: {
          created_at: string
          description: string | null
          id: string
          schedule: string | null
          template_id: string
          usage_name: string
          usage_type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          schedule?: string | null
          template_id: string
          usage_name: string
          usage_type: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          schedule?: string | null
          template_id?: string
          usage_name?: string
          usage_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_template_usage_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_template_versions: {
        Row: {
          body_en: string
          body_tr: string
          change_reason: string | null
          changed_by: string
          created_at: string
          id: string
          subject_en: string
          subject_tr: string
          template_id: string
          version: number
        }
        Insert: {
          body_en: string
          body_tr: string
          change_reason?: string | null
          changed_by: string
          created_at?: string
          id?: string
          subject_en: string
          subject_tr: string
          template_id: string
          version: number
        }
        Update: {
          body_en?: string
          body_tr?: string
          change_reason?: string | null
          changed_by?: string
          created_at?: string
          id?: string
          subject_en?: string
          subject_tr?: string
          template_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "email_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_en: string
          body_tr: string
          category: string | null
          created_at: string
          default_body_en: string | null
          default_body_tr: string | null
          default_subject_en: string | null
          default_subject_tr: string | null
          error_count: number | null
          id: string
          is_active: boolean | null
          is_digest: boolean | null
          is_system: boolean | null
          last_sent_at: string | null
          name: string
          priority: number | null
          retry_config: Json | null
          send_count: number | null
          subject_en: string
          subject_tr: string
          template_key: string
          updated_at: string
          variables: string[] | null
          variables_meta: Json | null
          version: number | null
        }
        Insert: {
          body_en: string
          body_tr: string
          category?: string | null
          created_at?: string
          default_body_en?: string | null
          default_body_tr?: string | null
          default_subject_en?: string | null
          default_subject_tr?: string | null
          error_count?: number | null
          id?: string
          is_active?: boolean | null
          is_digest?: boolean | null
          is_system?: boolean | null
          last_sent_at?: string | null
          name: string
          priority?: number | null
          retry_config?: Json | null
          send_count?: number | null
          subject_en: string
          subject_tr: string
          template_key: string
          updated_at?: string
          variables?: string[] | null
          variables_meta?: Json | null
          version?: number | null
        }
        Update: {
          body_en?: string
          body_tr?: string
          category?: string | null
          created_at?: string
          default_body_en?: string | null
          default_body_tr?: string | null
          default_subject_en?: string | null
          default_subject_tr?: string | null
          error_count?: number | null
          id?: string
          is_active?: boolean | null
          is_digest?: boolean | null
          is_system?: boolean | null
          last_sent_at?: string | null
          name?: string
          priority?: number | null
          retry_config?: Json | null
          send_count?: number | null
          subject_en?: string
          subject_tr?: string
          template_key?: string
          updated_at?: string
          variables?: string[] | null
          variables_meta?: Json | null
          version?: number | null
        }
        Relationships: []
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
      forecast_alerts: {
        Row: {
          alert_type: string
          color_code: string
          coverage_months: number | null
          created_at: string
          current_stock: number
          forecasted_demand: number
          id: string
          is_resolved: boolean
          previous_alert_id: string | null
          projected_stockout_days: number | null
          quality_code: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          run_id: string
          severity: string
          unit: string
        }
        Insert: {
          alert_type: string
          color_code: string
          coverage_months?: number | null
          created_at?: string
          current_stock: number
          forecasted_demand: number
          id?: string
          is_resolved?: boolean
          previous_alert_id?: string | null
          projected_stockout_days?: number | null
          quality_code: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          run_id: string
          severity: string
          unit: string
        }
        Update: {
          alert_type?: string
          color_code?: string
          coverage_months?: number | null
          created_at?: string
          current_stock?: number
          forecasted_demand?: number
          id?: string
          is_resolved?: boolean
          previous_alert_id?: string | null
          projected_stockout_days?: number | null
          quality_code?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          run_id?: string
          severity?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "forecast_alerts_previous_alert_id_fkey"
            columns: ["previous_alert_id"]
            isOneToOne: false
            referencedRelation: "forecast_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forecast_alerts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "forecast_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_results: {
        Row: {
          color_code: string
          created_at: string
          forecast_amount: number
          historical_avg: number | null
          id: string
          period_end: string
          period_start: string
          quality_code: string
          run_id: string
          scenario: string
          trend_factor: number | null
          unit: string
          weighted_avg: number | null
        }
        Insert: {
          color_code: string
          created_at?: string
          forecast_amount: number
          historical_avg?: number | null
          id?: string
          period_end: string
          period_start: string
          quality_code: string
          run_id: string
          scenario: string
          trend_factor?: number | null
          unit: string
          weighted_avg?: number | null
        }
        Update: {
          color_code?: string
          created_at?: string
          forecast_amount?: number
          historical_avg?: number | null
          id?: string
          period_end?: string
          period_start?: string
          quality_code?: string
          run_id?: string
          scenario?: string
          trend_factor?: number | null
          unit?: string
          weighted_avg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "forecast_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "forecast_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_runs: {
        Row: {
          affected_qualities: Json | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          processed_combinations: number | null
          run_type: string
          scheduled_at: string | null
          started_at: string
          status: string
          total_combinations: number | null
          triggered_by: string | null
        }
        Insert: {
          affected_qualities?: Json | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          processed_combinations?: number | null
          run_type: string
          scheduled_at?: string | null
          started_at?: string
          status?: string
          total_combinations?: number | null
          triggered_by?: string | null
        }
        Update: {
          affected_qualities?: Json | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          processed_combinations?: number | null
          run_type?: string
          scheduled_at?: string | null
          started_at?: string
          status?: string
          total_combinations?: number | null
          triggered_by?: string | null
        }
        Relationships: []
      }
      forecast_settings_audit_log: {
        Row: {
          change_reason: string | null
          changed_at: string
          changed_by: string
          color_code: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
          parameter_name: string
          quality_code: string | null
          scope: string
        }
        Insert: {
          change_reason?: string | null
          changed_at?: string
          changed_by: string
          color_code?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          parameter_name: string
          quality_code?: string | null
          scope: string
        }
        Update: {
          change_reason?: string | null
          changed_at?: string
          changed_by?: string
          color_code?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          parameter_name?: string
          quality_code?: string | null
          scope?: string
        }
        Relationships: []
      }
      forecast_settings_global: {
        Row: {
          created_at: string
          default_safety_stock_mode: string
          default_safety_stock_weeks: number
          demand_statuses: Json
          email_digest_day: number
          email_digest_enabled: boolean
          email_digest_hour: number
          email_digest_recipients: Json
          forecast_horizon_months: number
          history_window_months: number
          id: string
          min_order_zero_history: number
          normalization_type: string
          outlier_percentile: number
          override_row_tint_color: string
          overstock_alert_months: number
          permissions: Json
          scenario_parameters: Json
          stockout_alert_days: number
          time_bucket: string
          updated_at: string
          updated_by: string | null
          weekly_schedule_day: number
          weekly_schedule_enabled: boolean
          weekly_schedule_hour: number
          weekly_schedule_timezone: string
          weighting_method: string
        }
        Insert: {
          created_at?: string
          default_safety_stock_mode?: string
          default_safety_stock_weeks?: number
          demand_statuses?: Json
          email_digest_day?: number
          email_digest_enabled?: boolean
          email_digest_hour?: number
          email_digest_recipients?: Json
          forecast_horizon_months?: number
          history_window_months?: number
          id?: string
          min_order_zero_history?: number
          normalization_type?: string
          outlier_percentile?: number
          override_row_tint_color?: string
          overstock_alert_months?: number
          permissions?: Json
          scenario_parameters?: Json
          stockout_alert_days?: number
          time_bucket?: string
          updated_at?: string
          updated_by?: string | null
          weekly_schedule_day?: number
          weekly_schedule_enabled?: boolean
          weekly_schedule_hour?: number
          weekly_schedule_timezone?: string
          weighting_method?: string
        }
        Update: {
          created_at?: string
          default_safety_stock_mode?: string
          default_safety_stock_weeks?: number
          demand_statuses?: Json
          email_digest_day?: number
          email_digest_enabled?: boolean
          email_digest_hour?: number
          email_digest_recipients?: Json
          forecast_horizon_months?: number
          history_window_months?: number
          id?: string
          min_order_zero_history?: number
          normalization_type?: string
          outlier_percentile?: number
          override_row_tint_color?: string
          overstock_alert_months?: number
          permissions?: Json
          scenario_parameters?: Json
          stockout_alert_days?: number
          time_bucket?: string
          updated_at?: string
          updated_by?: string | null
          weekly_schedule_day?: number
          weekly_schedule_enabled?: boolean
          weekly_schedule_hour?: number
          weekly_schedule_timezone?: string
          weighting_method?: string
        }
        Relationships: []
      }
      forecast_settings_per_quality: {
        Row: {
          color_code: string
          created_at: string
          created_by: string | null
          id: string
          lead_time_days: number | null
          min_recommended_order: number | null
          quality_code: string
          safety_stock_mode: string | null
          safety_stock_weeks: number | null
          target_coverage_weeks: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          color_code: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_time_days?: number | null
          min_recommended_order?: number | null
          quality_code: string
          safety_stock_mode?: string | null
          safety_stock_weeks?: number | null
          target_coverage_weeks?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          color_code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_time_days?: number | null
          min_recommended_order?: number | null
          quality_code?: string
          safety_stock_mode?: string | null
          safety_stock_weeks?: number | null
          target_coverage_weeks?: number | null
          updated_at?: string
          updated_by?: string | null
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
          catalog_item_id: string | null
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
          catalog_item_id?: string | null
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
          catalog_item_id?: string | null
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
            foreignKeyName: "incoming_stock_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
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
          catalog_item_id: string | null
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
          catalog_item_id?: string | null
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
          catalog_item_id?: string | null
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
            foreignKeyName: "lots_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      manufacturing_orders: {
        Row: {
          catalog_item_id: string | null
          color: string
          created_at: string
          created_by: string
          currency: string | null
          customer_agreed_date: string | null
          customer_name: string | null
          expected_completion_date: string | null
          id: string
          incoming_stock_id: string | null
          is_customer_order: boolean | null
          mo_number: string
          notes: string | null
          order_date: string
          ordered_amount: number
          price_per_meter: number | null
          quality: string
          reservation_id: string | null
          status: string
          supplier_confirmation_number: string | null
          supplier_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          catalog_item_id?: string | null
          color: string
          created_at?: string
          created_by: string
          currency?: string | null
          customer_agreed_date?: string | null
          customer_name?: string | null
          expected_completion_date?: string | null
          id?: string
          incoming_stock_id?: string | null
          is_customer_order?: boolean | null
          mo_number?: string
          notes?: string | null
          order_date?: string
          ordered_amount: number
          price_per_meter?: number | null
          quality: string
          reservation_id?: string | null
          status?: string
          supplier_confirmation_number?: string | null
          supplier_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          catalog_item_id?: string | null
          color?: string
          created_at?: string
          created_by?: string
          currency?: string | null
          customer_agreed_date?: string | null
          customer_name?: string | null
          expected_completion_date?: string | null
          id?: string
          incoming_stock_id?: string | null
          is_customer_order?: boolean | null
          mo_number?: string
          notes?: string | null
          order_date?: string
          ordered_amount?: number
          price_per_meter?: number | null
          quality?: string
          reservation_id?: string | null
          status?: string
          supplier_confirmation_number?: string | null
          supplier_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manufacturing_orders_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_orders_incoming_stock_id_fkey"
            columns: ["incoming_stock_id"]
            isOneToOne: false
            referencedRelation: "incoming_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_orders_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      mo_status_history: {
        Row: {
          changed_at: string
          changed_by: string
          id: string
          manufacturing_order_id: string
          new_status: string
          notes: string | null
          old_status: string | null
        }
        Insert: {
          changed_at?: string
          changed_by: string
          id?: string
          manufacturing_order_id: string
          new_status: string
          notes?: string | null
          old_status?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string
          id?: string
          manufacturing_order_id?: string
          new_status?: string
          notes?: string | null
          old_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mo_status_history_manufacturing_order_id_fkey"
            columns: ["manufacturing_order_id"]
            isOneToOne: false
            referencedRelation: "manufacturing_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      ocr_jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          image_path: string
          max_attempts: number
          ocr_result: Json | null
          roll_id: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          image_path: string
          max_attempts?: number
          ocr_result?: Json | null
          roll_id?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          image_path?: string
          max_attempts?: number
          ocr_result?: Json | null
          roll_id?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocr_jobs_roll_id_fkey"
            columns: ["roll_id"]
            isOneToOne: false
            referencedRelation: "count_rolls"
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
      order_shares: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          order_id: string
          shared_by_user_id: string
          shared_with_user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          order_id: string
          shared_by_user_id: string
          shared_with_user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          order_id?: string
          shared_by_user_id?: string
          shared_with_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_shares_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
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
      po_draft_lines: {
        Row: {
          color: string | null
          confidence_score: number | null
          created_at: string
          customer_name: string | null
          delivery_notes: string | null
          draft_id: string
          extraction_status: string
          id: string
          intent_type: string | null
          is_firm_order: boolean | null
          is_option_or_blocked: boolean | null
          is_sample: boolean | null
          line_no: number
          meters: number | null
          price_currency: string | null
          price_value: number | null
          quality: string | null
          quantity_unit: string | null
          reference_numbers: string | null
          resolution_source: string | null
          source_row: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          confidence_score?: number | null
          created_at?: string
          customer_name?: string | null
          delivery_notes?: string | null
          draft_id: string
          extraction_status?: string
          id?: string
          intent_type?: string | null
          is_firm_order?: boolean | null
          is_option_or_blocked?: boolean | null
          is_sample?: boolean | null
          line_no: number
          meters?: number | null
          price_currency?: string | null
          price_value?: number | null
          quality?: string | null
          quantity_unit?: string | null
          reference_numbers?: string | null
          resolution_source?: string | null
          source_row?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          confidence_score?: number | null
          created_at?: string
          customer_name?: string | null
          delivery_notes?: string | null
          draft_id?: string
          extraction_status?: string
          id?: string
          intent_type?: string | null
          is_firm_order?: boolean | null
          is_option_or_blocked?: boolean | null
          is_sample?: boolean | null
          line_no?: number
          meters?: number | null
          price_currency?: string | null
          price_value?: number | null
          quality?: string | null
          quantity_unit?: string | null
          reference_numbers?: string | null
          resolution_source?: string | null
          source_row?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "po_draft_lines_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "po_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      po_drafts: {
        Row: {
          created_at: string
          created_by: string
          id: string
          note: string | null
          source_object_path: string | null
          source_type: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          note?: string | null
          source_object_path?: string | null
          source_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          note?: string | null
          source_object_path?: string | null
          source_type?: string
          status?: string
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
      purchase_recommendations: {
        Row: {
          aggressive_recommendation: number
          available_stock: number
          color_code: string
          conservative_recommendation: number
          created_at: string
          forecasted_lead_time_demand: number
          has_quality_override: boolean
          id: string
          in_production_stock: number
          incoming_stock: number
          last_order_date: string | null
          lead_time_days: number
          normal_recommendation: number
          notes: string | null
          past_12m_demand: number
          quality_code: string
          reviewed_at: string | null
          reviewed_by: string | null
          run_id: string
          safety_stock_value: number
          status: string
          target_coverage_weeks: number
          total_stock_position: number
          unit: string
        }
        Insert: {
          aggressive_recommendation?: number
          available_stock?: number
          color_code: string
          conservative_recommendation?: number
          created_at?: string
          forecasted_lead_time_demand?: number
          has_quality_override?: boolean
          id?: string
          in_production_stock?: number
          incoming_stock?: number
          last_order_date?: string | null
          lead_time_days: number
          normal_recommendation?: number
          notes?: string | null
          past_12m_demand?: number
          quality_code: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          run_id: string
          safety_stock_value?: number
          status?: string
          target_coverage_weeks?: number
          total_stock_position?: number
          unit: string
        }
        Update: {
          aggressive_recommendation?: number
          available_stock?: number
          color_code?: string
          conservative_recommendation?: number
          created_at?: string
          forecasted_lead_time_demand?: number
          has_quality_override?: boolean
          id?: string
          in_production_stock?: number
          incoming_stock?: number
          last_order_date?: string | null
          lead_time_days?: number
          normal_recommendation?: number
          notes?: string | null
          past_12m_demand?: number
          quality_code?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          run_id?: string
          safety_stock_value?: number
          status?: string
          target_coverage_weeks?: number
          total_stock_position?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_recommendations_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "forecast_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      qualities: {
        Row: {
          alerts_enabled: boolean | null
          aliases: string[] | null
          code: string
          created_at: string | null
          critical_stock_threshold_meters: number | null
          low_stock_threshold_meters: number | null
          unit: string
          updated_at: string | null
        }
        Insert: {
          alerts_enabled?: boolean | null
          aliases?: string[] | null
          code: string
          created_at?: string | null
          critical_stock_threshold_meters?: number | null
          low_stock_threshold_meters?: number | null
          unit?: string
          updated_at?: string | null
        }
        Update: {
          alerts_enabled?: boolean | null
          aliases?: string[] | null
          code?: string
          created_at?: string | null
          critical_stock_threshold_meters?: number | null
          low_stock_threshold_meters?: number | null
          unit?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      quality_aliases: {
        Row: {
          alias: string
          created_at: string | null
          quality_code: string
        }
        Insert: {
          alias: string
          created_at?: string | null
          quality_code: string
        }
        Update: {
          alias?: string
          created_at?: string | null
          quality_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_aliases_quality_code_fkey"
            columns: ["quality_code"]
            isOneToOne: false
            referencedRelation: "qualities"
            referencedColumns: ["code"]
          },
        ]
      }
      quality_colors: {
        Row: {
          color_code: string | null
          color_label: string
          created_at: string | null
          quality_code: string
        }
        Insert: {
          color_code?: string | null
          color_label: string
          created_at?: string | null
          quality_code: string
        }
        Update: {
          color_code?: string | null
          color_label?: string
          created_at?: string | null
          quality_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_colors_quality_code_fkey"
            columns: ["quality_code"]
            isOneToOne: false
            referencedRelation: "qualities"
            referencedColumns: ["code"]
          },
        ]
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
      scheduled_reports: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_enabled: boolean
          last_sent_at: string | null
          name: string
          next_run_at: string | null
          output_format: string
          recipients: Json
          report_config_id: string | null
          report_type: string
          schedule_config: Json
          schedule_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_enabled?: boolean
          last_sent_at?: string | null
          name: string
          next_run_at?: string | null
          output_format?: string
          recipients?: Json
          report_config_id?: string | null
          report_type: string
          schedule_config?: Json
          schedule_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_enabled?: boolean
          last_sent_at?: string | null
          name?: string
          next_run_at?: string | null
          output_format?: string
          recipients?: Json
          report_config_id?: string | null
          report_type?: string
          schedule_config?: Json
          schedule_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_reports_report_config_id_fkey"
            columns: ["report_config_id"]
            isOneToOne: false
            referencedRelation: "email_report_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          created_at: string
          default_lead_time_days: number | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_lead_time_days?: number | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_lead_time_days?: number | null
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
      can_reverse_action:
        | {
            Args: { p_audit_id: string }
            Returns: {
              can_reverse: boolean
              reason: string
              reversal_strategy: string
            }[]
          }
        | {
            Args: { p_audit_id: string; p_bypass_auth_check?: boolean }
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
      generate_count_session_number: { Args: never; Returns: string }
      generate_lastro_sku_code: { Args: never; Returns: string }
      generate_mo_number: { Args: never; Returns: string }
      generate_order_number: { Args: never; Returns: string }
      generate_reservation_number: { Args: never; Returns: string }
      get_available_rolls_count: { Args: { p_lot_id: string }; Returns: number }
      get_available_rolls_meters: {
        Args: { p_lot_id: string }
        Returns: number
      }
      get_dashboard_stats: {
        Args: never
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
        Args: never
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
        Args: never
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
        Args: never
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
        Args: never
        Returns: {
          total_lots: number
          total_meters: number
          total_rolls: number
        }[]
      }
      get_inventory_with_reservations: {
        Args: never
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
        Args: never
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
      is_ip_whitelisted: { Args: { check_ip: string }; Returns: boolean }
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
      normalize_quality: { Args: { quality_input: string }; Returns: string }
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
        | "incoming_stock"
        | "forecast_settings"
        | "catalog_item"
      cancel_reason_type:
        | "no_payment"
        | "customer_canceled"
        | "incorrect_entry"
        | "other"
      catalog_item_status:
        | "pending_approval"
        | "active"
        | "temporarily_unavailable"
        | "blocked"
        | "end_of_life"
      catalog_item_type:
        | "lining"
        | "pocketing"
        | "sleeve_lining"
        | "stretch"
        | "knee_lining"
      catalog_unit: "meters" | "kilograms"
      convert_reason_type: "payment_confirmation" | "manager_confirmation"
      order_line_type: "sample" | "standard"
      reservation_status: "active" | "released" | "converted" | "canceled"
      stock_status: "in_stock" | "out_of_stock" | "partially_fulfilled"
      stock_take_confidence_level: "high" | "medium" | "low"
      stock_take_edit_reason:
        | "ocr_unreadable"
        | "handwritten_label"
        | "label_damaged"
        | "wrong_extraction"
        | "other"
      stock_take_roll_status:
        | "pending_review"
        | "approved"
        | "rejected"
        | "recount_requested"
        | "void_pending_admin"
      stock_take_session_status:
        | "draft"
        | "active"
        | "counting_complete"
        | "reviewing"
        | "reconciled"
        | "closed"
        | "cancelled"
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
        "incoming_stock",
        "forecast_settings",
        "catalog_item",
      ],
      cancel_reason_type: [
        "no_payment",
        "customer_canceled",
        "incorrect_entry",
        "other",
      ],
      catalog_item_status: [
        "pending_approval",
        "active",
        "temporarily_unavailable",
        "blocked",
        "end_of_life",
      ],
      catalog_item_type: [
        "lining",
        "pocketing",
        "sleeve_lining",
        "stretch",
        "knee_lining",
      ],
      catalog_unit: ["meters", "kilograms"],
      convert_reason_type: ["payment_confirmation", "manager_confirmation"],
      order_line_type: ["sample", "standard"],
      reservation_status: ["active", "released", "converted", "canceled"],
      stock_status: ["in_stock", "out_of_stock", "partially_fulfilled"],
      stock_take_confidence_level: ["high", "medium", "low"],
      stock_take_edit_reason: [
        "ocr_unreadable",
        "handwritten_label",
        "label_damaged",
        "wrong_extraction",
        "other",
      ],
      stock_take_roll_status: [
        "pending_review",
        "approved",
        "rejected",
        "recount_requested",
        "void_pending_admin",
      ],
      stock_take_session_status: [
        "draft",
        "active",
        "counting_complete",
        "reviewing",
        "reconciled",
        "closed",
        "cancelled",
      ],
      user_role: ["warehouse_staff", "accounting", "admin", "senior_manager"],
    },
  },
} as const
