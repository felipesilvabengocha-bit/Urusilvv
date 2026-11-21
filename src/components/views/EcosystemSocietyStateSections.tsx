import React, { useState } from 'react';
import { Gavel, LineChart, Scale } from 'lucide-react';
import type { EcosystemAction, InstitutionalControlKind, PoliticalEcosystemState } from '../../types/expansion';
import type { GameState } from '../../types/game';
import { Btn, EC, EcoCard, Empty, Meter, Pill, Row, toneFor } from './ecosystemUi';

interface Props {
  gameState: GameState;
  eco: PoliticalEcosystemState;
  run: (action: EcosystemAction) => void;
}

export const OpinionSection: React.FC<Props> = ({ gameState, eco }) => (
  <EcoCard
    title="Opinión segmentada"
    subtitle="Aprobación y afinidad por grupo social"
    icon={<LineChart className="h-4 w-4 text-[#ACCEBF]" />}
  >
    {eco.opinionSegments.map((segment) => {
      const poll = eco.segmentPolls[eco.segmentPolls.length - 1]?.segments.find(
        (s) => s.segmentId === segment.id
      );
      const leader = gameState.parties.find((p) => p.id === poll?.leadingPartyId);
      return (
        <Row key={segment.id}>
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-xs font-bold text-[#DFE3E4]">{segment.name}</span>
            <span className="text-[10px] text-[#CDC6B8]">
              {segment.populationPct}% población · {leader?.acronym ?? '—'} lidera
            </span>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <div>
              <div className="flex justify-between text-[10px] text-[#CDC6B8]">
                <span>Gobierno</span>
                <span>{segment.governmentApproval.toFixed(0)}</span>
              </div>
              <Meter value={segment.governmentApproval} tone={toneFor(segment.governmentApproval)} />
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-[#CDC6B8]">
                <span>Tu afinidad</span>
                <span>{segment.playerAffinity.toFixed(0)}</span>
              </div>
              <Meter value={segment.playerAffinity} tone={toneFor(segment.playerAffinity)} />
            </div>
          </div>
          <p className="mt-1 text-[10px] text-[#CDC6B8]">Prioridades: {segment.priorities.join(' · ')}</p>
        </Row>
      );
    })}
  </EcoCard>
);

const CONTROL_KINDS: Array<{ id: InstitutionalControlKind; label: string }> = [
  { id: 'constitucionalidad', label: 'Constitucionalidad' },
  { id: 'competencia', label: 'Competencia' },
  { id: 'pedido_informe', label: 'Pedido de informe' },
  { id: 'auditoria_legal', label: 'Auditoría legal' },
];

export const ControlsSection: React.FC<Props> = ({ gameState, eco, run }) => {
  const [kind, setKind] = useState<InstitutionalControlKind>('pedido_informe');
  const policies = gameState.activePolicies ?? [];
  const open = eco.institutionalControls.filter((c) => c.status === 'abierto');
  return (
    <EcoCard
      title="Control institucional"
      subtitle="Riesgo jurídico y defensa de las medidas"
      icon={<Scale className="h-4 w-4 text-[#E8C57A]" />}
      right={<Pill tone={open.length > 0 ? 'bad' : 'good'}>{open.length} abiertos</Pill>}
    >
      {open.map((control) => (
        <Row key={control.id} className="border-[#C25A4E]/45">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-xs font-bold text-[#DFE3E4]">{control.targetTitle}</span>
            <Pill tone={control.riskScore >= 60 ? 'bad' : control.riskScore >= 35 ? 'warn' : 'good'}>
              Riesgo {control.riskScore.toFixed(0)}
            </Pill>
          </div>
          <p className="mt-0.5 text-[10px] text-[#CDC6B8]">
            {control.description} · {control.monthsOpen} meses
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <Btn onClick={() => run({ type: 'respond_institutional_control', caseId: control.id, strategy: 'juridica' })}>
              Defensa jurídica · 3 CP
            </Btn>
            <Btn onClick={() => run({ type: 'respond_institutional_control', caseId: control.id, strategy: 'tecnica' })}>
              Informe técnico
            </Btn>
            <Btn onClick={() => run({ type: 'respond_institutional_control', caseId: control.id, strategy: 'politica' })}>
              Salida política
            </Btn>
          </div>
        </Row>
      ))}
      {open.length === 0 && <Empty>No hay controles abiertos.</Empty>}
      <div className="flex items-center gap-1.5">
        <select
          value={kind}
          onChange={(event) => setKind(event.target.value as InstitutionalControlKind)}
          className="min-h-[32px] flex-1 rounded-lg border border-[#574239]/60 bg-[#262B2C] px-2 text-[11px] text-[#DFE3E4]"
        >
          {CONTROL_KINDS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <div className="max-h-[220px] space-y-1.5 overflow-y-auto pr-1">
        {policies.map((policy) => (
          <Row key={policy.id}>
            <div className="flex items-center justify-between gap-1">
              <span className="truncate text-[11px] font-semibold text-[#DFE3E4]">{policy.title}</span>
              <Pill tone={policy.riskLevel === 'alto' ? 'bad' : policy.riskLevel === 'medio' ? 'warn' : 'good'}>
                {policy.riskLevel ?? 'bajo'}
              </Pill>
            </div>
            <Btn className="mt-1" onClick={() => run({ type: 'file_institutional_control', targetId: policy.id, kind })}>
              <Gavel className="h-3 w-3" /> Presentar control · 4 CP
            </Btn>
          </Row>
        ))}
        {policies.length === 0 && <Empty>No hay políticas activas para controlar.</Empty>}
      </div>
    </EcoCard>
  );
};

export const EvaluationsSection: React.FC<Props> = ({ gameState, eco, run }) => {
  const policies = gameState.activePolicies ?? [];
  const evaluations = eco.policyEvaluations.slice(0, 6);
  return (
    <EcoCard
      title="Evaluación de políticas"
      subtitle="Costo, beneficiarios y desvío de resultados"
      icon={<LineChart className="h-4 w-4 text-[#FFB691]" />}
    >
      <div className="max-h-[240px] space-y-1.5 overflow-y-auto pr-1">
        {policies.map((policy) => {
          const done = eco.policyEvaluations.some((e) => e.policyId === policy.id);
          return (
            <Row key={policy.id}>
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-[11px] font-semibold text-[#DFE3E4]">{policy.title}</span>
                <Pill tone={policy.status === 'bloqueada' ? 'bad' : 'neutral'}>{policy.status}</Pill>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-[10px] text-[#CDC6B8]">
                  {policy.beneficiaries} · costo {(policy.estimatedEffects.fiscalCostPctGdp ?? 0).toFixed(2)}% PIB
                </span>
                <Btn disabled={done} onClick={() => run({ type: 'evaluate_policy', policyId: policy.id })}>
                  {done ? 'Evaluada' : 'Evaluar · 2 CP'}
                </Btn>
              </div>
            </Row>
          );
        })}
        {policies.length === 0 && <Empty>Sin políticas activas para evaluar.</Empty>}
      </div>
      {evaluations.map((evaluation) => (
        <Row key={evaluation.id}>
          <div className="flex items-center justify-between gap-1">
            <span className="truncate text-[11px] font-semibold text-[#DFE3E4]">{evaluation.policyTitle}</span>
            <Pill tone={(evaluation.deviationScore ?? 0) <= 20 ? 'good' : (evaluation.deviationScore ?? 0) <= 40 ? 'warn' : 'bad'}>
              Desvío {evaluation.deviationScore ?? 0}
            </Pill>
          </div>
          <p className="mt-0.5 text-[10px] text-[#CDC6B8]">{evaluation.verdict}</p>
        </Row>
      ))}
    </EcoCard>
  );
};
