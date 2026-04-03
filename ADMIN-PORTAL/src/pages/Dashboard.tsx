import { useEffect, useState } from 'react'
import KpiCard from '../components/KpiCard'
import FinanceChart from '../components/FinanceChart'
import { fetchTransactions, fetchUsers } from '../lib/data'
import { TransactionRecord, UserRecord } from '../lib/types'
import { subscribeTable } from '../lib/realtime'

export default function Dashboard() {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [transactions, setTransactions] = useState<TransactionRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchUsers(), fetchTransactions()])
      .then(([usersData, transactionsData]) => {
        setUsers(usersData)
        setTransactions(transactionsData)
      })
      .catch(console.error)
      .finally(() => setLoading(false))

      const unsubUsers = subscribeTable('users', () => fetchUsers().then(setUsers))
      const unsubTx = subscribeTable('transactions', () => fetchTransactions().then(setTransactions))
      return () => {
        unsubUsers()
        unsubTx()
      }
  }, [])

  const activeUsers = users.filter((u) => u.status === 'active').length
  const inactiveUsers = users.filter((u) => u.status && u.status !== 'active').length
  const merchants = users.filter((u) => u.role === 'merchant').length
  const customers = users.filter((u) => u.role === 'customer').length
  const totalAmount = transactions.reduce((acc, tx) => acc + Number(tx.amount || 0), 0)
  const pendingTransactions = transactions.filter((tx) => tx.status === 'pending').length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard 
          title="إجمالي المعاملات" 
          value={`${totalAmount.toLocaleString('fr-DZ')} دج`} 
          delta="+4.5%"
          icon="fa-coins" 
        />
        <KpiCard 
          title="التجار" 
          value={String(merchants)} 
          delta="+12"
          icon="fa-store" 
        />
        <KpiCard 
          title="الزبائن" 
          value={String(customers)} 
          delta="+24"
          icon="fa-users" 
        />
        <KpiCard 
          title="الحسابات النشطة" 
          value={String(activeUsers)} 
          delta="+1.4%" 
          icon="fa-user-check" 
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="enhanced-card p-5 border-r-4 border-yellow-400">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">المعاملات المعلقة</p>
              <p className="text-3xl font-black text-white">{pendingTransactions}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-yellow-400/10 flex items-center justify-center border border-yellow-400/20">
              <i className="fa-solid fa-clock text-yellow-400 text-xl"></i>
            </div>
          </div>
        </div>
        
        <div className="enhanced-card p-5 border-r-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">غير النشطة</p>
              <p className="text-3xl font-black text-white">{inactiveUsers}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
              <i className="fa-solid fa-user-slash text-red-500 text-xl"></i>
            </div>
          </div>
        </div>

        <div className="enhanced-card p-5 border-r-4 border-primary">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">إجمالي المسجلين</p>
              <p className="text-3xl font-black text-white">{users.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <i className="fa-solid fa-id-card text-primary text-xl"></i>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
        <FinanceChart data={transactions} />
        <div className="enhanced-card p-5 space-y-4">
          <div className="font-bold flex items-center justify-between text-sm">
            <span className="text-white">المعاملات المباشرة</span>
            <span className="badge badge-success">
              <i className="fa-solid fa-circle text-[8px] animate-pulse"></i>
              مباشر
            </span>
          </div>
          <div className="space-y-2 max-h-[360px] overflow-auto custom-scrollbar">
            {transactions.slice(0, 8).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between text-sm p-3 rounded-xl bg-dark-900/50 hover:bg-dark-900 transition-colors border border-white/5">
                <div>
                  <div className="font-semibold text-white text-xs">{tx.customer_name || 'عميل'}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{tx.id?.slice(0, 8)}...</div>
                </div>
                <div className="text-left">
                  <div className="font-bold text-white text-xs">{Number(tx.amount || 0).toLocaleString('fr-DZ')} دج</div>
                  <div className="text-[10px] text-slate-500">{tx.method || 'BNPL'}</div>
                </div>
              </div>
            ))}
            {transactions.length === 0 && <div className="text-xs text-slate-500 text-center py-8">لا توجد معاملات حالياً</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
