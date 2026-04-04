import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { getStoredRole, saveSession, getSession } from '../lib/storage'
import { Role } from '../lib/types'
import { supabase, hasSupabase } from '../lib/supabase'

const schema = z.object({
  identifier: z.string().min(3, 'اسم المستخدم أو البريد الإلكتروني مطلوب'),
  password: z.string().min(1, 'كلمة المرور مطلوبة')
})

// Local admin accounts that work without Supabase
const LOCAL_ADMINS: Array<{ username: string; password: string; role: Role; isCEO: boolean }> = [
  { username: 'admin', password: 'adminceo', role: 'ceo', isCEO: true },
  { username: 'admin', password: 'admin', role: 'administrator', isCEO: false },
  { username: 'support', password: 'support', role: 'support', isCEO: false },
  { username: 'partner', password: 'partner', role: 'partner', isCEO: false }
]

export default function Login() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const session = getSession()
    if (session) {
      navigate('/dashboard')
    }
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    
    const form = new FormData(e.currentTarget)
    const data = { 
      identifier: String(form.get('identifier') || '').trim(), 
      password: String(form.get('password') || '') 
    }
    
    const valid = schema.safeParse(data)
    if (!valid.success) {
      setError(valid.error.errors[0]?.message || 'الرجاء إدخال اسم المستخدم وكلمة المرور')
      setIsLoading(false)
      return
    }
    
    // 1. Check local admin accounts first
    const localAdmin = LOCAL_ADMINS.find(
      a => a.username === data.identifier.toLowerCase() && a.password === data.password
    )
    if (localAdmin) {
      saveSession({
        username: data.identifier,
        role: localAdmin.role,
        remember,
        isCEO: localAdmin.isCEO
      })
      navigate('/dashboard')
      setIsLoading(false)
      return
    }
    
    // 1.5 Check locally created staff accounts
    const localStaff = JSON.parse(localStorage.getItem('adjil_local_staff') || '[]')
    const staffAccount = localStaff.find(
      (s: any) => s.username?.toLowerCase() === data.identifier.toLowerCase() && s.password === data.password
    )
    if (staffAccount) {
      saveSession({
        username: data.identifier,
        role: staffAccount.role || 'support',
        remember,
        isCEO: false
      })
      navigate('/dashboard')
      setIsLoading(false)
      return
    }

    // 2. Try Supabase authentication
    if (hasSupabase && supabase) {
      try {
        let email = data.identifier;
        
        if (!email.includes('@')) {
          const { data: fetchedEmail, error: userError } = await supabase
            .rpc('get_user_email_by_username', { p_username: data.identifier });
          
          if (userError || !fetchedEmail) {
            // If username lookup fails, check if it's a direct email attempt
            setError('اسم المستخدم غير موجود أو كلمة المرور غير صحيحة')
            setIsLoading(false)
            return
          }
          email = fetchedEmail;
        }

        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: email,
          password: data.password
        })
        
        if (authError) {
          setError('بيانات الدخول غير صحيحة')
          setIsLoading(false)
          return
        }
        
        const { data: userData, error: fetchError } = await supabase
          .from('users')
          .select('role, username, name')
          .eq('id', authData.user.id)
          .single()
        
        if (fetchError || !userData) {
          setError('تعذر العثور على بيانات المستخدم. يرجى المحاولة مرة أخرى.')
          setIsLoading(false)
          return
        }

        const role = userData.role as Role
        const isStaff = ['ceo', 'administrator', 'admin', 'support', 'partner'].includes(role)
        
        if (!isStaff) {
          await supabase.auth.signOut()
          setError('عذراً، هذا الحساب غير مخول للدخول لبوابة الإدارة')
          setIsLoading(false)
          return
        }

        const isCEO = ['ceo', 'administrator', 'admin'].includes(role)
        
        saveSession({ 
          username: userData.username || userData.name || authData.user.email?.split('@')[0] || 'user', 
          role, 
          remember, 
          isCEO 
        })
        
        navigate('/dashboard')
      } catch (err) {
        setError('حدث خطأ أثناء محاولة الدخول. تحقق من الاتصال.')
      }
    } else {
      setError('اسم المستخدم أو كلمة المرور غير صحيحة')
    }
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900 px-6">
      <div className="max-w-md w-full space-y-6 animate-fade-in">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <svg className="w-16 h-16 drop-shadow-[0_0_15px_rgba(16,185,129,0.4)]" viewBox="0 0 100 100" fill="none">
              <path d="M20 55 L50 25 L80 55" stroke="#10b981" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M35 70 L50 55 L65 70" stroke="white" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 className="text-2xl font-black text-white">تسجيل الدخول</h2>
          <p className="text-slate-400 text-sm">Admin Portal / لوحة التحكم</p>
        </div>

        <form onSubmit={handleSubmit} className="nexus-card p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-medium">اسم المستخدم أو البريد الإلكتروني</label>
            <input
              name="identifier"
              type="text"
              className="w-full bg-dark-900 border border-white/5 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-slate-600"
              placeholder="admin"
              autoComplete="username"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-medium">كلمة المرور</label>
            <div className="relative">
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                className="w-full bg-dark-900 border border-white/5 rounded-xl px-4 py-3 pr-12 text-white text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-slate-600"
                placeholder="admin"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
              >
                <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
          </div>
          
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} 
              className="w-4 h-4 rounded border-slate-600 bg-dark-900 text-primary focus:ring-primary" />
            تذكرني
          </label>

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <i className="fa-solid fa-circle-exclamation ml-2"></i>{error}
            </div>
          )}

          <button 
            disabled={isLoading}
            className="w-full bg-primary hover:bg-secondary text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <><i className="fa-solid fa-circle-notch fa-spin"></i> جاري الدخول...</>
            ) : (
              <><i className="fa-solid fa-right-to-bracket"></i> دخول</>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
