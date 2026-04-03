export type Role = 'admin' | 'support' | 'partner' | 'merchant' | 'customer' | 'administrator' | 'ceo'

export type StaffRole = 'admin' | 'support' | 'partner' | 'administrator' | 'ceo'

export type AccountState = 'pending' | 'active' | 'inactive' | 'frozen' | 'blacklisted'

export type StaffRecord = {
  id: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  address?: string
  role: StaffRole
  institution?: string
  bank_name?: string
  avatar_url?: string
  is_active?: boolean
  created_at?: string
  updated_at?: string
  reports_count?: number
  messages_count?: number
}

export type CustomerRecord = {
  id: string
  full_name?: string
  email?: string
  phone_number?: string
  state?: AccountState
  city?: string
  wilaya?: string
  balance?: number
  subscription_plan?: string
  credit_limit?: number
  created_at?: string
  risk_score?: number
  doc_id_front?: string
  doc_id_back?: string
  doc_payslip?: string
  doc_rib?: string
}

export type MerchantRecord = {
  id: string
  shop_name?: string
  email?: string
  phone_number?: string
  state?: AccountState
  city?: string
  wilaya?: string
  activity?: string
  location?: string
  coords?: string
  balance?: number
  outstanding?: number
  credit_limit?: number
  created_at?: string
  risk_score?: number
  doc_id_front?: string
  doc_id_back?: string
  doc_commercial_register?: string
  doc_rib?: string
  doc_contract?: string
  last_synced_at?: string
}

// Backward-compatible type for existing pages.
export type UserRecord = {
  id: string
  name?: string
  email?: string
  phone?: string
  phone_number?: string
  role?: 'customer' | 'merchant' | 'admin' | 'partner' | 'support' | 'administrator' | 'ceo'
  status?: AccountState | string
  state?: AccountState
  city?: string
  wilaya?: string
  balance?: number
  outstanding?: number
  subscription_plan?: string
  credit_limit?: number
  location?: string
  activity?: string
  coords?: string
  risk_score?: number
  created_at?: string
  last_synced_at?: string
  frozen_at?: string
  blacklist_due_at?: string
  doc_id_front?: string
  doc_id_back?: string
  doc_payslip?: string
  doc_rib?: string
  doc_commercial_register?: string
  doc_contract?: string
  document_urls?: any[]
}

export type TransactionRecord = {
  id: string
  amount?: number
  method?: string
  status?: string
  paid?: boolean
  paid_at?: string
  created_at?: string
  merchant_name?: string
  customer_name?: string
  merchant_id?: string
  customer_id?: string
  merchant_activity?: string
  merchant_location?: string
  customer_card?: string
  invoice_number?: string
  store_number?: string
  linked_tx_id?: string
  payment_channel?: string
  cash_collected?: boolean
  cash_collected_at?: string
  cash_collection_status?: string
}

export type TicketRecord = {
  id: string
  user_email?: string
  subject?: string
  description?: string
  status?: string
  created_at?: string
}

export type StaffReport = {
  id: string
  staff_id: string
  title: string
  description: string
  type: 'warning' | 'complaint' | 'praise' | 'other'
  created_by: string
  created_at: string
}

export type StaffCommunication = {
  id: string
  staff_id: string
  subject: string
  body: string
  direction: 'incoming' | 'outgoing'
  created_at: string
}

export type Institution = {
  id: string
  name: string
  name_en: string
  name_fr: string
  logo: string
  code: string
}

export type SubscriptionRequestRecord = {
  id: string
  created_at: string
  updated_at: string
  user_id: string
  user_name: string
  user_email: string
  user_phone: string
  plan: 'monthly' | '6months' | 'annual'
  credit_limit: number
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  admin_notes: string
  reviewed_by: string
  reviewed_at: string
}
