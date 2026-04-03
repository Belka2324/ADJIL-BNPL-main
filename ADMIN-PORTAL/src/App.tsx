import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Merchants from './pages/Merchants'
import Transactions from './pages/Transactions'
import Subscriptions from './pages/Subscriptions'
import Blacklist from './pages/Blacklist'
import Frozen from './pages/Frozen'
import Complaints from './pages/Complaints'
import Invoices from './pages/Invoices'
import Audit from './pages/Audit'
import Settings from './pages/Settings'
import Team from './pages/Team'
import StaffProfile from './pages/StaffProfile'
import DashboardLayout from './components/DashboardLayout'
import { AdminSession, getSession } from './lib/storage'
import { roleAccess } from './lib/rbac'

export default function App() {
  const [session, setSession] = useState<AdminSession | null>(null)
  const location = useLocation()

  useEffect(() => {
    setSession(getSession())
  }, [location.pathname])

  const allow = (key: string) => session && roleAccess[session.role].includes(key)

  const shell = (node: JSX.Element) =>
    session ? (
      <DashboardLayout session={session} onLogout={() => setSession(null)}>
        {node}
      </DashboardLayout>
    ) : (
      <Navigate to="/login" replace />
    )

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={shell(<Dashboard />)} />
      <Route path="/dashboard/users" element={allow('users') ? shell(<Users isAdmin={session?.role === 'administrator' || session?.role === 'admin' || session?.isCEO === true} />) : <Navigate to="/dashboard" replace />} />
      <Route path="/dashboard/merchants" element={allow('merchants') ? shell(<Merchants isAdmin={session?.role === 'administrator' || session?.role === 'admin' || session?.isCEO === true} />) : <Navigate to="/dashboard" replace />} />
      <Route path="/dashboard/transactions" element={allow('transactions') ? shell(<Transactions />) : <Navigate to="/dashboard" replace />} />
      <Route path="/dashboard/subscriptions" element={allow('subscription_requests') ? shell(<Subscriptions />) : <Navigate to="/dashboard" replace />} />
      <Route path="/dashboard/blacklist" element={allow('blacklist') ? shell(<Blacklist />) : <Navigate to="/dashboard" replace />} />
      <Route path="/dashboard/frozen" element={allow('frozen') ? shell(<Frozen isAdmin={session?.role === 'administrator' || session?.role === 'admin' || session?.isCEO === true} />) : <Navigate to="/dashboard" replace />} />
      <Route path="/dashboard/complaints" element={allow('complaints') ? shell(<Complaints />) : <Navigate to="/dashboard" replace />} />
      <Route path="/dashboard/invoices" element={allow('invoices') ? shell(<Invoices />) : <Navigate to="/dashboard" replace />} />
      <Route path="/dashboard/audit" element={allow('audit') ? shell(<Audit />) : <Navigate to="/dashboard" replace />} />
      <Route path="/dashboard/settings" element={allow('settings') ? shell(<Settings />) : <Navigate to="/dashboard" replace />} />
      <Route path="/dashboard/team" element={allow('team') ? shell(<Team />) : <Navigate to="/dashboard" replace />} />
      <Route path="/staff/:id" element={shell(<StaffProfile />)} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
