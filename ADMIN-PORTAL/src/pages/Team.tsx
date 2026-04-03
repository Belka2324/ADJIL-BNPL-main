import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { StaffRecord, StaffRole } from '../lib/types'
import { createStaffViaFunction, fetchStaff } from '../lib/data'
import { getSession } from '../lib/storage'
import { subscribeTable } from '../lib/realtime'

export default function Team() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<StaffRole | 'all'>('all')
  const [staff, setStaff] = useState<StaffRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const session = getSession()
  const isAdmin = session?.role === 'admin' || session?.role === 'administrator' || session?.role === 'ceo' || session?.isCEO === true

  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'support' | 'partner'>('support')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')

  useEffect(() => {
    const loadStaff = async () => {
      setLoading(true)
      const data = await fetchStaff()
      setStaff(data)
      setLoading(false)
    }
    loadStaff()

    const unsub = subscribeTable('staff', () => {
      fetchStaff().then(setStaff)
    })
    return () => unsub()
  }, [])

  const filtered = staff.filter((s) => {
    const q = searchTerm.toLowerCase()
    const hay = `${s.first_name} ${s.last_name} ${s.email} ${s.phone || ''}`.toLowerCase()
    const roleOk = roleFilter === 'all' ? true : s.role === roleFilter
    return roleOk && hay.includes(q)
  })

  const handleCreate = async () => {
    if (!isAdmin) return
    if (!fullName || !username || !email || !password) return
    setCreating(true)
    try {
      await createStaffViaFunction({
        email,
        username,
        password,
        full_name: fullName,
        role,
        phone_number: phone || undefined,
        state: 'active',
        city: city || undefined
      })
      const data = await fetchStaff()
      setStaff(data)
      setShowCreate(false)
      setFullName('')
      setUsername('')
      setEmail('')
      setPassword('')
      setRole('support')
      setPhone('')
      setCity('')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">فريق العمل</h1>
          <p className="text-slate-400 text-sm">Team Members</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            className="bg-primary hover:bg-secondary text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
          >
            <i className="fa-solid fa-user-plus"></i>
            إضافة عضو
          </button>
        )}
      </div>

      <div className="nexus-card p-5 space-y-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex gap-2">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-dark-900 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary transition-all placeholder:text-slate-600"
              placeholder="بحث..."
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="bg-dark-900 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-primary transition-all"
            >
              <option value="all">كل الأدوار</option>
              <option value="admin">admin</option>
              <option value="support">support</option>
              <option value="partner">partner</option>
            </select>
          </div>
          <div className="text-xs text-slate-500">{filtered.length} عضو</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="spinner"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <i className="fa-solid fa-users text-4xl text-slate-600 mb-4"></i>
            <div className="text-sm text-slate-500">لا توجد نتائج</div>
          </div>
        ) : (
          <div className="overflow-auto custom-scrollbar">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 border-b border-white/5">
                  <th className="text-right py-3 px-2 font-medium">الاسم</th>
                  <th className="text-right py-3 px-2 font-medium">البريد</th>
                  <th className="text-right py-3 px-2 font-medium">الهاتف</th>
                  <th className="text-right py-3 px-2 font-medium">الدور</th>
                  <th className="text-right py-3 px-2 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                    onClick={() => navigate(`/staff/${s.id}`)}
                  >
                    <td className="py-3 px-2 text-white font-medium">{s.first_name} {s.last_name}</td>
                    <td className="py-3 px-2 text-slate-400">{s.email}</td>
                    <td className="py-3 px-2 text-slate-400">{s.phone || '—'}</td>
                    <td className="py-3 px-2">
                      <span className="nexus-pill text-[10px]">{s.role}</span>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${s.is_active ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-slate-800 text-slate-400 border border-white/5'}`}>
                        {s.is_active ? 'نشط' : 'غير نشط'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Staff Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-dark-800 border border-white/5 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="font-bold text-lg text-white">إضافة عضو جديد</div>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-white transition-colors">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="col-span-2 bg-dark-900 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary transition-all placeholder:text-slate-600"
                placeholder="الاسم الكامل"
              />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="col-span-2 bg-dark-900 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary transition-all placeholder:text-slate-600"
                placeholder="اسم المستخدم"
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="col-span-2 bg-dark-900 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary transition-all placeholder:text-slate-600"
                placeholder="البريد الإلكتروني"
              />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="col-span-2 bg-dark-900 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary transition-all placeholder:text-slate-600"
                placeholder="كلمة المرور"
                type="password"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="bg-dark-900 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-primary transition-all"
              >
                <option value="support">support</option>
                <option value="partner">partner</option>
                <option value="admin">admin</option>
              </select>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="bg-dark-900 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary transition-all placeholder:text-slate-600"
                placeholder="الهاتف (اختياري)"
              />
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="col-span-2 bg-dark-900 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary transition-all placeholder:text-slate-600"
                placeholder="البلدية (اختياري)"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/5 text-slate-400 text-sm font-medium hover:bg-white/5 transition-all"
              >
                إلغاء
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 px-4 py-2.5 rounded-xl bg-primary hover:bg-secondary text-white text-sm font-bold disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
              >
                {creating ? <><i className="fa-solid fa-circle-notch fa-spin ml-2"></i>جاري...</> : 'إنشاء'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
