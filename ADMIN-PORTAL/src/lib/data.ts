import { AccountState, CustomerRecord, Institution, MerchantRecord, StaffRecord, TicketRecord, TransactionRecord, UserRecord, SubscriptionRequestRecord } from './types'
import { supabase, hasSupabase } from './supabase'

const CACHE_KEYS = {
  users: 'adjil_users_cache',
  staff: 'adjil_staff_cache',
  transactions: 'adjil_transactions_cache',
  tickets: 'adjil_tickets_cache'
}

const CACHE_DURATION = 5 * 60 * 1000
const memoryCache = new Map<string, { data: unknown; timestamp: number }>()

const getCached = <T>(key: string): T | null => {
  const cached = memoryCache.get(key)
  if (!cached) return null
  if (Date.now() - cached.timestamp > CACHE_DURATION) {
    memoryCache.delete(key)
    return null
  }
  return cached.data as T
}

const setCache = <T>(key: string, data: T) => {
  memoryCache.set(key, { data, timestamp: Date.now() })
}

export const clearCache = () => {
  Object.values(CACHE_KEYS).forEach(k => memoryCache.delete(k))
}

export const clearCacheFor = (key: string) => {
  memoryCache.delete(key)
}

export const INSTITUTIONS: Institution[] = [
  {
    id: 'bna',
    name: 'البنك الوطني الجزائري',
    name_en: 'BNA - Banque Nationale d\'Algérie',
    name_fr: 'Banque Nationale d\'Algérie',
    logo: '/assets/banks/bna.png',
    code: 'BNA'
  },
  {
    id: 'badr',
    name: 'بنك الفلاحة والتنميةRural',
    name_en: 'BADR - Banque Agriculture et Développement Rural',
    name_fr: 'Banque de l\'Agriculture et du Développement Rural',
    logo: '/assets/banks/badr.jpg',
    code: 'BADR'
  },
  {
    id: 'cnep',
    name: 'الصندوق الوطني للتوفير والاحتياط',
    name_en: 'CNEP - Caisse Nationale d\'Epargne et de Prévoyance',
    name_fr: 'Caisse Nationale d\'Epargne et de Prévoyance',
    logo: '/assets/banks/cnep.png',
    code: 'CNEP'
  },
  {
    id: 'bea',
    name: 'بنك خارجية الجزائر',
    name_en: 'BEA - Banque Extérieure d\'Algérie',
    name_fr: 'Banque Extérieure d\'Algérie',
    logo: '/assets/banks/bea.jpg',
    code: 'BEA'
  },
  {
    id: 'ccp',
    name: 'بريد الجزائر - CCP',
    name_en: 'Algerie Poste - CCP',
    name_fr: 'Algerie Poste - CCP',
    logo: '/assets/banks/ccp.png',
    code: 'CCP'
  },
  {
    id: 'bnp',
    name: 'بي إن بي باريبا',
    name_en: 'BNP Paribas',
    name_fr: 'BNP Paribas',
    logo: '/assets/banks/bnp.png',
    code: 'BNP'
  }
]

export const getInstitutionById = (id: string): Institution | undefined => {
  return INSTITUTIONS.find(inst => inst.id === id)
}

export const getInstitutionByCode = (code: string): Institution | undefined => {
  return INSTITUTIONS.find(inst => inst.code === code)
}

// ============================================
// User Management Functions
// ============================================

export const fetchUsers = async (): Promise<UserRecord[]> => {
  const cached = getCached<UserRecord[]>(CACHE_KEYS.users)
  if (cached) return cached

  if (hasSupabase && supabase) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    const mapped: UserRecord[] = (data || []).map((p: any) => {
      // document_urls is jsonb array of {url, type} or just strings
      // We'll try to map them to specific fields if they have types, otherwise just put them in a list
      const docs = Array.isArray(p.document_urls) ? p.document_urls : []
      
      return {
        id: p.id,
        name: p.name || p.full_name || p.business_name,
        email: p.email,
        phone_number: p.phone, // Assuming phone in users maps to phone_number
        role: p.role,
        status: p.status,
        state: p.status as AccountState, // For backward compat with UI expecting 'state' to be status
        wilaya: p.wilaya, // Geographic state
        city: p.city,
        activity: p.activity || p.business_type,
        balance: p.balance || 0,
        outstanding: p.outstanding || 0,
        credit_limit: p.credit_limit || 0,
        risk_score: p.risk_score,
        created_at: p.created_at,
        frozen_at: p.frozen_at,
        blacklist_due_at: p.blacklist_due_at,
        document_urls: docs,
        // Legacy doc fields mapping (best effort)
        doc_id_front: p.doc_id_front || docs.find((d: any) => (d.type === 'id_front' || d.label?.includes('front')))?.url || (typeof docs[0] === 'string' ? docs[0] : undefined),
        doc_id_back: p.doc_id_back || docs.find((d: any) => (d.type === 'id_back' || d.label?.includes('back')))?.url || (typeof docs[1] === 'string' ? docs[1] : undefined),
        doc_commercial_register: p.doc_commercial_register || docs.find((d: any) => (d.type === 'commercial_register' || d.label?.includes('register')))?.url || (typeof docs[2] === 'string' ? docs[2] : undefined),
      }
    })

    setCache(CACHE_KEYS.users, mapped)
    return mapped
  }

  return []
}

// ============================================
// Customers / Merchants
// ============================================

export const fetchCustomers = async (): Promise<CustomerRecord[]> => {
  const users = await fetchUsers()
  return users
    .filter((u) => u.role === 'customer')
    .map((u) => ({
      id: u.id,
      full_name: u.name,
      email: u.email,
      phone_number: u.phone_number,
      state: u.state,
      city: u.city,
      wilaya: u.wilaya,
      balance: u.balance,
      subscription_plan: u.subscription_plan,
      credit_limit: u.credit_limit,
      created_at: u.created_at,
      risk_score: u.risk_score,
      doc_id_front: u.doc_id_front,
      doc_id_back: u.doc_id_back,
      doc_payslip: u.doc_payslip,
      doc_rib: u.doc_rib
    }))
}

export const fetchMerchants = async (): Promise<MerchantRecord[]> => {
  const users = await fetchUsers()
  return users
    .filter((u) => u.role === 'merchant')
    .map((u) => ({
      id: u.id,
      shop_name: u.name,
      email: u.email,
      phone_number: u.phone_number,
      state: u.state,
      city: u.city,
      wilaya: u.wilaya,
      activity: u.activity,
      balance: u.balance,
      outstanding: u.outstanding,
      credit_limit: u.credit_limit,
      created_at: u.created_at,
      risk_score: u.risk_score,
      doc_id_front: u.doc_id_front,
      doc_id_back: u.doc_id_back,
      doc_commercial_register: u.doc_commercial_register,
      doc_rib: u.doc_rib
    }))
}

export const setCustomerState = async (id: string, state: AccountState): Promise<void> => {
  if (hasSupabase && supabase) {
    const now = new Date().toISOString()
    const updates: any = { status: state }
    if (state === 'frozen') {
      updates.frozen_at = now
      updates.blacklist_due_at = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    }
    if (state === 'active') {
      updates.frozen_at = null
      updates.blacklist_due_at = null
    }
    const { error } = await supabase.from('users').update(updates).eq('id', id)
    if (error) throw error
    clearCache()
  }
}

export const setMerchantState = async (id: string, state: AccountState): Promise<void> => {
  if (hasSupabase && supabase) {
    const now = new Date().toISOString()
    const updates: any = { status: state }
    if (state === 'frozen') {
      updates.frozen_at = now
      updates.blacklist_due_at = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    }
    if (state === 'active') {
      updates.frozen_at = null
      updates.blacklist_due_at = null
    }
    const { error } = await supabase.from('users').update(updates).eq('id', id)
    if (error) throw error
    clearCache()
  }
}

export const getDocumentUrl = (path: string) => {
  if (!hasSupabase || !supabase) return null
  const { data } = supabase.storage.from('user-documents').getPublicUrl(path)
  return data.publicUrl || null
}

export const createStaffViaFunction = async (payload: {
  email: string
  username: string
  password: string
  full_name: string
  role: 'admin' | 'support' | 'partner'
  phone_number?: string
  state?: AccountState
  city?: string
}): Promise<void> => {
  if (!hasSupabase || !supabase) throw new Error('Supabase is not configured')
  
  const { error: functionError } = await supabase.functions.invoke('create-staff', { body: payload })
  
  if (!functionError) {
    clearCache()
    return
  }
  
  console.warn('Edge Function failed, trying direct signUp:', functionError)
  let staffUserId = ''
  const [firstName, ...lastNameParts] = payload.full_name.trim().split(/\s+/)
  const lastName = lastNameParts.join(' ')

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: payload.email,
    password: payload.password,
    options: {
      data: {
        name: payload.full_name,
        username: payload.username,
        role: payload.role,
        phone: payload.phone_number,
        city: payload.city
      }
    }
  })

  if (!signUpError && signUpData?.user?.id) {
    staffUserId = signUpData.user.id
  }

  if (!staffUserId) {
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', payload.email)
      .maybeSingle()
    staffUserId = existingUser?.id || crypto.randomUUID()
  }

  const { error: userUpsertError } = await supabase
    .from('users')
    .upsert(
      [{
        id: staffUserId,
        name: payload.full_name,
        username: payload.username,
        email: payload.email,
        phone: payload.phone_number || null,
        role: payload.role,
        status: payload.state === 'inactive' ? 'inactive' : 'active',
        city: payload.city || null
      }],
      { onConflict: 'id' }
    )
  if (userUpsertError) throw userUpsertError

  const { error: staffUpsertError } = await supabase
    .from('staff')
    .upsert(
      [{
        first_name: firstName || payload.full_name,
        last_name: lastName || '-',
        email: payload.email,
        phone: payload.phone_number || null,
        address: payload.city || null,
        role: payload.role,
        institution: 'Adjil HQ',
        is_active: payload.state !== 'inactive'
      }],
      { onConflict: 'email' }
    )
  if (staffUpsertError) throw staffUpsertError

  if (signUpError) {
    console.warn('Auth signUp failed but staff/user rows were created:', signUpError.message)
  }

  clearCache()
}

export const fetchTeamMembers = async (): Promise<UserRecord[]> => {
  if (hasSupabase && supabase) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .in('role', ['admin', 'administrator', 'partner', 'support', 'ceo'])
    
    if (error) {
      console.error('Error fetching team members:', error)
      return []
    }
    return data || []
  }
  return []
}

export const moveFromBlacklistToFrozen = async (userId: string, reason?: string): Promise<void> => {
  if (hasSupabase && supabase) {
    const { error } = await supabase
      .from('users')
      .update({ status: 'frozen' })
      .eq('id', userId)
    
    if (error) {
      console.error('Error moving user to frozen:', error)
      throw error
    }
    clearCache()
  } else {
    console.log('Moving user to frozen:', userId, reason)
  }
}

export const updateUserStatus = async (userId: string, status: string): Promise<void> => {
  if (hasSupabase && supabase) {
    const now = new Date().toISOString()
    const updates: any = { status }
    if (status === 'frozen') {
      updates.frozen_at = now
      updates.blacklist_due_at = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    }
    if (status === 'active' || status === 'blacklisted') {
      updates.blacklist_due_at = status === 'blacklisted' ? updates.blacklist_due_at : null
      updates.frozen_at = status === 'active' ? null : updates.frozen_at
    }
    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
    
    if (error) {
      console.error('Error updating user status:', error)
      throw error
    }
    clearCache()
  }
}

export const addToBlacklist = async (userId: string): Promise<void> => {
  if (hasSupabase && supabase) {
    const { error } = await supabase
      .from('users')
      .update({ status: 'blacklisted' })
      .eq('id', userId)
    
    if (error) {
      console.error('Error adding user to blacklist:', error)
      throw error
    }
    clearCache()
  }
}

export const removeFromBlacklist = async (userId: string): Promise<void> => {
  if (hasSupabase && supabase) {
    const { error } = await supabase
      .from('users')
      .update({ status: 'active' })
      .eq('id', userId)
    
    if (error) {
      console.error('Error removing user from blacklist:', error)
      throw error
    }
    clearCache()
  }
}

export const deleteTeamMember = async (userId: string): Promise<void> => {
  if (hasSupabase && supabase) {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId)
    
    if (error) {
      console.error('Error deleting team member:', error)
      throw error
    }
  }
}

export const createTeamMember = async (member: {
  name: string
  email: string
  password: string
  role: string
  username: string
}): Promise<void> => {
  if (hasSupabase && supabase) {
    const { error } = await supabase
      .from('users')
      .insert({
        name: member.name,
        email: member.email,
        role: member.role,
        status: 'active'
      })
    
    if (error) {
      console.error('Error creating team member:', error)
      throw error
    }
  }
}

// ============================================
// Staff Table Functions (new staff table)
// ============================================

export const fetchStaff = async (): Promise<StaffRecord[]> => {
  const cached = getCached<StaffRecord[]>(CACHE_KEYS.staff)
  if (cached) return cached
  
  if (hasSupabase && supabase) {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    if (data && data.length > 0) {
      setCache(CACHE_KEYS.staff, data)
      return data
    }
  }
  
  return []
}

export const fetchStaffById = async (id: string): Promise<StaffRecord | null> => {
  if (hasSupabase && supabase) {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  }
  
  return null
}

export const createStaff = async (member: Omit<StaffRecord, 'id' | 'created_at' | 'updated_at' | 'reports_count' | 'messages_count'> & { username?: string }): Promise<void> => {
  if (hasSupabase && supabase) {
    const { error } = await supabase
      .from('users')
      .insert({
        name: `${member.first_name} ${member.last_name}`,
        email: member.email,
        username: member.username,
        role: member.role,
        status: 'active'
      })
    
    if (error) {
      console.error('Error creating staff member in users table:', error)
      throw error
    }
    clearCache()
  }
}

export const updateStaff = async (id: string, updates: Partial<StaffRecord>): Promise<void> => {
  if (hasSupabase && supabase) {
    const { error } = await supabase
      .from('staff')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
    
    if (error) {
      console.error('Error updating staff member:', error)
      throw error
    }
    clearCache()
  }
}

export const deleteStaff = async (id: string): Promise<void> => {
  if (hasSupabase && supabase) {
    const { error } = await supabase
      .from('staff')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('Error deleting staff member:', error)
      throw error
    }
    clearCache()
  }
}

// ============================================
// Transaction Functions
// ============================================

export const fetchTransactions = async (): Promise<TransactionRecord[]> => {
  const cached = getCached<TransactionRecord[]>(CACHE_KEYS.transactions)
  if (cached) return cached
  
  if (hasSupabase && supabase) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    if (data && data.length > 0) {
      setCache(CACHE_KEYS.transactions, data)
      return data
    }
  }
  
  return []
}

export const updateTransactionPaidStatus = async (transactionId: string, paid: boolean): Promise<void> => {
  if (hasSupabase && supabase) {
    const { error } = await supabase
      .from('transactions')
      .update({ 
        paid, 
        paid_at: paid ? new Date().toISOString() : null 
      })
      .eq('id', transactionId)
    
    if (error) {
      console.error('Error updating transaction paid status:', error)
      throw error
    }
    clearCache()
  }
}

export const fetchTickets = async (): Promise<TicketRecord[]> => {
  const cached = getCached<TicketRecord[]>(CACHE_KEYS.tickets)
  if (cached) return cached
  
  if (hasSupabase && supabase) {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    if (data && data.length > 0) {
      setCache(CACHE_KEYS.tickets, data)
      return data
    }
  }
  
  return []
}

const getDemoTickets = (): TicketRecord[] => [
  { id: 't1', user_email: 'ahmed@example.com', subject: 'مشكلة في الدفع', description: 'لا أستطيع إكمال عملية الدفع', status: 'open', created_at: '2024-01-20' },
  { id: 't2', user_email: 'sarah@example.com', subject: 'استفسار حول الفاتورة', description: 'أريد توضيح حول تفاصيل الفاتورة', status: 'pending', created_at: '2024-01-19' },
  { id: 't3', user_email: 'karim@example.com', subject: 'طلب تأجيل دفع', description: 'أرجو تأجيل موعد الدفع لمدة شهر', status: 'resolved', created_at: '2024-01-18' },
  { id: 't4', user_email: 'fatima@example.com', subject: 'مشكلة في الحساب', description: 'لا أستطيع تسجيل الدخول', status: 'open', created_at: '2024-01-17' }
]

// Demo transactions for development
const getDemoTransactions = (): TransactionRecord[] => [
  { id: 'tx1', amount: 25000, method: 'BNPL', status: 'completed', paid: true, paid_at: '2024-01-15', created_at: '2024-01-14', merchant_name: 'متجر الإلكترونيات', customer_name: 'أحمد محمد', merchant_id: 'm1', customer_id: 'u1', merchant_activity: 'إلكترونيات', merchant_location: 'الجزائر', customer_card: '****1234' },
  { id: 'tx2', amount: 15000, method: 'BNPL', status: 'pending', paid: false, created_at: '2024-01-16', merchant_name: 'متجر الملابس', customer_name: 'سارة علي', merchant_id: 'm2', customer_id: 'u2', merchant_activity: 'ملابس', merchant_location: 'وهران', customer_card: '****5678' },
  { id: 'tx3', amount: 8000, method: 'INSTALLMENT', status: 'completed', paid: true, paid_at: '2024-01-10', created_at: '2024-01-08', merchant_name: 'صيدلية المدينة', customer_name: 'كريم بن يوسف', merchant_id: 'm3', customer_id: 'u3', merchant_activity: 'صيدلية', merchant_location: 'قسنطينة', customer_card: '****9012' },
  { id: 'tx4', amount: 45000, method: 'BNPL', status: 'completed', paid: true, paid_at: '2024-01-18', created_at: '2024-01-17', merchant_name: 'معرض السيارات', customer_name: 'فاطمة زهراء', merchant_id: 'm4', customer_id: 'u4', merchant_activity: 'سيارات', merchant_location: 'عنابة', customer_card: '****3456' },
  { id: 'tx5', amount: 12000, method: 'BNPL', status: 'frozen', paid: false, created_at: '2024-01-19', merchant_name: 'مطعم الطعام', customer_name: 'ياسين بوعبد الله', merchant_id: 'm5', customer_id: 'u5', merchant_activity: 'مطعم', merchant_location: 'سطيف', customer_card: '****7890' },
  { id: 'tx6', amount: 35000, method: 'INSTALLMENT', status: 'completed', paid: true, paid_at: '2024-01-20', created_at: '2024-01-19', merchant_name: 'متجر الأثاث', customer_name: 'منى حسن', merchant_id: 'm6', customer_id: 'u6', merchant_activity: 'أثاث', merchant_location: 'الجزائر', customer_card: '****1111' },
  { id: 'tx7', amount: 5000, method: 'BNPL', status: 'pending', paid: false, created_at: '2024-01-21', merchant_name: 'محل التدريب', customer_name: 'رشيد طويل', merchant_id: 'm7', customer_id: 'u7', merchant_activity: 'تعليم', merchant_location: 'وهران', customer_card: '****2222' },
  { id: 'tx8', amount: 20000, method: 'BNPL', status: 'completed', paid: true, paid_at: '2024-01-22', created_at: '2024-01-21', merchant_name: 'صالون تجميل', customer_name: 'هاجر سعيد', merchant_id: 'm8', customer_id: 'u8', merchant_activity: 'تجميل', merchant_location: 'قسنطينة', customer_card: '****3333' }
]

// Demo data for development
const getDemoUsers = (): UserRecord[] => [
  {
    id: '1',
    name: 'أحمد محمد',
    email: 'ahmed@example.com',
    role: 'customer',
    status: 'active',
    balance: 5000,
    location: 'الجزائر'
  },
  {
    id: '2',
    name: 'سارة علي',
    email: 'sarah@example.com',
    role: 'customer',
    status: 'active',
    balance: 0,
    location: 'وهران'
  }
]

// Demo staff data for development
const getDemoStaff = (): StaffRecord[] => [
  {
    id: '1',
    first_name: 'أحمد',
    last_name: 'محمد',
    email: 'ahmed.mohamed@adjil.dz',
    phone: '+213 770 000 001',
    address: 'الجزائر العاصمة',
    role: 'ceo',
    institution: 'Adjil HQ',
    bank_name: 'BNA',
    is_active: true,
    created_at: '2024-01-15',
    reports_count: 5,
    messages_count: 23
  },
  {
    id: '2',
    first_name: 'سارة',
    last_name: 'بلقاسم',
    email: 'sarah.belkasim@adjil.dz',
    phone: '+213 770 000 002',
    address: 'وهران',
    role: 'administrator',
    institution: 'Adjil HQ',
    bank_name: 'CNEP',
    is_active: true,
    created_at: '2024-02-01',
    reports_count: 12,
    messages_count: 45
  },
  {
    id: '3',
    first_name: 'كريم',
    last_name: 'بن يوسف',
    email: 'karim.benyoussef@adjil.dz',
    phone: '+213 770 000 003',
    address: 'قسنطينة',
    role: 'partner',
    institution: 'BNA',
    bank_name: 'BADR',
    is_active: true,
    created_at: '2024-03-10',
    reports_count: 3,
    messages_count: 15
  },
  {
    id: '4',
    first_name: 'فاطمة',
    last_name: 'زهراء',
    email: 'fatima.zahra@adjil.dz',
    phone: '+213 770 000 004',
    address: 'عنابة',
    role: 'support',
    institution: 'Adjil HQ',
    bank_name: 'CCP',
    is_active: true,
    created_at: '2024-04-05',
    reports_count: 8,
    messages_count: 67
  },
  {
    id: '5',
    first_name: 'ياسين',
    last_name: 'بوعبد الله',
    email: 'yacine.bouabdallah@adjil.dz',
    phone: '+213 770 000 005',
    address: 'سطيف',
    role: 'partner',
    institution: 'BADR',
    bank_name: 'BNA',
    is_active: false,
    created_at: '2024-05-20',
    reports_count: 1,
    messages_count: 4
  }
]

// ============================================
// Subscription Requests Functions
// ============================================

const mapRequestDocuments = (u: any): Array<{ key: string; label: string; url: string }> => {
  if (!u) return []
  const typed = [
    { key: 'doc_id_front', label: 'بطاقة التعريف (الوجه الأمامي)', url: u.doc_id_front },
    { key: 'doc_id_back', label: 'بطاقة التعريف (الوجه الخلفي)', url: u.doc_id_back },
    { key: 'doc_payslip', label: 'كشف الراتب', url: u.doc_payslip },
    { key: 'doc_rib', label: 'كشف RIB / RIP', url: u.doc_rib },
    { key: 'doc_commercial_register', label: 'السجل التجاري', url: u.doc_commercial_register },
    { key: 'doc_contract', label: 'العقد الرقمي', url: u.doc_contract }
  ].filter((d) => Boolean(d.url)) as Array<{ key: string; label: string; url: string }>

  const generic = (Array.isArray(u.document_urls) ? u.document_urls : [])
    .map((doc: any, idx: number) => {
      const url = typeof doc === 'string' ? doc : doc?.url
      if (!url) return null
      return {
        key: `generic-${idx}`,
        label: typeof doc === 'string' ? `وثيقة ${idx + 1}` : (doc.label || doc.type || `وثيقة ${idx + 1}`),
        url
      }
    })
    .filter(Boolean) as Array<{ key: string; label: string; url: string }>

  return [...typed, ...generic]
}

export const fetchSubscriptionRequests = async (): Promise<SubscriptionRequestRecord[]> => {
  const cached = getCached<SubscriptionRequestRecord[]>(CACHE_KEYS.users + '_subscriptions')
  if (cached) return cached

  if (hasSupabase && supabase) {
    const { data, error } = await supabase
      .from('subscription_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    const requests = (data || []) as SubscriptionRequestRecord[]
    const userIds = Array.from(new Set(requests.map((r) => r.user_id).filter(Boolean)))
    let usersMap = new Map<string, any>()

    if (userIds.length > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, name, email, phone, role, status, city, wilaya, location, activity, balance, credit_limit, doc_id_front, doc_id_back, doc_payslip, doc_rib, doc_commercial_register, doc_contract, document_urls')
        .in('id', userIds)
      usersMap = new Map((usersData || []).map((u: any) => [u.id, u]))
    }

    const enriched = requests.map((req) => {
      const u = usersMap.get(req.user_id)
      return {
        ...req,
        user_name: req.user_name || u?.name || '—',
        user_email: req.user_email || u?.email || '—',
        user_phone: req.user_phone || u?.phone || '—',
        user_role: (u?.role === 'merchant' ? 'merchant' : 'customer') as 'customer' | 'merchant',
        user_data: u
          ? {
              id: u.id,
              name: u.name,
              email: u.email,
              phone_number: u.phone,
              role: u.role,
              status: u.status,
              city: u.city,
              wilaya: u.wilaya,
              location: u.location,
              activity: u.activity,
              balance: u.balance,
              credit_limit: u.credit_limit,
              doc_id_front: u.doc_id_front,
              doc_id_back: u.doc_id_back,
              doc_payslip: u.doc_payslip,
              doc_rib: u.doc_rib,
              doc_commercial_register: u.doc_commercial_register,
              doc_contract: u.doc_contract,
              document_urls: Array.isArray(u.document_urls) ? u.document_urls : []
            }
          : null,
        request_documents: mapRequestDocuments(u)
      } as SubscriptionRequestRecord
    })

    setCache(CACHE_KEYS.users + '_subscriptions', enriched)
    return enriched
  }

  return []
}

export const approveSubscriptionRequest = async (requestId: string, adminNotes?: string): Promise<void> => {
  if (hasSupabase && supabase) {
    // Get the request to find user_id and credit_limit
    const { data: request } = await supabase
      .from('subscription_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (!request) throw new Error('Request not found')

    // Update request status to approved
    const { error: updateError } = await supabase
      .from('subscription_requests')
      .update({
        status: 'approved',
        admin_notes: adminNotes || null,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', requestId)

    if (updateError) throw updateError

    // Update user's subscription_plan and credit_limit
    const { error: userError } = await supabase
      .from('users')
      .update({
        subscription_plan: request.plan,
        credit_limit: request.credit_limit,
        status: 'active'
      })
      .eq('id', request.user_id)

    if (userError) throw userError

    clearCache()
  }
}

export const rejectSubscriptionRequest = async (requestId: string, adminNotes?: string): Promise<void> => {
  if (hasSupabase && supabase) {
    const { error } = await supabase
      .from('subscription_requests')
      .update({
        status: 'rejected',
        admin_notes: adminNotes || null,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', requestId)

    if (error) throw error
    clearCache()
  }
}
