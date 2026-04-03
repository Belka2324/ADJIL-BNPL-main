import { useEffect, useMemo, useState } from 'react'
import { fetchTransactions, updateTransactionPaidStatus } from '../lib/data'
import { TransactionRecord } from '../lib/types'
import { subscribeTable } from '../lib/realtime'

const toCsv = (rows: TransactionRecord[]) => {
  const header = ['id', 'amount', 'method', 'status', 'created_at', 'merchant_name', 'customer_name']
  const lines = rows.map((r) => [
    r.id,
    r.amount ?? '',
    r.method ?? '',
    r.status ?? '',
    r.created_at ?? '',
    r.merchant_name ?? '',
    r.customer_name ?? ''
  ])
  return [header.join(','), ...lines.map((l) => l.join(','))].join('\n')
}

export default function Invoices() {
  const [items, setItems] = useState<TransactionRecord[]>([])
  const [selected, setSelected] = useState<TransactionRecord | null>(null)

  useEffect(() => {
    fetchTransactions().then(setItems)
    const unsub = subscribeTable('transactions', () => {
      fetchTransactions().then(setItems)
    })
    return () => unsub()
  }, [])

  const total = useMemo(
    () => items.reduce((sum, t) => sum + Number(t.amount || 0), 0),
    [items]
  )
  const cashCollectedTotal = useMemo(
    () => items.filter((t) => String(t.method || '').includes('CASH_COLLECTION')).reduce((sum, t) => sum + Number(t.amount || 0), 0),
    [items]
  )

  const handleExport = () => {
    const blob = new Blob([toCsv(items)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'adjil_invoices.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // Format date for display
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—'
    const date = new Date(dateStr)
    return date.toLocaleDateString('ar-DZ', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
      <div className="nexus-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="font-bold">إدارة الفواتير / Factures / Invoices</div>
          <button onClick={handleExport} className="bg-nexus-accent text-white px-4 py-2 rounded-xl text-sm">
            تصدير CSV
          </button>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="text-sm text-slate-500">إجمالي المبالغ: {total.toLocaleString('fr-DZ')} دج</div>
          <div className="text-sm text-amber-600 font-semibold">المبالغ المحصلة نقداً من التاجر: {cashCollectedTotal.toLocaleString('fr-DZ')} دج</div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="text-right py-2">المعرف</th>
                <th className="text-right py-2">المبلغ</th>
                <th className="text-right py-2">الطريقة</th>
                <th className="text-right py-2">الحالة</th>
                <th className="text-right py-2">الدفع</th>
                <th className="text-right py-2">التحصيل النقدي</th>
                <th className="text-right py-2">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr 
                  key={t.id} 
                  className={`border-t border-slate-100 hover:bg-slate-50 cursor-pointer ${selected?.id === t.id ? 'bg-blue-50' : ''}`}
                  onClick={() => setSelected(t)}
                >
                  <td className="py-3 font-mono text-xs">{t.id?.slice(0, 12)}...</td>
                  <td className="py-3 font-semibold">{Number(t.amount || 0).toLocaleString('fr-DZ')} دج</td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      String(t.method || '').includes('CASH_COLLECTION') ? 'bg-amber-100 text-amber-700' :
                      t.method === 'BNPL' ? 'bg-blue-100 text-blue-700' :
                      t.method === 'card' ? 'bg-purple-100 text-purple-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {t.method || '—'}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      t.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                      t.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      t.status === 'failed' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {t.status || '—'}
                    </span>
                  </td>
                  <td className="py-3">
                    {t.paid ? (
                      <span className="text-green-600 font-semibold">✅ تم الدفع</span>
                    ) : (
                      <span className="text-yellow-600">⏳ Pending</span>
                    )}
                  </td>
                  <td className="py-3">
                    {String(t.method || '').includes('CASH_COLLECTION') ? (
                      <span className="text-amber-600 font-semibold">💵 تم التحصيل نقدًا</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3 text-xs text-slate-500">{formatDate(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && <div className="text-xs text-slate-400 mt-4">لا توجد بيانات</div>}
        </div>
      </div>

      {/* Invoice Details Panel */}
      <div className="nexus-card p-6 space-y-4">
        <div className="font-bold">تفاصيل الفاتورة</div>
        {selected ? (
          <div className="space-y-4 text-sm">
            {/* Invoice Header */}
            <div className="bg-slate-800 text-white p-4 rounded-xl -mx-2">
              <div className="text-xs text-slate-300">رقم الفاتورة</div>
              <div className="font-mono font-bold">{selected.id}</div>
            </div>

            {/* Amount */}
            <div className="text-center py-4 border-b border-slate-100">
              <div className="text-xs text-slate-500">المبلغ</div>
              <div className="text-3xl font-black text-slate-800">
                {Number(selected.amount || 0).toLocaleString('fr-DZ')} دج
              </div>
            </div>

            {/* Details */}
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-500">طريقة الدفع:</span>
                <span className="font-medium">{selected.method || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">نوع التسوية:</span>
                <span className="font-medium">
                  {String(selected.method || '').includes('CASH_COLLECTION') ? 'تحصيل نقدي من التاجر' : 'تسوية عادية'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">الحالة:</span>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  selected.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                  selected.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  selected.status === 'failed' ? 'bg-red-100 text-red-700' :
                  'bg-slate-100 text-slate-700'
                }`}>
                  {selected.status || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">دفع التاجر:</span>
                {selected.paid ? (
                  <span className="text-green-600 font-semibold">✅ تم الدفع</span>
                ) : (
                  <span className="text-yellow-600">⏳ Pending</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">التاريخ:</span>
                <span className="font-medium">{formatDate(selected.created_at)}</span>
              </div>
            </div>

            {/* Customer & Merchant Info */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="font-semibold">معلومات المعاملة</div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl">
                  <div className="text-slate-500 mb-1">الزبون</div>
                  <div className="font-medium">{selected.customer_name || '—'}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl">
                  <div className="text-slate-500 mb-1">التاجر</div>
                  <div className="font-medium">{selected.merchant_name || '—'}</div>
                </div>
              </div>
              {selected.customer_card && (
                <div className="bg-slate-50 p-3 rounded-xl">
                  <div className="text-slate-500 mb-1">بطاقة الزبون</div>
                  <div className="font-mono font-medium">{selected.customer_card}</div>
                </div>
              )}
              {selected.merchant_location && (
                <div className="bg-slate-50 p-3 rounded-xl">
                  <div className="text-slate-500 mb-1">موقع التاجر</div>
                  <div className="font-medium">{selected.merchant_location}</div>
                </div>
              )}
              {String(selected.method || '').includes('CASH_COLLECTION') && (
                <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                  <div className="text-amber-700 mb-1 font-semibold">إشعار فريق Adjil</div>
                  <div className="text-amber-800 text-xs">هذه فاتورة تحصيل نقدي مرسلة من التاجر حتى لا يتم الاقتطاع الآلي من راتب الزبون.</div>
                </div>
              )}
            </div>

            {/* Confirm Payment Button */}
            {selected.status === 'completed' && (
              <button
                onClick={async () => {
                  await updateTransactionPaidStatus(selected.id, !selected.paid)
                  setSelected({ ...selected, paid: !selected.paid, paid_at: !selected.paid ? new Date().toISOString() : undefined })
                  fetchTransactions().then(setItems)
                }}
                className={`w-full px-4 py-2.5 rounded-xl text-sm font-medium mt-4 ${
                  selected.paid 
                    ? 'bg-yellow-600 text-white hover:bg-yellow-700' 
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {selected.paid ? '❌ إلغاء تأكيد الدفع' : '✅ تأكيد الدفع للتاجر'}
              </button>
            )}

            {/* Print Button */}
            <button
              onClick={() => window.print()}
              className="w-full bg-slate-800 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-700 mt-4"
            >
              طباعة الفاتورة
            </button>
          </div>
        ) : (
          <div className="text-xs text-slate-400">اختر فاتورة لعرض التفاصيل</div>
        )}
      </div>
    </div>
  )
}
