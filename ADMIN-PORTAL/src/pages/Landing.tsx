import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setStoredRole } from '../lib/storage'
import { Role, Institution } from '../lib/types'
import { INSTITUTIONS } from '../lib/data'

export default function Landing() {
  const navigate = useNavigate()
  const [showPartnerGateway, setShowPartnerGateway] = useState(false)
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null)

  const pick = (role: Role) => {
    setStoredRole(role)
    navigate('/login')
  }

  const handleInstitutionSelect = (institution: Institution) => {
    setSelectedInstitution(institution)
    localStorage.setItem('partner_institution', institution.id)
    setStoredRole('partner')
    navigate(`/login?partner=${institution.id}`)
  }

  const cards: { role: Role; title: string; desc: string; icon: string }[] = [
    { role: 'administrator', title: 'ADMINISTRATOR', desc: 'إدارة شاملة / Full control', icon: 'fa-shield-halved' },
    { role: 'partner', title: 'PARTNER', desc: 'شركاء التسوية / Partners', icon: 'fa-building-columns' },
    { role: 'support', title: 'SUPPORT', desc: 'الدعم الفني / Support', icon: 'fa-headset' }
  ]

  if (showPartnerGateway) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900 px-6">
        <div className="max-w-6xl w-full space-y-10 animate-fade-in">
          <div className="text-center space-y-4">
            <button onClick={() => setShowPartnerGateway(false)} className="text-slate-500 hover:text-primary transition-colors text-sm flex items-center gap-2 mx-auto">
              <i className="fa-solid fa-arrow-right"></i> العودة
            </button>
            <div className="flex justify-center">
              <svg className="w-16 h-16 drop-shadow-[0_0_15px_rgba(16,185,129,0.4)]" viewBox="0 0 100 100" fill="none">
                <path d="M20 55 L50 25 L80 55" stroke="#10b981" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M35 70 L50 55 L65 70" stroke="white" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 className="text-3xl font-black text-white">اختر مؤسستك</h1>
            <p className="text-slate-400">اختر المؤسسة المالية التي تنتمي إليها</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {INSTITUTIONS.map((inst) => (
              <button
                key={inst.id}
                onClick={() => handleInstitutionSelect(inst)}
                className="nexus-card p-6 text-center hover:border-primary/30 transition-all group"
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-dark-900 flex items-center justify-center text-2xl font-black text-primary group-hover:scale-110 transition-transform border border-white/5">
                  {inst.code.charAt(0)}
                </div>
                <div className="font-bold text-lg text-white">{inst.name}</div>
                <div className="text-xs text-slate-500 mt-1">{inst.name_en}</div>
              </button>
            ))}
          </div>

          <div className="text-center">
            <button onClick={() => pick('partner')} className="text-slate-500 hover:text-primary text-sm transition-colors">
              <i className="fa-solid fa-ellipsis ml-2"></i> مؤسسة أخرى
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900 px-6">
      <div className="max-w-5xl w-full space-y-10 animate-fade-in">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <svg className="w-20 h-20 drop-shadow-[0_0_15px_rgba(16,185,129,0.4)]" viewBox="0 0 100 100" fill="none">
              <path d="M20 55 L50 25 L80 55" stroke="#10b981" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M35 70 L50 55 L65 70" stroke="white" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-4xl font-black font-montserrat tracking-tighter text-white uppercase italic">
            AD<span className="text-primary">JIL</span> <span className="text-slate-400 font-cairo text-2xl not-italic">Admin Portal</span>
          </h1>
          <p className="text-slate-400 max-w-md mx-auto">منصة إدارة Adjil.BNPL للموظفين والشركاء</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {cards.map((c) => (
            <button
              key={c.role}
              onClick={() => c.role === 'partner' ? setShowPartnerGateway(true) : pick(c.role)}
              className="nexus-card p-8 text-right hover:border-primary/30 transition-all group"
            >
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 border border-primary/20 group-hover:scale-110 transition-transform">
                <i className={`fa-solid ${c.icon} text-primary text-xl`}></i>
              </div>
              <div className="text-xs text-slate-500 font-bold tracking-wider uppercase">{c.title}</div>
              <div className="font-bold mt-2 text-white">{c.desc}</div>
              {c.role === 'partner' && (
                <div className="mt-3 text-xs text-primary">
                  <i className="fa-solid fa-building-columns ml-1"></i>
                  اختر مؤسستك أولاً
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
