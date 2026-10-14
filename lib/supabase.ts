import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Fallback pour éviter le crash Next.js lors du build si les variables ne sont pas encore renseignées
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: typeof window !== 'undefined',
      autoRefreshToken: typeof window !== 'undefined',
    },
  }
);

export const isSupabaseConfigured = () => {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')
  );
};

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'member';
  status: 'pending' | 'approved' | 'rejected';
  avatar_url?: string;
  created_at?: string;
}

export interface Conversation {
  id: string;
  name: string | null;
  is_group: boolean;
  created_by?: string;
  created_at: string;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
  participantIds?: string[];
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_name?: string;
}

export interface FamilyEvent {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  all_day: boolean;
  category: 'famille' | 'anniversaire' | 'ecole' | 'sante' | 'sortie' | 'travail' | 'general';
  color?: string;
  created_by?: string;
  created_at?: string;
  creator_name?: string;
}

export interface FamilyAlert {
  id: string;
  message: string;
  level: 'info' | 'warning' | 'urgent';
  author_name?: string;
  created_by?: string;
  expires_at: string;
  created_at?: string;
  is_active?: boolean;
}
