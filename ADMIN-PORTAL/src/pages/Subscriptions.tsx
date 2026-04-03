import { useEffect, useMemo, useState } from 'react'
import { fetchSubscriptionRequests, approveSubscriptionRequest, rejectSubscriptionRequest } from '../lib/data'
import { SubscriptionRequestRecord } from '../lib/types'
import { subscribeTable } from '../lib/realtime'

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

export default function Subscriptions() {
  const [requests, setRequests] = useState<SubscriptionRequestRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [selected, setSelected] = useState<SubscriptionRequestRecord | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showNotesModal, setShowNotesModal] = useState<'approve' | 'reject' | null>(null)
  const [adminNotes, setAdminNotes] = useState('')

  useEffect(() => {
    fetchSubscriptionRequests().then((data) => {
      setRequests(data)
      setLoading(false)
    })

    const unsubRealtime = subscribeTable('subscription_requests', () => {
      fetchSubscriptionRequests().then(setRequests)
    })

    return () => unsubRealtime()
  }, [])

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
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
