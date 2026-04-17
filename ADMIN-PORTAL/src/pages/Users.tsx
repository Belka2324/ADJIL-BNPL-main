import { useEffect, useMemo, useState } from 'react'
import { fetchTransactions, fetchUsers, getDocumentUrl, setCustomerState } from '../lib/data'
import { TransactionRecord, UserRecord } from '../lib/types'
import { subscribeTable } from '../lib/realtime'
import { supabase, hasSupabase } from '../lib/supabase'

type Props = {
  isAdmin?: boolean
}

const ALGERIA_STATES = [
  '16-الجزائر', '23-عنابة', '31-وهران', '25-قسنطينة', '06-بجاية', '19-سطيف', '09-البليدة', '35-بومرداس', '15-تيزي وزو', '13-تلمسان', '05-باتنة', '07-بسكرة'
]

export default function Users({ isAdmin = false }: Props) {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [transactions, setTransactions] = useState<TransactionRecord[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [wilayaFilter, setWilayaFilter] = useState<string>('all')
  const [selected, setSelected] = useState<UserRecord | null>(null)
  const [showActions, setShowActions] = useState(false)
  const [previewDocs, setPreviewDocs] = useState<UserRecord | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const getDocUrl = (url: string | null | undefined): string | null => {
    if (!url) return null
    if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) return url
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

  // Create form state
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newWilaya, setNewWilaya] = useState('')
  const [newRole, setNewRole] = useState<'customer' | 'merchant'>('customer')
  const [roleFilter, setRoleFilter] = useState<'all' | 'customer' | 'merchant'>('all')

  useEffect(() => {
    console.log('[Users] Loading all users...')
    fetchUsers().then((data) => {
      console.log('[Users] Result:', { total: data.length, roles: [...new Set(data.map(u => u.role))] })
      if (data.length === 0) {
        console.warn('[Users] No users returned - check Supabase connection')
      }
      setUsers(data)
    }).catch((err) => {
      console.error('[Users] Error:', err)
    })
    fetchTransactions().then(setTransactions)

    const unsubRealtime = subscribeTable('users', () => {
      fetchUsers().then((data) => setUsers(data))
    })
    const unsubTx = subscribeTable('transactions', () => fetchTransactions().then(setTransactions))
    return () => {
      unsubRealtime()
      unsubTx()
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    let results = users.filter((u) => {
      const hay = [u.name, u.email, u.phone, u.phone_number, u.wilaya, u.city]
        .filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
    // Filter by role
    if (roleFilter !== 'all') {
      results = results.filter((u) => u.role === roleFilter)
    }
    if (statusFilter !== 'all') {
      results = results.filter((u) => String(u.status || '').toLowerCase() === statusFilter)
    }
    if (wilayaFilter !== 'all') {
      results = results.filter((u) => String(u.wilaya || '').includes(wilayaFilter))
    }
    const order: Record<string, number> = { pending: 0, active: 1, inactive: 2, frozen: 3, blacklisted: 4 }
    return [...results].sort((a, b) => (order[String(a.status || '').toLowerCase()] ?? 99) - (order[String(b.status || '').toLowerCase()] ?? 99))
  }, [query, users, statusFilter, wilayaFilter, roleFilter])

  const userTxs = useMemo(() => {
    if (!selected) return []
    return transactions.filter((t) => t.customer_id === selected.id || t.customer_name === selected.name)
  }, [selected, transactions])

  const setState = async (state: 'pending' | 'active' | 'inactive' | 'frozen' | 'blacklisted') => {
    if (!selected) return
    await setCustomerState(selected.id, state)
    setUsers((prev) => prev.map((u) => (u.id === selected.id ? { ...u, status: state, state } : u)))
    setSelected({ ...selected, status: state, state })
    setShowActions(false)
  }

  const handleCreate = async () => {
    if (!newName || !newEmail || !newPassword) return
    setCreating(true)
    try {
      const newUser = {
        id: crypto.randomUUID(),
        name: newName,
        email: newEmail,
        phone: newPhone,
        password: newPassword,
        role: newRole,
        status: 'active',
        wilaya: newWilaya || null,
        balance: 0,
        outstanding: 0,
        credit_limit: newRole === 'customer' ? 50000 : 0,
        created_at: new Date().toISOString()
      }

      if (hasSupabase && supabase) {
        const { error } = await supabase.from('users').insert([newUser])
        if (error) throw error
      }

      // Refresh users list
      const data = await fetchUsers()
      setUsers(data)
      setShowCreate(false)
      setNewName('')
      setNewEmail('')
      setNewPhone('')
      setNewPassword('')
      setNewWilaya('')
      setNewRole('customer')
    } catch (err: any) {
      alert('خطأ: ' + (err.message || 'فشل إنشاء الحساب'))
    } finally {
      setCreating(false)
    }
  }

  const docsFor = (user: UserRecord) => {
    const typed = [
      { key: 'doc_id_front', label: 'بطاقة التعريف (الوجه الأمامي)', url: user.doc_id_front },
      { key: 'doc_id_back', label: 'بطاقة التعريف (الوجه الخلفي)', url: user.doc_id_back },
      { key: 'doc_payslip', label: 'كشف الراتب', url: user.doc_payslip },
      { key: 'doc_rib', label: 'كشف RIB / RIP', url: user.doc_rib },
      { key: 'doc_commercial_register', label: 'السجل التجاري', url: user.doc_commercial_register }
    ].filter((d) => Boolean(d.url))
    
    const generic = (user.document_urls || []).map((doc: any, idx: number) => {
      const url = typeof doc === 'string' ? doc : doc.url
      const label = typeof doc === 'string' ? `وثيقة ${idx + 1}` : (doc.label || doc.type || `وثيقة ${idx + 1}`)
      return { key: `generic-${idx}`, label, url }
    }).filter((d: any) => Boolean(d.url))
    
    return [...typed, ...generic].map(doc => {
      if (doc.url && !doc.url.startsWith('http')) {
        return { ...doc, url: getDocumentUrl(doc.url) }
      }
      return doc;
    })
  }

  const statusBadge = (status: string | undefined) => {
    const s = String(status || '').toLowerCase()
    const styles: Record<string, string> = {
      active: 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30',
      pending: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
      inactive: 'bg-slate-700/50 text-slate-400 border-white/5',
      frozen: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      blacklisted: 'bg-red-500/10 text-red-400 border-red-500/20'
    }
    return <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${styles[s] || 'bg-slate-700/50 text-slate-400 border-white/5'}`}>{status || '—'}</span>
  }

  return (
    <div className="grid lg:grid-cols-[2fr_1fr] gap-6 animate-fade-in">
      {/* Users Table */}
      <div className="nexus-card p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="font-bold text-sm text-white">الزبائن</div>
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <button onClick={() => setShowCreate(true)}
                className="bg-primary hover:bg-secondary text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg shadow-primary/20 flex items-center gap-1.5">
                <i className="fa-solid fa-user-plus"></i> إضافة
              </button>
            )}
            <select value={wilayaFilter} onChange={(e) => setWilayaFilter(e.target.value)}
              className="bg-dark-900 border border-white/5 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-primary transition-all">
              <option value="all">كل الولايات</option>
              {ALGERIA_STATES.map(s => <option key={s} value={s.split('-')[1] || s}>{s}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-dark-900 border border-white/5 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-primary transition-all">
              <option value="all">كل الحالات</option>
              <option value="pending">معلق</option>
              <option value="active">نشط</option>
              <option value="inactive">غير نشط</option>
              <option value="frozen">مجمد</option>
              <option value="blacklisted">محظور</option>
            </select>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as any)}
              className="bg-dark-900 border border-white/5 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-primary transition-all">
              <option value="all">الكل</option>
              <option value="customer">الزبائن</option>
              <option value="merchant">التجار</option>
            </select>
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              className="bg-dark-900 border border-white/5 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-primary transition-all placeholder:text-slate-600 w-40"
              placeholder="بحث..." />
          </div>
        </div>
        <div className="overflow-auto custom-scrollbar">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-white/5">
                <th className="text-right py-3 px-2 font-medium">الاسم</th>
                <th className="text-right py-3 px-2 font-medium">النوع</th>
                <th className="text-right py-3 px-2 font-medium">الولاية</th>
                <th className="text-right py-3 px-2 font-medium">الرصيد</th>
                <th className="text-right py-3 px-2 font-medium">الحد</th>
                <th className="text-right py-3 px-2 font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} onClick={() => setSelected(u)}
                  className={`border-b border-white/5 cursor-pointer transition-colors hover:bg-white/5 ${selected?.id === u.id ? 'bg-primary/5' : ''}`}>
                  <td className="py-3 px-2 font-medium text-white">{u.name || '—'}</td>
                  <td className="py-3 px-2">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${
                      u.role === 'merchant' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                    }`}>
                      {u.role === 'merchant' ? 'تاجر' : 'زبون'}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-slate-400">{u.wilaya || '—'}</td>
                  <td className="py-3 px-2 text-white">{Number(u.balance || 0).toLocaleString('fr-DZ')} دج</td>
                  <td className="py-3 px-2 text-slate-400">{Number(u.credit_limit || 0).toLocaleString('fr-DZ')} دج</td>
                  <td className="py-3 px-2">{statusBadge(u.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <i className="fa-solid fa-users text-3xl text-slate-600 mb-3"></i>
              <div className="text-xs text-slate-500">لا توجد نتائج</div>
            </div>
          )}
        </div>
      </div>

      {/* Details Panel */}
      <div className="nexus-card p-5 space-y-4">
        <div className="font-bold text-sm text-white flex items-center justify-between">
          <span>تفاصيل الحساب</span>
          {selected?.status === 'pending' && (
            <button onClick={() => setState('active')}
              className="bg-primary text-white px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-secondary transition-all shadow-lg shadow-primary/20">
              <i className="fa-solid fa-check ml-1"></i> تفعيل
            </button>
          )}
        </div>
        {selected ? (
          <div className="space-y-3 text-xs">
            <div className="font-semibold text-lg text-white">{selected.name}</div>
            <div className="grid grid-cols-2 gap-y-2 text-xs">
              <div className="text-slate-500">البريد:</div>
              <div className="text-white truncate">{selected.email || '—'}</div>
              <div className="text-slate-500">الهاتف:</div>
              <div className="text-white">{selected.phone_number || selected.phone || '—'}</div>
              <div className="text-slate-500">الولاية:</div>
              <div className="text-white">{selected.wilaya || '—'}</div>
              <div className="text-slate-500">الرصيد:</div>
              <div className="font-bold text-primary">{Number(selected.balance || 0).toLocaleString('fr-DZ')} دج</div>
              <div className="text-slate-500">الحد الائتماني:</div>
              <div className="text-white">{Number(selected.credit_limit || 0).toLocaleString('fr-DZ')} دج</div>
              <div className="text-slate-500">الحالة:</div>
              <div>{statusBadge(selected.status)}</div>
              <div className="text-slate-500 mt-2">النوع:</div>
              <div className="text-white">{selected.role === 'merchant' ? 'تاجر' : 'زبون'}</div>
            </div>

            {/* Documents Section */}
            {(selected.doc_id_front || selected.doc_id_back || selected.doc_payslip || selected.doc_rib || selected.doc_commercial_register) && (
              <div className="pt-3 border-t border-white/5">
                <div className="font-semibold text-slate-400 mb-2 text-[10px] uppercase tracking-wider">الوثائق</div>
                <div className="grid grid-cols-2 gap-2">
                  {selected.doc_id_front && (
                    <button onClick={() => handleDocClick(selected.doc_id_front)} className="bg-dark-900 border border-white/5 hover:border-primary/30 p-2 rounded-lg text-center cursor-pointer">
                      <i className="fa-solid fa-id-card text-primary mb-1"></i>
                      <div className="text-[10px] text-white">بطاقة التعريف</div>
                    </button>
                  )}
                  {selected.doc_payslip && (
                    <button onClick={() => handleDocClick(selected.doc_payslip)} className="bg-dark-900 border border-white/5 hover:border-green-500/30 p-2 rounded-lg text-center cursor-pointer">
                      <i className="fa-solid fa-file-invoice-dollar text-green-400 mb-1"></i>
                      <div className="text-[10px] text-white">كشف الراتب</div>
                    </button>
                  )}
                  {selected.doc_rib && (
                    <button onClick={() => handleDocClick(selected.doc_rib)} className="bg-dark-900 border border-white/5 hover:border-blue-500/30 p-2 rounded-lg text-center cursor-pointer">
                      <i className="fa-solid fa-building-columns text-blue-400 mb-1"></i>
                      <div className="text-[10px] text-white">RIB</div>
                    </button>
                  )}
                  {selected.doc_commercial_register && (
                    <button onClick={() => handleDocClick(selected.doc_commercial_register)} className="bg-dark-900 border border-white/5 hover:border-yellow-500/30 p-2 rounded-lg text-center cursor-pointer">
                      <i className="fa-solid fa-store text-yellow-400 mb-1"></i>
                      <div className="text-[10px] text-white">السجل التجاري</div>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Document Error Message */}
            {previewError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center mt-2">
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
            
            {isAdmin && (
              <div className="pt-3 border-t border-white/5 space-y-2">
                <div className="font-semibold text-slate-400 mb-2 text-[10px] uppercase tracking-wider">إجراءات</div>
                <button onClick={() => setShowActions(!showActions)}
                  className="w-full bg-dark-900 border border-white/5 text-white px-3 py-2 rounded-xl text-xs font-medium hover:bg-white/5 transition-all">
                  <i className="fa-solid fa-bolt ml-1"></i> إجراءات سريعة <i className="fa-solid fa-chevron-down text-[8px] mr-1"></i>
                </button>
                {showActions && (
                  <div className="grid grid-cols-1 gap-2 animate-fade-in">
                    {selected.status !== 'active' && (
                      <button onClick={() => setState('active')} className="w-full bg-primary/10 border border-primary/20 text-primary px-3 py-2 rounded-xl text-xs font-bold hover:bg-primary/20 transition-all">
                        <i className="fa-solid fa-check ml-1"></i> تفعيل
                      </button>
                    )}
                    {selected.status !== 'inactive' && (
                      <button onClick={() => setState('inactive')} className="w-full bg-slate-700/50 border border-white/5 text-slate-300 px-3 py-2 rounded-xl text-xs font-bold hover:bg-slate-700 transition-all">
                        <i className="fa-solid fa-pause ml-1"></i> توقيف
                      </button>
                    )}
                    {selected.status !== 'frozen' && (
                      <button onClick={() => setState('frozen')} className="w-full bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-2 rounded-xl text-xs font-bold hover:bg-blue-500/20 transition-all">
                        <i className="fa-solid fa-snowflake ml-1"></i> تجميد
                      </button>
                    )}
                    {selected.status !== 'blacklisted' && (
                      <button onClick={() => setState('blacklisted')} className="w-full bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-2 rounded-xl text-xs font-bold hover:bg-red-500/20 transition-all">
                        <i className="fa-solid fa-ban ml-1"></i> حظر
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="pt-3 border-t border-white/5">
              <button onClick={() => setPreviewDocs(selected)}
                className="w-full text-center py-3 border border-dashed border-white/10 rounded-xl text-slate-400 hover:border-primary/30 hover:text-primary transition-all text-xs">
                <i className="fa-solid fa-folder-open ml-1"></i> عرض الوثائق ({docsFor(selected).length})
              </button>
            </div>

            <div className="pt-3 border-t border-white/5">
              <div className="font-semibold text-slate-400 mb-2 text-[10px] uppercase tracking-wider">المعاملات</div>
              <div className="space-y-1 max-h-32 overflow-auto custom-scrollbar">
                {userTxs.slice(0, 5).map((tx) => (
                  <div key={tx.id} className="flex justify-between text-[10px] py-1.5 px-2 bg-dark-900/50 rounded-lg border border-white/5">
                    <span className="text-slate-500 font-mono">TX-{tx.id?.slice(-6)}</span>
                    <span className="text-white font-bold">{Number(tx.amount || 0).toLocaleString('fr-DZ')} دج</span>
                  </div>
                ))}
                {userTxs.length === 0 && <div className="text-[10px] text-slate-600 text-center py-4">لا توجد معاملات</div>}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <i className="fa-solid fa-hand-pointer text-3xl text-slate-600 mb-3"></i>
            <div className="text-xs text-slate-500">اختر حساباً لعرض التفاصيل</div>
          </div>
        )}
      </div>

      {/* Create Customer Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-dark-800 border border-white/5 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="font-bold text-lg text-white">إضافة حساب جديد</div>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-white transition-colors">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>
            <div className="flex gap-2 mb-2">
              <button onClick={() => setNewRole('customer')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${newRole === 'customer' ? 'bg-primary text-white' : 'bg-dark-900 text-slate-400 border border-white/5'}`}>
                <i className="fa-solid fa-user ml-1"></i> زبون
              </button>
              <button onClick={() => setNewRole('merchant')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${newRole === 'merchant' ? 'bg-primary text-white' : 'bg-dark-900 text-slate-400 border border-white/5'}`}>
                <i className="fa-solid fa-store ml-1"></i> تاجر
              </button>
            </div>
            <div className="space-y-3">
              <input value={newName} onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-dark-900 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary transition-all placeholder:text-slate-600"
                placeholder="الاسم الكامل" />
              <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                className="w-full bg-dark-900 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary transition-all placeholder:text-slate-600"
                placeholder="البريد الإلكتروني" type="email" />
              <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)}
                className="w-full bg-dark-900 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary transition-all placeholder:text-slate-600"
                placeholder="رقم الهاتف" />
              <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-dark-900 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary transition-all placeholder:text-slate-600"
                placeholder="كلمة المرور" type="password" />
              <select value={newWilaya} onChange={(e) => setNewWilaya(e.target.value)}
                className="w-full bg-dark-900 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary transition-all">
                <option value="">-- الولاية --</option>
                {ALGERIA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCreate(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/5 text-slate-400 text-sm font-medium hover:bg-white/5 transition-all">
                إلغاء
              </button>
              <button onClick={handleCreate} disabled={creating}
                className="flex-1 px-4 py-2.5 rounded-xl bg-primary hover:bg-secondary text-white text-sm font-bold disabled:opacity-50 transition-all shadow-lg shadow-primary/20">
                {creating ? <><i className="fa-solid fa-circle-notch fa-spin ml-2"></i>جاري...</> : <><i className="fa-solid fa-plus ml-1"></i>إنشاء</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Documents Preview Modal */}
      {previewDocs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-800 border border-white/5 rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-fade-in">
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white">ملفات: {previewDocs.name}</h3>
                <p className="text-xs text-slate-500">وثائق التسجيل</p>
              </div>
              <button onClick={() => setPreviewDocs(null)} className="p-2 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="p-5 overflow-auto custom-scrollbar space-y-4 bg-dark-900/50">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="bg-dark-800 rounded-xl p-3 border border-white/5"><div className="text-slate-500">الاسم</div><div className="font-semibold text-white">{previewDocs.name || '—'}</div></div>
                <div className="bg-dark-800 rounded-xl p-3 border border-white/5"><div className="text-slate-500">البريد</div><div className="font-semibold text-white">{previewDocs.email || '—'}</div></div>
                <div className="bg-dark-800 rounded-xl p-3 border border-white/5"><div className="text-slate-500">الهاتف</div><div className="font-semibold text-white">{previewDocs.phone_number || previewDocs.phone || '—'}</div></div>
                <div className="bg-dark-800 rounded-xl p-3 border border-white/5"><div className="text-slate-500">الولاية</div><div className="font-semibold text-white">{previewDocs.wilaya || '—'}</div></div>
              </div>
              {docsFor(previewDocs).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {docsFor(previewDocs).map((doc) => {
                    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(String(doc.url))
                    return (
                      <div key={doc.key} className="space-y-2">
                        <div className="aspect-[4/3] bg-dark-800 rounded-xl overflow-hidden border border-white/5">
                          {isImage ? (
                            <img src={String(doc.url)} alt={doc.label} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">
                              <i className="fa-solid fa-file text-2xl"></i>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold bg-dark-800 px-2 py-1 rounded border border-white/5 text-slate-400">{doc.label}</span>
                          <a href={String(doc.url)} target="_blank" rel="noreferrer" className="text-[10px] text-primary hover:underline">فتح</a>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-16 text-slate-500">
                  <i className="fa-solid fa-folder-open text-3xl mb-3"></i>
                  <div className="text-sm">لا توجد وثائق</div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-white/5 text-center">
              <button onClick={() => setPreviewDocs(null)} className="bg-primary hover:bg-secondary text-white px-8 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-primary/20">إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
