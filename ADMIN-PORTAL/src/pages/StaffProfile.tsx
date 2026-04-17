import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { StaffRecord, StaffReport, StaffCommunication, StaffRole } from '../lib/types'
import { deleteStaff, fetchStaffById } from '../lib/data'
import { getSession } from '../lib/storage'

// Demo staff data
const DEMO_STAFF: StaffRecord[] = [
  {
    id: '1',
    first_name: 'أحمد',
    last_name: 'محمد',
    email: 'ahmed.mohamed@adjil.dz',
    phone: '+213 770 000 001',
    address: 'الجزائر العاصمة، حي باب الوادي',
    role: 'ceo',
    institution: 'Adjil HQ',
    bank_name: 'BNA',
    is_active: true,
    created_at: '2024-01-15',
    reports_count: 5,
    messages_count: 23
  },
  {
    id: '2',
    first_name: 'سارة',
    last_name: 'بلقاسم',
    email: 'sarah.belkasim@adjil.dz',
    phone: '+213 770 000 002',
    address: 'وهران، حي السعادة',
    role: 'administrator',
    institution: 'Adjil HQ',
    bank_name: 'CNEP',
    is_active: true,
    created_at: '2024-02-01',
    reports_count: 12,
    messages_count: 45
  },
  {
    id: '3',
    first_name: 'كريم',
    last_name: 'بن يوسف',
    email: 'karim.benyoussef@adjil.dz',
    phone: '+213 770 000 003',
    address: 'قسنطينة، حي جمال',
    role: 'partner',
    institution: 'BNA',
    bank_name: 'BADR',
    is_active: true,
    created_at: '2024-03-10',
    reports_count: 3,
    messages_count: 15
  },
  {
    id: '4',
    first_name: 'فاطمة',
    last_name: 'زهراء',
    email: 'fatima.zahra@adjil.dz',
    phone: '+213 770 000 004',
    address: 'عنابة، حي رأس الماء',
    role: 'support',
    institution: 'Adjil HQ',
    bank_name: 'CCP',
    is_active: true,
    created_at: '2024-04-05',
    reports_count: 8,
    messages_count: 67
  },
  {
    id: '5',
    first_name: 'ياسين',
    last_name: 'بوعبد الله',
    email: 'yacine.bouabdallah@adjil.dz',
    phone: '+213 770 000 005',
    address: 'سطيف، حي البدر',
    role: 'partner',
    institution: 'BADR',
    bank_name: 'BNA',
    is_active: false,
    created_at: '2024-05-20',
    reports_count: 1,
    messages_count: 4
  }
]

// Demo reports
const DEMO_REPORTS: StaffReport[] = [
  {
    id: 'r1',
    staff_id: '1',
    title: 'تقرير أداء شهر يناير',
    description: 'أداء متميز في إدارة الفريق وتحقيق الأهداف',
    type: 'praise',
    created_by: 'المدير العام',
    created_at: '2024-02-01'
  },
  {
    id: 'r2',
    staff_id: '1',
    title: 'تقرير تأخر في التسوية',
    description: 'تم معالجة الموضوع في الوقت المناسب',
    type: 'warning',
    created_by: 'مدير العمليات',
    created_at: '2024-02-15'
  },
  {
    id: 'r3',
    staff_id: '1',
    title: 'شكوى من زبون',
    description: 'تم التواصل وحل المشكلة',
    type: 'complaint',
    created_by: 'قسم الدعم',
    created_at: '2024-03-01'
  }
]

// Demo communications
const DEMO_COMMUNICATIONS: StaffCommunication[] = [
  {
    id: 'c1',
    staff_id: '1',
    subject: 'اجتماع فريق الإدارة',
    body: 'نرحب بكم في اجتماع فريق الإدارة القادم يوم الأحد...',
    direction: 'outgoing',
    created_at: '2024-03-10'
  },
  {
    id: 'c2',
    staff_id: '1',
    subject: 'طلب إجازة',
    body: 'أطلب إجازة لمدة أسبوع بسبب ظروف شخصية...',
    direction: 'incoming',
    created_at: '2024-03-08'
  },
  {
    id: 'c3',
    staff_id: '1',
    subject: 'تقرير شهري',
    body: 'يرجى إرسال التقرير الشهري قبل نهاية الشهر...',
    direction: 'outgoing',
    created_at: '2024-03-05'
  }
]

const ROLE_LABELS: Record<StaffRole, { ar: string; en: string; fr: string }> = {
  ceo: { ar: 'الرئيس التنفيذي', en: 'CEO', fr: 'PDG' },
  administrator: { ar: 'مدير النظام', en: 'Administrator', fr: 'Administrateur' },
  admin: { ar: 'مدير', en: 'Admin', fr: 'Admin' },
  partner: { ar: 'شريك', en: 'Partner', fr: 'Partenaire' },
  support: { ar: 'الدعم الفني', en: 'Support', fr: 'Support' }
}

const BANK_LABELS: Record<string, { ar: string; en: string; fr: string }> = {
  BNA: { ar: 'البنك الوطني الجزائري', en: 'BNA', fr: 'BNA' },
  BADR: { ar: 'بنك الفلاحة والتنمية rural', en: 'BADR', fr: 'BADR' },
  CNEP: { ar: 'الصندوق الوطني للتوفير والاحتياط', en: 'CNEP', fr: 'CNEP' },
  CCP: { ar: 'بريد الجزائر', en: 'Algerie Poste', fr: 'Algerie Poste' },
  BEA: { ar: 'بنك خارجية الجزائر', en: 'BEA', fr: 'BEA' },
  BNP: { ar: 'بي إن بي باريبا', en: 'BNP Paribas', fr: 'BNP Paribas' }
}

export default function StaffProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'info' | 'reports' | 'communications'>('info')
  const [deleting, setDeleting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [staffData, setStaffData] = useState<StaffRecord | null>(null)
  const session = getSession()
  const isCEO = session?.role === 'ceo' || session?.isCEO === true
  
  useEffect(() => {
    const loadStaff = async () => {
      if (!id) return
      setLoading(true)
      try {
        const data = await fetchStaffById(id)
        setStaffData(data)
      } catch (error) {
        console.error('Error loading staff:', error)
      } finally {
        setLoading(false)
      }
    }
    loadStaff()
  }, [id])

  const staff = staffData || DEMO_STAFF.find(s => s.id === id)
  const reports = DEMO_REPORTS.filter(r => r.staff_id === id)
  const communications = DEMO_COMMUNICATIONS.filter(c => c.staff_id === id)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="spinner"></div>
      </div>
    )
  }

  const handleDelete = async () => {
    if (!staff) return
    if (!confirm('هل أنت متأكد من حذف هذا العضو نهائياً؟')) return
    setDeleting(true)
    try {
      await deleteStaff(staff.id)
      navigate('/team')
    } catch (error) {
      console.error('Delete failed:', error)
      alert('فشل حذف العضو')
    } finally {
      setDeleting(false)
    }
  }

  if (!staff) {
    return (
      <div className="text-center py-12">
        <i className="fa-solid fa-user-xmark text-4xl text-slate-300 mb-3"></i>
        <p className="text-slate-500">المستخدم غير موجود</p>
        <button 
          onClick={() => navigate('/team')}
          className="mt-4 text-nexus-accent"
        >
          العودة للقائمة
        </button>
      </div>
    )
  }

  const getRoleBadge = (role: StaffRole) => {
    const colors: Record<StaffRole, string> = {
      ceo: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      administrator: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      admin: 'bg-red-500/20 text-red-400 border-red-500/30',
      partner: 'bg-green-500/20 text-green-400 border-green-500/30',
      support: 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    }
    return (
      <span className={`px-3 py-1.5 rounded-full text-sm font-bold border ${colors[role]}`}>
        {ROLE_LABELS[role].ar}
      </span>
    )
  }

  const getReportTypeBadge = (type: StaffReport['type']) => {
    const badges: Record<StaffReport['type'], { bg: string; text: string; icon: string }> = {
      praise: { bg: 'bg-green-500/20', text: 'text-green-400', icon: 'fa-star' },
      warning: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: 'fa-triangle-exclamation' },
      complaint: { bg: 'bg-red-500/20', text: 'text-red-400', icon: 'fa-hand-paper' },
      other: { bg: 'bg-slate-500/20', text: 'text-slate-400', icon: 'fa-file' }
    }
    const b = badges[type]
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-bold ${b.bg} ${b.text}`}>
        <i className={`fa-solid ${b.icon} ml-1`}></i>
        {type === 'praise' && 'إشادة'}
        {type === 'warning' && 'تحذير'}
        {type === 'complaint' && 'شكوى'}
        {type === 'other' && 'أخرى'}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button 
        onClick={() => navigate('/team')}
        className="flex items-center gap-2 text-slate-500 hover:text-nexus-accent transition-colors"
      >
        <i className="fa-solid fa-arrow-right"></i>
        العودة لفريق العمل
      </button>

      {/* Profile Header */}
      <div className="nexus-card p-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Avatar */}
          <div className="flex flex-col items-center">
            <div className="w-32 h-32 rounded-full bg-nexus-accent/20 flex items-center justify-center text-nexus-accent text-4xl font-black">
              {staff.first_name[0]}{staff.last_name[0]}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${staff.is_active ? 'bg-green-400' : 'bg-red-400'}`}></span>
              <span className="text-sm text-slate-500">
                {staff.is_active ? 'نشط' : 'غير نشط'}
              </span>
            </div>
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black">{staff.first_name} {staff.last_name}</h1>
                <p className="text-slate-500">{staff.email}</p>
                <div className="mt-3">{getRoleBadge(staff.role)}</div>
              </div>
              <div className="flex gap-2">
                <button className="bg-nexus-accent text-white px-4 py-2 rounded-xl font-bold text-sm">
                  <i className="fa-solid fa-pen ml-2"></i>
                  تعديل
                </button>
                <button className="bg-slate-200 dark:bg-slate-700 px-4 py-2 rounded-xl font-bold text-sm">
                  <i className="fa-solid fa-envelope ml-2"></i>
                  رسالة
                </button>
                {isCEO && staff.role !== 'ceo' && (
                  <button 
                    onClick={handleDelete}
                    disabled={deleting}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-50"
                  >
                    <i className="fa-solid fa-trash ml-2"></i>
                    {deleting ? 'جاري...' : 'حذف'}
                  </button>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3 text-center">
                <i className="fa-solid fa-phone text-nexus-accent mb-1"></i>
                <div className="text-xs text-slate-500">الهاتف</div>
                <div className="font-bold text-sm">{staff.phone}</div>
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3 text-center">
                <i className="fa-solid fa-location-dot text-nexus-accent mb-1"></i>
                <div className="text-xs text-slate-500">العنوان</div>
                <div className="font-bold text-sm">{staff.address}</div>
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3 text-center">
                <i className="fa-solid fa-building-columns text-nexus-accent mb-1"></i>
                <div className="text-xs text-slate-500">البنك</div>
                <div className="font-bold text-sm">{BANK_LABELS[staff.bank_name || '']?.ar || '-'}</div>
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3 text-center">
                <i className="fa-solid fa-calendar text-nexus-accent mb-1"></i>
                <div className="text-xs text-slate-500">تاريخ الانضمام</div>
                <div className="font-bold text-sm">{staff.created_at}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab('info')}
          className={`px-4 py-3 font-bold text-sm border-b-2 transition-colors ${
            activeTab === 'info' 
              ? 'border-nexus-accent text-nexus-accent' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <i className="fa-solid fa-user ml-2"></i>
          البيانات الشخصية
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-3 font-bold text-sm border-b-2 transition-colors ${
            activeTab === 'reports' 
              ? 'border-nexus-accent text-nexus-accent' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <i className="fa-solid fa-file-lines ml-2"></i>
          التقارير ({reports.length})
        </button>
        <button
          onClick={() => setActiveTab('communications')}
          className={`px-4 py-3 font-bold text-sm border-b-2 transition-colors ${
            activeTab === 'communications' 
              ? 'border-nexus-accent text-nexus-accent' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <i className="fa-solid fa-comments ml-2"></i>
          المراسلات ({communications.length})
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'info' && (
        <div className="nexus-card p-6">
          <h3 className="text-lg font-bold mb-4">البيانات الشخصية والمهنية</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500">الاسم الأول</label>
                <div className="font-bold">{staff.first_name}</div>
              </div>
              <div>
                <label className="text-xs text-slate-500">الاسم الأخير</label>
                <div className="font-bold">{staff.last_name}</div>
              </div>
              <div>
                <label className="text-xs text-slate-500">البريد الإلكتروني</label>
                <div className="font-bold">{staff.email}</div>
              </div>
              <div>
                <label className="text-xs text-slate-500">رقم الهاتف</label>
                <div className="font-bold">{staff.phone}</div>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500">العنوان</label>
                <div className="font-bold">{staff.address}</div>
              </div>
              <div>
                <label className="text-xs text-slate-500">المنصب</label>
                <div className="font-bold">{ROLE_LABELS[staff.role].ar}</div>
              </div>
              <div>
                <label className="text-xs text-slate-500">المؤسسة</label>
                <div className="font-bold">{staff.institution}</div>
              </div>
              <div>
                <label className="text-xs text-slate-500">البنك المرتبط</label>
                <div className="font-bold">{BANK_LABELS[staff.bank_name || '']?.ar || '-'}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-4">
          {reports.map(report => (
            <div key={report.id} className="nexus-card p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    {getReportTypeBadge(report.type)}
                    <span className="text-xs text-slate-500">{report.created_at}</span>
                  </div>
                  <h4 className="font-bold">{report.title}</h4>
                  <p className="text-sm text-slate-500 mt-1">{report.description}</p>
                  <div className="text-xs text-slate-400 mt-2">
                    <i className="fa-solid fa-user ml-1"></i>
                    {report.created_by}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {reports.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <i className="fa-solid fa-folder-open text-3xl mb-2"></i>
              <p>لا توجد تقارير</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'communications' && (
        <div className="space-y-4">
          {communications.map(comm => (
            <div key={comm.id} className="nexus-card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      comm.direction === 'incoming' 
                        ? 'bg-blue-500/20 text-blue-400' 
                        : 'bg-green-500/20 text-green-400'
                    }`}>
                      <i className={`fa-solid fa-arrow-${comm.direction === 'incoming' ? 'left' : 'right'} ml-1`}></i>
                      {comm.direction === 'incoming' ? 'وارد' : 'صادر'}
                    </span>
                    <span className="text-xs text-slate-500">{comm.created_at}</span>
                  </div>
                  <h4 className="font-bold">{comm.subject}</h4>
                  <p className="text-sm text-slate-500 mt-1">{comm.body}</p>
                </div>
                <button className="text-slate-400 hover:text-nexus-accent">
                  <i className="fa-solid fa-ellipsis-vertical"></i>
                </button>
              </div>
            </div>
          ))}
          {communications.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <i className="fa-solid fa-envelope-open-text text-3xl mb-2"></i>
              <p>لا توجد مراسلات</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
