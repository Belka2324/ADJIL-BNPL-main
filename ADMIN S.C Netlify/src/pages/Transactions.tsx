import { useEffect, useMemo, useState } from 'react'
import { fetchTransactions } from '../lib/data'
import { TransactionRecord } from '../lib/types'
import { subscribeTable } from '../lib/realtime'

export default function Transactions() {
  const [items, setItems] = useState<TransactionRecord[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetchTransactions().then(setItems)
    const unsub = subscribeTable('transactions', () => {
      fetchTransactions().then(setItems)
    })
    return () => unsub()
  }, [])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return items.filter(
      (t) =>
        String(t.id || '').toLowerCase().includes(q) ||
        String(t.customer_name || '').toLowerCase().includes(q) ||
        String(t.merchant_name || '').toLowerCase().includes(q)
    )
  }, [items, query])

  return (
    <div className="nexus-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-bold">المعاملات / Transactions / Opérations</div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="bg-slate-100 rounded-xl px-4 py-2 text-sm outline-none"
          placeholder="بحث"
        />
      </div>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-400">
            <tr>
              <th className="text-right py-2">المعرف</th>
              <th className="text-right py-2">المبلغ</th>
              <th className="text-right py-2">الطريقة</th>
              <th className="text-right py-2">التاجر</th>
              <th className="text-right py-2">الزبون</th>
              <th className="text-right py-2">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="py-3">{t.id}</td>
                <td className="py-3">{Number(t.amount || 0).toLocaleString('fr-DZ')} دج</td>
                <td className="py-3">{t.method || '—'}</td>
                <td className="py-3">{t.merchant_name || '—'}</td>
                <td className="py-3">{t.customer_name || '—'}</td>
                <td className="py-3">{t.status || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-xs text-slate-400 mt-4">لا توجد نتائج</div>}
      </div>
    </div>
  )
}
