import { useEffect, useState } from 'react'
import { fetchTickets } from '../lib/data'
import { TicketRecord } from '../lib/types'

export default function Complaints() {
  const [tickets, setTickets] = useState<TicketRecord[]>([])

  useEffect(() => {
    fetchTickets().then(setTickets)
  }, [])

  return (
    <div className="nexus-card p-6 space-y-4">
      <div className="font-bold">الشكاوي / Réclamations / Complaints</div>
      {tickets.length === 0 && <div className="text-xs text-slate-400">لا توجد شكاوي</div>}
      <div className="space-y-3">
        {tickets.map((t) => (
          <div key={t.id} className="border border-slate-100 rounded-xl p-4 bg-slate-50">
            <div className="text-sm font-bold">{t.subject || 'بدون موضوع'}</div>
            <div className="text-xs text-slate-400">{t.user_email || '—'}</div>
            <div className="text-sm mt-2">{t.description || '—'}</div>
            <div className="text-xs text-slate-400 mt-2">{t.status || 'open'}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
