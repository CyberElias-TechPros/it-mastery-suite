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
      assets: {
        Row: {
          asset_tag: string
          assigned_to: string | null
          branch_id: string | null
          category: string | null
          created_at: string | null
          department_id: string | null
          description: string | null
          id: string
          location: string | null
          model: string | null
          name: string
          notes: string | null
          purchase_cost: number | null
          purchase_date: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["asset_status"] | null
          updated_at: string | null
          warranty_expiry: string | null
        }
        Insert: {
          asset_tag: string
          assigned_to?: string | null
          branch_id?: string | null
          category?: string | null
          created_at?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          location?: string | null
          model?: string | null
          name: string
          notes?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["asset_status"] | null
          updated_at?: string | null
          warranty_expiry?: string | null
        }
        Update: {
          asset_tag?: string
          assigned_to?: string | null
          branch_id?: string | null
          category?: string | null
          created_at?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          location?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["asset_status"] | null
          updated_at?: string | null
          warranty_expiry?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          resource_id: string
          resource_type: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          resource_id: string
          resource_type: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          resource_id?: string
          resource_type?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_executions: {
        Row: {
          error_message: string | null
          executed_at: string | null
          id: string
          result: Json | null
          rule_id: string | null
          status: string | null
          trigger_data: Json | null
        }
        Insert: {
          error_message?: string | null
          executed_at?: string | null
          id?: string
          result?: Json | null
          rule_id?: string | null
          status?: string | null
          trigger_data?: Json | null
        }
        Update: {
          error_message?: string | null
          executed_at?: string | null
          id?: string
          result?: Json | null
          rule_id?: string | null
          status?: string | null
          trigger_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_executions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          actions: Json | null
          conditions: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          trigger_event: string
          updated_at: string | null
        }
        Insert: {
          actions?: Json | null
          conditions?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          trigger_event: string
          updated_at?: string | null
        }
        Update: {
          actions?: Json | null
          conditions?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          trigger_event?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          budget: number | null
          city: string | null
          code: string | null
          country: string | null
          created_at: string | null
          id: string
          manager_id: string | null
          name: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          budget?: number | null
          city?: string | null
          code?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          manager_id?: string | null
          name: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          budget?: number | null
          city?: string | null
          code?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          manager_id?: string | null
          name?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean | null
          attendees: string[] | null
          created_at: string | null
          created_by: string
          description: string | null
          end_date: string
          event_type: Database["public"]["Enums"]["event_type"] | null
          id: string
          location: string | null
          related_ticket_id: string | null
          start_date: string
          title: string
          updated_at: string | null
        }
        Insert: {
          all_day?: boolean | null
          attendees?: string[] | null
          created_at?: string | null
          created_by: string
          description?: string | null
          end_date: string
          event_type?: Database["public"]["Enums"]["event_type"] | null
          id?: string
          location?: string | null
          related_ticket_id?: string | null
          start_date: string
          title: string
          updated_at?: string | null
        }
        Update: {
          all_day?: boolean | null
          attendees?: string[] | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          end_date?: string
          event_type?: Database["public"]["Enums"]["event_type"] | null
          id?: string
          location?: string | null
          related_ticket_id?: string | null
          start_date?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_related_ticket_id_fkey"
            columns: ["related_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_reports: {
        Row: {
          config: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          branch_id: string | null
          budget: number | null
          created_at: string | null
          id: string
          manager_id: string | null
          name: string
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          budget?: number | null
          created_at?: string | null
          id?: string
          manager_id?: string | null
          name: string
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          budget?: number | null
          created_at?: string | null
          id?: string
          manager_id?: string | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      diesel_logs: {
        Row: {
          branch_id: string | null
          closing_stock: number
          consumed_stock: number
          cost_per_liter: number | null
          created_at: string | null
          date: string
          id: string
          notes: string | null
          opening_stock: number
          received_stock: number | null
          recorded_by: string | null
          running_hours: number | null
          total_cost: number | null
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          closing_stock: number
          consumed_stock: number
          cost_per_liter?: number | null
          created_at?: string | null
          date: string
          id?: string
          notes?: string | null
          opening_stock: number
          received_stock?: number | null
          recorded_by?: string | null
          running_hours?: number | null
          total_cost?: number | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          closing_stock?: number
          consumed_stock?: number
          cost_per_liter?: number | null
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          opening_stock?: number
          received_stock?: number | null
          recorded_by?: string | null
          running_hours?: number | null
          total_cost?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diesel_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_logs_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          branch_id: string | null
          category: string | null
          created_at: string | null
          department_id: string | null
          description: string | null
          expense_date: string
          id: string
          notes: string | null
          receipt_url: string | null
          status: Database["public"]["Enums"]["expense_status"] | null
          submitted_by: string
          title: string
          updated_at: string | null
          vendor_id: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          category?: string | null
          created_at?: string | null
          department_id?: string | null
          description?: string | null
          expense_date: string
          id?: string
          notes?: string | null
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["expense_status"] | null
          submitted_by: string
          title: string
          updated_at?: string | null
          vendor_id?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          category?: string | null
          created_at?: string | null
          department_id?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["expense_status"] | null
          submitted_by?: string
          title?: string
          updated_at?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_articles: {
        Row: {
          author_id: string
          category: string | null
          content: string
          created_at: string | null
          id: string
          is_featured: boolean | null
          is_published: boolean | null
          tags: string[] | null
          title: string
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          author_id: string
          category?: string | null
          content: string
          created_at?: string | null
          id?: string
          is_featured?: boolean | null
          is_published?: boolean | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          author_id?: string
          category?: string | null
          content?: string
          created_at?: string | null
          id?: string
          is_featured?: boolean | null
          is_published?: boolean | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_comments: {
        Row: {
          article_id: string
          comment: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          article_id: string
          comment: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          article_id?: string
          comment?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_comments_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "kb_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_ratings: {
        Row: {
          article_id: string
          created_at: string | null
          id: string
          rating: number
          user_id: string
        }
        Insert: {
          article_id: string
          created_at?: string | null
          id?: string
          rating: number
          user_id: string
        }
        Update: {
          article_id?: string
          created_at?: string | null
          id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_ratings_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "kb_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          related_ticket_id: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"] | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          related_ticket_id?: string | null
          title: string
          type?: Database["public"]["Enums"]["notification_type"] | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          related_ticket_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_ticket_id_fkey"
            columns: ["related_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          branch_id: string | null
          created_at: string
          department: string | null
          department_id: string | null
          email: string
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string
          department?: string | null
          department_id?: string | null
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string
          department?: string | null
          department_id?: string | null
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          description: string | null
          id: string
          notes: string | null
          po_number: string
          requested_by: string | null
          status: string | null
          title: string
          total_amount: number | null
          updated_at: string | null
          vendor_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          po_number: string
          requested_by?: string | null
          status?: string | null
          title: string
          total_amount?: number | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          po_number?: string
          requested_by?: string | null
          status?: string | null
          title?: string
          total_amount?: number | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          is_internal: boolean | null
          ticket_id: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          is_internal?: boolean | null
          ticket_id: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          is_internal?: boolean | null
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assigned_to: string | null
          category: Database["public"]["Enums"]["ticket_category"]
          closed_at: string | null
          created_at: string
          created_by: string
          description: string
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolved_at: string | null
          sla_due_date: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          ticket_number: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          closed_at?: string | null
          created_at?: string
          created_by: string
          description: string
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          sla_due_date?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_number: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          closed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          sla_due_date?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_number?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          address: string | null
          category: string | null
          contact_person: string | null
          contract_end_date: string | null
          contract_start_date: string | null
          contract_value: number | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          rating: number | null
          service_type: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          category?: string | null
          contact_person?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          contract_value?: number | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          rating?: number | null
          service_type?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          category?: string | null
          contact_person?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          contract_value?: number | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          rating?: number | null
          service_type?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_ticket_number: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_view_count: { Args: { article_id: string }; Returns: undefined }
    }
    Enums: {
      asset_status: "active" | "inactive" | "maintenance" | "retired"
      event_type: "maintenance" | "meeting" | "deadline" | "other"
      expense_status: "pending" | "approved" | "rejected"
      notification_type:
        | "ticket_assigned"
        | "ticket_updated"
        | "ticket_resolved"
        | "system"
        | "mention"
      ticket_category:
        | "it_support"
        | "software"
        | "hardware"
        | "network"
        | "other"
      ticket_priority: "low" | "medium" | "high" | "critical"
      ticket_status: "open" | "in_progress" | "resolved" | "closed"
      user_role: "admin" | "technician" | "employee"
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
      asset_status: ["active", "inactive", "maintenance", "retired"],
      event_type: ["maintenance", "meeting", "deadline", "other"],
      expense_status: ["pending", "approved", "rejected"],
      notification_type: [
        "ticket_assigned",
        "ticket_updated",
        "ticket_resolved",
        "system",
        "mention",
      ],
      ticket_category: [
        "it_support",
        "software",
        "hardware",
        "network",
        "other",
      ],
      ticket_priority: ["low", "medium", "high", "critical"],
      ticket_status: ["open", "in_progress", "resolved", "closed"],
      user_role: ["admin", "technician", "employee"],
    },
  },
} as const
