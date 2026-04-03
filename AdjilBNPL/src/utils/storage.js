import { getSupabaseClient } from '../services/supabaseClient';

// LocalStorage fallback for support tickets
const KEY = 'adjil_support_tickets_offline';

export async function saveLocalTicket(ticket) {
  const supabase = getSupabaseClient();
  
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .insert([{
          user_email: ticket.email || ticket.user_email,
          subject: ticket.subject,
          description: ticket.description || ticket.message,
          status: 'open'
        }]);
      
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Failed to save ticket to Supabase, falling back to LocalStorage:', err);
    }
  }

  // Fallback to LocalStorage if Supabase fails or is not available
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    arr.push({ ...ticket, created_at: new Date().toISOString(), synced: false });
    localStorage.setItem(KEY, JSON.stringify(arr));
  } catch (err) {
    console.warn('Failed to save local ticket:', err);
  }
}

export async function getLocalTickets() {
  const supabase = getSupabaseClient();
  
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Failed to fetch tickets from Supabase, returning LocalStorage:', err);
    }
  }

  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function syncOfflineTickets() {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;

    const offlineTickets = JSON.parse(raw);
    const unsynced = offlineTickets.filter(t => !t.synced);

    if (unsynced.length === 0) return;

    for (const ticket of unsynced) {
      const { error } = await supabase
        .from('support_tickets')
        .insert([{
          user_email: ticket.email || ticket.user_email,
          subject: ticket.subject,
          description: ticket.description || ticket.message,
          status: 'open',
          created_at: ticket.created_at
        }]);
      
      if (!error) {
        ticket.synced = true;
      }
    }

    const remaining = offlineTickets.filter(t => !t.synced);
    if (remaining.length === 0) {
      localStorage.removeItem(KEY);
    } else {
      localStorage.setItem(KEY, JSON.stringify(remaining));
    }
  } catch (err) {
    console.warn('Sync failed:', err);
  }
}

