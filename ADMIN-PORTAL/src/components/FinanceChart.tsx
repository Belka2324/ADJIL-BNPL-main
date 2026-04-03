import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { TransactionRecord } from '../lib/types'

type Props = {
  data: TransactionRecord[]
}

type ViewMode = 'daily' | 'weekly' | 'monthly'

type ChartDataItem = {
  key: string
  name: string
  amount: number
  trend: number
  trendPercent: number
  isUp: boolean
  fill: string
}

export default function FinanceChart({ data }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('monthly')
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const processData = useMemo((): ChartDataItem[] => {
    const grouped: Record<string, number> = {}
    
    data.forEach((tx) => {
      const date = tx.created_at ? new Date(tx.created_at) : null
      if (!date) return
      
      let key: string
      if (viewMode === 'daily') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      } else if (viewMode === 'weekly') {
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        key = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      }
      
      grouped[key] = (grouped[key] || 0) + Number(tx.amount || 0)
    })

    const sortedKeys = Object.keys(grouped).sort()
    const maxItems = viewMode === 'daily' ? 30 : viewMode === 'weekly' ? 12 : 12
    
    let prevAmount = 0
    return sortedKeys.slice(-maxItems).map((key, index): ChartDataItem => {
      const amount = grouped[key]
      const trend = index > 0 ? amount - prevAmount : 0
      const trendPercent = prevAmount > 0 ? (trend / prevAmount) * 100 : 0
      const isUp = trend >= 0
      prevAmount = amount
      
      let label = key
      if (viewMode === 'monthly') {
        const [year, month] = key.split('-')
        label = `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(month) - 1]} ${year.slice(2)}`
      } else if (viewMode === 'weekly') {
        const [year, month, day] = key.split('-')
        label = `${day}/${month}`
      } else {
        const [, , day] = key.split('-')
        label = day
      }
      
      return {
        key,
        name: label,
        amount,
        trend,
        trendPercent,
        isUp,
        fill: isUp ? '#10b981' : '#ef4444'
      }
    })
  }, [data, viewMode])

  const selectedData = selectedIndex !== null ? processData[selectedIndex] : null

  const total = processData.reduce((sum, d) => sum + d.amount, 0)
  const avg = processData.length > 0 ? total / processData.length : 0
  const lastItem = processData.length > 1 ? processData[processData.length - 1] : null
  const prevItem = processData.length > 2 ? processData[processData.length - 2] : null
  const overallTrend = prevItem && lastItem 
    ? ((lastItem.amount - prevItem.amount) / prevItem.amount) * 100 
    : 0

  return (
    <div className="enhanced-card p-5 h-[420px]">
      <div className="flex items-center justify-between mb-4">
        <div className="font-bold text-sm text-white">التدفقات المالية</div>
        <div className="flex gap-1.5">
          {(['daily', 'weekly', 'monthly'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                viewMode === mode 
                  ? 'bg-primary text-white' 
                  : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              {mode === 'daily' ? 'يومي' : mode === 'weekly' ? 'أسبوعي' : 'شهري'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-dark-900/50 rounded-xl p-3 border border-white/5">
          <div className="text-[10px] text-slate-500">المجموع</div>
          <div className="font-bold text-sm text-white">{total.toLocaleString('fr-DZ')} دج</div>
        </div>
        <div className="bg-dark-900/50 rounded-xl p-3 border border-white/5">
          <div className="text-[10px] text-slate-500">المتوسط</div>
          <div className="font-bold text-sm text-white">{avg.toLocaleString('fr-DZ')} دج</div>
        </div>
        <div className={`rounded-xl p-3 border ${overallTrend >= 0 ? 'bg-primary/5 border-primary/10' : 'bg-red-500/5 border-red-500/10'}`}>
          <div className="text-[10px] text-slate-500">الاتجاه</div>
          <div className={`font-bold text-sm ${overallTrend >= 0 ? 'text-primary' : 'text-red-400'}`}>
            {overallTrend >= 0 ? '↑' : '↓'} {Math.abs(overallTrend).toFixed(1)}%
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height="55%">
        <BarChart data={processData} onMouseLeave={() => setSelectedIndex(null)}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#64748b', fontSize: 10 }} 
            dy={8}
            interval={viewMode === 'daily' ? 6 : 0}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#64748b', fontSize: 10 }} 
            tickFormatter={(value) => `${value / 1000}k`}
          />
          <Tooltip 
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            contentStyle={{ 
              borderRadius: '12px', 
              border: '1px solid rgba(255,255,255,0.05)', 
              background: '#0a192f',
              color: '#f8fafc',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
              fontSize: '12px'
            }}
          />
          <Bar dataKey="amount" radius={[6, 6, 0, 0]} barSize={viewMode === 'daily' ? 8 : 24} name="الإيرادات">
            {processData.map((entry, index) => (
              <Bar 
                key={index} 
                fill={entry.fill} 
                fillOpacity={selectedIndex === index ? 1 : 0.7}
                onMouseEnter={() => setSelectedIndex(index)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex items-center justify-center gap-6 mt-2 text-[10px]">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded bg-primary"></div>
          <span className="text-slate-500">صاعد ↑</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded bg-red-500"></div>
          <span className="text-slate-500">نازل ↓</span>
        </div>
      </div>

      {selectedData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setSelectedIndex(null)}>
          <div className="bg-dark-800 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl border border-white/5 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="text-center space-y-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto ${selectedData.isUp ? 'bg-primary/10 border border-primary/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                <span className={`text-2xl ${selectedData.isUp ? 'text-primary' : 'text-red-400'}`}>
                  {selectedData.isUp ? '↑' : '↓'}
                </span>
              </div>
              <div className="font-bold text-white">{selectedData.name}</div>
              <div className="text-3xl font-black text-white">
                {selectedData.amount.toLocaleString('fr-DZ')} دج
              </div>
              <div className={`text-sm font-medium ${selectedData.isUp ? 'text-primary' : 'text-red-400'}`}>
                {selectedData.trend >= 0 ? '+' : ''}{selectedData.trend.toLocaleString('fr-DZ')} دج 
                ({selectedData.trendPercent.toFixed(1)}%)
              </div>
              <div className="text-xs text-slate-500">
                {selectedData.isUp ? 'ارتفاع مقارنة بالفترة السابقة' : 'انخفاض مقارنة بالفترة السابقة'}
              </div>
              <button
                onClick={() => setSelectedIndex(null)}
                className="w-full bg-primary hover:bg-secondary text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
