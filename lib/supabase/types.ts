export type ConversationStatus = "active" | "escalated" | "resolved";
export type Urgency = "routine" | "urgent";
export type SenderType = "customer" | "bot" | "vet" | "system";

// These are `type` aliases rather than `interface`s on purpose: interfaces
// aren't structurally assignable to `Record<string, unknown>`, which is what
// supabase-js's GenericTable constraint requires for Row/Insert/Update. Using
// an interface here silently degrades every query's inferred type to `never`.
export type Conversation = {
  id: string;
  customer_name: string | null;
  customer_contact: string | null;
  status: ConversationStatus;
  urgency: Urgency | null;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_type: SenderType;
  sender_id: string | null;
  body: string;
  created_at: string;
};

export type EscalationEvent = {
  id: string;
  conversation_id: string;
  category: string;
  urgency: Urgency | null;
  reason: string;
  classifier_model: string;
  raw_output: Record<string, unknown>;
  created_at: string;
};

export type VetProfile = {
  id: string;
  display_name: string;
  created_at: string;
};

// Minimal hand-written Database type (no generated schema yet). Shaped to
// match supabase-js's GenericTable/GenericSchema constraints (Relationships,
// Views, Functions) — omitting those, or using interfaces for the Row types
// above, makes the client's generics silently degrade to `never`.
export type Database = {
  public: {
    Tables: {
      conversations: {
        Row: Conversation;
        Insert: Partial<Conversation> & { id?: string };
        Update: Partial<Conversation>;
        Relationships: [];
      };
      messages: {
        Row: Message;
        Insert: Partial<Message> & { id?: string };
        Update: Partial<Message>;
        Relationships: [];
      };
      escalation_events: {
        Row: EscalationEvent;
        Insert: Partial<EscalationEvent> & { id?: string };
        Update: Partial<EscalationEvent>;
        Relationships: [];
      };
      vet_profiles: {
        Row: VetProfile;
        Insert: Partial<VetProfile> & { id: string };
        Update: Partial<VetProfile>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
