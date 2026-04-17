import { useEffect, useMemo, useState } from 'react'
import { fetchSubscriptionRequests, approveSubscriptionRequest, rejectSubscriptionRequest, fetchUsers } from '../lib/data'
import { SubscriptionRequestRecord, UserRecord } from '../lib/types'
import { subscribeTable } from '../lib/realtime'
import { supabase, hasSupabase } from '../lib/supabase'

const PLAN_LABELS: Record<string, { ar: string; en: string; price: string }> = {
  monthly: { ar: 'شهري', en: 'Monthly', price: '2,500 دج/شهر' },
  '6months': { ar: '6 أشهر', en: '6 Months', price: '12,000 دج' },
  annual: { ar: 'سنوي', en: 'Annual', price: '20,000 دج' }
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  pending: { bg: 'bg-yellow-400/10', text: 'text-yellow-400', border: 'border-yellow-400/20' },
  approved: { bg: 'bg-[#10b981]/10', text: 'text-[#10b981]', border: 'border-[#10b981]/20' },
  rejected: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  cancelled: { bg: 'bg-slate-700/50', text: 'text-slate-400', border: 'border-white/5' }
}

type UserTab = 'all' | 'merchants' | 'customers'

const DOC_LABELS: Record<string, { ar: string; en: string }> = {
  doc_id_front: { ar: 'بطاقة التعريف (وجه)', en: 'ID Card (Front)' },
  doc_id_back: { ar: 'بطاقة التعريف (ظهر)', en: 'ID Card (Back)' },
  doc_payslip: { ar: 'كشف الراتب', en: 'Payslip' },
  doc_rib: { ar: 'RIB/RIP', en: 'RIB/RIP' },
  doc_commercial_register: { ar: 'السجل التجاري', en: 'Commercial Register' },
  doc_contract: { ar: 'العقد الرقمي', en: 'Digital Contract' }
}

export default function Subscriptions() {
  const [requests, setRequests] = useState<SubscriptionRequestRecord[]>([])
  const [allUsers, setAllUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [userTab, setUserTab] = useState<UserTab>('all')
  const [selected, setSelected] = useState<SubscriptionRequestRecord | null>(null)
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null)
  const [userActionLoading, setUserActionLoading] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showNotesModal, setShowNotesModal] = useState<'approve' | 'reject' | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const getDocUrl = (url: string | null | undefined): string | null => {
    if (!url) return null
    // If it's already a full URL or base64, return as-is
    if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) return url
    // If it's a local path starting with /, it might not work - mark as error
    if (url.startsWith('/')) {
      console.warn('[getDocUrl] Local path detected:', url)
      return null
    }
    return url
  }

  const handleDocClick = (url: string | null | undefined) => {
    const fullUrl = getDocUrl(url)
    if (!fullUrl) {
      setPreviewError('الصورة مخزنة محلياً ولا يمكن عرضها. يرجى إعادة الرفع من تطبيق ADJIL-BNPL.')
      return
    }
    setPreviewError(null)
    setPreviewImage(fullUrl)
  }

  useEffect(() => {
    console.log('[Subscriptions] Loading users...')
    Promise.all([
      fetchSubscriptionRequests(),
      fetchUsers()
    ]).then(([reqData, userData]) => {
      console.log('[Subscriptions] Loaded:', { requests: reqData.length, users: userData.length, userRoles: userData.map(u => u.role) })
      setRequests(reqData)
      setAllUsers(userData)
      setLoading(false)
    })

    const unsubRealtime = subscribeTable('subscription_requests', () => {
      fetchSubscriptionRequests().then(setRequests)
    })
    const unsubUsers = subscribeTable('users', () => {
      fetchUsers().then(setAllUsers)
    })

    return () => {
      unsubRealtime()
      unsubUsers()
    }
  }, [])

  const usersWithDocs = useMemo(() => {
    console.log('[usersWithDocs] allUsers roles:', allUsers.map(u => ({ id: u.id?.slice(0,8), role: u.role, status: u.status, email: u.email })))
    return allUsers.filter(u => 
      // Show all users - regardless of role or status
      u.role === 'merchant' || u.role === 'customer' || !u.role || u.role === null || u.role === undefined
    ).filter(u => 
      // Show all - pending, inactive, frozen OR any users
      u.status === 'pending' || u.status === 'inactive' || u.status === 'frozen' || u.status === 'active' ||
      !u.status ||
      u.doc_id_front || u.doc_id_back || u.doc_payslip || u.doc_rib || u.doc_commercial_register || 
      (u.document_urls && u.document_urls.length > 0)
    )
  }, [allUsers])

  const merchantsWithDocs = useMemo(() => usersWithDocs.filter(u => u.role === 'merchant'), [usersWithDocs])
  const customersWithDocs = useMemo(() => usersWithDocs.filter(u => u.role === 'customer'), [usersWithDocs])

  const displayedUsers = useMemo(() => {
    console.log('[displayedUsers] Result:', { total: usersWithDocs.length, tab: userTab })
    if (userTab === 'merchants') return merchantsWithDocs
    if (userTab === 'customers') return customersWithDocs
    return usersWithDocs
  }, [userTab, merchantsWithDocs, customersWithDocs])

  const filtered = useMemo(() => {
    if (filter === 'all') return requests
    return requests.filter((r) => r.status === filter)
  }, [requests, filter])

  const stats = useMemo(() => ({
    total: requests.length,
    pending: requests.filter((r) => r.status === 'pending').length,
    approved: requests.filter((r) => r.status === 'approved').length,
    rejected: requests.filter((r) => r.status === 'rejected').length
  }), [requests])

  const handleAction = async () => {
    if (!selected || !showNotesModal) return

    setActionLoading(selected.id)
    try {
      if (showNotesModal === 'approve') {
        await approveSubscriptionRequest(selected.id, adminNotes || undefined)
      } else {
        await rejectSubscriptionRequest(selected.id, adminNotes || undefined)
      }
      
      // Refresh data
      const data = await fetchSubscriptionRequests()
      setRequests(data)
      setSelected(null)
      setShowNotesModal(null)
      setAdminNotes('')
    } catch (err: any) {
      alert('خطأ: ' + (err.message || 'فشل执行操作'))
    } finally {
      setActionLoading(null)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('ar-DZ', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateStr
    }
  }

  const roleLabel = (role?: 'customer' | 'merchant') => {
    if (role === 'merchant') return 'تاجر'
    if (role === 'customer') return 'زبون'
    return '—'
  }

  const handleUserActivate = async (user: UserRecord) => {
    console.log('[handleUserActivate] Activating user:', user.id, user.email)
    if (!hasSupabase || !supabase) {
      alert('Supabase غير متصل')
      return
    }
    setUserActionLoading(user.id)
    try {
      const updates = { status: 'active', updated_at: new Date().toISOString() }
      console.log('[handleUserActivate] Sending:', updates)
      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)
      
      if (error) {
        console.error('[handleUserActivate] Error:', error.message)
        alert('خطأ: ' + error.message)
        return
      }
      
      console.log('[handleUserActivate] Success!')
      setAllUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: 'active' } : u))
      if (selectedUser?.id === user.id) {
        setSelectedUser(prev => prev ? { ...prev, status: 'active' } : null)
      }
      alert('تم تفعيل الحساب بنجاح!')
    } catch (err: any) {
      console.error('[handleUserActivate] Exception:', err)
      alert('خطأ: ' + (err.message || 'فشل التفعيل'))
    } finally {
      setUserActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* New Section: Users with e-KYC Documents */}
      {displayedUsers.length > 0 && (
        <div className="nexus-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white">طلبات الاشتراك - الحسابات الجديدة</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setUserTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  userTab === 'all' ? 'bg-primary text-white' : 'bg-dark-800 text-slate-400 border border-white/5'
                }`}
              >
                الكل ({usersWithDocs.length})
              </button>
              <button
                onClick={() => setUserTab('merchants')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  userTab === 'merchants' ? 'bg-blue-500 text-white' : 'bg-dark-800 text-slate-400 border border-white/5'
                }`}
              >
                التجار ({merchantsWithDocs.length})
              </button>
              <button
                onClick={() => setUserTab('customers')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  userTab === 'customers' ? 'bg-purple-500 text-white' : 'bg-dark-800 text-slate-400 border border-white/5'
                }`}
              >
                الزبناء ({customersWithDocs.length})
              </button>
            </div>
          </div>

          <div className="overflow-auto custom-scrollbar">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-white/5">
                  <th className="text-right py-3 px-3 font-medium">الاسم</th>
                  <th className="text-right py-3 px-3 font-medium">النوع</th>
                  <th className="text-right py-3 px-3 font-medium">البريد</th>
                  <th className="text-right py-3 px-3 font-medium">الهاتف</th>
                  <th className="text-right py-3 px-3 font-medium">الولاية</th>
                  <th className="text-right py-3 px-3 font-medium">الحالة</th>
                  <th className="text-right py-3 px-3 font-medium">الوثائق</th>
                </tr>
              </thead>
              <tbody>
                {displayedUsers.map((user) => (
                  <tr
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    className={`border-b border-white/5 cursor-pointer transition-colors hover:bg-white/5 ${
                      selectedUser?.id === user.id ? 'bg-primary/5' : ''
                    }`}
                  >
                    <td className="py-3 px-3 font-medium text-white">{user.name || '—'}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${
                        user.role === 'merchant'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                      }`}>
                        {roleLabel(user.role as 'customer' | 'merchant')}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-400">{user.email || '—'}</td>
                    <td className="py-3 px-3 text-slate-400">{user.phone_number || user.phone || '—'}</td>
                    <td className="py-3 px-3 text-slate-400">{user.wilaya || user.city || '—'}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                        user.status === 'active' ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20' :
                        user.status === 'pending' ? 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20' :
                        user.status === 'inactive' ? 'bg-slate-700/50 text-slate-400 border-white/5' :
                        'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        {user.status === 'active' ? 'نشط' : user.status === 'pending' ? 'معلق' : user.status === 'inactive' ? 'غير نشط' : user.status}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex gap-1">
                        {user.doc_id_front && <span className="w-6 h-6 bg-primary/20 text-primary rounded text-[10px] flex items-center justify-center" title="بطاقة التعريف">ID</span>}
                        {user.doc_payslip && <span className="w-6 h-6 bg-green-500/20 text-green-400 rounded text-[10px] flex items-center justify-center" title="كشف الراتب">PAY</span>}
                        {user.doc_rib && <span className="w-6 h-6 bg-blue-500/20 text-blue-400 rounded text-[10px] flex items-center justify-center" title="RIB">RIB</span>}
                        {user.doc_commercial_register && <span className="w-6 h-6 bg-yellow-500/20 text-yellow-400 rounded text-[10px] flex items-center justify-center" title="السجل التجاري">CR</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-dark-800 border border-white/5 rounded-2xl p-6 max-w-2xl w-full mx-4 shadow-2xl animate-fade-in max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-white">{selectedUser.name}</h3>
              <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-white">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs mb-4">
              <div className="bg-dark-900 p-3 rounded-xl border border-white/5">
                <div className="text-slate-500 mb-1">البريد</div>
                <div className="font-semibold text-white">{selectedUser.email || '—'}</div>
              </div>
              <div className="bg-dark-900 p-3 rounded-xl border border-white/5">
                <div className="text-slate-500 mb-1">الهاتف</div>
                <div className="font-semibold text-white">{selectedUser.phone_number || selectedUser.phone || '—'}</div>
              </div>
              <div className="bg-dark-900 p-3 rounded-xl border border-white/5">
                <div className="text-slate-500 mb-1">النوع</div>
                <div className="font-semibold text-white">{roleLabel(selectedUser.role as 'customer' | 'merchant')}</div>
              </div>
              <div className="bg-dark-900 p-3 rounded-xl border border-white/5">
                <div className="text-slate-500 mb-1">الحالة</div>
                <div className="font-semibold text-white">{selectedUser.status}</div>
              </div>
              <div className="bg-dark-900 p-3 rounded-xl border border-white/5">
                <div className="text-slate-500 mb-1">الولاية</div>
                <div className="font-semibold text-white">{selectedUser.wilaya || selectedUser.city || '—'}</div>
              </div>
              <div className="bg-dark-900 p-3 rounded-xl border border-white/5">
                <div className="text-slate-500 mb-1">النشاط</div>
                <div className="font-semibold text-white">{selectedUser.activity || '—'}</div>
              </div>
              <div className="bg-dark-900 p-3 rounded-xl border border-white/5">
                <div className="text-slate-500 mb-1">تاريخ التسجيل</div>
                <div className="font-semibold text-white">{formatDate(selectedUser.created_at)}</div>
              </div>
              <div className="bg-dark-900 p-3 rounded-xl border border-white/5">
                <div className="text-slate-500 mb-1">الرصيد</div>
                <div className="font-semibold text-primary">{Number(selectedUser.balance || 0).toLocaleString('fr-DZ')} دج</div>
              </div>
            </div>

            {selectedUser.status !== 'active' && (
              <div className="flex gap-3 pt-4 border-t border-white/5">
                <button
                  onClick={() => handleUserActivate(selectedUser)}
                  disabled={Boolean(userActionLoading)}
                  className="flex-1 bg-primary hover:bg-secondary text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  {userActionLoading === selectedUser.id ? (
                    <><i className="fa-solid fa-circle-notch fa-spin ml-2"></i> جاري التفعيل...</>
                  ) : (
                    <><i className="fa-solid fa-check ml-2"></i> تأكيد و تفعيل الحساب</>
                  )}
                </button>
              </div>
            )}

            <div className="space-y-3">
              <h4 className="font-bold text-white text-sm">الوثائق (e-KYC)</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {selectedUser.doc_id_front && (
                  <button onClick={() => handleDocClick(selectedUser.doc_id_front)} className="bg-dark-900 border border-white/5 hover:border-primary/30 text-white rounded-xl p-3 text-xs transition-all flex flex-col items-center gap-2 cursor-pointer">
                    <i className="fa-regular fa-id-card text-2xl text-primary"></i>
                    <span>بطاقة التعريف (أمامي)</span>
                  </button>
                )}
                {selectedUser.doc_id_back && (
                  <button onClick={() => handleDocClick(selectedUser.doc_id_back)} className="bg-dark-900 border border-white/5 hover:border-primary/30 text-white rounded-xl p-3 text-xs transition-all flex flex-col items-center gap-2 cursor-pointer">
                    <i className="fa-regular fa-id-card text-2xl text-secondary"></i>
                    <span>بطاقة التعريف (خلفي)</span>
                  </button>
                )}
                {selectedUser.doc_payslip && (
                  <button onClick={() => handleDocClick(selectedUser.doc_payslip)} className="bg-dark-900 border border-white/5 hover:border-green-500/30 text-white rounded-xl p-3 text-xs transition-all flex flex-col items-center gap-2 cursor-pointer">
                    <i className="fa-solid fa-file-invoice-dollar text-2xl text-green-400"></i>
                    <span>كشف الراتب</span>
                  </button>
                )}
                {selectedUser.doc_rib && (
                  <button onClick={() => handleDocClick(selectedUser.doc_rib)} className="bg-dark-900 border border-white/5 hover:border-blue-500/30 text-white rounded-xl p-3 text-xs transition-all flex flex-col items-center gap-2 cursor-pointer">
                    <i className="fa-solid fa-building-columns text-2xl text-blue-400"></i>
                    <span>RIB / RIP</span>
                  </button>
                )}
                {selectedUser.doc_commercial_register && (
                  <button onClick={() => handleDocClick(selectedUser.doc_commercial_register)} className="bg-dark-900 border border-white/5 hover:border-yellow-500/30 text-white rounded-xl p-3 text-xs transition-all flex flex-col items-center gap-2 cursor-pointer">
                    <i className="fa-solid fa-store text-2xl text-yellow-400"></i>
                    <span>السجل التجاري</span>
                  </button>
                )}
                {selectedUser.doc_contract && (
                  <button onClick={() => handleDocClick(selectedUser.doc_contract)} className="bg-dark-900 border border-white/5 hover:border-purple-500/30 text-white rounded-xl p-3 text-xs transition-all flex flex-col items-center gap-2 cursor-pointer">
                    <i className="fa-solid fa-file-signature text-2xl text-purple-400"></i>
                    <span>العقد الرقمي</span>
                  </button>
                )}
              </div>
              {(!selectedUser.doc_id_front && !selectedUser.doc_id_back && !selectedUser.doc_payslip && !selectedUser.doc_rib && !selectedUser.doc_commercial_register && !selectedUser.doc_contract) && (
                <div className="text-center py-8 text-slate-500">لا توجد وثائق مرفوعة</div>
              )}
            </div>

            {/* Document Error Message */}
            {previewError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                <i className="fa-solid fa-exclamation-triangle text-red-400 text-xl mb-2"></i>
                <div className="text-red-400 text-sm">{previewError}</div>
              </div>
            )}

            {/* Image Preview Modal */}
            {(previewImage || previewError) && (
              <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { setPreviewImage(null); setPreviewError(null) }}>
                <div className="relative max-w-4xl w-full max-h-[90vh] overflow-auto bg-dark-800 rounded-xl p-4" onClick={e => e.stopPropagation()}>
                  <button onClick={() => { setPreviewImage(null); setPreviewError(null) }} className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg transition-colors z-10">
                    <i className="fa-solid fa-xmark text-xl"></i>
                  </button>
                  {previewError ? (
                    <div className="text-center py-12">
                      <i className="fa-solid fa-exclamation-triangle text-4xl text-yellow-400 mb-4"></i>
                      <div className="text-yellow-400">{previewError}</div>
                    </div>
                  ) : previewImage && (
                    <img 
                      src={previewImage} 
                      alt="Document" 
                      className="w-full h-auto rounded-lg"
                      onError={(e) => {
                        console.warn('[Preview] Failed to load image:', previewImage)
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                        const parent = target.parentElement
                        if (parent) {
                          parent.innerHTML = '<div class="text-center text-red-400 p-8"><i class="fa-solid fa-exclamation-triangle text-3xl mb-2"></i><div>تعذر تحميل الصورة - الرابط غير صالح</div></div>'
                        }
                      }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="nexus-card p-4">
          <div className="text-xs text-slate-500 mb-1">الكل</div>
          <div className="text-2xl font-bold text-white">{stats.total}</div>
        </div>
        <div className="nexus-card p-4 border-l-2 border-yellow-400">
          <div className="text-xs text-slate-500 mb-1">معلق</div>
          <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
        </div>
        <div className="nexus-card p-4 border-l-2 border-[#10b981]">
          <div className="text-xs text-slate-500 mb-1">موافق</div>
          <div className="text-2xl font-bold text-[#10b981]">{stats.approved}</div>
        </div>
        <div className="nexus-card p-4 border-l-2 border-red-400">
          <div className="text-xs text-slate-500 mb-1">مرفوض</div>
          <div className="text-2xl font-bold text-red-400">{stats.rejected}</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            filter === 'all' ? 'bg-primary text-white' : 'bg-dark-800 text-slate-400 border border-white/5'
          }`}
        >
          الكل ({stats.total})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            filter === 'pending' ? 'bg-yellow-400 text-black' : 'bg-dark-800 text-slate-400 border border-white/5'
          }`}
        >
          معلق ({stats.pending})
        </button>
        <button
          onClick={() => setFilter('approved')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            filter === 'approved' ? 'bg-[#10b981] text-white' : 'bg-dark-800 text-slate-400 border border-white/5'
          }`}
        >
          موافق ({stats.approved})
        </button>
        <button
          onClick={() => setFilter('rejected')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            filter === 'rejected' ? 'bg-red-500 text-white' : 'bg-dark-800 text-slate-400 border border-white/5'
          }`}
        >
          مرفوض ({stats.rejected})
        </button>
      </div>

      {/* Requests Table */}
      <div className="nexus-card p-5">
        <div className="overflow-auto custom-scrollbar">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-white/5">
                <th className="text-right py-3 px-3 font-medium">الاسم</th>
                <th className="text-right py-3 px-3 font-medium">النوع</th>
                <th className="text-right py-3 px-3 font-medium">البريد</th>
                <th className="text-right py-3 px-3 font-medium">الهاتف</th>
                <th className="text-right py-3 px-3 font-medium">الباقة</th>
                <th className="text-right py-3 px-3 font-medium">الحد الائتماني</th>
                <th className="text-right py-3 px-3 font-medium">الحالة</th>
                <th className="text-right py-3 px-3 font-medium">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((req) => (
                <tr
                  key={req.id}
                  onClick={() => setSelected(req)}
                  className={`border-b border-white/5 cursor-pointer transition-colors hover:bg-white/5 ${
                    selected?.id === req.id ? 'bg-primary/5' : ''
                  }`}
                >
                  <td className="py-3 px-3 font-medium text-white">{req.user_name || '—'}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${
                      req.user_role === 'merchant'
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                    }`}>
                      {roleLabel(req.user_role)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-400">{req.user_email || '—'}</td>
                  <td className="py-3 px-3 text-slate-400">{req.user_phone || '—'}</td>
                  <td className="py-3 px-3">
                    <span className="bg-primary/10 text-primary px-2 py-1 rounded-lg text-[10px] font-bold">
                      {PLAN_LABELS[req.plan]?.ar || req.plan}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-white font-bold">
                    {Number(req.credit_limit || 0).toLocaleString('fr-DZ')} دج
                  </td>
                  <td className="py-3 px-3">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                      STATUS_COLORS[req.status]?.bg || 'bg-slate-700/50'
                    } ${STATUS_COLORS[req.status]?.text || 'text-slate-400'} ${
                      STATUS_COLORS[req.status]?.border || 'border-white/5'
                    }`}>
                      {req.status === 'pending' ? 'معلق' : req.status === 'approved' ? 'موافق' : req.status === 'rejected' ? 'مرفوض' : req.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-500">{formatDate(req.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-16">
              <i className="fa-solid fa-inbox text-4xl text-slate-600 mb-4"></i>
              <div className="text-sm text-slate-500">لا توجد طلبات</div>
            </div>
          )}
        </div>
      </div>

      {/* Details Panel & Actions */}
      {selected && (
        <div className="nexus-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white">تفاصيل الطلب</h3>
            <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-white">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="bg-dark-900 p-3 rounded-xl border border-white/5">
              <div className="text-slate-500 mb-1">الاسم</div>
              <div className="font-semibold text-white">{selected.user_name || '—'}</div>
            </div>
            <div className="bg-dark-900 p-3 rounded-xl border border-white/5">
              <div className="text-slate-500 mb-1">نوع الحساب</div>
              <div className="font-semibold text-white">{roleLabel(selected.user_role)}</div>
            </div>
            <div className="bg-dark-900 p-3 rounded-xl border border-white/5">
              <div className="text-slate-500 mb-1">البريد</div>
              <div className="font-semibold text-white truncate">{selected.user_email || '—'}</div>
            </div>
            <div className="bg-dark-900 p-3 rounded-xl border border-white/5">
              <div className="text-slate-500 mb-1">الهاتف</div>
              <div className="font-semibold text-white">{selected.user_phone || '—'}</div>
            </div>
            <div className="bg-dark-900 p-3 rounded-xl border border-white/5">
              <div className="text-slate-500 mb-1">الباقة</div>
              <div className="font-semibold text-primary">
                {PLAN_LABELS[selected.plan]?.ar} ({PLAN_LABELS[selected.plan]?.price})
              </div>
            </div>
            <div className="bg-dark-900 p-3 rounded-xl border border-white/5">
              <div className="text-slate-500 mb-1">الحد الائتماني</div>
              <div className="font-semibold text-white">{Number(selected.credit_limit || 0).toLocaleString('fr-DZ')} دج</div>
            </div>
            <div className="bg-dark-900 p-3 rounded-xl border border-white/5">
              <div className="text-slate-500 mb-1">الحالة</div>
              <div className={`font-semibold ${
                selected.status === 'pending' ? 'text-yellow-400' :
                selected.status === 'approved' ? 'text-[#10b981]' :
                selected.status === 'rejected' ? 'text-red-400' : 'text-slate-400'
              }`}>
                {selected.status === 'pending' ? 'معلق' : selected.status === 'approved' ? 'موافق' : selected.status === 'rejected' ? 'مرفوض' : selected.status}
              </div>
            </div>
            <div className="bg-dark-900 p-3 rounded-xl border border-white/5 col-span-2">
              <div className="text-slate-500 mb-1">تاريخ الطلب</div>
              <div className="font-semibold text-white">{formatDate(selected.created_at)}</div>
            </div>
            <div className="bg-dark-900 p-3 rounded-xl border border-white/5">
              <div className="text-slate-500 mb-1">الحالة الحالية للحساب</div>
              <div className="font-semibold text-white">{selected.user_data?.status || '—'}</div>
            </div>
            <div className="bg-dark-900 p-3 rounded-xl border border-white/5">
              <div className="text-slate-500 mb-1">الولاية / المدينة</div>
              <div className="font-semibold text-white">{selected.user_data?.wilaya || selected.user_data?.city || '—'}</div>
            </div>
          </div>

          <div className="bg-dark-900 p-4 rounded-xl border border-white/5">
            <div className="text-slate-500 mb-3 text-xs">الوثائق المرفوعة</div>
            {selected.request_documents && selected.request_documents.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-2">
                {selected.request_documents.map((doc) => (
                  <a
                    key={doc.key}
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-dark-800 border border-white/5 hover:border-primary/30 text-white rounded-xl px-3 py-2 text-xs transition-all flex items-center justify-between"
                  >
                    <span>{doc.label}</span>
                    <i className="fa-solid fa-up-right-from-square text-slate-400"></i>
                  </a>
                ))}
              </div>
            ) : (
              <div className="text-slate-500 text-xs">لا توجد وثائق مرتبطة بهذا الطلب</div>
            )}
          </div>

          {selected.admin_notes && (
            <div className="bg-dark-900 p-3 rounded-xl border border-white/5">
              <div className="text-slate-500 mb-1 text-xs">ملاحظات المسؤول</div>
              <div className="text-white text-sm">{selected.admin_notes}</div>
            </div>
          )}

          {selected.status === 'pending' && (
            <div className="flex gap-3 pt-4 border-t border-white/5">
              <button
                onClick={() => setShowNotesModal('approve')}
                className="flex-1 bg-[#10b981] hover:bg-[#059669] text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-[#10b981]/20"
              >
                <i className="fa-solid fa-check ml-2"></i>
                قبول
              </button>
              <button
                onClick={() => setShowNotesModal('reject')}
                className="flex-1 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
              >
                <i className="fa-solid fa-xmark ml-2"></i>
                رفض
              </button>
            </div>
          )}
        </div>
      )}

      {/* Notes Modal */}
      {showNotesModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-dark-800 border border-white/5 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-white">
                {showNotesModal === 'approve' ? 'قبول الطلب' : 'رفض الطلب'}
              </h3>
              <button onClick={() => { setShowNotesModal(null); setAdminNotes('') }} className="text-slate-400 hover:text-white">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="ملاحظات (اختياري)"
              className="w-full bg-dark-900 border border-white/5 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary transition-all placeholder:text-slate-600 h-24 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setShowNotesModal(null); setAdminNotes('') }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/5 text-slate-400 text-sm font-medium hover:bg-white/5 transition-all"
              >
                إلغاء
              </button>
              <button
                onClick={handleAction}
                disabled={Boolean(actionLoading)}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  showNotesModal === 'approve'
                    ? 'bg-[#10b981] hover:bg-[#059669] text-white shadow-lg shadow-[#10b981]/20'
                    : 'bg-red-500 hover:bg-red-600 text-white'
                } disabled:opacity-50`}
              >
                {actionLoading ? (
                  <><i className="fa-solid fa-circle-notch fa-spin ml-2"></i> جاري...</>
                ) : (
                  showNotesModal === 'approve' ? 'تأكيد القبول' : 'تأكيد الرفض'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
