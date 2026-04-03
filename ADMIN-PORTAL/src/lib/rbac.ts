import { Role } from './types'

export type NavItem = {
  key: string
  label: string
  path: string
}

export const roleAccess: Record<Role, string[]> = {
  administrator: [
    'overview',
    'users',
    'merchants',
    'transactions',
    'subscription_requests',
    'blacklist',
    'frozen',
    'complaints',
    'invoices',
    'audit',
    'settings',
    'team'
  ],
  ceo: [
    'overview',
    'users',
    'merchants',
    'transactions',
    'subscription_requests',
    'blacklist',
    'frozen',
    'complaints',
    'invoices',
    'audit',
    'settings',
    'team'
  ],
  // Partner can see merchants, customers, transactions, invoices
  partner: ['overview', 'merchants', 'users', 'transactions', 'invoices'],
  // Support can see users, merchants, complaints
  support: ['overview', 'users', 'merchants', 'complaints'],
  // Admin role (same as administrator)
  admin: ['overview', 'users', 'merchants', 'transactions', 'subscription_requests', 'blacklist', 'frozen', 'complaints', 'invoices', 'audit', 'settings', 'team'],
  // Customer role (limited access)
  customer: ['overview'],
  // Merchant role (limited access)
  merchant: ['overview']
}

export const navItems: NavItem[] = [
  { key: 'overview', label: 'لوحة الإحصائيات / Tableau de bord / Dashboard', path: '/dashboard' },
  { key: 'merchants', label: 'التجار / Marchands / Merchants', path: '/dashboard/merchants' },
  { key: 'users', label: 'الزبائن / Clients / Customers', path: '/dashboard/users' },
  { key: 'transactions', label: 'العمليات / Opérations / Transactions', path: '/dashboard/transactions' },
  { key: 'subscription_requests', label: 'طلبات الاشتراك / Abonnements / Subscriptions', path: '/dashboard/subscriptions' },
  { key: 'blacklist', label: 'القائمة السوداء / Blacklist / Blacklist', path: '/dashboard/blacklist' },
  { key: 'frozen', label: 'حسابات مجمدة / Comptes gelés / Frozen', path: '/dashboard/frozen' },
  { key: 'complaints', label: 'الشكاوي / Réclamations / Complaints', path: '/dashboard/complaints' },
  { key: 'invoices', label: 'الفواتير / Factures / Invoices', path: '/dashboard/invoices' },
  { key: 'audit', label: 'سجل النشاط / Audit / Logs', path: '/dashboard/audit' },
  { key: 'settings', label: 'الإعدادات / Paramètres / Settings', path: '/dashboard/settings' },
  { key: 'team', label: 'فريق العمل / Équipe / Team', path: '/dashboard/team' }
]
