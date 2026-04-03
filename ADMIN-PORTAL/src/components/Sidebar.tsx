import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, Store, CreditCard, Ban, Snowflake, MessageSquare, Settings, FileText, Activity, UsersRound, Sparkles } from 'lucide-react'
import { navItems, roleAccess } from '../lib/rbac'
import { Role } from '../lib/types'
import clsx from 'clsx'

type Props = {
  role: Role
}

const icons: Record<string, any> = {
  overview: LayoutDashboard,
  users: Users,
  merchants: Store,
  transactions: CreditCard,
  subscription_requests: Sparkles,
  blacklist: Ban,
  frozen: Snowflake,
  complaints: MessageSquare,
  invoices: FileText,
  audit: Activity,
  settings: Settings,
  team: UsersRound
}

export default function Sidebar({ role }: Props) {
  const allowed = roleAccess[role]
  
  return (
    <aside className="bg-dark-800 text-white m-4 rounded-3xl w-72 p-6 flex flex-col gap-8 shadow-2xl border border-white/5">
      {/* ADJIL Logo */}
      <div className="flex items-center gap-4 px-2">
        <div className="relative">
          <svg className="w-12 h-12 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 55 L50 25 L80 55" stroke="#10b981" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M35 70 L50 55 L65 70" stroke="white" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-black font-montserrat tracking-tighter leading-none text-white uppercase italic">
            AD<span className="text-primary">JIL</span>
          </h2>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="h-px w-4 bg-primary/50"></span>
            <span className="text-[7px] text-primary font-bold tracking-[0.15em] uppercase whitespace-nowrap">Admin Portal</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 flex-1 overflow-y-auto custom-scrollbar pr-1">
        {navItems
          .filter((n) => allowed.includes(n.key))
          .map((item) => {
            const Icon = icons[item.key] || LayoutDashboard
            return (
              <NavLink
                key={item.key}
                to={item.path}
                end={item.key === 'overview'}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group relative',
                    isActive 
                      ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-l-full"></div>}
                    <Icon size={18} className="opacity-80 group-hover:opacity-100" />
                    <span className="truncate">{item.label.split('/')[0].trim()}</span>
                  </>
                )}
              </NavLink>
            )
          })}
      </nav>

      {/* System Status */}
      <div className="mt-auto pt-4 border-t border-white/5">
        <div className="flex items-center gap-3 px-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
          <div className="text-xs font-medium text-slate-400">System Operational</div>
        </div>
      </div>
    </aside>
  )
}
