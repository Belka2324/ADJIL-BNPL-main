import { supabase } from './supabase'

type Unsubscribe = () => void

type RealtimeTable = 'profiles' | 'transactions' | 'staff' | 'users' | 'tickets'

export const subscribeTable = (
  table: RealtimeTable,
  onAnyChange: () => void,
  onError?: (error: string) => void
): Unsubscribe => {
  if (!supabase) return () => {}

  const channel = supabase
    .channel(`rt:${table}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
      onAnyChange()
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.debug(`[realtime] Subscribed to ${table}`)
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`[realtime] Error subscribing to ${table}. Ensure Realtime is enabled on this table in Supabase.`)
        onError?.(`Failed to subscribe to ${table}`)
      } else if (status === 'TIMED_OUT') {
        console.warn(`[realtime] Subscription to ${table} timed out`)
        onError?.(`Subscription to ${table} timed out`)
      }
    })

  return () => {
    if (supabase) supabase.removeChannel(channel)
  }
}