import { useEffect, useMemo, useState } from 'react'
import { addToBlacklist, fetchUsers, removeFromBlacklist, updateUserStatus } from '../lib/data'
import { UserRecord } from '../lib/types'

type Props = {
  isAdmin?: boolean
}

export default function Frozen({ isAdmin = false }: Props) {
  const [items, setItems] = useState<UserRecord[]>([])
  const [selected, setSelected] = useState<UserRecord | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showBlacklistNowConfirm, setShowBlacklistNowConfirm] = useState(false)
  const [showBlacklistConfirm, setShowBlacklistConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      const data = await fetchUsers()
      const frozenAccounts = data.filter((u) =>
        !['admin', 'partner', 'support', 'administrator', 'ceo'].includes(String(u.role || '').toLowerCase()) &&
        String(u.status || '').toLowerCase() === 'frozen'
      )
      const now = Date.now()
      for (const account of frozenAccounts) {
        const dueAt = account.blacklist_due_at ? new Date(account.blacklist_due_at).getTime() : 0
        if (dueAt > 0 && dueAt <= now) {
          await updateUserStatus(account.id, 'blacklisted')
        }
      }
      const refreshed = await fetchUsers()
      setItems(refreshed.filter((u) =>
        !['admin', 'partner', 'support', 'administrator', 'ceo'].includes(String(u.role || '').toLowerCase()) &&
        String(u.status || '').toLowerCase() === 'frozen'
      ))
    }
    load()
  }, [])

  const countdownText = useMemo(() => {
    if (!selected?.blacklist_due_at) return 'غير محدد'
    const remainMs = new Date(selected.blacklist_due_at).getTime() - Date.now()
    if (remainMs <= 0) return 'انتهت المهلة (جاهز للإدراج بالقائمة السوداء)'
    const hours = Math.floor(remainMs / (1000 * 60 * 60))
    const minutes = Math.floor((remainMs % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours} ساعة و ${minutes} دقيقة`
  }, [selected])

  const handleUnfreeze = async () => {
    if (!selected) return
    setLoading(true)
    try {
      await updateUserStatus(selected.id, 'active')
      setItems((prev) => prev.filter((u) => u.id !== selected.id))
      setSelected(null)
      setShowConfirm(false)
    } catch (error) {
      console.error('Failed to unfreeze account:', error)
    }
    setLoading(false)
  }

  const handleBlacklistNow = async () => {
    if (!selected) return
    setLoading(true)
    try {
      await addToBlacklist(selected.id)
      setItems((prev) => prev.filter((u) => u.id !== selected.id))
      setSelected(null)
      setShowBlacklistNowConfirm(false)
    } catch (error) {
      console.error('Failed to blacklist account:', error)
    }
    setLoading(false)
  }

  const handleRemoveFromBlacklist = async () => {
    if (!selected) return
    setLoading(true)
    try {
      await removeFromBlacklist(selected.id)
      setItems((prev) => prev.filter((u) => u.id !== selected.id))
      setSelected(null)
      setShowBlacklistConfirm(false)
    } catch (error) {
      console.error('Failed to remove from blacklist:', error)
    }
    setLoading(false)
  }

  return (
    <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
      <div className="nexus-card p-6 space-y-4">
        <div className="font-bold">الحسابات المجمدة / Comptes gelés / Frozen Accounts</div>
        {items.length === 0 && <div className="text-xs text-slate-400">لا توجد حسابات مجمدة</div>}
        {items.map((u) => (
          <div 
            key={u.id} 
            className={`flex items-center justify-between border-t border-slate-100 pt-3 text-sm cursor-pointer hover:bg-slate-50 ${selected?.id === u.id ? 'bg-blue-50' : ''}`}
            onClick={() => setSelected(u)}
          >
            <div>{u.name || '—'}</div>
            <div>{u.email || '—'}</div>
            <div className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">{u.status}</div>
          </div>
        ))}
      </div>

      <div className="nexus-card p-6 space-y-4">
        <div className="font-bold">تفاصيل الحساب المجمّد</div>
        {selected ? (
          <div className="space-y-3 text-sm">
            <div className="font-semibold">{selected.name}</div>
            <div>البريد: {selected.email || '—'}</div>
            <div>الهاتف: {selected.phone || '—'}</div>
            <div>الولاية: {selected.wilaya || '—'}</div>
            <div>سبب التجميد: {selected.status}</div>
            <div>مهلة الإدراج في القائمة السوداء: {countdownText}</div>
            <div className="pt-3 border-t border-slate-100">
              {isAdmin ? (
                <>
                  <button
                    onClick={() => setShowConfirm(true)}
                    className="w-full bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors"
                  >
                    ✅ رفع التجميد
                  </button>
                  <button
                    onClick={() => setShowBlacklistNowConfirm(true)}
                    className="w-full mt-2 bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-red-700 transition-colors"
                  >
                    ⛔ إدراج فوري في القائمة السوداء
                  </button>
                  <button
                    onClick={() => setShowBlacklistConfirm(true)}
                    className="w-full mt-2 bg-slate-800 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-900 transition-colors"
                  >
                    ✅ سحب من القائمة السوداء
                  </button>
                </>
              ) : (
                <div className="text-xs text-slate-500 text-center">
                  لا توجد إجراءات متاحة لك
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-400">اختر حساباً لعرض التفاصيل</div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="font-bold text-lg">تأكيد رفع التجميد</div>
              <div className="text-sm text-slate-500">
                هل أنت متأكد من رفع تجميد حساب <span className="font-semibold">{selected?.name}</span>؟
                <br />
                سيتم تحويل الحساب إلى حالة "نشط" ويمكنه استخدام المنصة مرة أخرى.
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleUnfreeze}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'جاري...' : 'تأكيد'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBlacklistNowConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="text-center space-y-4">
              <div className="font-bold text-lg">إدراج فوري في القائمة السوداء</div>
              <div className="text-sm text-slate-500">
                هل تريد إدراج حساب <span className="font-semibold">{selected?.name}</span> مباشرة في القائمة السوداء؟
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowBlacklistNowConfirm(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleBlacklistNow}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'جاري...' : 'تأكيد'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remove from Blacklist Confirmation Modal */}
      {showBlacklistConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="font-bold text-lg">السحب من القائمة السوداء</div>
              <div className="text-sm text-slate-500">
                هل أنت متأكد من سحب حساب <span className="font-semibold">{selected?.name}</span> من القائمة السوداء؟
                <br />
                سيتمكن الحساب من استخدام المنصة مرة أخرى.
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowBlacklistConfirm(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleRemoveFromBlacklist}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'جاري...' : 'تأكيد'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
