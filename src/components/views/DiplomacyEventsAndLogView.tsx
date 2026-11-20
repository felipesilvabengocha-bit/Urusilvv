import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Globe2,
  History,
  Lock,
  Megaphone,
  Newspaper,
  ShieldAlert,
} from 'lucide-react';
import { MONTH_NAMES } from '../../data/uruguayData';
import { getPlayerCapabilities } from '../../engine/capabilitiesEngine';
import { seededRandom } from '../../engine/electoralEngine';
import {
  POLITICAL_OPERATIONS,
  PoliticalOperationDef,
  applyDiplomaticAction,
  resolveGameEvent,
} from '../../engine/eventsAndAiEngine';
import { DiplomaticPartner, GameEvent, GameEventOption, GameState } from '../../types/game';

interface DiplomacyEventsProps {
  gameState: GameState;
  onUpdateState: (next: GameState) => void;
}

export const DiplomacyView: React.FC<DiplomacyEventsProps> = ({ gameState, onUpdateState }) => {
  const [msg, setMsg] = useState<string | null>(null);
  const caps = getPlayerCapabilities(gameState);

  const handleAction = (partnerId: DiplomaticPartner['id'], act: 'cumbre' | 'comercio' | 'inversion') => {
    if (!caps.canDirectForeignPolicyExecutive) {
      setMsg(caps.lockReasons.foreignPolicy);
      return;
    }
    const res = applyDiplomaticAction(gameState, partnerId, act);
    setMsg(res.message);
    onUpdateState(res.nextState);
  };

  return (
    <div className="space-y-5 animate-editorial-in">
      <section className="warroom-surface rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#574239]/40 pb-3.5">
          <div>
            <div className="font-mono-data text-[11px] font-semibold uppercase tracking-[0.12em] text-[#FFB691]">
              Cancillería · Comercio Exterior y Mercosur
            </div>
            <h2 className="mt-0.5 flex items-center gap-2 font-display text-xl font-bold text-[#DFE3E4]">
              <Globe2 className="h-5 w-5 text-[#ACCEBF]" />
              Relaciones Internacionales, Comercio y Mercosur
            </h2>
            <p className="mt-1 text-xs text-[#CDC6B8]">
              La relación bilateral con socios del Mercosur y mercados extra-zona incide en exportaciones, inversiones y crecimiento del PIB.
            </p>
          </div>
          {!caps.canDirectForeignPolicyExecutive && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-[#E87532]/45 bg-[#E87532]/15 px-2.5 py-1 text-xs font-semibold text-[#FFB691]">
              <Lock className="h-3.5 w-3.5" /> Conducción exclusiva del Presidente
            </span>
          )}
        </div>

        {!caps.canDirectForeignPolicyExecutive && (
          <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-[#E87532]/45 bg-[#E87532]/12 p-3 text-xs text-[#DFE3E4]">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#FFB691]" />
            <div>
              <strong className="text-[#FFB691]">Política exterior bloqueada:</strong> {caps.lockReasons.foreignPolicy}
            </div>
          </div>
        )}

        {msg && (
          <div className="mt-3 rounded-lg border border-[#557568]/50 bg-[#557568]/18 p-3 text-xs font-medium text-[#ACCEBF]">
            {msg}
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {gameState.diplomacy.map((partner) => (
            <div key={partner.id} className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-display text-sm font-bold text-[#DFE3E4]">{partner.name}</span>
                  <span className="ml-2 text-xs font-semibold text-[#ACCEBF]">· {partner.bloc}</span>
                </div>
                <span className="font-mono-data text-sm font-bold text-[#FFB691]">
                  {partner.relationScore} / 100
                </span>
              </div>

              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#0A0F10]">
                <div
                  className={`h-full rounded-full transition-all ${
                    partner.relationScore >= 65
                      ? 'bg-[#557568]'
                      : partner.relationScore >= 45
                      ? 'bg-[#E87532]'
                      : 'bg-[#93000A]'
                  }`}
                  style={{ width: `${partner.relationScore}%` }}
                />
              </div>

              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 font-mono-data text-[11px] text-[#DEC1B4]">
                <span>Comercio: USD {partner.tradeVolumeBillionsUSD}B</span>
                <span>Part. Exp.: {partner.exportSharePct}%</span>
                <span>Inversión: {partner.investmentFlowScore}/100</span>
              </div>
              <p className="mt-1.5 text-[11px] text-[#CDC6B8]">{partner.activeAgreement}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  disabled={!caps.canDirectForeignPolicyExecutive}
                  onClick={() => handleAction(partner.id, 'cumbre')}
                  className="min-h-[34px] rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-2.5 py-1 text-[11px] font-semibold text-[#DFE3E4] transition hover:border-[#E87532] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Cumbre diplomática
                </button>
                <button
                  disabled={!caps.canDirectForeignPolicyExecutive}
                  onClick={() => handleAction(partner.id, 'comercio')}
                  className="min-h-[34px] rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-2.5 py-1 text-[11px] font-semibold text-[#DFE3E4] transition hover:border-[#E87532] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Acuerdo comercial
                </button>
                <button
                  disabled={!caps.canDirectForeignPolicyExecutive}
                  onClick={() => handleAction(partner.id, 'inversion')}
                  className="min-h-[34px] rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-2.5 py-1 text-[11px] font-semibold text-[#DFE3E4] transition hover:border-[#557568] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Misión inversión
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export const EventsAndOpsView: React.FC<DiplomacyEventsProps> = ({ gameState, onUpdateState }) => {
  const [opFeedback, setOpFeedback] = useState<string | null>(null);
  const caps = getPlayerCapabilities(gameState);

  const getOperationPermission = (opId: string): { allowed: boolean; reason: string } => {
    switch (opId) {
      case 'op_negociar_dirigentes':
        return { allowed: true, reason: '' };
      case 'op_conferencia':
        return caps.currentOffice !== null || caps.canCampaign
          ? { allowed: true, reason: '' }
          : { allowed: false, reason: 'Requiere ejercicio de cargo público o actividad de campaña.' };
      case 'op_auditoria':
        return caps.canSignPresidentialDecrees || caps.canAdministerDepartamentalBudget
          ? { allowed: true, reason: '' }
          : {
              allowed: false,
              reason: `Requiere titularidad del Ejecutivo Nacional o de una Intendencia (${caps.currentOfficeTitle}).`,
            };
      case 'op_comision_inv':
        return caps.canOversightGovernment
          ? { allowed: true, reason: '' }
          : {
              allowed: false,
              reason: `Requiere banca legislativa (Senador, Diputado o Vicepresidente) para impulsar comisiones investigadoras.`,
            };
      case 'op_congreso_intendentes':
        return caps.canSignPresidentialDecrees || caps.canAdministerDepartamentalBudget
          ? { allowed: true, reason: '' }
          : {
              allowed: false,
              reason: 'Solo el Presidente en ejercicio o un Intendente Departamental participan resolutivamente del Congreso de Intendentes.',
            };
      case 'op_mediacion_social':
        return caps.canSignPresidentialDecrees
          ? { allowed: true, reason: '' }
          : {
              allowed: false,
              reason: 'Convocar mesas tripartitas en el MTSS requiere ejercer el Poder Ejecutivo Nacional.',
            };
      default:
        return { allowed: true, reason: '' };
    }
  };

  const handleResolveEvent = (evt: GameEvent, opt: GameEventOption) => {
    if (evt.resolved) return;
    if (!caps.canResolveNationalEventsAsExecutive) {
      setOpFeedback(caps.lockReasons.nationalEvents);
      return;
    }
    if (gameState.player.campaignFundsUYU < opt.moneyCostUYU) {
      setOpFeedback('Fondos insuficientes para ejecutar esta respuesta.');
      return;
    }
    if (gameState.player.politicalCapital < opt.politicalCapitalCost) {
      setOpFeedback('Capital político insuficiente para esta opción.');
      return;
    }

    const res = resolveGameEvent(gameState, evt, opt);
    setOpFeedback(res.outcomeText);
    onUpdateState(res.nextState);
  };

  const handlePoliticalStanceOnEvent = (evt: GameEvent, mode: 'posicionamiento' | 'contralor') => {
    if (evt.resolved) return;
    const costCap = mode === 'contralor' ? 5 : 3;
    if (gameState.player.politicalCapital < costCap) {
      setOpFeedback(`Necesitás ${costCap} de capital político.`);
      return;
    }

    const popGain = mode === 'contralor' ? 2.1 : 1.5;
    const outcomeText =
      mode === 'contralor'
        ? `Ejerciste control parlamentario exigiendo explicaciones al Ejecutivo sobre «${evt.title}» (+${popGain} pop.).`
        : `Fijaste posicionamiento político público ante «${evt.title}» sin usurpar funciones del Ejecutivo (+${popGain} pop. y +0.8 impulso partidario).`;

    const nextEvents = gameState.events.map((e) =>
      e.id === evt.id
        ? { ...e, resolved: true, chosenOptionId: mode, resolutionOutcome: outcomeText }
        : e
    );
    const nextParties = gameState.parties.map((p) =>
      p.id === gameState.player.partyId
        ? { ...p, campaignMomentum: Number(Math.min(15, p.campaignMomentum + 0.8).toFixed(2)) }
        : p
    );

    setOpFeedback(outcomeText);
    onUpdateState({
      ...gameState,
      events: nextEvents,
      parties: nextParties,
      player: {
        ...gameState.player,
        politicalCapital: gameState.player.politicalCapital - costCap,
        attributes: {
          ...gameState.player.attributes,
          popularity: Number(Math.min(98, gameState.player.attributes.popularity + popGain).toFixed(1)),
        },
      },
      history: [
        {
          id: `evt_pos_${Date.now()}`,
          dateLabel: `${MONTH_NAMES[gameState.currentMonth - 1]} ${gameState.currentYear}`,
          category: 'evento',
          title: mode === 'contralor' ? `Control legislativo: ${evt.title}` : `Posicionamiento: ${evt.title}`,
          detail: outcomeText,
        },
        ...gameState.history,
      ],
    });
  };

  const handleRunOperation = (op: PoliticalOperationDef) => {
    const perm = getOperationPermission(op.id);
    if (!perm.allowed) {
      setOpFeedback(perm.reason);
      return;
    }
    if (gameState.player.campaignFundsUYU < op.moneyCostUYU) {
      setOpFeedback('Fondos insuficientes para ejecutar esta operación política.');
      return;
    }
    if (gameState.player.politicalCapital < op.politicalCapitalCost) {
      setOpFeedback('Capital político insuficiente.');
      return;
    }

    const rng = seededRandom(`${gameState.id}-op-${op.id}-${gameState.currentMonth}`);
    const bonus = (gameState.player.attributes.negotiation - 50) * 0.3;
    const ok = rng() * 100 < op.baseSuccessPct + bonus;

    const nextInd = { ...gameState.politicalIndicators };
    const nextMacro = { ...gameState.macro };
    let nextDepartments = gameState.departments;
    let nextRelations = gameState.player.relations;
    let nextParties = gameState.parties;
    let nextOpposition = gameState.opposition;
    let nextPop = gameState.player.attributes.popularity;
    let nextCap = gameState.player.politicalCapital - op.politicalCapitalCost;

    if (ok) {
      if (op.id === 'op_negociar_dirigentes') {
        nextInd.coalitionStability = Math.min(98, nextInd.coalitionStability + 5);
        const topTargets = new Set(
          [...gameState.player.relations]
            .sort((a, b) => b.affinity - a.affinity)
            .slice(0, 2)
            .map((r) => r.partyId)
        );
        nextRelations = gameState.player.relations.map((r) =>
          topTargets.has(r.partyId) ? { ...r, affinity: Math.min(100, r.affinity + 8) } : r
        );
      }
      if (op.id === 'op_conferencia') {
        nextPop = Math.min(98, Number((nextPop + 2.5).toFixed(1)));
        nextInd.governmentApproval = Math.min(85, Number((nextInd.governmentApproval + 2).toFixed(1)));
        nextMacro.governmentApprovalPct = nextInd.governmentApproval;
      }
      if (op.id === 'op_auditoria') {
        nextInd.governmentApproval = Math.min(85, Number((nextInd.governmentApproval + 3.5).toFixed(1)));
        nextMacro.governmentApprovalPct = nextInd.governmentApproval;
        nextInd.businessConfidence = Math.min(95, Number((nextInd.businessConfidence + 3).toFixed(1)));
      }
      if (op.id === 'op_comision_inv') {
        nextInd.partyStrength = Math.min(100, Number((nextInd.partyStrength + 4).toFixed(1)));
        nextParties = gameState.parties.map((p) =>
          p.id === gameState.player.partyId ? { ...p, partyStrength: nextInd.partyStrength } : p
        );
        nextPop = Math.min(98, Number((nextPop + 1.5).toFixed(1)));
        nextCap = Math.min(100, nextCap + 3);
        nextOpposition = {
          ...gameState.opposition,
          parliamentaryControlsExecuted: (gameState.opposition.parliamentaryControlsExecuted ?? 0) + 1,
        };
        if (gameState.nationalPresidentPartyId !== gameState.player.partyId) {
          nextInd.governmentApproval = Math.max(15, Number((nextInd.governmentApproval - 2.0).toFixed(1)));
          nextMacro.governmentApprovalPct = nextInd.governmentApproval;
        }
      }
      if (op.id === 'op_mediacion_social') {
        nextInd.unionConfidence = Math.min(95, Number((nextInd.unionConfidence + 5).toFixed(1)));
        nextInd.businessConfidence = Math.min(95, Number((nextInd.businessConfidence + 4).toFixed(1)));
      }
      if (op.id === 'op_congreso_intendentes') {
        nextPop = Math.min(98, Number((nextPop + 1.2).toFixed(1)));
        nextDepartments = gameState.departments.map((d) => ({
          ...d,
          localServiceQuality: Math.min(98, Number((d.localServiceQuality + (d.id === gameState.player.targetDepartment ? 4 : 1.5)).toFixed(1))),
          partyMultipliers:
            d.id === gameState.player.targetDepartment
              ? {
                  ...d.partyMultipliers,
                  [gameState.player.partyId]: Number(
                    Math.min(1.9, (d.partyMultipliers[gameState.player.partyId] ?? 1) + 0.03).toFixed(3)
                  ),
                }
              : d.partyMultipliers,
        }));
      }
    } else {
      nextPop = Math.max(12, Number((nextPop - 1).toFixed(1)));
    }

    const msg = ok ? `${op.label}: ejecución exitosa. ${op.effectSummary}` : `${op.label}: resultados limitados ante resistencia política.`;
    setOpFeedback(msg);

    onUpdateState({
      ...gameState,
      macro: nextMacro,
      departments: nextDepartments,
      parties: nextParties,
      opposition: nextOpposition,
      politicalIndicators: nextInd,
      player: {
        ...gameState.player,
        campaignFundsUYU: gameState.player.campaignFundsUYU - op.moneyCostUYU,
        politicalCapital: nextCap,
        relations: nextRelations,
        attributes: { ...gameState.player.attributes, popularity: nextPop },
      },
      history: [
        {
          id: `op_${Date.now()}`,
          dateLabel: `${MONTH_NAMES[gameState.currentMonth - 1]} ${gameState.currentYear}`,
          category: 'gobierno',
          title: op.label,
          detail: msg,
        },
        ...gameState.history,
      ],
    });
  };

  return (
    <div className="space-y-5 animate-editorial-in">
      {/* Acontecimientos activos */}
      <section className="warroom-surface rounded-xl p-5">
        <div className="border-b border-[#574239]/40 pb-3.5">
          <div className="font-mono-data text-[11px] font-semibold uppercase tracking-[0.12em] text-[#FFB691]">
            Despacho de Coyuntura Nacional
          </div>
          <h2 className="mt-0.5 flex items-center gap-2 font-display text-xl font-bold text-[#DFE3E4]">
            <AlertTriangle className="h-5 w-5 text-[#E87532]" />
            Acontecimientos y Coyunturas Nacionales
          </h2>
          <p className="mt-1 text-xs text-[#CDC6B8]">
            {caps.canResolveNationalEventsAsExecutive
              ? 'Como Presidente de la República podés adoptar decisiones ejecutivas frente a cada crisis nacional.'
              : 'Las decisiones ejecutivas del Estado corresponden exclusivamente al Presidente en ejercicio. Según tu cargo, podés fijar postura pública o ejercer control legislativo.'}
          </p>
        </div>

        {!caps.canResolveNationalEventsAsExecutive && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#E87532]/45 bg-[#E87532]/12 p-3 text-xs text-[#DFE3E4]">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#FFB691]" />
            <div>
              <strong className="text-[#FFB691]">Resoluciones del Poder Ejecutivo bloqueadas:</strong> {caps.lockReasons.nationalEvents}
            </div>
          </div>
        )}

        {opFeedback && (
          <div className="mt-3 rounded-lg border border-[#557568]/50 bg-[#557568]/18 p-3 text-xs font-medium text-[#ACCEBF]">
            {opFeedback}
          </div>
        )}

        <div className="mt-4 space-y-3">
          {gameState.events.length === 0 ? (
            <div className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-4 text-xs text-[#CDC6B8]">
              No hay crisis activas este mes. Avanzá el calendario mensual para procesar la coyuntura.
            </div>
          ) : (
            gameState.events.map((evt) => (
              <div key={evt.id} className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-mono-data font-bold uppercase text-[#FFB691]">
                    {evt.domain} · {evt.dateLabel}
                  </span>
                  {evt.resolved && (
                    <span className="inline-flex items-center gap-1 font-semibold text-[#ACCEBF]">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Resuelto
                    </span>
                  )}
                </div>
                <h3 className="mt-1 font-display text-sm font-bold text-[#DFE3E4]">{evt.title}</h3>
                <p className="mt-1 text-xs text-[#DFE3E4]">{evt.description}</p>
                <p className="mt-1 text-[11px] italic text-[#DEC1B4]">{evt.context}</p>

                {evt.resolved ? (
                  <div className="mt-2.5 rounded-lg border border-[#557568]/45 bg-[#0A0F10] p-2.5 text-xs font-medium text-[#ACCEBF]">
                    Resultado: {evt.resolutionOutcome}
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {evt.options.map((opt) => (
                        <button
                          key={opt.id}
                          disabled={!caps.canResolveNationalEventsAsExecutive}
                          onClick={() => handleResolveEvent(evt, opt)}
                          className="rounded-lg border border-[#574239]/50 bg-[#0A0F10] p-3 text-left transition hover:border-[#E87532] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <div className="flex items-center justify-between gap-2 text-xs font-bold text-[#DFE3E4]">
                            <span>{opt.label}</span>
                            {!caps.canResolveNationalEventsAsExecutive && (
                              <Lock className="h-3.5 w-3.5 shrink-0 text-[#FFB691]" />
                            )}
                          </div>
                          <p className="mt-1 text-[11px] text-[#CDC6B8]">{opt.description}</p>
                          <div className="mt-2 flex flex-wrap gap-x-3 font-mono-data text-[11px] font-semibold text-[#ACCEBF]">
                            <span>Éxito: {opt.successProbability}%</span>
                            <span>-{opt.politicalCapitalCost} cap.</span>
                            {opt.moneyCostUYU > 0 && <span>-${(opt.moneyCostUYU / 1000).toFixed(0)}k</span>}
                          </div>
                          <div className="mt-1 text-[11px] font-medium text-[#FFB691]">{opt.expectedImpactSummary}</div>
                        </button>
                      ))}
                    </div>

                    {!caps.canResolveNationalEventsAsExecutive && (
                      <div className="flex flex-wrap gap-2 border-t border-[#574239]/40 pt-2.5">
                        <button
                          onClick={() => handlePoliticalStanceOnEvent(evt, 'posicionamiento')}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#E87532]/50 bg-[#E87532]/15 px-3 text-xs font-semibold text-[#FFB691] transition hover:bg-[#E87532] hover:text-white"
                        >
                          <Megaphone className="h-3.5 w-3.5" />
                          Fijar posicionamiento político (-3 cap.)
                        </button>
                        {caps.canOversightGovernment && (
                          <button
                            onClick={() => handlePoliticalStanceOnEvent(evt, 'contralor')}
                            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#557568]/50 bg-[#557568]/18 px-3 text-xs font-semibold text-[#ACCEBF] transition hover:bg-[#557568] hover:text-white"
                          >
                            Control parlamentario sobre la crisis (-5 cap.)
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* Operaciones políticas estratégicas */}
      <section className="warroom-surface rounded-xl p-5">
        <h3 className="flex items-center gap-2 font-display text-base font-bold text-[#DFE3E4]">
          <ShieldAlert className="h-4 w-4 text-[#E87532]" />
          Acciones y Operaciones Políticas Institucionales
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {POLITICAL_OPERATIONS.map((op) => {
            const perm = getOperationPermission(op.id);
            return (
              <button
                key={op.id}
                disabled={!perm.allowed}
                onClick={() => handleRunOperation(op)}
                className="flex flex-col justify-between rounded-lg border border-[#574239]/40 bg-[#1B2021] p-3.5 text-left transition hover:border-[#E87532] disabled:cursor-not-allowed disabled:opacity-55"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 text-xs font-bold text-[#DFE3E4]">
                    <span>{op.label}</span>
                    {!perm.allowed && <Lock className="h-3.5 w-3.5 shrink-0 text-[#FFB691]" />}
                  </div>
                  <p className="mt-1 text-[11px] text-[#CDC6B8]">{op.description}</p>
                  {!perm.allowed && (
                    <p className="mt-1.5 text-[11px] font-medium text-[#FFB691]">{perm.reason}</p>
                  )}
                </div>
                <div className="mt-2.5 border-t border-[#574239]/40 pt-2 font-mono-data text-[11px] font-semibold text-[#ACCEBF]">
                  Éxito base {op.baseSuccessPct}% · -{op.politicalCapitalCost} cap. · ${(op.moneyCostUYU / 1000).toFixed(0)}k
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export const HistoricalLogView: React.FC<{ gameState: GameState }> = ({ gameState }) => {
  return (
    <section className="warroom-surface rounded-xl p-5 animate-editorial-in">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#574239]/40 pb-3.5">
        <div>
          <div className="font-mono-data text-[11px] font-semibold uppercase tracking-[0.12em] text-[#FFB691]">
            Archivo de Prensa e Institución
          </div>
          <h2 className="mt-0.5 flex items-center gap-2 font-display text-xl font-bold text-[#DFE3E4]">
            <History className="h-5 w-5 text-[#E87532]" />
            Registro Histórico de la Partida
          </h2>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#574239]/50 bg-[#1B2021] px-2.5 py-1 font-mono-data text-xs font-semibold text-[#DEC1B4]">
          <Newspaper className="h-3.5 w-3.5 text-[#E87532]" />
          {gameState.history.length} asientos
        </span>
      </div>

      <div className="mt-4 space-y-2.5">
        {gameState.history.map((item) => (
          <div key={item.id} className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-3.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-display text-sm font-bold text-[#DFE3E4]">{item.title}</span>
              <span className="rounded border border-[#574239]/50 bg-[#0A0F10] px-2 py-0.5 font-mono-data text-[10px] font-semibold uppercase text-[#FFB691]">
                {item.dateLabel} · {item.category}
              </span>
            </div>
            <p className="mt-1.5 leading-relaxed text-[#CDC6B8]">{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
};
