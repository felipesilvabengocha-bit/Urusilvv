import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Compass,
  Flag,
  Gavel,
  GitMerge,
  Handshake,
  Landmark,
  Lock,
  Newspaper,
  Shield,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { MONTH_NAMES, SCENARIOS } from '../../data/uruguayData';
import { VISUAL_ASSETS } from '../../data/visualAssets';
import {
  executePartyMerger,
  getPartyCompatibilityScore,
  negotiateElectoralAlliance,
} from '../../engine/allianceMergerEngine';
import { getPlayerCapabilities } from '../../engine/capabilitiesEngine';
import { resolveGameEvent } from '../../engine/eventsAndAiEngine';
import { getActiveChambers } from '../../engine/parliamentEngine';
import { buildDynamicNewsHeadlines } from '../../engine/progressionEngine';
import { EmblemId, GameEvent, GameEventOption, GameState } from '../../types/game';
import { MacroTrendChart } from '../Charts';

interface SummaryViewProps {
  gameState: GameState;
  onUpdateState?: (next: GameState) => void;
  onNavigateTab?: (tab: 'acontecimientos' | 'parlamento' | 'gobierno' | 'gabinete' | 'campana') => void;
}

export const NationalSummaryView: React.FC<SummaryViewProps> = ({
  gameState,
  onUpdateState,
  onNavigateTab,
}) => {
  const [dispatchTab, setDispatchTab] = useState<'agenda' | 'gabinete' | 'prensa'>('agenda');
  const [selectedOptId, setSelectedOptId] = useState<string | null>(null);
  const [deskFeedback, setDeskFeedback] = useState<string | null>(null);
  const [deskImgErr, setDeskImgErr] = useState(false);

  const scenario = SCENARIOS.find((s) => s.id === gameState.scenarioId)!;
  const ind = gameState.politicalIndicators;
  const m = gameState.macro;
  const poll = gameState.latestPoll;
  const playerParty = gameState.parties.find((p) => p.id === gameState.player.partyId)!;
  const caps = getPlayerCapabilities(gameState);
  const news = buildDynamicNewsHeadlines(gameState);
  const chambers = getActiveChambers(gameState);

  const senGovSeats = gameState.coalitionPartyIds.reduce((s, id) => s + (chambers.senateByParty[id] ?? 0), 0);
  const depGovSeats = gameState.coalitionPartyIds.reduce((s, id) => s + (chambers.deputiesByParty[id] ?? 0), 0);

  const activeCrisis: GameEvent | undefined = gameState.events.find((e) => !e.resolved);
  const selectedCrisisOpt: GameEventOption | undefined = activeCrisis?.options.find((o) => o.id === selectedOptId);
  const pendingBills = gameState.bills.filter((b) => b.status === 'en_negociacion').slice(0, 3);

  const handleConfirmExecutiveDecree = () => {
    if (!activeCrisis || !selectedCrisisOpt || !onUpdateState) return;
    if (!caps.canResolveNationalEventsAsExecutive) {
      setDeskFeedback(caps.lockReasons.nationalEvents);
      return;
    }
    if (gameState.player.campaignFundsUYU < selectedCrisisOpt.moneyCostUYU) {
      setDeskFeedback('Fondos insuficientes para ejecutar esta medida.');
      return;
    }
    if (gameState.player.politicalCapital < selectedCrisisOpt.politicalCapitalCost) {
      setDeskFeedback('Capital político insuficiente para firmar este decreto.');
      return;
    }

    const res = resolveGameEvent(gameState, activeCrisis, selectedCrisisOpt);
    setDeskFeedback(res.outcomeText);
    setSelectedOptId(null);
    onUpdateState(res.nextState);
  };

  return (
    <div className="space-y-5 animate-editorial-in">
      {/* 1. Tarjeta de Identidad del Despacho (Stitch Hero Identity Card) */}
      <section className="warroom-card rounded-xl p-4 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-mono-data text-sm font-extrabold text-white shadow-inner"
              style={{ backgroundColor: playerParty.color }}
            >
              {playerParty.acronym}
            </div>
            <div className="min-w-0">
              <span className="font-mono-data text-[10px] uppercase tracking-wider text-[#DEC1B4]">
                {playerParty.name} • Ciclo #{gameState.cycleNumber}
              </span>
              <h2 className="truncate font-display text-xl font-semibold leading-tight text-[#DFE3E4]">
                {gameState.player.name}
              </h2>
              <span className="font-mono-data text-xs font-medium text-[#FFB691]">
                {caps.roleSummaryLabel}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-[#ACCEBF]/35 bg-[#0A0F10] px-3 py-1.5 font-mono-data text-[11px] text-[#ACCEBF]">
            Presidencia: <strong className="text-[#DFE3E4]">{gameState.nationalPresidentName}</strong>
          </div>
        </div>
      </section>

      {/* 2. Grilla Crítica de Telemetría (2x2 Stitch + 4 KPIs complementarios) */}
      <section className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <div className="warroom-card flex flex-col gap-1.5 rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <span className="font-mono-data text-[10px] uppercase tracking-wider text-[#DEC1B4]">
              Capital Político
            </span>
            <Activity className="h-3.5 w-3.5 text-[#E87532]" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-display text-2xl font-semibold text-[#DFE3E4]">
              {gameState.player.politicalCapital}
            </span>
            <span className="font-mono-data text-[10px] text-[#DEC1B4]">/ 100</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#0A0F10]">
            <div
              className="h-full rounded-full bg-[#E87532]"
              style={{ width: `${Math.min(100, gameState.player.politicalCapital)}%` }}
            />
          </div>
        </div>

        <div className="warroom-card flex flex-col gap-1.5 rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <span className="font-mono-data text-[10px] uppercase tracking-wider text-[#DEC1B4]">
              Estabilidad Coalición
            </span>
            <Shield className="h-3.5 w-3.5 text-[#ACCEBF]" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-display text-2xl font-semibold text-[#DFE3E4]">
              {Math.round(ind.coalitionStability)}
            </span>
            <span className="font-mono-data text-[10px] text-[#DEC1B4]">/ 100</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#0A0F10]">
            <div
              className="h-full rounded-full bg-[#ACCEBF]"
              style={{ width: `${Math.min(100, ind.coalitionStability)}%` }}
            />
          </div>
        </div>

        <div className="warroom-card flex flex-col gap-1 rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <span className="font-mono-data text-[10px] uppercase tracking-wider text-[#DEC1B4]">
              Hemiciclo Oficialista
            </span>
            <Landmark className="h-3.5 w-3.5 text-[#E9E2D4]" />
          </div>
          <span className="font-display text-lg font-semibold text-[#DFE3E4]">
            {senGovSeats}/30 S · {depGovSeats}/99 D
          </span>
          <span className="font-mono-data text-[10px] font-medium text-[#ACCEBF]">
            Apoyo parl.: {ind.parliamentarySupportPct}%
          </span>
        </div>

        <div className="warroom-card flex flex-col gap-1 rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <span className="font-mono-data text-[10px] uppercase tracking-wider text-[#DEC1B4]">
              Déficit Fiscal
            </span>
            <TrendingDown className="h-3.5 w-3.5 text-[#FFB4AB]" />
          </div>
          <span className="font-display text-lg font-semibold text-[#DFE3E4]">
            {m.fiscalDeficitPctGdp.toFixed(1)}% PIB
          </span>
          <span className="font-mono-data text-[10px] font-medium text-[#FFB691]">
            Inflación: {m.inflationPct.toFixed(1)}% · Riesgo {m.countryRiskBps} pb
          </span>
        </div>
      </section>

      {/* Tira secundaria con los 4 indicadores complementarios */}
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'Popularidad personal', val: `${gameState.player.attributes.popularity.toFixed(1)}%` },
          { label: 'Aprobación gobierno', val: `${ind.governmentApproval.toFixed(1)}%` },
          { label: 'Intención de tu lema', val: `${playerParty.currentPollShare.toFixed(1)}%` },
          { label: 'Conf. empresarial / sind.', val: `${Math.round(ind.businessConfidence)} / ${Math.round(ind.unionConfidence)}` },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-[#574239]/35 bg-[#171C1D] px-3 py-2">
            <div className="font-mono-data text-[10px] text-[#CDC6B8]">{k.label}</div>
            <div className="mt-0.5 font-mono-data text-sm font-bold text-[#DFE3E4]">{k.val}</div>
          </div>
        ))}
      </section>

      {/* 3. Bodegón Visual: El Escritorio Presidencial + Crisis / Orden del Día */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Columna izquierda: Escritorio Presidencial + Dossier en Pergamino Crema */}
        <div className="space-y-4 lg:col-span-7">
          <section className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-[#574239]/45 bg-[#171C1D] shadow-lg">
            {!deskImgErr ? (
              <img
                src={VISUAL_ASSETS.presidentialDesk}
                alt="Escritorio presidencial en Montevideo"
                referrerPolicy="no-referrer"
                onError={() => setDeskImgErr(true)}
                className="h-full w-full object-cover object-center opacity-85"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#171C1D] font-display text-sm text-[#CDC6B8]">
                Torre Ejecutiva · Despacho de la República
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0F1415] via-[#0F1415]/45 to-transparent" />
            <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-[#0A0F10]/85 px-2.5 py-1 backdrop-blur-md">
              <span
                className={`h-2 w-2 rounded-full ${
                  activeCrisis ? 'animate-ping bg-[#FFB4AB]' : 'bg-[#ACCEBF]'
                }`}
              />
              <span className="font-mono-data text-[10px] font-semibold uppercase tracking-wider text-[#DFE3E4]">
                {activeCrisis ? 'Crisis Activa' : 'Despacho en Sesión'}
              </span>
            </div>
            <div className="absolute bottom-3 left-3 right-3">
              <p className="font-display text-sm italic text-[#E9E2D4]">
                «{scenario.title} — {caps.currentOfficeTitle}»
              </p>
            </div>
          </section>

          {/* Tarjeta Dossier en Pergamino Crema (#e9e2d4) */}
          {activeCrisis ? (
            <section className="parchment-dossier relative overflow-hidden rounded-xl p-4 sm:p-5">
              <div className="mb-2.5 flex items-center justify-between border-b border-[#1E1B13]/15 pb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-[#93000A]" />
                  <span className="font-mono-data text-[10px] font-bold uppercase tracking-widest text-[#1E1B13]">
                    Expediente N° {activeCrisis.id.slice(-4).toUpperCase()} • {activeCrisis.domain}
                  </span>
                </div>
                <span className="-rotate-12 border-2 border-[#93000A] px-2 py-0.5 font-mono-data text-[10px] font-extrabold uppercase tracking-widest text-[#93000A]">
                  URGENTE
                </span>
              </div>

              <h3 className="font-display text-2xl font-semibold leading-tight text-[#1E1B13]">
                {activeCrisis.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#4B463C]">{activeCrisis.description}</p>
              <p className="mt-1 text-xs italic text-[#4B463C]/85">{activeCrisis.context}</p>

              {deskFeedback && (
                <div className="mt-3 rounded-lg border border-[#557568]/45 bg-[#FAF6EE] p-2.5 text-xs font-medium text-[#1E1B13]">
                  {deskFeedback}
                </div>
              )}

              {caps.canResolveNationalEventsAsExecutive ? (
                <>
                  <div className="mt-4 flex flex-col gap-2">
                    {activeCrisis.options.map((opt) => {
                      const isSel = selectedOptId === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => setSelectedOptId(opt.id)}
                          className={`group flex flex-col gap-1 rounded-lg border p-3 text-left transition ${
                            isSel
                              ? 'border-[#E87532] bg-[#E87532] text-[#511E00]'
                              : 'border-[#1E1B13]/20 bg-[#FAF6EE] text-[#1E1B13] hover:bg-[#E87532]/20'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold">{opt.label}</span>
                            <span
                              className={`shrink-0 rounded px-2 py-0.5 font-mono-data text-[10px] font-bold ${
                                isSel ? 'bg-[#511E00] text-[#FFDBCB]' : 'bg-[#1E1B13]/10 text-[#1E1B13]'
                              }`}
                            >
                              -{opt.politicalCapitalCost} CP {opt.moneyCostUYU > 0 ? `· -$${(opt.moneyCostUYU / 1000).toFixed(0)}k` : ''}
                            </span>
                          </div>
                          <span className={`text-xs ${isSel ? 'text-[#511E00]/90' : 'text-[#4B463C]'}`}>
                            {opt.expectedImpactSummary} (Éxito: {opt.successProbability}%)
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedCrisisOpt && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#0A0F10] p-3 text-[#FFB691]">
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <Gavel className="h-4 w-4 shrink-0" />
                        <span>{selectedCrisisOpt.label} [-{selectedCrisisOpt.politicalCapitalCost} CP]</span>
                      </div>
                      <button
                        onClick={handleConfirmExecutiveDecree}
                        className="rounded bg-[#E87532] px-3 py-1.5 font-mono-data text-[11px] font-bold uppercase tracking-wider text-[#511E00] transition hover:brightness-110"
                      >
                        Ejecutar Decreto
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#9E4200]/30 bg-[#FAF6EE] p-3 text-xs text-[#1E1B13]">
                  <span className="flex items-center gap-2">
                    <Lock className="h-4 w-4 shrink-0 text-[#9E4200]" />
                    <span>Como {caps.currentOfficeTitle}, podés fijar postura en Acontecimientos.</span>
                  </span>
                  {onNavigateTab && (
                    <button
                      onClick={() => onNavigateTab('acontecimientos')}
                      className="rounded bg-[#E87532] px-3 py-1.5 font-mono-data text-[10px] font-bold uppercase text-white"
                    >
                      Ir a Crisis
                    </button>
                  )}
                </div>
              )}
            </section>
          ) : (
            <section className="parchment-dossier relative overflow-hidden rounded-xl p-4 sm:p-5">
              <div className="mb-2.5 flex items-center justify-between border-b border-[#1E1B13]/15 pb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#3D584D]" />
                  <span className="font-mono-data text-[10px] font-bold uppercase tracking-widest text-[#1E1B13]">
                    Sin Crisis Urgentes • {MONTH_NAMES[gameState.currentMonth - 1]} {gameState.currentYear}
                  </span>
                </div>
                <span className="-rotate-6 border border-[#3D584D] px-2 py-0.5 font-mono-data text-[9px] font-extrabold uppercase tracking-widest text-[#3D584D]">
                  ESTABLE
                </span>
              </div>
              <h3 className="font-display text-xl font-semibold text-[#1E1B13]">
                {gameState.progression.activeObjectives[0]?.title ?? 'Consolidación Institucional y Agenda'}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[#4B463C]">
                {gameState.progression.activeObjectives[0]?.description ??
                  gameState.lastMacroReasons[0]?.causes[0] ??
                  'Avanzá el calendario mensual o coordiná la agenda en Parlamento y Campaña.'}
              </p>
              {onNavigateTab && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => onNavigateTab(gameState.careerPhase === 'campana' ? 'campana' : 'parlamento')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E1B13] px-3 py-2 font-mono-data text-[11px] font-bold text-[#E9E2D4] transition hover:bg-[#E87532] hover:text-white"
                  >
                    {gameState.careerPhase === 'campana' ? 'Ir a Campaña' : 'Ir al Parlamento'}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Columna derecha: Despacho de Información (Agenda / Gabinete / Prensa) */}
        <div className="space-y-4 lg:col-span-5">
          <section className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="font-mono-data text-[11px] font-semibold uppercase tracking-wider text-[#DEC1B4]">
                Despacho de Información
              </span>
              <span className="font-mono-data text-[10px] text-[#FFB691]">
                {MONTH_NAMES[gameState.currentMonth - 1]} {gameState.currentYear}
              </span>
            </div>

            {/* 3 Tabs Switch */}
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-[#0A0F10] p-1">
              {[
                { id: 'agenda', label: 'Agenda' },
                { id: 'gabinete', label: caps.currentOffice === 'intendente' ? 'Equipo Dept.' : 'Gabinete' },
                { id: 'prensa', label: 'Prensa' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setDispatchTab(t.id as typeof dispatchTab)}
                  className={`rounded py-1.5 font-mono-data text-[11px] font-semibold transition ${
                    dispatchTab === t.id
                      ? 'bg-[#1B2021] text-[#DFE3E4] shadow-xs'
                      : 'text-[#DEC1B4] hover:text-[#DFE3E4]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab 1: Agenda (Objetivos + Proyectos en trámite) */}
            {dispatchTab === 'agenda' && (
              <div className="space-y-2">
                {gameState.progression.activeObjectives.map((obj) => (
                  <div
                    key={obj.id}
                    className="warroom-card flex items-center justify-between gap-2 rounded-lg p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 font-mono-data text-[10px] font-bold text-[#FFB691]">
                        <Target className="h-3 w-3 shrink-0" />
                        <span className="uppercase">{obj.category}</span>
                        <span>+{obj.capitalReward} CP</span>
                      </div>
                      <div className="mt-0.5 truncate text-xs font-semibold text-[#DFE3E4]">{obj.title}</div>
                      <div className="font-mono-data text-[11px] text-[#DEC1B4]">
                        Actual: <strong className="text-[#ACCEBF]">{obj.currentValue}</strong> · Meta: {obj.targetValue} {obj.unitLabel}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#DEC1B4]" />
                  </div>
                ))}

                {pendingBills.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => onNavigateTab?.('parlamento')}
                    className="warroom-card flex w-full items-center justify-between gap-2 rounded-lg p-3 text-left transition hover:border-[#E87532]/50"
                  >
                    <div className="min-w-0">
                      <span className="font-mono-data text-[10px] font-semibold uppercase text-[#ACCEBF]">
                        En trámite · {b.chamber}
                      </span>
                      <div className="truncate text-xs font-semibold text-[#DFE3E4]">{b.title}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#DEC1B4]" />
                  </button>
                ))}
              </div>
            )}

            {/* Tab 2: Gabinete real (o Equipo Departamental) */}
            {dispatchTab === 'gabinete' && (
              <div className="space-y-2">
                {caps.currentOffice === 'intendente'
                  ? gameState.departamentalTeam.slice(0, 5).map((dir) => (
                      <div
                        key={dir.id}
                        className="warroom-card flex items-center justify-between gap-2 rounded-lg p-3"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#262B2C] font-mono-data text-[10px] font-bold text-[#FFB691]">
                            {dir.areaCode}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-[#DFE3E4]">
                              {dir.areaName}: {dir.holderName}
                            </div>
                            <div className="font-mono-data text-[11px] text-[#ACCEBF]">
                              Lealtad: {dir.loyalty}% • Gestión: {dir.management}
                            </div>
                          </div>
                        </div>
                        <span className="shrink-0 rounded bg-[#313637] px-2 py-0.5 font-mono-data text-[10px] text-[#DEC1B4]">
                          {dir.loyalty >= 65 ? 'Firme' : 'Alerta'}
                        </span>
                      </div>
                    ))
                  : gameState.cabinet.slice(0, 5).map((min) => {
                      const isLow = min.loyalty < 65;
                      return (
                        <div
                          key={min.id}
                          className="warroom-card flex items-center justify-between gap-2 rounded-lg p-3"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#262B2C] font-mono-data text-[10px] font-bold ${
                                isLow ? 'text-[#FFB4AB]' : 'text-[#FFB691]'
                              }`}
                            >
                              {min.ministryCode}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-xs font-semibold text-[#DFE3E4]">
                                {min.ministryCode}: {min.holderName}
                              </div>
                              <div
                                className={`font-mono-data text-[11px] ${
                                  isLow ? 'text-[#FFB4AB]' : 'text-[#ACCEBF]'
                                }`}
                              >
                                Lealtad: {min.loyalty}% • Gestión: {min.management}
                              </div>
                            </div>
                          </div>
                          <span
                            className={`shrink-0 rounded px-2 py-0.5 font-mono-data text-[10px] ${
                              isLow ? 'bg-[#93000A]/40 text-[#FFB4AB]' : 'bg-[#313637] text-[#DEC1B4]'
                            }`}
                          >
                            {isLow ? 'Tenso' : 'Firme'}
                          </span>
                        </div>
                      );
                    })}
              </div>
            )}

            {/* Tab 3: Prensa Nacional Real */}
            {dispatchTab === 'prensa' && (
              <div className="space-y-2">
                {news.map((item, idx) => (
                  <div key={item.id} className="warroom-card flex flex-col gap-1 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`font-mono-data text-[10px] font-bold uppercase ${
                          item.tone === 'positive'
                            ? 'text-[#ACCEBF]'
                            : item.tone === 'warning'
                            ? 'text-[#FFB4AB]'
                            : 'text-[#FFB691]'
                        }`}
                      >
                        {item.section}
                      </span>
                      <span className="font-mono-data text-[10px] text-[#DEC1B4]">
                        {idx === 0 ? 'PORTADA' : `${MONTH_NAMES[gameState.currentMonth - 1]}`}
                      </span>
                    </div>
                    <div className="font-display text-sm font-semibold italic leading-snug text-[#DFE3E4]">
                      «{item.headline}»
                    </div>
                    <p className="text-xs text-[#CDC6B8]">{item.deck}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* 4. Encuesta Mensual + Registro Causal de Cambios */}
      <div className="grid gap-4 lg:grid-cols-12">
        <section className="warroom-card rounded-xl p-4 sm:p-5 lg:col-span-6">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-display text-base font-semibold text-[#DFE3E4]">
              <BarChart3 className="h-4 w-4 text-[#E87532]" />
              Encuesta de intención de voto ({poll.firmName})
            </h3>
            <span className="font-mono-data text-[11px] text-[#DEC1B4]">
              n={poll.sampleSize} · ±{poll.marginOfErrorPct}%
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[#CDC6B8]">
            Muestra probabilística ({poll.dateLabel}) · Indecisos: {poll.undecidedPct}%
          </p>

          <div className="mt-4 space-y-2.5">
            {poll.shares.slice(0, 6).map((row) => (
              <div key={row.partyId} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#DFE3E4]">{row.partyName}</span>
                  <span className="font-mono-data font-bold text-[#FFB691]">{row.pct.toFixed(1)}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#0A0F10]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, row.pct * 1.7)}%`, backgroundColor: row.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="warroom-card rounded-xl p-4 sm:p-5 lg:col-span-6">
          <h3 className="flex items-center gap-2 font-display text-base font-semibold text-[#DFE3E4]">
            <Newspaper className="h-4 w-4 text-[#ACCEBF]" />
            Registro causal de cambios mensuales
          </h3>
          <p className="mt-1 text-[11px] text-[#CDC6B8]">
            Evolución directa de cada indicador en el último mes simulado.
          </p>

          <div className="mt-3 space-y-2.5">
            {gameState.lastMacroReasons.map((r, idx) => (
              <div key={idx} className="rounded-lg border border-[#574239]/35 bg-[#171C1D] p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#DFE3E4]">{r.indicator}</span>
                  <span
                    className={`inline-flex items-center gap-1 font-mono-data font-bold ${
                      r.direction === 'up'
                        ? 'text-[#ACCEBF]'
                        : r.direction === 'down'
                        ? 'text-[#FFB691]'
                        : 'text-[#CDC6B8]'
                    }`}
                  >
                    {r.direction === 'up' && <TrendingUp className="h-3.5 w-3.5" />}
                    {r.direction === 'down' && <TrendingDown className="h-3.5 w-3.5" />}
                    {r.deltaLabel}
                  </span>
                </div>
                <ul className="mt-1.5 space-y-0.5 text-[11px] text-[#CDC6B8]">
                  {r.causes.map((c, i) => (
                    <li key={i}>• {c}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 5. Gráfico histórico mensual */}
      <MacroTrendChart history={gameState.macroHistory} />
    </div>
  );
};

interface PartyViewProps {
  gameState: GameState;
  onNegotiateWithParty: (partyId: string) => void;
  onRequestSupport?: (partyId: string) => void;
  onRequestElectoralSupport?: (partyId: string) => void;
  onUpdateState: (next: GameState) => void;
}

export const PartySpaceView: React.FC<PartyViewProps> = ({
  gameState,
  onNegotiateWithParty,
  onRequestSupport,
  onRequestElectoralSupport,
  onUpdateState,
}) => {
  const [partyMsg, setPartyMsg] = useState<string | null>(null);
  const playerParty = gameState.parties.find((p) => p.id === gameState.player.partyId)!;
  const caps = getPlayerCapabilities(gameState);

  // Estado del constructor de Alianzas Electorales
  const [allianceName, setAllianceName] = useState('');
  const [alliancePartners, setAlliancePartners] = useState<string[]>([]);
  const [promisedMinistries, setPromisedMinistries] = useState<Record<string, number>>({});

  // Estado del constructor de Fusión Orgánica de Lemas
  const [mergerPartners, setMergerPartners] = useState<string[]>([]);
  const [mergerName, setMergerName] = useState('');
  const [mergerAcronym, setMergerAcronym] = useState('');
  const [mergerColor, setMergerColor] = useState(playerParty.color);
  const [mergerEmblem, setMergerEmblem] = useState<EmblemId>(playerParty.emblem);

  const toggleAlliancePartner = (partyId: string) => {
    setAlliancePartners((prev) =>
      prev.includes(partyId) ? prev.filter((id) => id !== partyId) : [...prev, partyId]
    );
  };

  const toggleMergerPartner = (partyId: string) => {
    setMergerPartners((prev) =>
      prev.includes(partyId) ? prev.filter((id) => id !== partyId) : [...prev, partyId]
    );
  };

  const handleNegotiateAlliance = (e: React.FormEvent) => {
    e.preventDefault();
    const res = negotiateElectoralAlliance(gameState, {
      name: allianceName,
      partnerPartyIds: alliancePartners,
      promisedMinistries,
      programPoints: ['Coordinación legislativa, electoral y programática'],
    });
    setPartyMsg(res.message);
    if (res.ok) {
      setAllianceName('');
      setAlliancePartners([]);
      setPromisedMinistries({});
      onUpdateState(res.nextState);
    }
  };

  const handleExecuteMerger = (e: React.FormEvent) => {
    e.preventDefault();
    const res = executePartyMerger(gameState, {
      partnerPartyIds: mergerPartners,
      newName: mergerName,
      newAcronym: mergerAcronym,
      newColor: mergerColor,
      newEmblem: mergerEmblem,
    });
    setPartyMsg(res.message);
    if (res.ok) {
      setMergerPartners([]);
      setMergerName('');
      setMergerAcronym('');
      onUpdateState(res.nextState);
    }
  };

  const handlePartyAction = (
    kind: 'organizar_sectores' | 'negociar_candidaturas' | 'estrategia_interior' | 'posicionamiento'
  ) => {
    const costCap = kind === 'negociar_candidaturas' ? 5 : 4;
    if (gameState.player.politicalCapital < costCap) {
      setPartyMsg(`Capital político insuficiente (${costCap} requeridos).`);
      return;
    }

    const nextParties = gameState.parties.map((p) => {
      if (p.id !== playerParty.id) return p;
      const nextSectors = p.sectors.map((s) => {
        if (kind === 'organizar_sectores' || kind === 'negociar_candidaturas') {
          if (s.id === gameState.player.sectorId) {
            return { ...s, internalWeight: Math.min(85, s.internalWeight + 3) };
          }
          return { ...s, internalWeight: Math.max(5, s.internalWeight - 1) };
        }
        return s;
      });
      return {
        ...p,
        sectors: nextSectors,
        partyStrength: Math.min(100, p.partyStrength + (kind === 'organizar_sectores' ? 4 : 2.5)),
        campaignMomentum: Number(
          Math.min(15, p.campaignMomentum + (kind === 'estrategia_interior' ? 1.8 : 1.1)).toFixed(2)
        ),
        programPriority:
          kind === 'posicionamiento'
            ? `${p.programPriority.split('·')[0].trim()} · Posición actualizada (${MONTH_NAMES[gameState.currentMonth - 1]})`
            : p.programPriority,
      };
    });

    const msgMap: Record<typeof kind, string> = {
      organizar_sectores: 'Plenario sectorial realizado: reorganizaste listas internas (+4 fortaleza partidaria, +3 peso de tu sector).',
      negociar_candidaturas: 'Acuerdo de candidaturas y sublemas cerrado entre sectores (+3 peso interno y unidad partidaria).',
      estrategia_interior: 'Estrategia electoral territorial aprobada para el interior (+1.8 impulso nacional).',
      posicionamiento: 'Declaración política oficial del lema fijando línea frente a la coyuntura nacional (+1.5 popularidad).',
    };
    const msg = msgMap[kind];
    setPartyMsg(msg);

    onUpdateState({
      ...gameState,
      parties: nextParties,
      politicalIndicators: {
        ...gameState.politicalIndicators,
        partyStrength: Math.min(100, gameState.politicalIndicators.partyStrength + 3),
      },
      player: {
        ...gameState.player,
        politicalCapital: gameState.player.politicalCapital - costCap,
        attributes: {
          ...gameState.player.attributes,
          popularity: Number(
            Math.min(98, gameState.player.attributes.popularity + (kind === 'posicionamiento' ? 1.5 : 0.8)).toFixed(1)
          ),
        },
      },
      history: [
        {
          id: `party_${Date.now()}`,
          dateLabel: `${MONTH_NAMES[gameState.currentMonth - 1]} ${gameState.currentYear}`,
          category: 'campana',
          title: `Orgánica partidaria (${playerParty.acronym})`,
          detail: msg,
        },
        ...gameState.history,
      ],
    });
  };

  return (
    <div className="space-y-5 animate-editorial-in">
      <section className="warroom-card rounded-xl p-5 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#574239]/40 pb-4">
          <div className="flex items-center gap-3">
            <span
              className="flex h-11 w-11 items-center justify-center rounded-lg font-mono-data text-sm font-extrabold text-white shadow-xs"
              style={{ backgroundColor: playerParty.color }}
            >
              {playerParty.acronym}
            </span>
            <div>
              <h2 className="font-display text-xl font-bold text-[#DFE3E4]">{playerParty.name}</h2>
              <p className="text-xs text-[#CDC6B8]">{playerParty.programPriority}</p>
            </div>
          </div>
          <div className="text-right font-mono-data text-xs">
            <div className="text-[#DEC1B4]">Fortaleza organizativa</div>
            <div className="text-base font-bold text-[#FFB691]">{Math.round(playerParty.partyStrength)} / 100</div>
          </div>
        </div>

        {/* Conducción Partidaria y Estrategia */}
        <div className="mt-4 rounded-xl border border-[#574239]/40 bg-[#171C1D] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#DFE3E4]">
              <Compass className="h-4 w-4 text-[#E87532]" />
              Gestión Partidaria, Estrategia y Candidaturas ({caps.roleSummaryLabel})
            </div>
            <span className="font-mono-data text-[11px] font-bold text-[#FFB691]">
              Cap. disponible: {gameState.player.politicalCapital} CP
            </span>
          </div>

          {partyMsg && (
            <div className="mt-2.5 rounded-lg border border-[#ACCEBF]/40 bg-[#7B9C8E]/15 p-2.5 text-xs text-[#E9E2D4]">
              {partyMsg}
            </div>
          )}

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <button
              onClick={() => handlePartyAction('organizar_sectores')}
              className="rounded-lg border border-[#574239]/45 bg-[#262B2C] p-3 text-left text-xs transition hover:border-[#E87532]"
            >
              <div className="font-bold text-[#DFE3E4]">Organizar sectores (-4 CP)</div>
              <p className="mt-1 text-[11px] text-[#CDC6B8]">Ordena agrupaciones y fortalece tu sector en la interna.</p>
            </button>
            <button
              onClick={() => handlePartyAction('negociar_candidaturas')}
              className="rounded-lg border border-[#574239]/45 bg-[#262B2C] p-3 text-left text-xs transition hover:border-[#E87532]"
            >
              <div className="font-bold text-[#DFE3E4]">Negociar candidaturas (-5 CP)</div>
              <p className="mt-1 text-[11px] text-[#CDC6B8]">Cierra listas comunes, sublemas y unidad departamental.</p>
            </button>
            <button
              onClick={() => handlePartyAction('estrategia_interior')}
              className="rounded-lg border border-[#574239]/45 bg-[#262B2C] p-3 text-left text-xs transition hover:border-[#E87532]"
            >
              <div className="font-bold text-[#DFE3E4]">Estrategia electoral (-4 CP)</div>
              <p className="mt-1 text-[11px] text-[#CDC6B8]">Coordina despliegue territorial y mensajes de campaña.</p>
            </button>
            <button
              onClick={() => handlePartyAction('posicionamiento')}
              className="rounded-lg border border-[#574239]/45 bg-[#262B2C] p-3 text-left text-xs transition hover:border-[#E87532]"
            >
              <div className="font-bold text-[#DFE3E4]">Posicionamiento político (-4 CP)</div>
              <p className="mt-1 text-[11px] text-[#CDC6B8]">Define postura partidaria pública ante la agenda nacional.</p>
            </button>
          </div>
        </div>

        <h3 className="mt-5 flex items-center gap-2 font-display text-base font-bold text-[#DFE3E4]">
          <Users className="h-4 w-4 text-[#E87532]" />
          Sectores y corrientes internas del lema
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {playerParty.sectors.map((sec) => {
            const isYours = sec.id === gameState.player.sectorId;
            return (
              <div
                key={sec.id}
                className={`rounded-lg border p-3.5 ${
                  isYours
                    ? 'border-[#E87532] bg-[#E87532]/15'
                    : 'border-[#574239]/40 bg-[#171C1D]'
                }`}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-[#DFE3E4]">{sec.name}</span>
                  <span className="font-mono-data text-xs font-bold text-[#FFB691]">{sec.internalWeight}%</span>
                </div>
                <div className="mt-1 text-xs font-medium text-[#ACCEBF]">
                  Referente: {isYours ? `${gameState.player.name} (Tu corriente)` : sec.leader}
                </div>
                <p className="mt-1 text-[11px] text-[#CDC6B8]">{sec.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="warroom-card rounded-xl p-5 shadow-md">
        <h3 className="flex items-center gap-2 font-display text-base font-bold text-[#DFE3E4]">
          <Flag className="h-4 w-4 text-[#E87532]" />
          Alianzas y relaciones con otros partidos y dirigentes
        </h3>
        <p className="mt-1 text-xs text-[#CDC6B8]">
          Afinidad, balotaje y apoyo parlamentario.
        </p>

        <div className="mt-4 space-y-2.5">
          {gameState.player.relations.map((rel) => {
            const party = gameState.parties.find((p) => p.id === rel.partyId);
            return (
              <div
                key={rel.partyId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#574239]/40 bg-[#171C1D] p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="h-3.5 w-3.5 rounded-sm" style={{ backgroundColor: party?.color ?? '#252A2B' }} />
                  <div>
                    <div className="text-sm font-bold text-[#DFE3E4]">
                      {rel.partyName} <span className="text-xs font-normal text-[#DEC1B4]">· {rel.leaderName}</span>
                    </div>
                    <div className="text-[11px] text-[#CDC6B8]">
                      Intención: {party?.currentPollShare.toFixed(1)}% · Afinidad:{' '}
                      <span className={`font-mono-data font-bold ${rel.affinity >= 0 ? 'text-[#ACCEBF]' : 'text-[#FFB4AB]'}`}>
                        {rel.affinity > 0 ? `+${rel.affinity}` : rel.affinity}
                      </span>
                      {party && (
                        <>
                          {' '}· Compatibilidad:{' '}
                          <span className="font-mono-data font-bold text-[#FFB691]">
                            {getPartyCompatibilityScore(playerParty, party, rel.affinity)}/100
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => onNegotiateWithParty(rel.partyId)}
                    className="min-h-[38px] rounded-lg border border-[#574239]/55 bg-[#262B2C] px-3 py-1.5 text-xs font-bold text-[#DFE3E4] transition hover:border-[#E87532] hover:text-[#FFB691]"
                  >
                    Mejorar relación (-4 CP)
                  </button>
                  {onRequestSupport && (
                    <button
                      onClick={() => onRequestSupport(rel.partyId)}
                      className="min-h-[38px] rounded-lg border border-[#557568]/55 bg-[#557568]/20 px-3 py-1.5 text-xs font-bold text-[#ACCEBF] transition hover:bg-[#557568]/35"
                    >
                      Pedir apoyo (-3 CP)
                    </button>
                  )}
                  {onRequestElectoralSupport && !(gameState.electoralSupporters ?? []).includes(rel.partyId) && (
                    <button
                      onClick={() => onRequestElectoralSupport(rel.partyId)}
                      className="min-h-[38px] rounded-lg border border-[#E87532]/55 bg-[#E87532]/15 px-3 py-1.5 text-xs font-bold text-[#FFB691] transition hover:bg-[#E87532]/30"
                    >
                      Pedir apoyo electoral (-4 CP)
                    </button>
                  )}
                  {(gameState.electoralSupporters ?? []).includes(rel.partyId) && (
                    <span className="min-h-[38px] inline-flex items-center rounded-lg border border-[#ACCEBF]/45 bg-[#557568]/20 px-3 py-1.5 text-xs font-bold text-[#ACCEBF]">
                      Te apoya
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Candidatos y referentes de otros lemas: mejorar relación y pedir apoyo por separado */}
      <section className="warroom-card rounded-xl p-5 shadow-md">
        <h3 className="flex items-center gap-2 font-display text-base font-bold text-[#DFE3E4]">
          <Users className="h-4 w-4 text-[#E87532]" />
          Candidatos y referentes de otros lemas
        </h3>
        <p className="mt-1 text-xs text-[#CDC6B8]">
          Relación o apoyo por candidato, sin alianza.
        </p>
        <div className="mt-4 space-y-2.5">
          {gameState.player.relations.map((rel) => {
            const party = gameState.parties.find((p) => p.id === rel.partyId);
            if (!party) return null;
            const leader = party.sectors[0]?.leader ?? party.acronym;
            return (
              <div
                key={`cand_${rel.partyId}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#574239]/40 bg-[#171C1D] p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="h-3.5 w-3.5 rounded-sm" style={{ backgroundColor: party.color }} />
                  <div>
                    <div className="text-sm font-bold text-[#DFE3E4]">
                      {leader} <span className="text-xs font-normal text-[#DEC1B4]">· {party.acronym}</span>
                    </div>
                    <div className="text-[11px] text-[#CDC6B8]">
                      Afinidad: {rel.affinity} · Intención: {party.currentPollShare.toFixed(1)}%
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => onNegotiateWithParty(rel.partyId)}
                    className="min-h-[34px] rounded-lg border border-[#574239]/55 bg-[#262B2C] px-3 py-1.5 text-xs font-bold text-[#DFE3E4] transition hover:border-[#E87532] hover:text-[#FFB691]"
                  >
                    Mejorar relación (-4 CP)
                  </button>
                  {onRequestSupport && (
                    <button
                      onClick={() => onRequestSupport(rel.partyId)}
                      className="min-h-[34px] rounded-lg border border-[#557568]/55 bg-[#557568]/20 px-3 py-1.5 text-xs font-bold text-[#ACCEBF] transition hover:bg-[#557568]/35"
                    >
                      Pedir apoyo (-3 CP)
                    </button>
                  )}
                  {onRequestElectoralSupport && !(gameState.electoralSupporters ?? []).includes(rel.partyId) && (
                    <button
                      onClick={() => onRequestElectoralSupport(rel.partyId)}
                      className="min-h-[34px] rounded-lg border border-[#E87532]/55 bg-[#E87532]/15 px-3 py-1.5 text-xs font-bold text-[#FFB691] transition hover:bg-[#E87532]/30"
                    >
                      Pedir apoyo electoral (-4 CP)
                    </button>
                  )}
                  {(gameState.electoralSupporters ?? []).includes(rel.partyId) && (
                    <span className="min-h-[34px] inline-flex items-center rounded-lg border border-[#ACCEBF]/45 bg-[#557568]/20 px-3 py-1.5 text-xs font-bold text-[#ACCEBF]">
                      Te apoya
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Constructor de Alianzas Electorales y Coaliciones */}
      <section className="warroom-card rounded-xl p-5 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 font-display text-base font-bold text-[#DFE3E4]">
              <Handshake className="h-4 w-4 text-[#E87532]" />
              Alianzas Electorales y Pactos de Coalición (-8 CP)
            </h3>
            <p className="mt-1 text-xs text-[#CDC6B8]">
              Acordá bloques electorales o de gobierno comprometiendo ministerios por partido socio.
            </p>
          </div>
          <span className="font-mono-data text-xs font-bold text-[#FFB691]">
            Activas: {gameState.electoralAlliances?.length ?? 0}
          </span>
        </div>

        <form onSubmit={handleNegotiateAlliance} className="mt-4 space-y-3">
          <input
            value={allianceName}
            onChange={(e) => setAllianceName(e.target.value)}
            placeholder={`Nombre de la alianza (ej. Acuerdo ${playerParty.acronym})`}
            className="w-full rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-3 py-2 text-xs text-[#DFE3E4] placeholder:text-[#CDC6B8]/45 focus:border-[#E87532] focus:outline-none"
          />

          <div className="grid gap-2 sm:grid-cols-2">
            {gameState.player.relations.map((rel) => {
              const party = gameState.parties.find((p) => p.id === rel.partyId);
              if (!party) return null;
              const isSelected = alliancePartners.includes(party.id);
              const compat = getPartyCompatibilityScore(playerParty, party, rel.affinity);
              const quota = promisedMinistries[party.id] ?? 0;

              return (
                <div
                  key={party.id}
                  className={`rounded-lg border p-3 transition ${
                    isSelected
                      ? 'border-[#E87532] bg-[#E87532]/15'
                      : 'border-[#574239]/40 bg-[#171C1D]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => toggleAlliancePartner(party.id)}
                      className="flex flex-1 items-center gap-2 text-left"
                    >
                      <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: party.color }} />
                      <span className="text-xs font-bold text-[#DFE3E4]">
                        {party.name} ({party.acronym})
                      </span>
                    </button>
                    <span
                      className={`font-mono-data text-[10px] font-bold ${
                        compat >= 46 ? 'text-[#ACCEBF]' : 'text-[#FFB4AB]'
                      }`}
                    >
                      Compat. {compat}
                    </span>
                  </div>

                  {isSelected && (
                    <div className="mt-2 flex items-center justify-between border-t border-[#574239]/35 pt-2 text-[11px] text-[#DEC1B4]">
                      <span>Ministerios prometidos:</span>
                      <div className="flex items-center gap-1.5 font-mono-data">
                        {[0, 1, 2, 3].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() =>
                              setPromisedMinistries((prev) => ({ ...prev, [party.id]: num }))
                            }
                            className={`h-6 w-6 rounded text-xs font-bold ${
                              quota === num
                                ? 'bg-[#E87532] text-[#511E00]'
                                : 'bg-[#262B2C] text-[#DFE3E4]'
                            }`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="submit"
            disabled={alliancePartners.length === 0}
            className="executive-action-btn min-h-[40px] w-full rounded-lg px-4 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-45"
          >
            Formalizar Alianza Electoral ({alliancePartners.length} socio/s · -8 CP)
          </button>
        </form>

        {(gameState.electoralAlliances?.length ?? 0) > 0 && (
          <div className="mt-4 space-y-2 border-t border-[#574239]/35 pt-3">
            <div className="font-mono-data text-[10px] font-bold uppercase tracking-wider text-[#ACCEBF]">
              Alianzas vigentes
            </div>
            {gameState.electoralAlliances!.map((al) => (
              <div
                key={al.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#ACCEBF]/35 bg-[#557568]/15 px-3 py-2 text-xs"
              >
                <div>
                  <span className="font-bold text-[#DFE3E4]">{al.name}</span>
                  <span className="ml-2 text-[#CDC6B8]">
                    Socios: {al.partnerPartyIds.map((id) => gameState.parties.find((p) => p.id === id)?.acronym ?? id).join(', ')}
                  </span>
                </div>
                <span className="font-mono-data text-[10px] text-[#FFB691]">{al.createdDateLabel}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Fusión Orgánica de Lemas */}
      <section className="warroom-card rounded-xl p-5 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 font-display text-base font-bold text-[#DFE3E4]">
              <GitMerge className="h-4 w-4 text-[#E87532]" />
              Fusión Orgánica de Lemas (-16 CP)
            </h3>
            <p className="mt-1 text-xs text-[#CDC6B8]">
              Unificá tu partido con otros lemas afines (compatibilidad ≥ 56; conlleva fuga sectorial del 6% al 16%).
            </p>
          </div>
          <span className="font-mono-data text-xs font-bold text-[#DEC1B4]">
            Fusiones: {gameState.partyMergers?.length ?? 0}
          </span>
        </div>

        <form onSubmit={handleExecuteMerger} className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {gameState.player.relations.map((rel) => {
              const party = gameState.parties.find((p) => p.id === rel.partyId);
              if (!party) return null;
              const compat = getPartyCompatibilityScore(playerParty, party, rel.affinity);
              const isSel = mergerPartners.includes(party.id);
              return (
                <button
                  key={party.id}
                  type="button"
                  onClick={() => toggleMergerPartner(party.id)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                    isSel
                      ? 'border-[#E87532] bg-[#E87532]/20 text-[#DFE3E4]'
                      : 'border-[#574239]/45 bg-[#171C1D] text-[#CDC6B8]'
                  }`}
                >
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: party.color }} />
                  <span className="font-bold">{party.acronym}</span>
                  <span className={`font-mono-data text-[10px] ${compat >= 56 ? 'text-[#ACCEBF]' : 'text-[#FFB4AB]'}`}>
                    ({compat}/100)
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-2.5 sm:grid-cols-4">
            <input
              value={mergerName}
              onChange={(e) => setMergerName(e.target.value)}
              placeholder="Nombre del nuevo lema"
              className="rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-3 py-2 text-xs text-[#DFE3E4] placeholder:text-[#CDC6B8]/45 focus:border-[#E87532] focus:outline-none sm:col-span-2"
            />
            <input
              value={mergerAcronym}
              onChange={(e) => setMergerAcronym(e.target.value.toUpperCase().slice(0, 5))}
              placeholder="Sigla (máx 5)"
              className="rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-3 py-2 font-mono-data text-xs text-[#DFE3E4] placeholder:text-[#CDC6B8]/45 focus:border-[#E87532] focus:outline-none"
            />
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={mergerColor}
                onChange={(e) => setMergerColor(e.target.value)}
                aria-label="Color del nuevo lema"
                className="h-9 w-11 cursor-pointer rounded border border-[#574239]/60 bg-[#0A0F10] p-0.5"
              />
              <select
                value={mergerEmblem}
                onChange={(e) => setMergerEmblem(e.target.value as EmblemId)}
                className="flex-1 rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-2 py-2 text-xs text-[#DFE3E4] focus:border-[#E87532] focus:outline-none"
              >
                <option value="sol">Sol</option>
                <option value="ceibo">Ceibo</option>
                <option value="bandera">Bandera</option>
                <option value="balanza">Balanza</option>
                <option value="espiga">Espiga</option>
                <option value="engranaje">Engranaje</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={mergerPartners.length === 0}
            className="min-h-[40px] w-full rounded-lg border border-[#E87532]/60 bg-[#262B2C] px-4 py-2 text-xs font-bold text-[#FFB691] transition hover:bg-[#E87532] hover:text-[#511E00] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Ejecutar Fusión Orgánica de Lemas (-16 CP)
          </button>
        </form>

        {(gameState.partyMergers?.length ?? 0) > 0 && (
          <div className="mt-4 space-y-1.5 border-t border-[#574239]/35 pt-3">
            {gameState.partyMergers!.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-xs text-[#CDC6B8]">
                <span>
                  <strong className="text-[#DFE3E4]">{m.newPartyName}</strong> ({m.newAcronym}) · Fuga: -{m.defectionPenaltyPct}%
                </span>
                <span className="font-mono-data text-[10px] text-[#DEC1B4]">{m.dateLabel}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="warroom-card rounded-xl p-4 text-xs">
        <div className="flex items-center gap-2 font-bold text-[#DFE3E4]">
          <Shield className="h-4 w-4 text-[#ACCEBF]" />
          Alcance actual de tu cargo
        </div>
        <p className="mt-1 text-[#CDC6B8]">
          Cargo en ejercicio: <strong className="text-[#ACCEBF]">{caps.currentOfficeTitle}</strong> · Postulación:{' '}
          <strong className="text-[#FFB691]">{caps.targetOfficeTitle}</strong>.
        </p>
      </section>
    </div>
  );
};
