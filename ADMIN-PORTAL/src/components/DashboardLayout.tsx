import { ReactNode } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { AdminSession, clearSession } from '../lib/storage'

type Props = {
  session: AdminSession
  children: ReactNode
  onLogout: () => void
}

export default function DashboardLayout({ session, children, onLogout }: Props) {
  return (
    <div className="min-h-screen bg-dark-900 p-4 md:p-6">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-4 md:gap-6">
        <div className="flex flex-col gap-4 md:gap-6">
          <TopBar
            role={session.role}
            username={session.username}
            isCEO={session.isCEO}
            onLogout={() => {
              clearSession()
              onLogout()
            }}
          />
          <div className="grid gap-4 md:gap-6">{children}</div>
        </div>
        <div className="hidden md:block">
          <Sidebar role={session.role} />
        </div>
      </div>
    </div>
  )
}
