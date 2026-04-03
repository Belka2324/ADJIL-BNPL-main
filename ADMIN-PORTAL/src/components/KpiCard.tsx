type Props = {
  title: string
  value: string
  delta?: string
  icon?: string
  className?: string
}

export default function KpiCard({ title, value, delta, icon, className }: Props) {
  return (
    <div className={`enhanced-card p-5 ${className || ''}`}>
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-400 font-medium">{title}</div>
        {icon && (
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <i className={`fa-solid ${icon} text-primary`}></i>
          </div>
        )}
      </div>
      <div className="text-2xl font-black mt-3 text-white">{value}</div>
      {delta && <div className="text-xs text-primary mt-1 font-bold">{delta}</div>}
    </div>
  )
}
