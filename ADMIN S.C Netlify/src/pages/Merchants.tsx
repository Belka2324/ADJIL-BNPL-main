import { useEffect, useMemo, useState } from 'react'
import { fetchUsers, getDocumentUrl, setMerchantState } from '../lib/data'
import { UserRecord } from '../lib/types'
import { subscribeTable } from '../lib/realtime'

type Props = {
  isAdmin?: boolean
}

const ALGERIA_STATES = [
  '16-الجزائر', '23-عنابة', '31-وهران', '25-قسنطينة', '06-بجاية', '19-سطيف', '09-البليدة', '35-بومرداس', '15-تيزي وزو', '13-تلمسان', '05-باتنة', '07-بسكرة'
]

export default function Merchants({ isAdmin = false }: Props) {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [wilayaFilter, setWilayaFilter] = useState<string>('all')
  const [selected, setSelected] = useState<UserRecord | null>(null)
  const [showActions, setShowActions] = useState(false)
  const [previewDocs, setPreviewDocs] = useState<UserRecord | null>(null)

  useEffect(() => {
    fetchUsers().then((data) => {
      setUsers(data.filter((u) => u.role === 'merchant'))
    })

    const unsubRealtime = subscribeTable('users', () => {
      fetchUsers().then((data) => setUsers(data.filter((u) => u.role === 'merchant')))
    })
    
    return () => unsubRealtime()
  }, [])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    let results = users.filter((u) => {
      const hay = [
        u.name,
        u.email,
        u.phone,
        u.phone_number,
        u.wilaya,
        u.city,
        u.activity
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })

    if (statusFilter !== 'all') {
      results = results.filter((u) => String(u.status || '').toLowerCase() === statusFilter)
    }

    if (wilayaFilter !== 'all') {
      results = results.filter((u) => String(u.wilaya || '').includes(wilayaFilter))
    }

    const order: Record<string, number> = { pending: 0, active: 1, inactive: 2, frozen: 3, blacklisted: 4 }
    return [...results].sort((a, b) => (order[String(a.status || '').toLowerCase()] ?? 99) - (order[String(b.status || '').toLowerCase()] ?? 99))
  }, [query, users, statusFilter, wilayaFilter])

  const setState = async (state: 'pending' | 'active' | 'inactive' | 'frozen' | 'blacklisted') => {
    if (!selected) return
    await setMerchantState(selected.id, state)
    setUsers((prev) => prev.map((u) => (u.id === selected.id ? { ...u, status: state, state } : u)))
    setSelected({ ...selected, status: state, state })
    setShowActions(false)
  }

  const docsFor = (user: UserRecord) => {
    const typed = [
      { key: 'doc_id_front', label: 'بطاقة التعريف (الوجه الأمامي)', url: user.doc_id_front },
      { key: 'doc_id_back', label: 'بطاقة التعريف (الوجه الخلفي)', url: user.doc_id_back },
      { key: 'doc_commercial_register', label: 'السجل التجاري', url: user.doc_commercial_register },
      { key: 'doc_rib', label: 'كشف RIB / RIP', url: user.doc_rib },
      { key: 'doc_contract', label: 'العقد الرقمي', url: user.doc_contract }
    ].filter((d) => Boolean(d.url))

    const generic = (user.document_urls || []).map((doc: any, idx: number) => {
      const url = typeof doc === 'string' ? doc : doc.url
      const label = typeof doc === 'string' ? `وثيقة إضافية ${idx + 1}` : (doc.label || doc.type || `وثيقة إضافية ${idx + 1}`)
      return { key: `generic-${idx}`, label, url }
    }).filter((d: any) => Boolean(d.url))

    return [...typed, ...generic].map(doc => {
      // If it's just a filename, assume it's in the 'user-documents' bucket
      if (doc.url && !String(doc.url).startsWith('http')) {
        return { ...doc, url: getDocumentUrl(String(doc.url)) }
      }
      return doc
    })
  }

  return (
    <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
      <div className="nexus-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="font-bold">التجار / Marchands / Merchants</div>
          <div className="flex items-center gap-2">
             <select
              value={wilayaFilter}
              onChange={(e) => setWilayaFilter(e.target.value)}
              className="bg-slate-100 rounded-xl px-3 py-2 text-sm outline-none"
              title="فلترة حسب الولاية"
            >
              <option value="all">كل الولايات</option>
              {ALGERIA_STATES.map(s => (
                <option key={s} value={s.split('-')[1] || s}>{s}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-100 rounded-xl px-3 py-2 text-sm outline-none"
              title="فلترة حسب الحالة"
            >
              <option value="all">كل الحالات</option>
              <option value="pending">pending</option>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
              <option value="frozen">frozen</option>
              <option value="blacklisted">blacklisted</option>
            </select>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-slate-100 rounded-xl px-4 py-2 text-sm outline-none"
              placeholder="بحث..."
            />
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="text-right py-2">الاسم</th>
                <th className="text-right py-2">الولاية</th>
                <th className="text-right py-2">النشاط</th>
                <th className="text-right py-2">الرصيد</th>
                <th className="text-right py-2">الحالة</th>
                <th className="text-right py-2">الوثائق</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr 
                  key={u.id} 
                  className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => setSelected(u)}
                >
                  <td className="py-3 font-medium text-slate-900" onClick={(e) => { e.stopPropagation(); setPreviewDocs(u); }}>
                    <span className="hover:text-blue-600 underline underline-offset-4 decoration-slate-200">{u.name || '—'}</span>
                  </td>
                  <td className="py-3">{u.wilaya || '—'}</td>
                  <td className="py-3">{u.activity || '—'}</td>
                  <td className="py-3">{Number(u.balance || 0).toLocaleString('fr-DZ')} دج</td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      String(u.status) === 'active' ? 'bg-emerald-100 text-emerald-700' :
                      String(u.status) === 'pending' ? 'bg-amber-100 text-amber-700' :
                      String(u.status) === 'inactive' ? 'bg-slate-200 text-slate-700' :
                      String(u.status) === 'frozen' ? 'bg-blue-100 text-blue-700' :
                      String(u.status) === 'blacklisted' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {(u.status || '—') as string}
                    </span>
                  </td>
                  <td className="py-3">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setPreviewDocs(u); }}
                      className="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-colors"
                    >
                      معاينة ({docsFor(u).length})
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-xs text-slate-400 mt-4 text-center py-8">لا توجد نتائج</div>}
        </div>
      </div>

      {/* Account Details Panel */}
      <div className="nexus-card p-6 space-y-4">
        <div className="font-bold flex items-center justify-between">
          <span>تفاصيل الحساب</span>
          {selected?.status === 'pending' && (
            <button
              onClick={() => setState('active')}
              className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all shadow-sm"
            >
              ✓ تفعيل الآن
            </button>
          )}
        </div>
        {selected ? (
          <div className="space-y-3 text-sm">
            <div className="font-semibold text-lg">{selected.name}</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="text-slate-500">البريد:</div>
              <div className="truncate">{selected.email || '—'}</div>
              <div className="text-slate-500">الهاتف:</div>
              <div>{selected.phone_number || selected.phone || '—'}</div>
              <div className="text-slate-500">النشاط:</div>
              <div>{selected.activity || '—'}</div>
              <div className="text-slate-500">الولاية:</div>
              <div>{selected.wilaya || '—'}</div>
              <div className="text-slate-500">الرصيد:</div>
              <div className="font-semibold">{Number(selected.balance || 0).toLocaleString('fr-DZ')} دج</div>
              <div className="text-slate-500">الحالة:</div>
              <div>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  String(selected.status) === 'active' ? 'bg-emerald-100 text-emerald-700' :
                  String(selected.status) === 'pending' ? 'bg-amber-100 text-amber-700' :
                  'bg-slate-100 text-slate-700'
                }`}>
                  {(selected.status || '—') as string}
                </span>
              </div>
            </div>
            
            {/* Action Buttons - Only for Admin */}
            {isAdmin && (
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="font-semibold mb-2 text-xs">إجراءات التحكم</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowActions(!showActions)}
                    className="flex-1 bg-slate-800 text-white px-3 py-2 rounded-xl text-xs font-medium hover:bg-slate-700 transition-colors"
                  >
                    إجراءات سريعة ▼
                  </button>
                </div>
                
                {showActions && (
                  <div className="grid grid-cols-1 gap-2 mt-2 animate-in slide-in-from-top-2 duration-200">
                    {selected.status !== 'active' && (
                      <button
                        onClick={() => setState('active')}
                        className="w-full bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs font-medium hover:bg-emerald-700 transition-colors"
                      >
                        ✅ تفعيل الحساب
                      </button>
                    )}
                    {selected.status !== 'inactive' && (
                      <button
                        onClick={() => setState('inactive')}
                        className="w-full bg-slate-700 text-white px-3 py-2 rounded-xl text-xs font-medium hover:bg-slate-800 transition-colors"
                      >
                        ⏸️ توقيف الحساب
                      </button>
                    )}
                    {selected.status !== 'frozen' && (
                      <button
                        onClick={() => setState('frozen')}
                        className="w-full bg-blue-600 text-white px-3 py-2 rounded-xl text-xs font-medium hover:bg-blue-700 transition-colors"
                      >
                        ❄️ تجميد الحساب
                      </button>
                    )}
                    {selected.status !== 'blacklisted' && (
                      <button
                        onClick={() => setState('blacklisted')}
                        className="w-full bg-red-600 text-white px-3 py-2 rounded-xl text-xs font-medium hover:bg-red-700 transition-colors"
                      >
                        ⛔ إدراج في القائمة السوداء
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Documents Quick View */}
            <div className="pt-3 border-t border-slate-100">
              <div className="font-semibold mb-2 text-xs">الوثائق</div>
              <button 
                onClick={() => setPreviewDocs(selected)}
                className="w-full text-center py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 hover:border-blue-400 hover:text-blue-500 transition-all text-xs"
              >
                📂 فتح معرض الوثائق ({docsFor(selected).length})
              </button>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-400 text-center py-12">اختر تاجراً لعرض التفاصيل</div>
        )}
      </div>

      {/* Document Preview Modal */}
      {previewDocs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">وثائق التاجر: {previewDocs.name}</h3>
                <p className="text-xs text-slate-500">معاينة المستندات والصور المرفوعة</p>
              </div>
              <button 
                onClick={() => setPreviewDocs(null)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                ×
              </button>
            </div>
            <div className="p-6 overflow-auto bg-slate-50">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs mb-6">
                <div className="bg-white rounded-xl p-3 border border-slate-200"><div className="text-slate-500">اسم التاجر</div><div className="font-semibold">{previewDocs.name || '—'}</div></div>
                <div className="bg-white rounded-xl p-3 border border-slate-200"><div className="text-slate-500">النشاط</div><div className="font-semibold">{previewDocs.activity || '—'}</div></div>
                <div className="bg-white rounded-xl p-3 border border-slate-200"><div className="text-slate-500">العنوان</div><div className="font-semibold">{previewDocs.city || previewDocs.wilaya || '—'}</div></div>
                <div className="bg-white rounded-xl p-3 border border-slate-200"><div className="text-slate-500">الحالة</div><div className="font-semibold">{previewDocs.status || '—'}</div></div>
              </div>
              {docsFor(previewDocs).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {docsFor(previewDocs).map((doc) => {
                     const url = String(doc.url);
                     const label = doc.label;
                     const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
                     return (
                      <div key={doc.key} className="space-y-2 group">
                        <div className="aspect-[4/3] bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 group-hover:shadow-md transition-shadow relative overflow-hidden">
                          {isImage ? (
                            <img 
                              src={url} 
                              alt={label}
                              className="w-full h-full object-cover"
                              onError={(e) => (e.currentTarget.src = 'https://placehold.co/600x400?text=Error+Loading+Image')}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">ملف مستند</div>
                          )}
                          <a 
                            href={url} 
                            target="_blank" 
                            rel="noreferrer"
                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold"
                          >
                            فتح الرابط الأصلي ↗
                          </a>
                        </div>
                        <div className="text-center">
                          <span className="text-xs font-semibold bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">{label}</span>
                        </div>
                      </div>
                     )
                  })}
                </div>
              ) : (
                <div className="text-center py-20 text-slate-400">
                  <div className="text-4xl mb-4">Empty</div>
                  <p>لا توجد وثائق مرفوعة لهذا الحساب</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 bg-white text-center">
              <button 
                onClick={() => setPreviewDocs(null)}
                className="bg-slate-900 text-white px-8 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
