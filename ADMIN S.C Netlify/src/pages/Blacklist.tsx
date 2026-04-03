import { useEffect, useState } from 'react'
import { fetchUsers, moveFromBlacklistToFrozen } from '../lib/data'
import { UserRecord } from '../lib/types'
import { RefreshCcw, Loader2 } from 'lucide-react'

export default function Blacklist() {
  const [items, setItems] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const loadData = () => {
    setLoading(true)
    fetchUsers().then((data) => {
      setItems(data.filter((u) => ['blacklist', 'blacklisted'].includes(String(u.status || '').toLowerCase())))
      setLoading(false)
    })
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleMoveToFrozen = async (userId: string) => {
    setProcessingId(userId)
    await moveFromBlacklistToFrozen(userId, 'تم نقل الحساب من القائمة السوداء إلى قائمة المجمدة')
    setProcessingId(null)
    loadData()
  }

  return (
    <div className="nexus-card p-6 space-y-4">
      <div className="font-bold text-lg">القائمة السوداء / Blacklist</div>
      
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin text-blue-600" size={24} />
        </div>
      ) : items.length === 0 ? (
        <div className="text-xs text-slate-400 py-4">لا توجد حسابات في القائمة السوداء</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-100">
                <th className="text-right py-3 px-2 font-medium">الاسم</th>
                <th className="text-right py-3 px-2 font-medium">البريد الإلكتروني</th>
                <th className="text-right py-3 px-2 font-medium">الدور</th>
                <th className="text-right py-3 px-2 font-medium">الحالة</th>
                <th className="text-right py-3 px-2 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-2 text-sm">{u.name || '—'}</td>
                  <td className="py-3 px-2 text-sm text-slate-600">{u.email || '—'}</td>
                  <td className="py-3 px-2 text-sm">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-medium ${
                      u.role === 'merchant' ? 'bg-emerald-100 text-emerald-700' :
                      u.role === 'customer' ? 'bg-blue-100 text-blue-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {u.role === 'merchant' ? 'تاجر' : u.role === 'customer' ? 'عميل' : u.role}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-sm">
                    <span className="px-2 py-1 rounded-full text-[10px] font-medium bg-red-100 text-red-700">
                      قائمة سوداء
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <button
                      onClick={() => handleMoveToFrozen(u.id)}
                      disabled={processingId === u.id}
                      className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-200 transition-colors disabled:opacity-50"
                    >
                      {processingId === u.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <RefreshCcw size={14} />
                      )}
                      سحب الحساب
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
