import React, { useEffect, useState, useMemo } from 'react'

const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#ec4899']

const SVG_W = 800
const SVG_H = 280
const PAD = { left: 58, right: 20, top: 20, bottom: 40 }
const CHART_W = SVG_W - PAD.left - PAD.right
const CHART_H = SVG_H - PAD.top - PAD.bottom

export default function MonthlyTrendChart() {
  const currentYear = new Date().getFullYear()
  const [rawData, setRawData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [year, setYear] = useState(currentYear)
  const [metric, setMetric] = useState('count')   // 'count' | 'hours' | 'amount'
  const [groupBy, setGroupBy] = useState('total')  // 'total' | 'byRole' | 'byAnalytic'
  const [tooltip, setTooltip] = useState(null)

  const years = useMemo(() => {
    return [currentYear, currentYear - 1, currentYear - 2, currentYear - 3]
  }, [currentYear])

  useEffect(() => { fetchData() }, [year])

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ startMonth: `${year}-01`, endMonth: `${year}-12` })
      const r = await fetch('/api/admin/statistics/invoices?' + params)
      if (!r.ok) throw new Error('HTTP ' + r.status)
      const d = await r.json()
      setRawData(d.prestations || [])
    } catch (e) {
      setError(e.message)
      setRawData(null)
    } finally {
      setLoading(false)
    }
  }

  // Aggregate by month
  const chartData = useMemo(() => {
    if (!rawData) return null

    const byMonth = Array.from({ length: 12 }, () => ({
      total: { count: 0, hours: 0, amount: 0 },
      analytics: {},
      roles: {
        INFI: { count: 0, hours: 0, amount: 0 },
        MED:  { count: 0, hours: 0, amount: 0 },
      }
    }))

    rawData.forEach(p => {
      const dateStr = p.date || ''
      if (!dateStr) return
      const monthIdx = parseInt(dateStr.slice(5, 7), 10) - 1
      if (monthIdx < 0 || monthIdx > 11) return

      const role = p.user_role || ''
      let amount = 0
      if (role === 'MED') amount = parseFloat(p.remuneration_med || 0)
      else if (role === 'INFI') amount = parseFloat(p.remuneration_infi || 0)
      else amount = Math.max(parseFloat(p.remuneration_infi || 0), parseFloat(p.remuneration_med || 0))

      const gardeH = parseFloat(p.garde_hours || 0)
      const sortieH = parseFloat(p.sortie_hours || 0)
      const hours = (gardeH > 0 || sortieH > 0) ? gardeH + sortieH : parseFloat(p.hours_actual || 0)

      const m = byMonth[monthIdx]
      m.total.count += 1
      m.total.hours += hours
      m.total.amount += amount

      const aname = p.analytic_name || 'Sans analytique'
      if (!m.analytics[aname]) m.analytics[aname] = { count: 0, hours: 0, amount: 0 }
      m.analytics[aname].count += 1
      m.analytics[aname].hours += hours
      m.analytics[aname].amount += amount

      const rkey = role === 'INFI' ? 'INFI' : role === 'MED' ? 'MED' : null
      if (rkey) {
        m.roles[rkey].count += 1
        m.roles[rkey].hours += hours
        m.roles[rkey].amount += amount
      }
    })

    const analyticNames = [...new Set(rawData.map(p => p.analytic_name || 'Sans analytique'))]
    return { byMonth, analyticNames }
  }, [rawData])

  // Build chart series
  const series = useMemo(() => {
    if (!chartData) return []
    const { byMonth, analyticNames } = chartData

    if (groupBy === 'total') {
      return [{ name: 'Total', color: '#6366f1', values: byMonth.map(m => m.total[metric]) }]
    }
    if (groupBy === 'byRole') {
      return [
        { name: 'Infirmier', color: '#3b82f6', values: byMonth.map(m => m.roles.INFI[metric]) },
        { name: 'Médecin',   color: '#f97316', values: byMonth.map(m => m.roles.MED[metric]) },
      ].filter(s => s.values.some(v => v > 0))
    }
    // byAnalytic: top 8 analytics by total value over the year
    const sorted = analyticNames
      .map(name => ({ name, total: byMonth.reduce((s, m) => s + (m.analytics[name]?.[metric] || 0), 0) }))
      .filter(a => a.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)

    return sorted.map((a, i) => ({
      name: a.name,
      color: COLORS[i % COLORS.length],
      values: byMonth.map(m => m.analytics[a.name]?.[metric] || 0)
    }))
  }, [chartData, groupBy, metric])

  // Chart geometry helpers
  const maxVal = useMemo(() => Math.max(...series.flatMap(s => s.values), 1), [series])
  const xPos = (i) => PAD.left + (i / 11) * CHART_W
  const yPos = (v) => PAD.top + CHART_H - (v / maxVal) * CHART_H

  function buildPath(values) {
    if (values.every(v => v === 0)) return ''
    return values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xPos(i).toFixed(1)} ${yPos(v).toFixed(1)}`).join(' ')
  }
  function buildArea(values) {
    const line = buildPath(values)
    if (!line) return ''
    return `${line} L ${xPos(11).toFixed(1)} ${(PAD.top + CHART_H).toFixed(1)} L ${xPos(0).toFixed(1)} ${(PAD.top + CHART_H).toFixed(1)} Z`
  }

  const yTicks = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const val = (maxVal / 5) * i
      return { val, y: yPos(val) }
    })
  }, [maxVal, series])

  const fmtVal = (v) => {
    if (metric === 'count') return Math.round(v) + ''
    if (metric === 'hours') return (v || 0).toFixed(1) + ' h'
    return (v || 0).toFixed(2) + ' €'
  }
  const fmtTick = (v) => {
    if (metric === 'count') return Math.round(v)
    if (metric === 'hours') return Math.round(v) + 'h'
    const n = Math.round(v)
    return n >= 1000 ? (n / 1000).toFixed(1) + 'k€' : n + '€'
  }

  const btnBase = { padding: '7px 12px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }
  const selectStyle = { padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, background: '#fff' }

  // Summary stats
  const totals = useMemo(() => {
    if (!chartData) return null
    return chartData.byMonth.reduce((acc, m) => ({
      count: acc.count + m.total.count,
      hours: acc.hours + m.total.hours,
      amount: acc.amount + m.total.amount
    }), { count: 0, hours: 0, amount: 0 })
  }, [chartData])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Controls */}
      <div style={{ padding: 16, background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Année</span>
            <select value={year} onChange={e => setYear(parseInt(e.target.value))} style={selectStyle}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Afficher</span>
            <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #d1d5db' }}>
              {[['count', 'Prestations'], ['hours', 'Heures'], ['amount', 'Montant']].map(([val, lbl], i, arr) => (
                <button key={val} onClick={() => setMetric(val)} style={{
                  ...btnBase,
                  background: metric === val ? '#4f46e5' : '#fff',
                  color: metric === val ? '#fff' : '#374151',
                  borderRight: i < arr.length - 1 ? '1px solid #d1d5db' : 'none'
                }}>{lbl}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Grouper par</span>
            <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #d1d5db' }}>
              {[['total', 'Total'], ['byRole', 'Rôle'], ['byAnalytic', 'Analytique']].map(([val, lbl], i, arr) => (
                <button key={val} onClick={() => setGroupBy(val)} style={{
                  ...btnBase,
                  background: groupBy === val ? '#10b981' : '#fff',
                  color: groupBy === val ? '#fff' : '#374151',
                  borderRight: i < arr.length - 1 ? '1px solid #d1d5db' : 'none'
                }}>{lbl}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {loading && <div style={{ padding: 32, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>Chargement…</div>}
      {error && <div style={{ padding: 16, background: '#fee2e2', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>Erreur : {error}</div>}

      {/* Summary KPIs */}
      {!loading && totals && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {[
            { label: 'Prestations', value: totals.count, unit: '', color: '#6366f1', bg: '#eff6ff' },
            { label: 'Heures',      value: totals.hours.toFixed(1), unit: ' h', color: '#10b981', bg: '#f0fdf4' },
            { label: 'Montant',     value: totals.amount.toFixed(2), unit: ' €', color: '#f59e0b', bg: '#fffbeb' },
          ].map(({ label, value, unit, color, bg }) => (
            <div key={label} style={{ padding: '14px 18px', background: bg, borderRadius: 10, border: `1px solid ${color}22` }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{label} {year}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}{unit}</div>
            </div>
          ))}
        </div>
      )}

      {/* SVG Line Chart */}
      {!loading && series.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px 16px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', marginBottom: 2 }}>
            Évolution mensuelle — {year}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
            {metric === 'count' ? 'Nombre de prestations' : metric === 'hours' ? 'Heures totales' : 'Montant total'} par mois
          </div>

          <div style={{ overflowX: 'auto' }}>
            <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ width: '100%', minWidth: 480, display: 'block' }}
              onMouseLeave={() => setTooltip(null)}>

              {/* Horizontal grid lines + Y labels */}
              {yTicks.map((t, i) => (
                <g key={i}>
                  <line x1={PAD.left} y1={t.y} x2={PAD.left + CHART_W} y2={t.y}
                    stroke={i === 0 ? '#e5e7eb' : '#f3f4f6'} strokeWidth={i === 0 ? 1.5 : 1} />
                  <text x={PAD.left - 6} y={t.y + 4} textAnchor="end" fontSize={10} fill="#9ca3af">
                    {fmtTick(t.val)}
                  </text>
                </g>
              ))}

              {/* Vertical grid lines */}
              {MONTHS_FR.map((_, i) => (
                <line key={i} x1={xPos(i)} y1={PAD.top} x2={xPos(i)} y2={PAD.top + CHART_H}
                  stroke="#f3f4f6" strokeWidth={1} />
              ))}

              {/* Area fill (only when single series) */}
              {series.length === 1 && buildArea(series[0].values) && (
                <path d={buildArea(series[0].values)} fill={series[0].color} fillOpacity={0.09} />
              )}

              {/* Lines */}
              {series.map((s, si) => buildPath(s.values) && (
                <path key={si} d={buildPath(s.values)} fill="none"
                  stroke={s.color} strokeWidth={2.5}
                  strokeLinejoin="round" strokeLinecap="round" />
              ))}

              {/* Dots + hover zones */}
              {series.map((s, si) =>
                s.values.map((v, i) => (
                  <g key={`${si}-${i}`}>
                    <circle cx={xPos(i)} cy={yPos(v)} r={4}
                      fill={v > 0 ? s.color : '#e5e7eb'} stroke="#fff" strokeWidth={1.5} />
                    <rect
                      x={xPos(i) - (CHART_W / 11 / 2)} y={PAD.top}
                      width={CHART_W / 11} height={CHART_H}
                      fill="transparent" style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setTooltip({ xi: i, si, v, seriesName: s.name, color: s.color })}
                    />
                  </g>
                ))
              )}

              {/* Tooltip */}
              {tooltip && (() => {
                const x = xPos(tooltip.xi)
                const y = yPos(tooltip.v)
                const tw = 160, th = 52
                const tx = Math.min(x + 12, SVG_W - tw - 4)
                const ty = Math.max(y - th - 10, 4)
                const allLines = series.map((s, si) => ({ name: s.name, color: s.color, v: s.values[tooltip.xi] }))
                const multiLine = allLines.length > 1
                const boxH = multiLine ? 16 + allLines.length * 18 + 8 : 52
                return (
                  <g>
                    <rect x={tx} y={ty} width={tw} height={boxH} rx={7} fill="#1f2937" opacity={0.93} />
                    <text x={tx + 10} y={ty + 15} fontSize={11} fill="#9ca3af">
                      {MONTHS_FR[tooltip.xi]} {year}
                    </text>
                    {multiLine
                      ? allLines.map((l, li) => (
                          <g key={li}>
                            <rect x={tx + 10} y={ty + 24 + li * 18} width={8} height={8} rx={2} fill={l.color} />
                            <text x={tx + 22} y={ty + 32 + li * 18} fontSize={11} fill="#e5e7eb">
                              {l.name.length > 14 ? l.name.slice(0, 13) + '…' : l.name}: {fmtVal(l.v)}
                            </text>
                          </g>
                        ))
                      : <text x={tx + 10} y={ty + 38} fontSize={16} fontWeight="bold" fill="#fff">
                          {fmtVal(tooltip.v)}
                        </text>
                    }
                  </g>
                )
              })()}

              {/* Axes */}
              <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + CHART_H}
                stroke="#d1d5db" strokeWidth={1} />
              <line x1={PAD.left} y1={PAD.top + CHART_H} x2={PAD.left + CHART_W} y2={PAD.top + CHART_H}
                stroke="#d1d5db" strokeWidth={1} />

              {/* X axis labels */}
              {MONTHS_FR.map((m, i) => (
                <text key={i} x={xPos(i)} y={PAD.top + CHART_H + 20}
                  textAnchor="middle" fontSize={11} fill="#6b7280">{m}</text>
              ))}
            </svg>
          </div>

          {/* Legend */}
          {series.length > 1 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 16, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
              {series.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 28, height: 3, background: s.color, borderRadius: 2 }} />
                  <span style={{ fontSize: 12, color: '#374151' }}>{s.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Monthly breakdown table */}
      {!loading && chartData && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #f3f4f6', fontSize: 13, fontWeight: 700, color: '#1f2937' }}>
            Détail par mois — {year}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Mois', 'Prestations', 'Heures', 'Montant'].map((h, i) => (
                    <th key={h} style={{
                      padding: '9px 16px', textAlign: i === 0 ? 'left' : 'right',
                      fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb',
                      whiteSpace: 'nowrap', fontSize: 12
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chartData.byMonth.map((m, i) => {
                  const empty = m.total.count === 0
                  const isCurrentMonth = year === currentYear && i === new Date().getMonth()
                  return (
                    <tr key={i} style={{
                      borderBottom: '1px solid #f9fafb',
                      background: isCurrentMonth ? '#fafaf5' : 'transparent'
                    }}>
                      <td style={{ padding: '8px 16px', fontWeight: 600, color: isCurrentMonth ? '#4f46e5' : '#374151' }}>
                        {MONTHS_FR[i]}
                        {isCurrentMonth && <span style={{ fontSize: 10, color: '#6366f1', marginLeft: 6, fontWeight: 500 }}>← maintenant</span>}
                      </td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', color: empty ? '#d1d5db' : '#1f2937', fontWeight: empty ? 400 : 600 }}>
                        {empty ? '—' : m.total.count}
                      </td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', color: empty ? '#d1d5db' : '#374151' }}>
                        {empty ? '—' : m.total.hours.toFixed(1) + ' h'}
                      </td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', color: empty ? '#d1d5db' : '#374151' }}>
                        {empty ? '—' : m.total.amount.toFixed(2) + ' €'}
                      </td>
                    </tr>
                  )
                })}
                <tr style={{ background: '#f0fdf4', borderTop: '2px solid #e5e7eb' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 700, color: '#065f46' }}>Total {year}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: '#065f46' }}>
                    {chartData.byMonth.reduce((s, m) => s + m.total.count, 0)}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: '#065f46' }}>
                    {chartData.byMonth.reduce((s, m) => s + m.total.hours, 0).toFixed(1)} h
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: '#065f46' }}>
                    {chartData.byMonth.reduce((s, m) => s + m.total.amount, 0).toFixed(2)} €
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && rawData && rawData.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
          Aucune prestation pour l'année {year}.
        </div>
      )}
    </div>
  )
}
