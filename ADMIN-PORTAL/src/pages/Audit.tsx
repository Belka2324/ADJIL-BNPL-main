import { useMemo } from 'react'

export default function Audit() {
  const logs = useMemo(
    () => [
      { id: 1, action: 'تسجيل دخول', actor: 'admin', time: 'قبل دقيقة' },
      { id: 2, action: 'تصدير فواتير', actor: 'admin', time: 'قبل 10 دقائق' },
      { id: 3, action: 'مراجعة شكاوي', actor: 'support', time: 'قبل ساعة' }
    ],
    []
  )

  return (
    <div className="nexus-card p-6 space-y-4">
      <div className="font-bold">سجل النشاطات / Audit Logs</div>
      <div className="space-y-3">
        {logs.map((l) => (
          <div key={l.id} className="flex items-center justify-between text-sm border-t border-slate-100 pt-3">
            <div>{l.action}</div>
            <div className="text-slate-400">{l.actor}</div>
            <div className="text-slate-400">{l.time}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
