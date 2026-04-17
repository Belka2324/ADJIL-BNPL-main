import { useEffect, useState } from 'react'
import { getSession } from '../lib/storage'
import { supabase, hasSupabase } from '../lib/supabase'
import { UserRecord } from '../lib/types'
import { createStaff, syncFromAdjilBNPL, getLastSyncTime } from '../lib/data'

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'general' | 'team' | 'create' | 'account'>('account')
  const [teamMembers, setTeamMembers] = useState<UserRecord[]>([])
  const [selectedMember, setSelectedMember] = useState<UserRecord | null>(null)
  const [showSuspendModal, setShowSuspendModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  
  // Create form state
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'partner' | 'support'>('support')
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  // Account settings state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newAccountPassword, setNewAccountPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [updatingPassword, setUpdatingPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [registrationRows, setRegistrationRows] = useState<Array<{ id: string; email: string; role: string; source: string; status: string; createdAt?: string; verified: boolean }>>([])
  const [loadingAudit, setLoadingAudit] = useState(false)

  // Sync state
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ users: number; transactions: number } | null>(null)
  const [lastSync, setLastSync] = useState<string | null>(null)

  // CEO role check - get from session
  const session = getSession()
  const isCEO = session?.role === 'administrator' || session?.isCEO === true || session?.role === 'ceo'

  useEffect(() => {
    setLastSync(getLastSyncTime())
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const result = await syncFromAdjilBNPL()
      setSyncResult(result)
      setLastSync(new Date().toISOString())
    } catch (error) {
      console.error('Sync failed:', error)
      alert('فشلت المزامنة')
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    const fetchTeamData = async () => {
      // Fetch from local storage first (demo mode)
      const localStaff = JSON.parse(localStorage.getItem('adjil_local_staff') || '[]')
      
      if (hasSupabase && supabase) {
        // Fetch staff from staff table
        const { data: staffData } = await supabase
          .from('staff')
          .select('*')
          .in('role', ['administrator', 'partner', 'support', 'ceo'])
        
        // Also fetch admins from users table
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .in('role', ['admin', 'administrator'])
        
        // Combine both with local
        const allMembers = [
          ...localStaff.map((s: any) => ({
            id: s.id,
            name: `${s.first_name} ${s.last_name}`,
            email: s.email,
            role: s.role,
            status: s.is_active ? 'active' : 'suspended'
          })),
          ...(staffData || []).map(s => ({
            id: s.id,
            name: `${s.first_name} ${s.last_name}`,
            email: s.email,
            role: s.role,
            status: s.is_active ? 'active' : 'suspended'
          })),
          ...(userData || []).map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            status: u.status
          }))
        ]
        setTeamMembers(allMembers)
      } else {
        // Use local storage only
        setTeamMembers(localStaff.map((s: any) => ({
          id: s.id,
          name: `${s.first_name} ${s.last_name}`,
          email: s.email,
          role: s.role,
          status: s.is_active ? 'active' : 'suspended'
        })))
      }
    }
    
    if (activeTab === 'team') {
      fetchTeamData()
    }
  }, [activeTab])

  useEffect(() => {
    const fetchRegistrationAudit = async () => {
      if (activeTab !== 'general') return
      if (!hasSupabase || !supabase) {
        setRegistrationRows([])
        return
      }
      setLoadingAudit(true)
      // Use public.users table for all user profiles (unified from migration)
      const { data: usersData } = await supabase
        .from('users')
        .select('id, email, role, status, created_at')
      const { data: staffData } = await supabase
        .from('staff')
        .select('id, email, role, is_active, created_at')
      const rows = [
        ...((usersData || []).map((r: any) => ({
          id: r.id,
          email: r.email || '',
          role: r.role || '',
          source: 'ADJIL-BNPL',
          status: r.status || 'unknown',
          createdAt: r.created_at,
          verified: Boolean(r.email && r.role && r.status)
        }))),
        ...((staffData || []).map((r: any) => ({
          id: r.id,
          email: r.email || '',
          role: r.role || '',
          source: 'ADMIN-PORTAL',
          status: r.is_active ? 'active' : 'suspended',
          createdAt: r.created_at,
          verified: Boolean(r.email && r.role)
        })))
      ]
      setRegistrationRows(rows)
      setLoadingAudit(false)
    }
    fetchRegistrationAudit()
  }, [activeTab])

  const handleCreateAccount = async () => {
    if (!newEmail || !newPassword || !newName || !newUsername) {
      alert('الرجاء إكمال جميع الحقول')
      return
    }
    setCreating(true)
    
    try {
      const nameParts = newName.trim().split(' ')
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''
      
      await createStaff({
        email: newEmail,
        password: newPassword,
        first_name: firstName,
        last_name: lastName,
        username: newUsername,
        role: newRole
      })
      
      alert('تم إنشاء الحساب بنجاح!\n\nاسم المستخدم: ' + newUsername + '\nكلمة المرور: ' + newPassword + '\n\nالرجاء حفظ هذه البيانات للدخول القادم.')
      
      // Clear form
      setNewEmail('')
      setNewPassword('')
      setNewUsername('')
      setNewName('')
      setNewRole('support')
      
    } catch (err: any) {
      console.error('Error creating team member:', err)
      alert('خطأ في إنشاء الحساب: ' + (err.message || 'فشل الاتصال'))
    }
    setCreating(false)
  }

  const handleUpdatePassword = async () => {
    setPasswordError('')
    setPasswordSuccess('')
    
    if (newAccountPassword !== confirmPassword) {
      setPasswordError('كلمات السر غير متطابقة')
      return
    }
    
    if (newAccountPassword.length < 6) {
      setPasswordError('كلمة السر يجب أن تكون 6 أحرف على الأقل')
      return
    }
    
    if (hasSupabase && supabase) {
      setUpdatingPassword('updating')
      try {
        const { error } = await supabase.auth.updateUser({
          password: newAccountPassword
        })
        
        if (error) throw error
        
        setPasswordSuccess('تم تحديث كلمة السر بنجاح')
        setNewAccountPassword('')
        setConfirmPassword('')
        setCurrentPassword('')
      } catch (err: any) {
        console.error('Error updating password:', err)
        setPasswordError(err.message || 'فشل تحديث كلمة السر')
      } finally {
        setUpdatingPassword('')
      }
    }
  }

  const handleSuspend = async () => {
    if (!selectedMember) return
    
    if (hasSupabase && supabase) {
      // Try to update staff table first, then users table
      const { error } = await supabase
        .from('staff')
        .update({ is_active: selectedMember.status === 'suspended' })
        .eq('id', selectedMember.id)
      
      if (error) {
        // Try users table
        await supabase
          .from('users')
          .update({ status: selectedMember.status === 'suspended' ? 'active' : 'suspended' })
          .eq('id', selectedMember.id)
      }
    }
    
    // Update local state
    setTeamMembers((prev) => prev.map((u) => 
      u.id === selectedMember.id ? { ...u, status: u.status === 'suspended' ? 'active' : 'suspended' } : u
    ))
    setShowSuspendModal(false)
    setSelectedMember(null)
  }

  const handleDelete = async () => {
    if (!selectedMember) return
    
    if (hasSupabase && supabase) {
      // Try to delete from staff table first, then users table
      const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', selectedMember.id)
      
      if (error) {
        // Try users table
        await supabase
          .from('users')
          .delete()
          .eq('id', selectedMember.id)
      }
    }
    
    // Update local state
    setTeamMembers((prev) => prev.filter((u) => u.id !== selectedMember.id))
    setShowDeleteModal(false)
    setSelectedMember(null)
  }

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'admin': return 'مدير / Admin'
      case 'partner': return 'شريك / Partner'
      case 'support': return 'دعم / Support'
      default: return role || '—'
    }
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex bg-slate-200/50 p-1 rounded-2xl gap-1">
        <button
          onClick={() => setActiveTab('account')}
          className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            activeTab === 'account' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          حسابي / Mon compte
        </button>
        <button
          onClick={() => setActiveTab('general')}
          className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            activeTab === 'general' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          الإعدادات العامة
        </button>
        <button
          onClick={() => setActiveTab('team')}
          className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            activeTab === 'team' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          فريق العمل
        </button>
        <button
          onClick={() => setActiveTab('create')}
          className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            activeTab === 'create' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          إنشاء حساب جديد
        </button>
      </div>

      {/* Account Settings */}
      {activeTab === 'account' && (
        <div className="space-y-6">
          <div className="nexus-card p-6">
            <h3 className="text-xl font-bold mb-4">إعدادات الحساب / Paramètres du compte</h3>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-xs text-slate-400 mb-1">اسم المستخدم / Username</p>
                  <p className="font-bold">{session?.username || '—'}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-xs text-slate-400 mb-1">الرتبة / Role</p>
                  <p className="font-bold uppercase">{session?.role || '—'}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="font-bold text-sm">تغيير كلمة السر / Modifier le mot de passe</h4>
                <div className="space-y-3">
                  <input
                    type="password"
                    value={newAccountPassword}
                    onChange={(e) => setNewAccountPassword(e.target.value)}
                    className="w-full bg-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="كلمة السر الجديدة"
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="تأكيد كلمة السر"
                  />
                  {passwordError && <p className="text-xs text-red-500 font-bold">{passwordError}</p>}
                  {passwordSuccess && <p className="text-xs text-emerald-600 font-bold">{passwordSuccess}</p>}
                  <button
                    onClick={handleUpdatePassword}
                    disabled={!!updatingPassword || !newAccountPassword || !confirmPassword}
                    className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold text-sm hover:bg-slate-700 transition-colors disabled:opacity-50"
                  >
                    {updatingPassword ? 'جاري التحديث...' : 'تحديث كلمة السر'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* General Settings */}
      {activeTab === 'general' && (
        <div className="nexus-card p-6 space-y-4">
          <div className="font-bold">الإعدادات العامة / Paramètres / Settings</div>
          <div className="text-sm text-slate-500">
            إدارة مفاتيح الربط، صلاحيات المستخدمين، وسياسات الأمان حسب متطلبات المنصة.
          </div>
          <div className="grid lg:grid-cols-4 gap-4">
            <div className="bg-slate-50 rounded-2xl p-4">
              <div className="text-xs text-slate-400">سياسة الوصول</div>
              <div className="font-semibold">Role-Based Access Control</div>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4">
              <div className="text-xs text-slate-400">المزامنة</div>
              <div className="font-semibold">Supabase / Local</div>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4">
              <div className="text-xs text-slate-400">نظام الفوترة</div>
              <div className="font-semibold">مفوتر / BNPL</div>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4">
              <div className="text-xs text-slate-400">حالة النظام</div>
              <div className="font-semibold text-emerald-600">نشط</div>
            </div>
          </div>
          
          {/* Sync Section */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="font-bold">مزامنة البيانات من AdjilBNPL</div>
            <div className="text-xs text-slate-500">جلب التجار والزبائن والمعاملات من منصة AdjilBNPL إلى قاعدة البيانات.</div>
            <div className="flex flex-wrap items-center gap-4">
              <button 
                onClick={handleSync}
                disabled={syncing}
                className="bg-primary hover:bg-secondary text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
              >
                <i className={`fa-solid fa-sync ${syncing ? 'fa-spin' : ''}`}></i>
                {syncing ? 'جاري المزامنة...' : 'مزامنة الآن'}
              </button>
              {lastSync && (
                <span className="text-xs text-slate-500">
                  آخر مزامنة: {new Date(lastSync).toLocaleString('ar-DZ')}
                </span>
              )}
            </div>
            {syncResult && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-4">
                <div className="text-emerald-600 font-semibold">
                  <i className="fa-solid fa-check-circle ml-1"></i>
                  تم المزامنة بنجاح
                </div>
                <div className="text-sm text-emerald-700">
                  {syncResult.users} مستخدم، {syncResult.transactions} معاملة
                </div>
              </div>
            )}
          </div>
          
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="font-bold">التحقق من التسجيل الحقيقي للحسابات</div>
            <div className="text-xs text-slate-500">هذه القائمة تعرض حسابات ADJIL-BNPL و ADMIN-PORTAL مع حالة اكتمال التسجيل.</div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="text-xs text-slate-500">إجمالي السجلات</div>
                <div className="text-xl font-bold">{registrationRows.length}</div>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3">
                <div className="text-xs text-emerald-600">حسابات موثقة</div>
                <div className="text-xl font-bold text-emerald-700">{registrationRows.filter((r) => r.verified).length}</div>
              </div>
              <div className="bg-red-50 rounded-xl p-3">
                <div className="text-xs text-red-600">حسابات ناقصة</div>
                <div className="text-xl font-bold text-red-700">{registrationRows.filter((r) => !r.verified).length}</div>
              </div>
            </div>
            <div className="overflow-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-sm min-w-[900px]">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="text-right py-3 px-3">البريد</th>
                    <th className="text-right py-3 px-3">الدور</th>
                    <th className="text-right py-3 px-3">المنصة</th>
                    <th className="text-right py-3 px-3">الحالة</th>
                    <th className="text-right py-3 px-3">موثق</th>
                    <th className="text-right py-3 px-3">تاريخ التسجيل</th>
                  </tr>
                </thead>
                <tbody>
                  {registrationRows.map((row) => (
                    <tr key={`${row.source}-${row.id}`} className="border-t border-slate-100">
                      <td className="py-3 px-3 font-medium">{row.email || '—'}</td>
                      <td className="py-3 px-3">{row.role || '—'}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-1 rounded text-xs ${row.source === 'ADJIL-BNPL' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                          {row.source}
                        </span>
                      </td>
                      <td className="py-3 px-3">{row.status || '—'}</td>
                      <td className="py-3 px-3">
                        {row.verified ? <span className="text-emerald-700 font-semibold">✅ نعم</span> : <span className="text-red-600 font-semibold">❌ لا</span>}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-500">{row.createdAt ? new Date(row.createdAt).toLocaleString('ar-DZ') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {loadingAudit && <div className="p-4 text-xs text-slate-500">جاري تحميل سجلات التسجيل...</div>}
              {!loadingAudit && registrationRows.length === 0 && <div className="p-4 text-xs text-slate-500">لا توجد بيانات تسجيل متاحة حالياً</div>}
            </div>
          </div>
        </div>
      )}

      {/* Team Management - Only for CEO */}
      {activeTab === 'team' && (
        <div className="space-y-4">
          {isCEO ? (
            <>
              <div className="nexus-card p-6 space-y-4">
                <div className="font-bold">فريق العمل / Équipe / Team</div>
                <div className="text-sm text-slate-500">
                  إدارة حسابات فريق العمل (الCEO يستطيع إيقاف وتفعيل وحذف الحسابات)
                </div>
              </div>

              {/* Team Tables */}
              <div className="grid md:grid-cols-3 gap-4">
                {/* Admins */}
                <div className="nexus-card p-4 space-y-3">
                  <div className="font-semibold text-slate-700 border-b pb-2">
                    👑 المديرين / Admins
                  </div>
                  {teamMembers.filter(u => u.role === 'admin').map((member) => (
                    <div 
                      key={member.id}
                      className="flex items-center justify-between bg-slate-50 rounded-xl p-3"
                    >
                      <div>
                        <div className="font-medium text-sm">{member.name}</div>
                        <div className="text-xs text-slate-500">{member.email}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          member.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                          member.status === 'suspended' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100'
                        }`}>
                          {member.status}
                        </span>
                        {member.status === 'suspended' ? (
                          <button 
                            onClick={() => { setSelectedMember(member); setShowSuspendModal(true) }}
                            className="text-xs bg-emerald-600 text-white px-2 py-1 rounded"
                          >
                            تفعيل
                          </button>
                        ) : (
                          <button 
                            onClick={() => { setSelectedMember(member); setShowSuspendModal(true) }}
                            className="text-xs bg-orange-500 text-white px-2 py-1 rounded"
                          >
                            وقف
                          </button>
                        )}
                        <button 
                          onClick={() => { setSelectedMember(member); setShowDeleteModal(true) }}
                          className="text-xs bg-red-600 text-white px-2 py-1 rounded"
                          title="حذف الحساب"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                  {teamMembers.filter(u => u.role === 'admin').length === 0 && (
                    <div className="text-xs text-slate-400">لا يوجد مديرين</div>
                  )}
                </div>

                {/* Partners */}
                <div className="nexus-card p-4 space-y-3">
                  <div className="font-semibold text-slate-700 border-b pb-2">
                    🤝 الشركاء / Partners
                  </div>
                  {teamMembers.filter(u => u.role === 'partner').map((member) => (
                    <div 
                      key={member.id}
                      className="flex items-center justify-between bg-slate-50 rounded-xl p-3"
                    >
                      <div>
                        <div className="font-medium text-sm">{member.name}</div>
                        <div className="text-xs text-slate-500">{member.email}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          member.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                          member.status === 'suspended' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100'
                        }`}>
                          {member.status}
                        </span>
                        {member.status === 'suspended' ? (
                          <button 
                            onClick={() => { setSelectedMember(member); setShowSuspendModal(true) }}
                            className="text-xs bg-emerald-600 text-white px-2 py-1 rounded"
                          >
                            تفعيل
                          </button>
                        ) : (
                          <button 
                            onClick={() => { setSelectedMember(member); setShowSuspendModal(true) }}
                            className="text-xs bg-orange-500 text-white px-2 py-1 rounded"
                          >
                            وقف
                          </button>
                        )}
                        <button 
                          onClick={() => { setSelectedMember(member); setShowDeleteModal(true) }}
                          className="text-xs bg-red-600 text-white px-2 py-1 rounded"
                          title="حذف الحساب"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                  {teamMembers.filter(u => u.role === 'partner').length === 0 && (
                    <div className="text-xs text-slate-400">لا يوجد شركاء</div>
                  )}
                </div>

                {/* Support */}
                <div className="nexus-card p-4 space-y-3">
                  <div className="font-semibold text-slate-700 border-b pb-2">
                    🎧 الدعم / Support
                  </div>
                  {teamMembers.filter(u => u.role === 'support').map((member) => (
                    <div 
                      key={member.id}
                      className="flex items-center justify-between bg-slate-50 rounded-xl p-3"
                    >
                      <div>
                        <div className="font-medium text-sm">{member.name}</div>
                        <div className="text-xs text-slate-500">{member.email}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          member.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                          member.status === 'suspended' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100'
                        }`}>
                          {member.status}
                        </span>
                        {member.status === 'suspended' ? (
                          <button 
                            onClick={() => { setSelectedMember(member); setShowSuspendModal(true) }}
                            className="text-xs bg-emerald-600 text-white px-2 py-1 rounded"
                          >
                            تفعيل
                          </button>
                        ) : (
                          <button 
                            onClick={() => { setSelectedMember(member); setShowSuspendModal(true) }}
                            className="text-xs bg-orange-500 text-white px-2 py-1 rounded"
                          >
                            وقف
                          </button>
                        )}
                        <button 
                          onClick={() => { setSelectedMember(member); setShowDeleteModal(true) }}
                          className="text-xs bg-red-600 text-white px-2 py-1 rounded"
                          title="حذف الحساب"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                  {teamMembers.filter(u => u.role === 'support').length === 0 && (
                    <div className="text-xs text-slate-400">لا يوجد فريق دعم</div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="nexus-card p-6">
              <div className="text-center text-slate-500">
                لا يمكنك الوصول إلى هذه الصفحة. يتطلب صلاحيات CEO.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create New Account */}
      {activeTab === 'create' && (
        <div className="nexus-card p-6 space-y-6">
          <div className="font-bold">إنشاء حساب جديد / Créer un compte / Create Account</div>
          <div className="text-sm text-slate-500">
            أنشئ حساب جديد لفريق العمل مع تحديد صلاحياته ومسؤولياته.
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">الاسم / Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="الاسم الكامل"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">اسم المستخدم / Username</label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full bg-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="username"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">البريد الإلكتروني / Email</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full bg-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">كلمة المرور / Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="********"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">الدور / Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'admin' | 'partner' | 'support')}
                className="w-full bg-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="support">دعم فني / Support</option>
                <option value="partner">شريك / Partner</option>
                <option value="admin">مدير / Admin</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleCreateAccount}
            disabled={creating || !newEmail || !newPassword || !newName}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? 'جاري الإنشاء...' : 'إنشاء الحساب / Créer'}
          </button>
        </div>
      )}

      {/* Suspend Modal */}
      {showSuspendModal && selectedMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c0 2.502-1.667 1.1.54 732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="font-bold text-lg">
                {selectedMember.status === 'suspended' ? 'تفعيل الحساب' : 'إيقاف الحساب'}
              </div>
              <div className="text-sm text-slate-500">
                هل أنت متأكد من {selectedMember.status === 'suspended' ? 'تفعيل' : 'إيقاف'} حساب 
                <span className="font-semibold"> {selectedMember.name}</span>؟
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowSuspendModal(false); setSelectedMember(null) }}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleSuspend}
                  className="flex-1 px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600"
                >
                  {selectedMember.status === 'suspended' ? 'تفعيل' : 'إيقاف'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && selectedMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div className="font-bold text-lg">حذف الحساب</div>
              <div className="text-sm text-slate-500">
                هل أنت متأكد من حذف حساب <span className="font-semibold">{selectedMember.name}</span>؟
                <br />
                <span className="text-red-500">هذا الإجراء لا يمكن التراجع عنه!</span>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowDeleteModal(false); setSelectedMember(null) }}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700"
                >
                  حذف
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
