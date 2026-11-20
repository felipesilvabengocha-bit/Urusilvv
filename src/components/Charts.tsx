import React, { useState } from 'react';
import { Landmark } from 'lucide-react';
import { MonthlyHistoryPoint, Party } from '../types/game';

interface MacroTrendChartProps {
  history: MonthlyHistoryPoint[];
}

type MetricKey = 'gdpGrowthPct' | 'inflationPct' | 'unemploymentPct' | 'approvalPct' | 'playerPartyPollPct';

const METRICS: Array<{ key: MetricKey; label: string; unit: string; color: string }> = [
  { key: 'gdpGrowthPct', label: 'PIB %', unit: '%', color: '#ACCEBF' },
  { key: 'inflationPct', label: 'Inflación %', unit: '%', color: '#E87532' },
  { key: 'unemploymentPct', label: 'Desempleo %', unit: '%', color: '#FFB4AB' },
  { key: 'approvalPct', label: 'Aprobación %', unit: '%', color: '#E9E2D4' },
  { key: 'playerPartyPollPct', label: 'Intención Lema %', unit: '%', color: '#FFB691' },
];

export const MacroTrendChart: React.FC<MacroTrendChartProps> = ({ history }) => {
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('gdpGrowthPct');
  const metric = METRICS.find((m) => m.key === selectedMetric)!;

  if (history.length < 2) {
    return (
      <div className="warroom-card rounded-xl p-5 text-sm text-[#CDC6B8]">
        Avanzá al menos un mes para visualizar la serie histórica mensual de indicadores.
      </div>
    );
  }

  const values = history.map((h) => h[selectedMetric]);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const pad = Math.max(1, (rawMax - rawMin) * 0.2);
  const minV = rawMin - pad;
  const maxV = rawMax + pad;
  const range = Math.max(0.5, maxV - minV);

  const w = 640;
  const h = 200;
  const padX = 42;
  const padY = 20;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;

  const coords = history.map((pt, idx) => {
    const x = padX + (idx / Math.max(1, history.length - 1)) * innerW;
    const y = padY + innerH - ((pt[selectedMetric] - minV) / range) * innerH;
    return { x, y, label: pt.dateLabel, val: pt[selectedMetric] };
  });

  const polylinePoints = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const areaPath = `M ${coords[0].x.toFixed(1)},${padY + innerH} L ${coords
    .map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(' L ')} L ${coords[coords.length - 1].x.toFixed(1)},${padY + innerH} Z`;

  const latest = coords[coords.length - 1];

  return (
    <div className="warroom-card rounded-xl p-4 shadow-md sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-base font-semibold text-[#DFE3E4]">
            Evolución mensual: {metric.label}
          </h3>
          <div className="mt-0.5 text-xs text-[#CDC6B8]">
            Último registro ({latest.label}):{' '}
            <span className="font-mono-data font-bold text-[#FFB691]">
              {latest.val.toFixed(1)}
              {metric.unit}
            </span>
          </div>
        </div>
        <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-lg border border-[#574239]/50 bg-[#0A0F10] p-1">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setSelectedMetric(m.key)}
              className={`min-h-[34px] shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 font-mono-data text-[11px] font-semibold transition ${
                selectedMetric === m.key
                  ? 'bg-[#E87532] text-[#511E00]'
                  : 'text-[#CDC6B8] hover:text-[#DFE3E4]'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 w-full overflow-hidden rounded-lg bg-[#0A0F10]/60 p-2">
        <svg viewBox={`0 0 ${w} ${h}`} className="h-44 w-full sm:h-48" role="img" aria-label={`Gráfico mensual de ${metric.label}`}>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = padY + innerH * (1 - t);
            const valLabel = (minV + range * t).toFixed(1);
            return (
              <g key={t}>
                <line x1={padX} y1={y} x2={w - padX} y2={y} stroke="#262B2C" strokeWidth="1" />
                <text x={padX - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#CDC6B8" className="font-mono-data">
                  {valLabel}
                </text>
              </g>
            );
          })}

          <path d={areaPath} fill={metric.color} fillOpacity="0.16" />
          <polyline fill="none" stroke={metric.color} strokeWidth="2.5" points={polylinePoints} />

          {coords.map((c, idx) => (
            <g key={idx}>
              <circle cx={c.x} cy={c.y} r={idx === coords.length - 1 ? 4.5 : 2.5} fill={metric.color} />
              {(idx === 0 || idx === coords.length - 1 || idx % Math.max(1, Math.floor(coords.length / 6)) === 0) && (
                <text x={c.x} y={h - 4} textAnchor="middle" fontSize="9.5" fill="#CDC6B8" className="font-mono-data">
                  {c.label}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
};

interface ParliamentHemicycleProps {
  title: string;
  seatsByParty: Record<string, number>;
  parties: Party[];
  totalSeats: number;
  subtitle?: string;
  daisLabel?: string;
}

export const ParliamentHemicycle: React.FC<ParliamentHemicycleProps> = ({
  title,
  seatsByParty,
  parties,
  totalSeats,
  subtitle = 'Palacio Legislativo • Sala de Sesiones',
  daisLabel,
}) => {
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const orderedParties = [...parties].sort((a, b) => a.ideology.economic - b.ideology.economic);
  const seatNodes: Array<{ partyId: string; color: string }> = [];
  orderedParties.forEach((p) => {
    const count = seatsByParty[p.id] ?? 0;
    for (let i = 0; i < count; i++) seatNodes.push({ partyId: p.id, color: p.color });
  });

  const rows = totalSeats <= 32 ? 3 : 5;
  const points: Array<{ x: number; y: number; color: string; partyId: string }> = [];
  const cx = 180;
  const cy = 155;
  const minR = 54;
  const maxR = 132;

  let assigned = 0;
  for (let r = 0; r < rows; r++) {
    const radius = minR + ((maxR - minR) * r) / Math.max(1, rows - 1);
    const remainingRows = rows - r;
    const remainingSeats = seatNodes.length - assigned;
    const rowSeats =
      r === rows - 1 ? remainingSeats : Math.round((remainingSeats / remainingRows) * (0.72 + r * 0.12));
    const count = Math.max(1, Math.min(remainingSeats, rowSeats));
    for (let i = 0; i < count; i++) {
      const angle = Math.PI - (count === 1 ? Math.PI / 2 : (i / (count - 1)) * Math.PI);
      const x = cx + Math.cos(angle) * radius;
      const y = cy - Math.sin(angle) * radius;
      const node = seatNodes[assigned];
      points.push({ x, y, color: node?.color ?? '#313637', partyId: node?.partyId ?? '' });
      assigned++;
    }
  }

  const selectedParty = selectedPartyId ? parties.find((p) => p.id === selectedPartyId) : null;
  const selectedSeats = selectedPartyId ? seatsByParty[selectedPartyId] ?? 0 : 0;
  const majorityNeeded = Math.floor(totalSeats / 2) + 1;

  return (
    <div className="warroom-card relative flex flex-col overflow-hidden rounded-xl p-4 shadow-md">
      {/* Sello de agua institucional */}
      <div className="pointer-events-none absolute -bottom-6 -right-6 flex h-32 w-32 items-center justify-center rounded-full bg-[#E87532]/[0.04] opacity-70">
        <Landmark className="h-20 w-20 text-[#E87532]/20" />
      </div>

      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="font-mono-data text-[10px] uppercase tracking-wider text-[#FFB691]">
            {subtitle}
          </span>
          <h4 className="font-display text-lg font-medium text-[#DFE3E4]">{title}</h4>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#313637] px-2.5 py-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#E87532]" />
          <span className="font-mono-data text-[10px] text-[#DEC1B4]">
            Quórum: {totalSeats}/{totalSeats}
          </span>
        </div>
      </div>

      <div className="relative flex w-full flex-col items-center justify-center pt-1">
        <svg viewBox="0 0 360 172" className="w-full max-w-[320px] drop-shadow-md" role="img" aria-label={title}>
          <path
            d="M 42 155 A 138 138 0 0 1 318 155"
            fill="none"
            stroke="#262B2C"
            strokeWidth="1.8"
            strokeDasharray="3,3"
          />
          {points.map((pt, i) => {
            const dimmed = selectedPartyId !== null && pt.partyId !== selectedPartyId;
            return (
              <circle
                key={i}
                cx={pt.x}
                cy={pt.y}
                r={totalSeats > 50 ? 4.3 : 6.3}
                fill={pt.color}
                fillOpacity={dimmed ? 0.2 : 1}
                stroke={selectedPartyId === pt.partyId ? '#FFB691' : '#171C1D'}
                strokeWidth={selectedPartyId === pt.partyId ? 1.8 : 1.1}
                onClick={() =>
                  pt.partyId && setSelectedPartyId((prev) => (prev === pt.partyId ? null : pt.partyId))
                }
                className="cursor-pointer transition-opacity"
              />
            );
          })}
          {/* Nodo central del estrado / Presidencia */}
          <circle cx={cx} cy={154} r={6.5} fill="#FFB691" stroke="#511E00" strokeWidth={2} />
          <text x={cx} y={134} textAnchor="middle" fontSize="10.5" fill="#E9E2D4" className="font-mono-data font-semibold">
            {selectedParty
              ? `${selectedParty.acronym}: ${selectedSeats}/${totalSeats} (${Math.round((selectedSeats / totalSeats) * 100)}%)`
              : `Mayoría: ${majorityNeeded}`}
          </text>
        </svg>

        {daisLabel && (
          <div className="mt-1.5 flex items-center gap-2 rounded-full bg-[#262B2C] px-3 py-1 shadow-inner">
            <span className="flex h-2.5 w-2.5 items-center justify-center rounded-full bg-[#FFB691]">
              <span className="h-1 w-1 rounded-full bg-[#552000]" />
            </span>
            <span className="font-mono-data text-[10px] text-[#E9E2D4]">{daisLabel}</span>
          </div>
        )}
      </div>

      {/* Leyenda en grilla War Room */}
      <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-lg bg-[#171C1D] p-2.5 text-xs">
        {orderedParties
          .filter((p) => (seatsByParty[p.id] ?? 0) > 0)
          .map((p) => {
            const active = selectedPartyId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPartyId((prev) => (prev === p.id ? null : p.id))}
                className={`flex items-center gap-1.5 rounded px-2 py-1 text-left transition ${
                  active ? 'bg-[#313637] ring-1 ring-[#FFB691]' : 'hover:bg-[#262B2C]'
                }`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-mono-data text-[10px] text-[#DEC1B4]">{p.acronym}</span>
                  <span className="font-mono-data text-xs font-bold text-[#DFE3E4]">
                    {seatsByParty[p.id]} {seatsByParty[p.id] === 1 ? 'banca' : 'bancas'}
                  </span>
                </div>
              </button>
            );
          })}
        <div className="flex items-center gap-1.5 rounded px-2 py-1">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#E87532]" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-mono-data text-[10px] text-[#DEC1B4]">Mayoría</span>
            <span className="font-mono-data text-xs font-bold text-[#FFB691]">{majorityNeeded} votos</span>
          </div>
        </div>
      </div>
    </div>
  );
};
