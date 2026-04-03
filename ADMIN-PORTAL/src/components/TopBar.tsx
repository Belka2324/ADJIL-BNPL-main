import { Search, Bell, LogOut, X, User, Settings, Key, Camera, Loader2, Globe, Sun, Moon } from 'lucide-react'
import { Role } from '../lib/types'
import { useState, useEffect, useRef } from 'react'
import { Language, getStoredLanguage, setLanguage } from '../lib/i18n'

type Props = {
  role: Role
  username: string
  onLogout: () => void
  isCEO?: boolean
}

type Notification = {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'error' | 'success'
  created_at: string
  read: boolean
}

type ProfileData = {
  name: string
  email: string
  phone: string
  avatar?: string
}

export default function TopBar({ role, username, onLogout, isCEO }: Props) {
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [profileData, setProfileData] = useState<ProfileData>({
    name: username,
    email: '',
    phone: '',
    avatar: ''
  })
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [currentLang, setCurrentLang] = useState<Language>(getStoredLanguage())
  const [showLangMenu, setShowLangMenu] = useState(false)
  const [isLight, setIsLight] = useState(() => localStorage.getItem('adjil_admin_theme') === 'light')

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang)
    setCurrentLang(lang)
    setShowLangMenu(false)
    window.location.reload()
  }

  const toggleTheme = () => {
    const newIsLight = !isLight
    setIsLight(newIsLight)
    document.body.classList.toggle('light-mode', newIsLight)
    localStorage.setItem('adjil_admin_theme', newIsLight ? 'light' : 'dark')
  }

  useEffect(() => {
    document.body.classList.toggle('light-mode', isLight)
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem('adjil_admin_profile')
    if (stored) {
      setProfileData(JSON.parse(stored))
    } else {
      setProfileData(prev => ({ ...prev, name: username }))
    }
  }, [username])

  useEffect(() => {
    const stored = localStorage.getItem('adjil_notifications')
    if (stored) {
      setNotifications(JSON.parse(stored))
    } else {
      const defaultNotifs: Notification[] = [
        {
          id: '1',
          title: 'مرحباً بك',
          message: 'مرحباً في لوحة تحكم Adjil.BNPL',
          type: 'info',
          created_at: new Date().toISOString(),
          read: false
        }
      ]
      setNotifications(defaultNotifs)
      localStorage.setItem('adjil_notifications', JSON.stringify(defaultNotifs))
    }
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  const roleLabel =
    role === 'administrator' || role === 'admin'
      ? isCEO ? 'CEO ADMIN' : 'ADMINISTRATOR'
      : role === 'ceo'
      ? 'CEO'
      : role === 'partner'
      ? 'PARTNER'
      : 'SUPPORT'

  const markAsRead = (id: string) => {
    const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n)
    setNotifications(updated)
    localStorage.setItem('adjil_notifications', JSON.stringify(updated))
  }

  const markAllAsRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }))
    setNotifications(updated)
    localStorage.setItem('adjil_notifications', JSON.stringify(updated))
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 1) return 'الآن'
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`
    if (diffHours < 24) return `منذ ${diffHours} ساعة`
    return `منذ ${diffDays} يوم`
  }

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success': return '✅'
      case 'warning': return '⚠️'
      case 'error': return '❌'
      default: return 'ℹ️'
    }
  }

  const handleProfileClick = () => {
    setShowUserMenu(false)
    setShowProfileModal(true)
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        setProfileData(prev => ({ ...prev, avatar: base64 }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSaveProfile = () => {
    setSaving(true)
    localStorage.setItem('adjil_admin_profile', JSON.stringify(profileData))
    
    const existing = JSON.parse(localStorage.getItem('adjil_notifications') || '[]')
    const newNotif = {
      id: crypto.randomUUID(),
      title: 'تم تحديث الملف الشخصي',
      message: 'تم حفظ التغييرات بنجاح',
      type: 'success' as const,
      created_at: new Date().toISOString(),
      read: false
    }
    localStorage.setItem('adjil_notifications', JSON.stringify([newNotif, ...existing]))
    
    setTimeout(() => {
      setSaving(false)
      setShowProfileModal(false)
      window.location.reload()
    }, 500)
  }

  return (
    <>
      <header className="flex items-center justify-between gap-4 mb-6">
        {/* Search */}
        <div className="flex-1 max-w-xl">
          <div className="relative group">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors" size={18} />
            <input
              className="w-full bg-dark-800 border border-white/5 rounded-xl pl-4 pr-11 py-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
              placeholder="بحث..."
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Theme Toggle */}
          <button 
            onClick={toggleTheme}
            id="theme-toggle-btn"
            aria-label="Toggle theme"
          >
            {isLight ? <Moon size={16} /> : <Sun size={16} />}
          </button>

          {/* Role Badge */}
          <span className="nexus-pill text-[10px] tracking-widest">
            {roleLabel}
          </span>
          
          {/* Notifications */}
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative bg-dark-800 p-2.5 rounded-xl border border-white/5 text-slate-400 hover:text-primary hover:border-primary/20 transition-all"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-dark-800"></span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute left-0 top-full mt-2 w-80 bg-dark-800 rounded-2xl border border-white/5 shadow-2xl z-50 overflow-hidden">
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                  <div className="font-bold text-sm">الإشعارات</div>
                  {unreadCount > 0 && (
                    <button onClick={markAllAsRead} className="text-xs text-primary hover:underline">
                      تحديد كمقروء
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto custom-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-500">لا توجد إشعارات</div>
                  ) : (
                    notifications.map((notif) => (
                      <div 
                        key={notif.id}
                        onClick={() => markAsRead(notif.id)}
                        className={`p-4 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors ${!notif.read ? 'bg-primary/5' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-lg">{getNotificationIcon(notif.type)}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm">{notif.title}</div>
                            <div className="text-xs text-slate-500 mt-1">{notif.message}</div>
                            <div className="text-xs text-slate-600 mt-2">{formatTime(notif.created_at)}</div>
                          </div>
                          {!notif.read && <div className="w-2 h-2 bg-primary rounded-full mt-1"></div>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-3 border-t border-white/5">
                  <button className="w-full text-center text-sm text-primary hover:underline">عرض كل الإشعارات</button>
                </div>
              </div>
            )}
          </div>

          {/* Profile */}
          <div className="bg-dark-800 border border-white/5 rounded-xl p-1.5 pr-3 pl-1.5 flex items-center gap-3 relative">
            <div 
              className="h-9 w-9 rounded-lg bg-gradient-to-tr from-primary to-secondary text-white flex items-center justify-center font-bold text-sm shadow-lg shadow-primary/20 cursor-pointer overflow-hidden"
              onClick={handleProfileClick}
            >
              {profileData.avatar ? (
                <img src={profileData.avatar} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                username.slice(0, 1).toUpperCase()
              )}
            </div>
            
            <div className="text-sm hidden md:block">
              <div className="font-bold text-white">{username}</div>
              <div className="text-[10px] text-slate-500">Adjil.BNPL</div>
            </div>
            <div className="w-px h-7 bg-white/5 mx-1 hidden md:block"></div>
            
            {/* Language Switcher */}
            <div className="relative">
              <button 
                onClick={() => setShowLangMenu(!showLangMenu)}
                className="p-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-primary transition-colors"
              >
                <Globe size={16} />
              </button>
              {showLangMenu && (
                <div className="absolute top-full left-0 mt-2 w-40 bg-dark-800 rounded-xl border border-white/5 shadow-xl z-50 overflow-hidden">
                  {(['ar', 'fr', 'en'] as Language[]).map(lang => (
                    <button 
                      key={lang}
                      onClick={() => handleLanguageChange(lang)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-white/5 transition-colors ${currentLang === lang ? 'bg-primary/10 text-primary font-bold' : 'text-slate-400'}`}
                    >
                      {lang === 'ar' ? '🇩🇿 العربية' : lang === 'fr' ? '🇫🇷 Français' : '🇬🇧 English'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <button 
              onClick={onLogout} 
              className="p-2 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
              title="تسجيل الخروج"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {(showNotifications || showUserMenu || showLangMenu) && (
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => { setShowNotifications(false); setShowUserMenu(false); setShowLangMenu(false) }}
          />
        )}
      </header>

      {/* Profile Edit Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-800 rounded-3xl border border-white/5 shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <div className="font-bold text-lg text-white">ملف التعريف</div>
              <button onClick={() => setShowProfileModal(false)} className="p-2 rounded-xl hover:bg-white/5 transition-colors">
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex flex-col items-center gap-3 mb-4">
                <div className="relative">
                  <div className="h-20 w-20 rounded-2xl bg-gradient-to-tr from-primary to-secondary text-white flex items-center justify-center font-bold text-2xl shadow-lg shadow-primary/20 overflow-hidden">
                    {profileData.avatar ? (
                      <img src={profileData.avatar} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      username.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <button onClick={handleAvatarClick} className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary rounded-lg flex items-center justify-center cursor-pointer hover:bg-secondary transition-colors shadow-md">
                    <Camera size={12} className="text-white" />
                  </button>
                </div>
                <div className="text-xs text-slate-500">انقر لتغيير الصورة</div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">الاسم</label>
                  <input type="text" value={profileData.name}
                    onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl bg-dark-900 border border-white/5 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">البريد الإلكتروني</label>
                  <input type="email" value={profileData.email}
                    onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl bg-dark-900 border border-white/5 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">رقم الهاتف</label>
                  <input type="tel" value={profileData.phone}
                    onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl bg-dark-900 border border-white/5 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">كلمة المرور</label>
                  <div className="flex items-center gap-2">
                    <input type="password" value="••••••••" disabled
                      className="flex-1 px-4 py-2.5 rounded-xl bg-dark-900/50 border border-white/5 text-slate-500 text-sm cursor-not-allowed" />
                    <button className="px-3 py-2.5 bg-white/5 rounded-xl text-xs text-slate-400 hover:bg-white/10 transition-colors">تغيير</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-white/5 flex gap-3">
              <button onClick={() => setShowProfileModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/5 text-slate-400 font-medium hover:bg-white/5 transition-colors text-sm">
                إلغاء
              </button>
              <button onClick={handleSaveProfile} disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-secondary transition-colors flex items-center justify-center gap-2 disabled:opacity-70 text-sm">
                {saving ? <><Loader2 size={16} className="animate-spin" /> جاري الحفظ...</> : 'حفظ التغييرات'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
