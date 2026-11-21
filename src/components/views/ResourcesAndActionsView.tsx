import React, { useState } from 'react';
import {
  AlertTriangle,
  Bolt,
  CheckCircle2,
  Coins,
  Handshake,
  Landmark,
  Megaphone,
  Mic2,
  Radio,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { MONTH_NAMES } from '../../data/uruguayData';
import { GameState } from '../../types/game';

interface ResourcesAndActionsViewProps {
  gameState: GameState;
  onUpdateState: (next: GameState) => void;
  onOpenCareer?: () => void;
}

interface ResourceOperation {
  id: string;
  kind: 'cp' | 'money';
  title: string;
  subtitle: string;
  cpDelta: number;
  moneyDelta: number;
  popDelta: number;
  govApprovalDelta?: number;
  credDelta?: number;
  cpCost?: number;
  moneyCost?: number;
  icon: React.ComponentType<{ className?: string }>;
}

const MAX_RESOURCE_ACTIONS_PER_MONTH = 3;

const RESOURCE_OPERATIONS: ResourceOperation[] = [
  // Operaciones rápidas para Capital Político (CP): con contrapartida real en imagen/aprobación
  {
    id: 'res_cp_mesa_chica',
    kind: 'cp',
    title: 'Acuerdo de Mesa Chica y Cúpulas Sectoriales',
    subtitle: 'Negociás cupos internos rápido, pero la militancia percibe rosca cupular.',
    cpDelta: 9,
    moneyDelta: -150000,
    moneyCost: 150000,
    popDelta: -0.9,
    credDelta: -1,
    icon: Handshake,
  },
  {
    id: 'res_cp_gira_prensa',
    kind: 'cp',
    title: 'Ofensiva Mediática de Alto Voltaje',
    subtitle: 'Exposición intensiva para marcar agenda, generando desgaste y sobreexposición.',
    cpDelta: 8,
    moneyDelta: -90000,
    moneyCost: 90000,
    popDelta: -0.8,
    icon: Mic2,
  },
  {
    id: 'res_cp_asamblea_militante',
    kind: 'cp',
    title: 'Movilización Extraordinaria de Aparato',
    subtitle: 'Forzás estructura partidaria fuera de calendario; costo económico y fatiga pública.',
    cpDelta: 11,
    moneyDelta: -280000,
    moneyCost: 280000,
    popDelta: -1.1,
    icon: Users,
  },
  {
    id: 'res_cp_pacto_camaras',
    kind: 'cp',
    title: 'Intercambio Táctico en Comisiones',
    subtitle: 'Cedés votos puntuales para ganar margen legislativo; reduce aprobación oficial.',
    cpDelta: 10,
    moneyDelta: 0,
    popDelta: -1.0,
    govApprovalDelta: -1.2,
    icon: Landmark,
  },
  {
    id: 'res_cp_campana_digital',
    kind: 'cp',
    title: 'Pauta Digital Agresiva de Posicionamiento',
    subtitle: 'Instalás agenda en redes de forma abrupta, con rechazo en votantes independientes.',
    cpDelta: 7,
    moneyDelta: -120000,
    moneyCost: 120000,
    popDelta: -0.7,
    icon: Radio,
  },

  // Operaciones rápidas para Dinero (UYU): con contrapartida política transparente
  {
    id: 'res_money_cena',
    kind: 'money',
    title: 'Cena Privada de Financiamiento Partidario',
    subtitle: 'Aportes de grandes donantes; genera suspicacia pública sobre compromisos asumidos.',
    cpDelta: 0,
    moneyDelta: 1200000,
    cpCost: 2,
    popDelta: -1.2,
    icon: Coins,
  },
  {
    id: 'res_money_bonos',
    kind: 'money',
    title: 'Colecta Extraordinaria de Emergencia',
    subtitle: 'Pedido de aportes a adherentes fuera de campaña con leve desgaste organizativo.',
    cpDelta: 0,
    moneyDelta: 650000,
    cpCost: 1,
    popDelta: -0.6,
    icon: Wallet,
  },
  {
    id: 'res_money_sector_productivo',
    kind: 'money',
    title: 'Fondo de Cámaras y Grupos Económicos',
    subtitle: 'Inyección fuerte de liquidez a cambio de desgaste popular y menor credibilidad opositora.',
    cpDelta: 0,
    moneyDelta: 1950000,
    cpCost: 4,
    popDelta: -1.6,
    credDelta: -1.5,
    icon: TrendingUp,
  },
  {
    id: 'res_money_adelanto_corte',
    kind: 'money',
    title: 'Descuento Compulsivo a Cargos Políticos',
    subtitle: 'Retención extraordinaria a legisladores y cargos de confianza del lema.',
    cpDelta: 0,
    moneyDelta: 600000,
    cpCost: 2,
    popDelta: -0.8,
    icon: ShieldCheck,
  },
  {
    id: 'res_money_acto_recaudacion',
    kind: 'money',
    title: 'Kermés y Suscripción Arancelada',
    subtitle: 'Evento con entrada paga y pauta comercial; menor convocatoria ciudadana neta.',
    cpDelta: 0,
    moneyDelta: 900000,
    cpCost: 1,
    popDelta: -0.9,
    icon: Megaphone,
  },
];

export const ResourcesAndActionsView: React.FC<ResourcesAndActionsViewProps> = ({
  gameState,
  onUpdateState,
  onOpenCareer,
}) => {
  const [feedback, setFeedback] = useState<string | null>(null);

  const usedThisMonth = gameState.resourceActionsThisMonth ?? 0;
  const remainingThisMonth = Math.max(0, MAX_RESOURCE_ACTIONS_PER_MONTH - usedThisMonth);
  const activeObjectives = gameState.progression.activeObjectives ?? [];
  const tacticalMissions = gameState.progression.tacticalMissions ?? [];

  const handleExecuteOperation = (op: ResourceOperation) => {
    if (remainingThisMonth <= 0) {
      setFeedback(`Agotaste el cupo de ${MAX_RESOURCE_ACTIONS_PER_MONTH} maniobras rápidas este mes.`);
      return;
    }
    const reqCp = op.cpCost ?? 0;
    const reqMoney = op.moneyCost ?? 0;
    if (gameState.player.politicalCapital < reqCp) {
      setFeedback(`Necesitás al menos ${reqCp} CP para ejecutar esta operación.`);
      return;
    }
    if (gameState.player.campaignFundsUYU < reqMoney) {
      setFeedback(`Fondos insuficientes: requiere $${(reqMoney / 1000).toLocaleString('es-UY')} mil UYU.`);
      return;
    }

    const netCpDelta = op.cpDelta - reqCp;
    const nextCp = Math.max(0, Math.min(100, gameState.player.politicalCapital + netCpDelta));
    const nextFunds = Math.max(0, gameState.player.campaignFundsUYU + op.moneyDelta);
    const nextPop = Number(
      Math.max(12, Math.min(95, gameState.player.attributes.popularity + op.popDelta)).toFixed(1)
    );

    const nextApproval = op.govApprovalDelta
      ? Number(Math.max(12, Math.min(90, gameState.politicalIndicators.governmentApproval + op.govApprovalDelta)).toFixed(1))
      : gameState.politicalIndicators.governmentApproval;

    const nextOpposition = op.credDelta
      ? {
          ...gameState.opposition,
          credibility: Math.max(10, Math.min(100, gameState.opposition.credibility + op.credDelta)),
        }
      : gameState.opposition;

    const dateLabel = `${MONTH_NAMES[gameState.currentMonth - 1]} ${gameState.currentYear}`;
    const summaryParts: string[] = [];
    if (netCpDelta !== 0) summaryParts.push(`${netCpDelta > 0 ? '+' : ''}${netCpDelta} CP`);
    if (op.moneyDelta !== 0) {
      summaryParts.push(
        `${op.moneyDelta > 0 ? '+' : '-'}$${Math.abs(Math.round(op.moneyDelta / 1000)).toLocaleString('es-UY')} mil UYU`
      );
    }
    summaryParts.push(`${op.popDelta}% pop.`);
    if (op.govApprovalDelta) summaryParts.push(`${op.govApprovalDelta}% aprob.`);

    onUpdateState({
      ...gameState,
      resourceActionsThisMonth: usedThisMonth + 1,
      macro: {
        ...gameState.macro,
        governmentApprovalPct: nextApproval,
      },
      politicalIndicators: {
        ...gameState.politicalIndicators,
        governmentApproval: nextApproval,
      },
      opposition: nextOpposition,
      player: {
        ...gameState.player,
        politicalCapital: nextCp,
        campaignFundsUYU: nextFunds,
        attributes: {
          ...gameState.player.attributes,
          popularity: nextPop,
        },
      },
      history: [
        {
          id: `res_${Date.now()}`,
          dateLabel,
          category: op.kind === 'cp' ? 'campana' : 'sistema',
          title: op.title,
          detail: `Maniobra de emergencia (${summaryParts.join(' · ')}).`,
        },
        ...gameState.history,
      ],
    });

    setFeedback(`${op.title}: ${summaryParts.join(' · ')}`);
  };

  const cpOps = RESOURCE_OPERATIONS.filter((o) => o.kind === 'cp');
  const moneyOps = RESOURCE_OPERATIONS.filter((o) => o.kind === 'money');

  return (
    <div className="space-y-5 animate-editorial-in">
      {/* Cabecera de Recursos & Liquidez Política */}
      <section className="warroom-surface rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="font-mono-data text-[10px] font-bold uppercase tracking-[0.14em] text-[#FFB691]">
              Tesorería, Objetivos y Capital Político
            </div>
            <h2 className="mt-1 font-display text-2xl font-semibold text-[#DFE3E4]">
              Recursos y Recompensas por Gestión
            </h2>
            <p className="mt-1 max-w-2xl text-xs text-[#CDC6B8]">
              Objetivos y misiones dan CP sin desgaste. Maniobras rápidas cuestan popularidad ({MAX_RESOURCE_ACTIONS_PER_MONTH}/mes).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="rounded-lg border border-[#E87532]/50 bg-[#0A0F10] px-3.5 py-2 text-right">
              <div className="font-mono-data text-[9px] uppercase tracking-wider text-[#DEC1B4]">Capital Político</div>
              <div className="font-mono-data text-lg font-bold text-[#FFB691]">
                {gameState.player.politicalCapital} <span className="text-xs font-normal text-[#CDC6B8]">/ 100 CP</span>
              </div>
            </div>
            <div className="rounded-lg border border-[#ACCEBF]/45 bg-[#0A0F10] px-3.5 py-2 text-right">
              <div className="font-mono-data text-[9px] uppercase tracking-wider text-[#DEC1B4]">Fondos</div>
              <div className="font-mono-data text-lg font-bold text-[#ACCEBF]">
                ${(gameState.player.campaignFundsUYU / 1000000).toFixed(2)}M <span className="text-xs font-normal text-[#CDC6B8]">UYU</span>
              </div>
            </div>
            <div className="rounded-lg border border-[#574239]/60 bg-[#1B2021] px-3.5 py-2 text-right">
              <div className="font-mono-data text-[9px] uppercase tracking-wider text-[#DEC1B4]">Atajos Mes</div>
              <div className="font-mono-data text-lg font-bold text-[#DFE3E4]">
                {remainingThisMonth} <span className="text-xs font-normal text-[#CDC6B8]">/ {MAX_RESOURCE_ACTIONS_PER_MONTH}</span>
              </div>
            </div>
          </div>
        </div>

        {feedback && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-[#ACCEBF]/50 bg-[#1B2021] px-3.5 py-2.5 text-xs font-semibold text-[#ACCEBF]">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}
      </section>

      {/* Vía Principal: Resumen compacto con acceso directo a Trayectoria */}
      <section className="warroom-surface rounded-xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-[#ACCEBF]" />
            <div>
              <h3 className="font-display text-base font-semibold text-[#DFE3E4]">
                Metas Limpias Activas ({activeObjectives.length + tacticalMissions.length} en curso)
              </h3>
              <p className="text-[11px] text-[#CDC6B8]">
                Completá objetivos institucionales y misiones tácticas para sumar CP y fondos sin desgaste de imagen.
              </p>
            </div>
          </div>
          {onOpenCareer && (
            <button
              onClick={onOpenCareer}
              className="min-h-[34px] rounded-lg border border-[#ACCEBF]/45 bg-[#557568]/20 px-3 py-1.5 font-mono-data text-[11px] font-bold text-[#ACCEBF] transition hover:bg-[#557568]/35"
            >
              Ver detalle en Trayectoria →
            </button>
          )}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {activeObjectives.slice(0, 3).map((obj) => (
            <div key={obj.id} className="warroom-card rounded-lg px-3 py-2 text-xs">
              <div className="flex items-center justify-between font-mono-data text-[10px]">
                <span className="uppercase text-[#FFB691]">{obj.category}</span>
                <span className="font-bold text-[#ACCEBF]">
                  +{obj.capitalReward} CP · +${Math.round((obj.moneyRewardUYU ?? 850000) / 1000)}k
                </span>
              </div>
              <div className="mt-0.5 truncate font-semibold text-[#DFE3E4]">{obj.title}</div>
              <div className="font-mono-data text-[10px] text-[#DEC1B4]">
                {obj.currentValue} / {obj.targetValue} {obj.unitLabel}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bloque 1: Maniobras Rápidas de CP (con costo político explícito) */}
      <section className="warroom-surface rounded-xl p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#574239]/35 pb-2.5">
          <div className="flex items-center gap-2">
            <Bolt className="h-4 w-4 text-[#E87532]" />
            <h3 className="font-display text-lg font-semibold text-[#DFE3E4]">
              Maniobras de Emergencia: Capital Político (CP)
            </h3>
          </div>
          <span className="flex items-center gap-1 font-mono-data text-[10px] uppercase text-[#FFB4AB]">
            <AlertTriangle className="h-3.5 w-3.5" /> Conllevan desgaste en popularidad
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {cpOps.map((op) => {
            const Icon = op.icon;
            const reqMoney = op.moneyCost ?? 0;
            const disabled = remainingThisMonth <= 0 || gameState.player.campaignFundsUYU < reqMoney;
            return (
              <div
                key={op.id}
                className="warroom-card flex flex-col justify-between rounded-xl p-4 transition hover:border-[#E87532]/60"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#262B2C] text-[#FFB691]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <h4 className="text-sm font-bold text-[#DFE3E4]">{op.title}</h4>
                    </div>
                    <span className="shrink-0 rounded border border-[#E87532]/50 bg-[#E87532]/15 px-2 py-0.5 font-mono-data text-xs font-bold text-[#FFB691]">
                      +{op.cpDelta} CP
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-[#CDC6B8]">{op.subtitle}</p>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#574239]/30 pt-2.5">
                  <div className="flex flex-wrap gap-2 font-mono-data text-[10px]">
                    <span className="text-[#DEC1B4]">
                      {reqMoney > 0 ? `-$${(reqMoney / 1000).toLocaleString('es-UY')}k` : '$0'}
                    </span>
                    <span className="font-bold text-[#FFB4AB]">· {op.popDelta}% pop.</span>
                    {op.govApprovalDelta && (
                      <span className="font-bold text-[#FFB4AB]">· {op.govApprovalDelta}% aprob.</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleExecuteOperation(op)}
                    disabled={disabled}
                    className="executive-action-btn min-h-[36px] rounded-lg px-3.5 py-1.5 font-mono-data text-xs font-bold disabled:opacity-45"
                  >
                    Ejecutar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Bloque 2: Recaudación de Emergencia (con costo político explícito) */}
      <section className="warroom-surface rounded-xl p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#574239]/35 pb-2.5">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-[#ACCEBF]" />
            <h3 className="font-display text-lg font-semibold text-[#DFE3E4]">
              Recaudación de Emergencia (UYU)
            </h3>
          </div>
          <span className="flex items-center gap-1 font-mono-data text-[10px] uppercase text-[#FFB4AB]">
            <AlertTriangle className="h-3.5 w-3.5" /> Reduce popularidad / capital
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {moneyOps.map((op) => {
            const Icon = op.icon;
            const reqCp = op.cpCost ?? 0;
            const disabled = remainingThisMonth <= 0 || gameState.player.politicalCapital < reqCp;
            return (
              <div
                key={op.id}
                className="warroom-card flex flex-col justify-between rounded-xl p-4 transition hover:border-[#ACCEBF]/60"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#262B2C] text-[#ACCEBF]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <h4 className="text-sm font-bold text-[#DFE3E4]">{op.title}</h4>
                    </div>
                    <span className="shrink-0 rounded border border-[#ACCEBF]/45 bg-[#557568]/20 px-2 py-0.5 font-mono-data text-xs font-bold text-[#ACCEBF]">
                      +${(op.moneyDelta / 1000).toLocaleString('es-UY')}k
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-[#CDC6B8]">{op.subtitle}</p>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#574239]/30 pt-2.5">
                  <div className="flex flex-wrap gap-2 font-mono-data text-[10px]">
                    <span className="text-[#DEC1B4]">-{reqCp} CP</span>
                    <span className="font-bold text-[#FFB4AB]">· {op.popDelta}% pop.</span>
                  </div>
                  <button
                    onClick={() => handleExecuteOperation(op)}
                    disabled={disabled}
                    className="min-h-[36px] rounded-lg border border-[#ACCEBF]/50 bg-[#557568] px-3.5 py-1.5 font-mono-data text-xs font-bold text-white transition hover:bg-[#3D584D] disabled:opacity-45"
                  >
                    Recaudar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
