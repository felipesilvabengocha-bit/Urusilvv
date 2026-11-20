import React, { useState } from 'react';
import { Award, BarChart2, CheckCircle2, Clock, Compass, Flame, Landmark, Newspaper, ScrollText, Target } from 'lucide-react';
import { ACHIEVEMENTS, OFFICES } from '../../data/uruguayData';
import { getPlayerCapabilities } from '../../engine/capabilitiesEngine';
import { AchievementCategory, GameState, NarrativeMoment } from '../../types/game';
import { NarrativeMomentModal } from '../NarrativeMomentModal';

interface CareerProgressionViewProps {
  gameState: GameState;
}

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  electoral: 'Logros Electorales',
  gobierno: 'Logros de Gobierno',
  parlamentario: 'Logros Parlamentarios',
  politico: 'Logros Políticos y Partidarios',
};

export const CareerProgressionView: React.FC<CareerProgressionViewProps> = ({ gameState }) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | AchievementCategory>('all');
  const [inspectMoment, setInspectMoment] = useState<NarrativeMoment | null>(null);

  const prog = gameState.progression;
  const caps = getPlayerCapabilities(gameState);
  const playerParty = gameState.parties.find((p) => p.id === gameState.player.partyId);
  const targetOfficeName =
    OFFICES.find((o) => o.id === gameState.player.targetOffice)?.name ?? gameState.player.targetOffice;

  const unlockedMap = new Map(prog.unlockedAchievements.map((u) => [u.id, u]));
  const filteredAchievements =
    selectedCategory === 'all'
      ? ACHIEVEMENTS
      : ACHIEVEMENTS.filter((a) => a.category === selectedCategory);

  return (
    <div className="space-y-5 animate-editorial-in">
      {/* Cabecera de Trayectoria Institucional (sin niveles ni XP) */}
      <section className="warroom-surface rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-mono-data text-[11px] font-semibold uppercase tracking-[0.12em] text-[#FFB691]">
              <Landmark className="h-4 w-4 text-[#E87532]" />
              <span>Trayectoria Institucional y Electoral</span>
            </div>
            <h2 className="font-display text-2xl font-bold text-[#DFE3E4]">
              {caps.currentOffice ? caps.currentOfficeTitle : `Candidatura: ${targetOfficeName}`}
            </h2>
            <p className="max-w-2xl text-xs text-[#CDC6B8]">
              Tu carrera avanza únicamente por desempeño electoral, acuerdos parlamentarios y resultados de gestión. Ningún cargo se asigna automáticamente fuera de las urnas.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-[#574239]/50 bg-[#0A0F10] px-3 py-2 text-right">
              <div className="font-mono-data text-[9px] uppercase text-[#DEC1B4]">Ciclo</div>
              <div className="font-mono-data text-lg font-bold text-[#FFB691]">#{gameState.cycleNumber}</div>
            </div>
            <div className="rounded-lg border border-[#574239]/50 bg-[#0A0F10] px-3 py-2 text-right">
              <div className="font-mono-data text-[9px] uppercase text-[#DEC1B4]">Leyes/Normas</div>
              <div className="font-mono-data text-lg font-bold text-[#ACCEBF]">{gameState.player.legislativeWins}</div>
            </div>
            <div className="rounded-lg border border-[#574239]/50 bg-[#0A0F10] px-3 py-2 text-right">
              <div className="font-mono-data text-[9px] uppercase text-[#DEC1B4]">Logros</div>
              <div className="font-mono-data text-lg font-bold text-[#DFE3E4]">
                {prog.unlockedAchievements.length}/{ACHIEVEMENTS.length}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="warroom-card rounded-lg p-3">
            <div className="font-mono-data text-[10px] uppercase text-[#DEC1B4]">Lema Partidario</div>
            <div className="mt-0.5 font-semibold text-sm text-[#DFE3E4]">{playerParty?.name}</div>
            <div className="font-mono-data text-[11px] text-[#FFB691]">
              {playerParty?.currentPollShare.toFixed(1)}% intención de voto
            </div>
          </div>
          <div className="warroom-card rounded-lg p-3">
            <div className="font-mono-data text-[10px] uppercase text-[#DEC1B4]">Cargo Efectivo</div>
            <div className="mt-0.5 font-semibold text-sm text-[#DFE3E4]">{caps.currentOfficeTitle}</div>
            <div className="font-mono-data text-[11px] text-[#ACCEBF]">
              {caps.isInNationalOpposition ? 'Bloque de Oposición' : 'Oficialismo / Base'}
            </div>
          </div>
          <div className="warroom-card rounded-lg p-3">
            <div className="font-mono-data text-[10px] uppercase text-[#DEC1B4]">Postulación Vigente</div>
            <div className="mt-0.5 font-semibold text-sm text-[#DFE3E4]">{targetOfficeName}</div>
            <div className="font-mono-data text-[11px] text-[#CDC6B8]">
              {gameState.player.totalMonthsInCareer} meses de carrera
            </div>
          </div>
          <div className="warroom-card rounded-lg p-3">
            <div className="font-mono-data text-[10px] uppercase text-[#DEC1B4]">Objetivos Cumplidos</div>
            <div className="mt-0.5 font-mono-data text-lg font-bold text-[#ACCEBF]">
              {prog.completedObjectivesCount}
            </div>
            <div className="font-mono-data text-[11px] text-[#CDC6B8]">Otorgan CP y fondos (+$)</div>
          </div>
        </div>
      </section>

      {/* Objetivos Dinámicos Contextuales */}
      <section className="warroom-surface rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 font-display text-lg font-bold text-[#DFE3E4]">
              <Target className="h-5 w-5 text-[#E87532]" />
              Objetivos dinámicos de tu rol actual
            </h3>
            <p className="mt-0.5 text-xs text-[#CDC6B8]">
              Metas adaptadas a tu cargo actual. Al cumplirse otorgan Capital Político (+CP) y financiamiento legítimo (+$).
            </p>
          </div>
          <span className="font-mono-data text-xs font-semibold text-[#ACCEBF]">
            Completados: {prog.completedObjectivesCount}
          </span>
        </div>

        {prog.activeObjectives.length === 0 ? (
          <div className="mt-3 rounded-lg border border-[#574239]/40 bg-[#1B2021] p-4 text-xs text-[#CDC6B8]">
            Al avanzar un mes o iniciar el próximo ciclo electoral se asignarán nuevos objetivos contextuales.
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {prog.activeObjectives.map((obj) => {
              const isReverseGoal = obj.id === 'obj_pres_infl' || obj.id === 'obj_pres_pov' || obj.id === 'obj_int_unemp';
              const ratio = isReverseGoal
                ? obj.currentValue <= obj.targetValue
                  ? 100
                  : Math.max(12, Math.round((obj.targetValue / Math.max(0.1, obj.currentValue)) * 100))
                : Math.min(100, Math.round((obj.currentValue / Math.max(1, obj.targetValue)) * 100));

              return (
                <div key={obj.id} className="warroom-card flex flex-col justify-between rounded-xl p-4">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-1.5 font-mono-data text-[10px] uppercase tracking-wider text-[#ACCEBF]">
                      <span>
                        {obj.category}
                        {obj.difficultyTier ? ` · ${obj.difficultyTier}` : ''}
                      </span>
                      <span className="font-bold text-[#FFB691]">
                        +{obj.capitalReward} CP
                        {(obj.moneyRewardUYU ?? 0) > 0 ? ` · +$${Math.round((obj.moneyRewardUYU ?? 0) / 1000)}k` : ''}
                      </span>
                    </div>
                    <h4 className="mt-1 text-sm font-bold text-[#DFE3E4]">{obj.title}</h4>
                    <p className="mt-1 text-xs leading-relaxed text-[#CDC6B8]">{obj.description}</p>
                  </div>

                  <div className="mt-3 pt-2">
                    <div className="flex items-center justify-between font-mono-data text-xs">
                      <span className="font-semibold text-[#DFE3E4]">
                        Actual: {obj.currentValue}{obj.unitLabel === '%' ? '%' : ''}
                      </span>
                      <span className="text-[#DEC1B4]">
                        Meta: {obj.targetValue} {obj.unitLabel}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#0A0F10]">
                      <div
                        className="h-full rounded-full bg-[#557568] transition-all"
                        style={{ width: `${Math.min(100, Math.max(6, ratio))}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Misiones Tácticas Mensuales + Estadísticas Históricas */}
      <section className="warroom-surface rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 font-display text-lg font-bold text-[#DFE3E4]">
              <Flame className="h-5 w-5 text-[#E87532]" />
              Misiones Tácticas Rotativas
            </h3>
            <p className="mt-0.5 text-xs text-[#CDC6B8]">
              Operativos acotados en el tiempo con recompensa inmediata de CP y recursos al cumplirse.
            </p>
          </div>
          <span className="font-mono-data text-xs font-semibold text-[#FFB691]">
            Activas: {(prog.tacticalMissions ?? []).filter((m) => !m.completed).length}
          </span>
        </div>

        {(prog.tacticalMissions ?? []).length === 0 ? (
          <div className="mt-3 rounded-lg border border-[#574239]/40 bg-[#1B2021] p-4 text-xs text-[#CDC6B8]">
            Al avanzar al siguiente mes se activarán nuevas misiones tácticas para tu espacio político.
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {prog.tacticalMissions!.map((m) => {
              const pct = Math.min(100, Math.round((m.currentValue / Math.max(1, m.targetValue)) * 100));
              return (
                <div
                  key={m.id}
                  className={`rounded-xl border p-4 ${
                    m.completed ? 'border-[#ACCEBF]/50 bg-[#557568]/15' : 'border-[#574239]/45 bg-[#1B2021]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 font-mono-data text-[10px]">
                    <span className="inline-flex items-center gap-1 font-bold text-[#FFB691]">
                      <Clock className="h-3.5 w-3.5" />
                      {m.completed ? 'COMPLETADA' : `Vence en ${m.expiresInMonths} ${m.expiresInMonths === 1 ? 'mes' : 'meses'}`}
                    </span>
                    <span className="font-bold text-[#ACCEBF]">
                      +{m.capitalReward} CP · +${Math.round(m.moneyRewardUYU / 1000)}k
                    </span>
                  </div>
                  <h4 className="mt-1 text-sm font-bold text-[#DFE3E4]">{m.title}</h4>
                  <p className="mt-1 text-xs text-[#CDC6B8]">{m.description}</p>
                  <div className="mt-2.5 flex items-center justify-between font-mono-data text-[11px] text-[#DEC1B4]">
                    <span>Progreso: {m.currentValue} / {m.targetValue} {m.unitLabel}</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#0A0F10]">
                    <div className="h-full rounded-full bg-[#E87532]" style={{ width: `${Math.max(5, pct)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {prog.careerStats && (
          <div className="mt-5 border-t border-[#574239]/40 pt-4">
            <h4 className="mb-3 flex items-center gap-2 font-mono-data text-xs font-bold uppercase tracking-wider text-[#DEC1B4]">
              <BarChart2 className="h-4 w-4 text-[#ACCEBF]" />
              Balance Histórico de Trayectoria
            </h4>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                { label: 'Leyes aprobadas', val: prog.careerStats.lawsPassed },
                { label: 'Políticas IA vigentes', val: prog.careerStats.policiesEnacted },
                { label: 'Elecciones ganadas / perdidas', val: `${prog.careerStats.electionsWon} / ${prog.careerStats.electionsLost}` },
                { label: 'Alianzas y coaliciones', val: prog.careerStats.coalitionsFormed },
                { label: 'Fusiones de lemas', val: prog.careerStats.partiesMerged },
                { label: 'Ministros designados', val: prog.careerStats.ministersAppointed },
                { label: 'Contralores ejecutados', val: prog.careerStats.controlsExecuted },
                { label: 'Objetivos superados', val: prog.completedObjectivesCount },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-[#574239]/35 bg-[#171C1D] px-3 py-2">
                  <div className="text-[10px] text-[#CDC6B8]">{s.label}</div>
                  <div className="mt-0.5 font-mono-data text-sm font-bold text-[#DFE3E4]">{s.val}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Galería de Logros (20 medallas reales) */}
      <section className="warroom-surface rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-display text-lg font-bold text-[#DFE3E4]">
              <Award className="h-5 w-5 text-[#E87532]" />
              Logros y distinciones institucionales ({prog.unlockedAchievements.length}/{ACHIEVEMENTS.length})
            </h3>
            <p className="mt-0.5 text-xs text-[#CDC6B8]">
              Cada distinción se desbloquea únicamente al cumplir la condición histórica real dentro del simulador.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(['all', 'electoral', 'gobierno', 'parlamentario', 'politico'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`min-h-[36px] rounded-full px-3.5 py-1 font-mono-data text-xs font-semibold transition ${
                  selectedCategory === cat
                    ? 'bg-[#E87532] text-[#511E00]'
                    : 'border border-[#574239]/50 bg-[#262B2C] text-[#DEC1B4] hover:border-[#E87532]'
                }`}
              >
                {cat === 'all' ? 'Todos' : CATEGORY_LABELS[cat].replace('Logros ', '')}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAchievements.map((ach) => {
            const record = unlockedMap.get(ach.id);
            const isUnlocked = Boolean(record);
            return (
              <div
                key={ach.id}
                className={`rounded-xl border p-4 transition ${
                  isUnlocked
                    ? 'border-[#ACCEBF]/55 bg-[#557568]/20'
                    : 'border-[#574239]/40 bg-[#1B2021] opacity-80'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono-data text-[10px] uppercase tracking-wider text-[#DEC1B4]">
                      {ach.category}
                    </div>
                    <h4 className="mt-0.5 text-sm font-bold text-[#DFE3E4]">{ach.title}</h4>
                  </div>
                  {isUnlocked ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-[#ACCEBF]" />
                  ) : (
                    <Compass className="h-5 w-5 shrink-0 text-[#8B9491]" />
                  )}
                </div>
                <p className="mt-1.5 text-xs text-[#CDC6B8]">{ach.description}</p>
                <div className="mt-2.5 border-t border-[#574239]/35 pt-2 font-mono-data text-[11px]">
                  {isUnlocked ? (
                    <span className="font-semibold text-[#ACCEBF]">
                      Desbloqueado: {record!.unlockedAtDate} · Ciclo #{record!.cycleNumber}
                    </span>
                  ) : (
                    <span className="text-[#DEC1B4]">Requisito: {ach.conditionText}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Archivo de Portadas + Registro Reciente de Carrera */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="warroom-surface rounded-xl p-5">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-[#DFE3E4]">
            <Newspaper className="h-5 w-5 text-[#E87532]" />
            Hemeroteca de portadas y ceremonias
          </h3>
          {prog.momentsArchive.length === 0 ? (
            <p className="mt-3 text-xs text-[#CDC6B8]">
              Las portadas conmemorativas aparecerán automáticamente al fundar partido, ganar elecciones, asumir el gobierno o sancionar reformas estructurales.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {prog.momentsArchive.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setInspectMoment(m)}
                  className="warroom-card w-full rounded-xl p-3 text-left transition hover:border-[#E87532]"
                >
                  <div className="flex items-center justify-between gap-2 font-mono-data text-[10px] uppercase text-[#FFB691]">
                    <span>{m.kicker}</span>
                    <span className="text-[#DEC1B4]">{m.dateLabel}</span>
                  </div>
                  <div className="mt-1 font-display text-sm font-bold text-[#DFE3E4]">{m.headline}</div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="warroom-surface rounded-xl p-5">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-[#DFE3E4]">
            <ScrollText className="h-5 w-5 text-[#ACCEBF]" />
            Hitos recientes de tu carrera
          </h3>
          <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {gameState.history.slice(0, 15).map((entry) => (
              <div
                key={entry.id}
                className="warroom-card flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold text-[#DFE3E4]">{entry.title}</div>
                  <div className="font-mono-data text-[10px] text-[#DEC1B4]">{entry.dateLabel}</div>
                </div>
                <span className="shrink-0 rounded bg-[#0A0F10] px-2 py-0.5 font-mono-data text-[10px] uppercase text-[#FFB691]">
                  {entry.category}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {inspectMoment && (
        <NarrativeMomentModal moment={inspectMoment} onDismiss={() => setInspectMoment(null)} />
      )}
    </div>
  );
};
