import React, { useState } from 'react';
import { Building2, ClipboardCheck, Globe2, Landmark, MapPinned } from 'lucide-react';
import {
  FOREIGN_NEGOTIATION_LABELS,
  PLAN_FOCUS_TEMPLATES,
  PLAN_HORIZON_LABELS,
} from '../../data/expansionData';
import type {
  EcosystemAction,
  ForeignNegotiationKind,
  NationalPlanGoalState,
  PlanHorizon,
  PoliticalEcosystemState,
} from '../../types/expansion';
import type { GameState } from '../../types/game';
import { Btn, EC, EcoCard, Empty, Meter, Pill, Row, toneFor } from './ecosystemUi';

interface Props {
  gameState: GameState;
  eco: PoliticalEcosystemState;
  run: (action: EcosystemAction) => void;
}

const LOWER_IS_BETTER = ['inflationPct', 'unemploymentPct', 'povertyPct', 'fiscalDeficitPctGdp'];

function goalProgress(goal: NationalPlanGoalState): number {
  if (LOWER_IS_BETTER.includes(goal.metric)) {
    if (goal.currentValue <= goal.targetValue) return 100;
    return Math.max(0, Math.min(99, 100 - Math.abs(goal.currentValue - goal.targetValue) * 8));
  }
  if (goal.currentValue >= goal.targetValue) return 100;
  return Math.max(0, Math.min(99, 100 - Math.abs(goal.targetValue - goal.currentValue) * 8));
}

export const PlansSection: React.FC<Props> = ({ eco, run }) => {
  const [horizon, setHorizon] = useState<PlanHorizon>(5);
  const [focus, setFocus] = useState(PLAN_FOCUS_TEMPLATES[0]?.id ?? 'desarrollo_productivo');
  const active = eco.nationalPlans.filter((p) => p.status === 'vigente');
  return (
    <EcoCard
      title="Planificación nacional"
      subtitle="Objetivos y obras a 5, 10 y 20 años"
      icon={<Landmark className="h-4 w-4 text-[#E8C57A]" />}
      right={<Pill tone="accent">{active.length} vigentes</Pill>}
    >
      <div className="grid gap-1.5 sm:grid-cols-2">
        <select
          value={horizon}
          onChange={(event) => setHorizon(Number(event.target.value) as PlanHorizon)}
          className="min-h-[32px] rounded-lg border border-[#574239]/60 bg-[#262B2C] px-2 text-[11px] text-[#DFE3E4]"
        >
          {([5, 10, 20] as PlanHorizon[]).map((value) => (
            <option key={value} value={value}>
              {PLAN_HORIZON_LABELS[value]}
            </option>
          ))}
        </select>
        <select
          value={focus}
          onChange={(event) => setFocus(event.target.value)}
          className="min-h-[32px] rounded-lg border border-[#574239]/60 bg-[#262B2C] px-2 text-[11px] text-[#DFE3E4]"
        >
          {PLAN_FOCUS_TEMPLATES.map((template) => (
            <option key={template.id} value={template.id}>
              {template.label}
            </option>
          ))}
        </select>
      </div>
      <Btn tone="primary" onClick={() => run({ type: 'create_national_plan', horizon, focus })}>
        Crear plan · 8 CP
      </Btn>
      {active.map((plan) => (
        <Row key={plan.id} className="border-[#557568]/45">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-xs font-bold text-[#DFE3E4]">{plan.name}</span>
            <Pill tone="good">
              {plan.startYear}-{plan.endYear}
            </Pill>
          </div>
          <div className="mt-1.5 space-y-1">
            {plan.goals.map((goal) => (
              <div key={goal.id}>
                <div className="flex justify-between text-[10px] text-[#CDC6B8]">
                  <span>{goal.title}</span>
                  <span>
                    {goal.currentValue.toFixed(1)}
                    {goal.unit} → {goal.targetValue.toFixed(1)}
                    {goal.unit}
                  </span>
                </div>
                <Meter value={goalProgress(goal)} tone={goalProgress(goal) >= 80 ? 'good' : 'warn'} />
              </div>
            ))}
          </div>
          <div className="mt-1.5 space-y-1">
            {plan.projects.map((project) => (
              <div
                key={project.id}
                className={`flex flex-wrap items-center justify-between gap-1 rounded-md border ${EC.border} px-2 py-1`}
              >
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold text-[#DFE3E4]">{project.title}</span>
                  <span className="ml-1 text-[10px] text-[#CDC6B8]">
                    {project.status === 'en_ejecucion'
                      ? `${project.remainingMonths}/${project.totalMonths} meses`
                      : project.status}
                  </span>
                </div>
                {project.status === 'planificado' && (
                  <Btn onClick={() => run({ type: 'fund_plan_project', planId: plan.id, projectId: project.id })}>
                    Financiar · 5 CP
                  </Btn>
                )}
              </div>
            ))}
          </div>
        </Row>
      ))}
      {active.length === 0 && <Empty>Sin plan vigente. Un plan ordena la inversión y da continuidad.</Empty>}
    </EcoCard>
  );
};

export const TransparencySection: React.FC<Props> = ({ eco, run }) => {
  const open = eco.transparencyCases.filter((c) => c.status !== 'cerrado');
  return (
    <EcoCard
      title="Transparencia"
      subtitle="Auditorías, investigaciones y respuesta pública"
      icon={<ClipboardCheck className="h-4 w-4 text-[#ACCEBF]" />}
      right={<Pill tone={open.length > 0 ? 'warn' : 'good'}>{open.length} abiertos</Pill>}
    >
      <div className="flex flex-wrap gap-1">
        <Btn onClick={() => run({ type: 'launch_transparency_case', kind: 'auditoria' })}>Auditoría · 3 CP</Btn>
        <Btn onClick={() => run({ type: 'launch_transparency_case', kind: 'investigacion' })}>Investigación</Btn>
        <Btn onClick={() => run({ type: 'launch_transparency_case', kind: 'pedido_informe' })}>Pedido de informe</Btn>
      </div>
      {open.map((item) => (
        <Row key={item.id} className={item.status === 'escalado' ? 'border-[#C25A4E]/50' : ''}>
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-xs font-bold text-[#DFE3E4]">{item.title}</span>
            <Pill tone={item.severity >= 60 ? 'bad' : item.severity >= 35 ? 'warn' : 'good'}>
              {item.severity.toFixed(0)}/100
            </Pill>
          </div>
          <p className="mt-0.5 text-[10px] text-[#CDC6B8]">{item.description}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <Btn onClick={() => run({ type: 'respond_transparency_case', caseId: item.id, strategy: 'transparente' })}>
              Respuesta abierta · 3 CP
            </Btn>
            <Btn onClick={() => run({ type: 'respond_transparency_case', caseId: item.id, strategy: 'tecnica' })}>
              Informe técnico · 4 CP
            </Btn>
            <Btn tone="danger" onClick={() => run({ type: 'respond_transparency_case', caseId: item.id, strategy: 'reservada' })}>
              Reserva · 2 CP
            </Btn>
          </div>
        </Row>
      ))}
      {open.length === 0 && <Empty>Sin casos abiertos. La transparencia sostiene la credibilidad.</Empty>}
    </EcoCard>
  );
};

export const IntendenciesSection: React.FC<Props> = ({ gameState, eco, run }) => {
  const sorted = [...eco.intendencyRelations].sort((a, b) => b.relationScore - a.relationScore);
  const latestPoll = eco.departmentPolls?.[eco.departmentPolls.length - 1];
  return (
    <EcoCard
      title="Las 19 intendencias"
      subtitle="Convenios, transferencias y conflicto territorial"
      icon={<MapPinned className="h-4 w-4 text-[#FFB691]" />}
    >
      <div className="max-h-[360px] space-y-1.5 overflow-y-auto pr-1">
        {sorted.map((relation) => {
          const poll = latestPoll?.departments.find(
            (entry) => entry.departmentId === relation.departmentId
          );
          const leader = gameState.parties.find((party) => party.id === poll?.leadingPartyId);
          return (
            <Row key={relation.departmentId}>
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-xs font-bold text-[#DFE3E4]">{relation.departmentName}</span>
                <Pill tone={relation.relationScore >= 25 ? 'good' : relation.relationScore >= -10 ? 'warn' : 'bad'}>
                  {relation.relationScore > 0 ? '+' : ''}
                  {relation.relationScore.toFixed(0)}
                </Pill>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Meter
                  value={(relation.relationScore + 100) / 2}
                  tone={toneFor((relation.relationScore + 100) / 2)}
                />
                <span className="shrink-0 text-[10px] text-[#CDC6B8]">Conflicto {relation.conflictLevel.toFixed(0)}</span>
              </div>
              <p className="mt-0.5 text-[10px] text-[#CDC6B8]">
                {relation.intendenteName}
                {poll
                  ? ` · ${leader?.acronym ?? '—'} lidera · tú ${poll.playerPartyPct.toFixed(0)}%`
                  : ''}
                {relation.agreement?.active
                  ? ` · convenio ${relation.agreement.monthsRemaining} meses`
                  : ''}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <Btn disabled={relation.agreement?.active} onClick={() => run({ type: 'intendency_agreement', departmentId: relation.departmentId })}>
                  Convenio · 4 CP
                </Btn>
                <Btn onClick={() => run({ type: 'transfer_to_intendency', departmentId: relation.departmentId, amountMillions: 50 })}>
                  Transferir $50M · 3 CP
                </Btn>
              </div>
            </Row>
          );
        })}
      </div>
    </EcoCard>
  );
};

const FOREIGN_KINDS: ForeignNegotiationKind[] = ['comercial', 'diplomatica', 'mercosur', 'cooperacion'];

export const ForeignSection: React.FC<Props> = ({ gameState, eco, run }) => {
  const [kind, setKind] = useState<ForeignNegotiationKind>('comercial');
  const active = eco.foreignNegotiations.filter((n) => n.status === 'en_curso');
  return (
    <EcoCard
      title="Política exterior"
      subtitle="Acuerdos, Mercosur y cooperación"
      icon={<Globe2 className="h-4 w-4 text-[#ACCEBF]" />}
      right={<Pill tone="accent">Mercosur {eco.mercosurIntegration.toFixed(0)}/100</Pill>}
    >
      <select
        value={kind}
        onChange={(event) => setKind(event.target.value as ForeignNegotiationKind)}
        className="min-h-[32px] w-full rounded-lg border border-[#574239]/60 bg-[#262B2C] px-2 text-[11px] text-[#DFE3E4]"
      >
        {FOREIGN_KINDS.map((item) => (
          <option key={item} value={item}>
            {FOREIGN_NEGOTIATION_LABELS[item].title}
          </option>
        ))}
      </select>
      {active.map((negotiation) => (
        <Row key={negotiation.id} className="border-[#E87532]/45">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-xs font-bold text-[#DFE3E4]">{negotiation.title}</span>
            <Pill tone="warn">{negotiation.monthsRemaining} meses</Pill>
          </div>
          <p className="mt-0.5 text-[10px] text-[#CDC6B8]">{negotiation.expectedBenefit}</p>
        </Row>
      ))}
      <div className="max-h-[260px] space-y-1.5 overflow-y-auto pr-1">
        {gameState.diplomacy.map((partner) => (
          <Row key={partner.id}>
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-bold text-[#DFE3E4]">{partner.name}</span>
              <Pill tone={partner.relationScore >= 60 ? 'good' : partner.relationScore >= 40 ? 'warn' : 'bad'}>
                {partner.relationScore.toFixed(0)}
              </Pill>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <Meter value={partner.relationScore} tone={toneFor(partner.relationScore)} />
              <span className="shrink-0 text-[10px] text-[#CDC6B8]">
                USD {partner.tradeVolumeBillionsUSD.toFixed(1)}B
              </span>
            </div>
            <div className="mt-1 flex justify-end">
              <Btn onClick={() => run({ type: 'foreign_negotiation', partnerId: partner.id, kind })}>
                Negociar · 5 CP
              </Btn>
            </div>
          </Row>
        ))}
      </div>
      <Btn tone="primary" onClick={() => run({ type: 'mercosur_summit' })}>
        <Building2 className="h-3 w-3" /> Cumbre Mercosur · 6 CP
      </Btn>
    </EcoCard>
  );
};
