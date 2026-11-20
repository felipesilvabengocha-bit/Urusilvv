import React, { useState } from 'react';
import { Briefcase, Building2, Compass, DollarSign, Landmark, MapPin, Navigation, TrendingUp } from 'lucide-react';
import { URUGUAY_MAP_SHAPES } from '../data/uruguayMapPaths';
import { DepartmentId, GameState } from '../types/game';

interface UruguayMapProps {
  gameState: GameState;
  onVisitDepartment?: (deptId: DepartmentId) => void;
}

type MapLayer = 'intendencia' | 'intencion_propia' | 'desempleo' | 'pobreza';

export const UruguayMap: React.FC<UruguayMapProps> = ({ gameState, onVisitDepartment }) => {
  const [layer, setLayer] = useState<MapLayer>('intendencia');
  const [selectedId, setSelectedId] = useState<DepartmentId>(gameState.player.targetDepartment);

  const selectedDept = gameState.departments.find((d) => d.id === selectedId) ?? gameState.departments[0];
  const intendenteParty = gameState.parties.find((p) => p.id === selectedDept.currentIntendentePartyId);
  const playerParty = gameState.parties.find((p) => p.id === gameState.player.partyId)!;
  const natBreakdown = gameState.nationalResult?.byDepartment.find((b) => b.departmentId === selectedId);
  const depBreakdown = gameState.departamentalResult?.departments.find((b) => b.departmentId === selectedId);

  const getFillColor = (deptId: DepartmentId): string => {
    const dept = gameState.departments.find((d) => d.id === deptId)!;
    if (layer === 'intendencia') {
      const p = gameState.parties.find((x) => x.id === dept.currentIntendentePartyId);
      return p?.color ?? '#4F5658';
    }
    if (layer === 'intencion_propia') {
      const mult = dept.partyMultipliers[gameState.player.partyId] ?? 1.0;
      if (mult >= 1.25) return '#E87532';
      if (mult >= 1.05) return '#7B9C8E';
      if (mult >= 0.88) return '#6E7678';
      return '#262B2C';
    }
    if (layer === 'desempleo') {
      if (dept.unemploymentRate >= 9.5) return '#93000A';
      if (dept.unemploymentRate >= 8.2) return '#E87532';
      return '#7B9C8E';
    }
    if (dept.povertyRate >= 12) return '#93000A';
    if (dept.povertyRate >= 9.5) return '#E87532';
    return '#7B9C8E';
  };

  // Proyección partidaria ordenada para este departamento
  const partyShares = gameState.parties
    .map((p) => {
      const pct = natBreakdown
        ? natBreakdown.partyPctOfValid[p.id] ?? 0
        : Number(
            (
              (p.currentPollShare * (selectedDept.partyMultipliers[p.id] ?? 1.0)) /
              Math.max(
                1,
                gameState.parties.reduce(
                  (s, x) => s + x.currentPollShare * (selectedDept.partyMultipliers[x.id] ?? 1.0),
                  0
                ) / 100
              )
            ).toFixed(1)
          );
      return { p, pct };
    })
    .sort((a, b) => b.pct - a.pct);

  const topTwoMargin = partyShares.length >= 2 ? partyShares[0].pct - partyShares[1].pct : 10;
  const territoryStatusLabel =
    topTwoMargin < 4
      ? 'EN DISPUTA'
      : partyShares[0]?.p.id === gameState.player.partyId
      ? `BASTIÓN ${playerParty.acronym}`
      : `CONTROL ${intendenteParty?.acronym ?? partyShares[0]?.p.acronym ?? 'LOCAL'}`;

  const layerModeLabel =
    layer === 'intendencia'
      ? 'INTENDENCIAS VIGENTES'
      : layer === 'intencion_propia'
      ? `FUERZA TERRITORIAL (${playerParty.acronym})`
      : layer === 'desempleo'
      ? 'DESEMPLEO & TENSIÓN LABORAL'
      : 'INCIDENCIA DE POBREZA';

  return (
    <div className="space-y-4 animate-editorial-in">
      {/* Cabecera y Pills Selector (Scroll horizontal en iPhone) */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="font-mono-data text-[10px] font-semibold uppercase tracking-[0.12em] text-[#FFB691]">
              Cartografía Política · República Oriental del Uruguay
            </div>
            <h2 className="font-display text-xl font-semibold text-[#DFE3E4] sm:text-2xl">
              Mapa Territorial — Los 19 Departamentos
            </h2>
          </div>
          <span className="font-mono-data text-[10px] uppercase tracking-widest text-[#DEC1B4]">
            {layerModeLabel}
          </span>
        </div>

        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'intendencia', label: 'Poder Departamental', icon: Landmark },
            { id: 'intencion_propia', label: `Tu fuerza (${playerParty.acronym})`, icon: TrendingUp },
            { id: 'desempleo', label: 'Desempleo', icon: Briefcase },
            { id: 'pobreza', label: 'Pobreza', icon: DollarSign },
          ].map((opt) => {
            const Icon = opt.icon;
            const active = layer === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setLayer(opt.id as MapLayer)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 font-mono-data text-[11px] font-semibold transition active:scale-95 ${
                  active
                    ? 'bg-[#E87532] text-[#511E00] shadow-md'
                    : 'bg-[#262B2C] text-[#DEC1B4] hover:text-[#DFE3E4]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grilla War Room + Hoja Táctica Departamental */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Lienzo Cartográfico War Room (#0a0f10) */}
        <section className="relative overflow-hidden rounded-xl border border-[#574239]/50 bg-[#0A0F10] p-3.5 shadow-xl lg:col-span-6">
          {/* Pill flotante departamento activo */}
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#262B2C]/90 px-3 py-1 backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-[#FFB691]" />
              <span className="font-mono-data text-[10px] font-semibold uppercase tracking-wider text-[#E9E2D4]">
                {selectedDept.name}
              </span>
            </div>
            <span className="font-mono-data text-[10px] uppercase tracking-widest text-[#DEC1B4]">
              {selectedDept.baselineDeputies} Dip. Base
            </span>
          </div>

          <svg
            viewBox="0 0 500 490"
            className="mx-auto max-h-[380px] w-full sm:max-h-[450px]"
            role="img"
            aria-label="Mapa interactivo de los 19 departamentos de Uruguay"
          >
            {URUGUAY_MAP_SHAPES.map((shape) => {
              const isSelected = shape.id === selectedId;
              const fill = getFillColor(shape.id);
              return (
                <g
                  key={shape.id}
                  onClick={() => setSelectedId(shape.id)}
                  className="cursor-pointer transition-opacity hover:opacity-95"
                >
                  <path
                    d={shape.path}
                    fill={fill}
                    fillOpacity={isSelected ? 1 : 0.84}
                    stroke={isSelected ? '#FFB691' : '#0A0F10'}
                    strokeWidth={isSelected ? 3.2 : 1.8}
                  />
                  <text
                    x={shape.labelX}
                    y={shape.labelY}
                    textAnchor="middle"
                    fontSize={shape.id === 'montevideo' ? '8.5' : '10.5'}
                    fontWeight="700"
                    fill="#FAF6EE"
                    stroke="#0A0F10"
                    strokeWidth="0.7"
                    className="pointer-events-none select-none font-mono-data"
                  >
                    {shape.shortLabel}
                  </text>
                </g>
              );
            })}

            {/* Anotaciones hidrográficas editoriales */}
            <text
              x="95"
              y="468"
              fill="#7B9C8E"
              fillOpacity="0.45"
              fontSize="11"
              letterSpacing="2.5"
              className="pointer-events-none select-none font-display italic"
            >
              RÍO DE LA PLATA
            </text>
            <text
              x="365"
              y="445"
              fill="#7B9C8E"
              fillOpacity="0.45"
              fontSize="10.5"
              letterSpacing="2"
              className="pointer-events-none select-none font-display italic"
            >
              OCÉANO ATLÁNTICO
            </text>
          </svg>

          {/* Leyenda inferior del mapa */}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#574239]/30 pt-2.5 text-[11px] text-[#CDC6B8]">
            {layer === 'intendencia' && (
              <div className="flex flex-wrap items-center gap-3">
                {gameState.parties
                  .filter((p) => gameState.departments.some((d) => d.currentIntendentePartyId === p.id))
                  .map((p) => (
                    <span key={p.id} className="flex items-center gap-1.5 font-mono-data text-[10px] text-[#DFE3E4]">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                      {p.acronym}
                    </span>
                  ))}
              </div>
            )}
            {layer === 'intencion_propia' && (
              <div className="flex flex-wrap items-center gap-3 font-mono-data text-[10px]">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#E87532]" /> Bastión ({'>'}1.25x)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#7B9C8E]" /> Favorable
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#262B2C] ring-1 ring-[#CDC6B8]/30" /> Adverso
                </span>
              </div>
            )}
            {(layer === 'desempleo' || layer === 'pobreza') && (
              <div className="flex flex-wrap items-center gap-3 font-mono-data text-[10px]">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#7B9C8E]" /> Bajo
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#E87532]" /> Medio
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#93000A]" /> Crítico
                </span>
              </div>
            )}
            <span className="flex items-center gap-1 font-mono-data text-[10px] text-[#FFB691]">
              <Compass className="h-3 w-3" /> ROU
            </span>
          </div>
        </section>

        {/* Hoja Táctica Departamental */}
        <section className="flex flex-col gap-3 rounded-xl border border-[#574239]/55 bg-[#171C1D] p-4 shadow-xl lg:col-span-6">
          {/* Cabecera Departamento */}
          <div className="flex items-start justify-between gap-2 border-b border-[#574239]/35 pb-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <MapPin className="h-4 w-4 text-[#E87532]" />
                <h3 className="font-display text-2xl font-bold uppercase tracking-tight text-[#DFE3E4]">
                  {selectedDept.name}
                </h3>
                <span
                  className="rounded px-2 py-0.5 font-mono-data text-[10px] font-bold uppercase text-white"
                  style={{ backgroundColor: intendenteParty?.color ?? '#313637' }}
                >
                  {intendenteParty?.acronym ?? 'IND'}
                </span>
              </div>
              <p className="mt-1 font-mono-data text-[11px] text-[#DEC1B4]">
                Cap. {selectedDept.capital} • {selectedDept.population2023.toLocaleString('es-UY')} hab. (INE 2023)
              </p>
            </div>

            <div className="flex flex-col items-end">
              <span className="font-mono-data text-[10px] text-[#DEC1B4]">Intendencia</span>
              <span className="text-right font-mono-data text-xs font-semibold text-[#E9E2D4]">
                {selectedDept.currentIntendenteName}
              </span>
              <span
                className={`mt-1 rounded px-2 py-0.5 font-mono-data text-[9px] font-bold uppercase ${
                  topTwoMargin < 4
                    ? 'bg-[#93000A] text-[#FFDAD6]'
                    : 'bg-[#313637] text-[#E9E2D4]'
                }`}
              >
                {territoryStatusLabel}
              </span>
            </div>
          </div>

          {/* Barra Apilada de Intención de Voto Real del Departamento */}
          <div className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="font-mono-data text-[10px] font-semibold uppercase tracking-wider text-[#DEC1B4]">
                {natBreakdown ? 'Último Escrutinio Nacional' : 'Fuerza Territorial por Lema'}
              </span>
              {depBreakdown && (
                <span className="font-mono-data text-[10px] font-semibold text-[#FFB691]">
                  Junta: {depBreakdown.winningLemaName} ({depBreakdown.juntaSeats[depBreakdown.winningLemaId]})
                </span>
              )}
            </div>

            <div className="flex h-3 w-full overflow-hidden rounded-full bg-[#0A0F10]">
              {partyShares.slice(0, 5).map(({ p, pct }) => (
                <div
                  key={p.id}
                  style={{ width: `${Math.max(2, pct)}%`, backgroundColor: p.color }}
                  className="h-full transition-all"
                  title={`${p.acronym}: ${pct.toFixed(1)}%`}
                />
              ))}
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {partyShares.slice(0, 6).map(({ p, pct }) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded bg-[#0A0F10]/60 px-2 py-1 font-mono-data text-[11px]"
                >
                  <span className="flex items-center gap-1.5 text-[#E9E2D4]">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                    {p.acronym}
                  </span>
                  <strong className="text-[#DFE3E4]">{pct.toFixed(1)}%</strong>
                </div>
              ))}
            </div>
          </div>

          {/* 4 KPIs Socioeconómicos en Tarjetas War Room */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-lg border border-[#574239]/35 bg-[#1B2021] p-3">
              <div className="flex items-center justify-between font-mono-data text-[10px] text-[#DEC1B4]">
                <span>DESEMPLEO</span>
                <span className="text-[#FFB691]">{selectedDept.unemploymentRate.toFixed(1)}%</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#0A0F10]">
                <div
                  className="h-full bg-[#E87532]"
                  style={{ width: `${Math.min(100, selectedDept.unemploymentRate * 6)}%` }}
                />
              </div>
            </div>

            <div className="rounded-lg border border-[#574239]/35 bg-[#1B2021] p-3">
              <div className="flex items-center justify-between font-mono-data text-[10px] text-[#DEC1B4]">
                <span>POBREZA</span>
                <span className="text-[#FFB4AB]">{selectedDept.povertyRate.toFixed(1)}%</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#0A0F10]">
                <div
                  className="h-full bg-[#93000A]"
                  style={{ width: `${Math.min(100, selectedDept.povertyRate * 4.5)}%` }}
                />
              </div>
            </div>

            <div className="rounded-lg border border-[#574239]/35 bg-[#1B2021] p-3">
              <span className="font-mono-data text-[10px] uppercase text-[#DEC1B4]">Índice Salarial</span>
              <div className="mt-0.5 font-mono-data text-base font-bold text-[#ACCEBF]">
                {selectedDept.wageIndex} <span className="text-[10px] font-normal text-[#CDC6B8]">(MVD=100)</span>
              </div>
            </div>

            <div className="rounded-lg border border-[#574239]/35 bg-[#1B2021] p-3">
              <span className="font-mono-data text-[10px] uppercase text-[#DEC1B4]">Presupuesto & Mun.</span>
              <div className="mt-0.5 font-mono-data text-sm font-bold text-[#DFE3E4]">
                ${selectedDept.annualBudgetMillionsUYU.toLocaleString('es-UY')}M · {selectedDept.municipalitiesCount} mun.
              </div>
            </div>
          </div>

          {/* Matriz Productiva y Municipios */}
          <div className="rounded-lg border border-[#574239]/35 bg-[#1B2021] p-3 text-xs">
            <div className="flex items-center gap-1.5 font-mono-data text-[10px] uppercase tracking-wider text-[#FFB691]">
              <Building2 className="h-3.5 w-3.5" />
              Matriz Productiva y Municipios
            </div>
            <p className="mt-1 font-medium text-[#E9E2D4]">{selectedDept.economicProfile.join(' · ')}</p>
            <p className="mt-1 text-[11px] text-[#CDC6B8]">
              Municipios clave: {selectedDept.sampleMunicipalities.join(', ')}
            </p>
          </div>

          {/* Acción Táctica Pulgar */}
          {onVisitDepartment && gameState.careerPhase === 'campana' && (
            <button
              onClick={() => onVisitDepartment(selectedDept.id)}
              className="game-border-amber flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#E87532] px-4 py-3 font-mono-data text-xs font-bold uppercase tracking-wide text-[#511E00] transition hover:brightness-110 active:scale-[0.98]"
            >
              <Navigation className="h-4 w-4" />
              Recorrer {selectedDept.name} en Campaña ($450 mil UYU)
            </button>
          )}
        </section>
      </div>
    </div>
  );
};
