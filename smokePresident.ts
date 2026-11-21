import { buildNewGameState } from './src/engine/gameFactory';
import { advanceOneMonth } from './src/engine/simulationEngine';
import { dispatchEcosystemAction } from './src/engine/ecosystemActions';
import type { ActivePublicPolicy } from './src/types/game';

const memory = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memory.set(key, value);
  },
  removeItem: (key: string) => {
    memory.delete(key);
  },
  clear: () => memory.clear(),
  key: (index: number) => Array.from(memory.keys())[index] ?? null,
  get length() {
    return memory.size;
  },
};

let state = buildNewGameState({
  scenarioId: 'contemporaneo_2024',
  difficultyId: 'normal',
  originMode: 'partido_existente',
  selectedPartyId: 'fa',
  selectedSectorId: 'fa_mpp',
  playerName: 'Prueba Presidente',
  biography: 'Prueba',
  attributes: { popularity: 60, charisma: 60, management: 60, territorialMachine: 60, negotiation: 60 },
  targetOffice: 'presidente',
  targetDepartment: 'montevideo',
});
state = {
  ...state,
  careerPhase: 'gobierno',
  currentMonth: 6,
  currentYear: 2026,
  player: { ...state.player, currentOffice: 'presidente', politicalCapital: 200, campaignFundsUYU: 50000000 },
  nationalPresidentPartyId: state.player.partyId,
  nationalPresidentName: state.player.name,
  coalitionPartyIds: [state.player.partyId],
};

const policy: ActivePublicPolicy = {
  id: 'pol_test_1',
  title: 'Plan de Empleo Joven',
  ministryArea: 'desarrollo_social',
  summary: 'Prueba',
  objectives: [],
  instruments: [],
  financingSource: 'Presupuesto',
  beneficiaries: 'Jóvenes 18-29',
  timelineMonths: 12,
  implementationSteps: [],
  conditions: [],
  politicalCapitalCost: 5,
  moneyCostUYU: 100000000,
  estimatedEffects: { gdpDelta: 0.3, unemploymentDelta: -0.4, approvalDelta: 1.2, fiscalCostPctGdp: 0.2 },
  delayedEffects: {},
  positiveExternalities: [],
  negativeExternalities: [],
  viabilityNote: 'Prueba',
  synergyTags: [],
  enactedDateLabel: '2026-01',
  activeMonths: 8,
  status: 'vigente',
  sponsorPartyId: state.player.partyId,
  synergies: [],
  conflicts: [],
  riskLevel: 'alto',
  observedEffects: {
    gdpImpactAcc: 0.1,
    inflationImpactAcc: 0.05,
    employmentImpactAcc: -0.1,
    povertyImpactAcc: 0.02,
    fiscalNetAcc: -0.1,
    approvalImpactAcc: 0.3,
  },
};
state = { ...state, activePolicies: [policy] };

const run = (action: Parameters<typeof dispatchEcosystemAction>[1]) => {
  const result = dispatchEcosystemAction(state, action);
  console.log(action.type, result.ok, result.message.slice(0, 120));
  if (result.ok) state = result.nextState;
};

run({ type: 'evaluate_policy', policyId: policy.id });
run({ type: 'file_institutional_control', targetId: policy.id, kind: 'constitucionalidad' });
run({ type: 'foreign_negotiation', partnerId: 'brasil', kind: 'comercial' });
run({ type: 'mercosur_summit' });
run({ type: 'transfer_to_intendency', departmentId: 'salto', amountMillions: 50 });
const plan = state.expansion!.nationalPlans[0];
if (plan) {
  const project = plan.projects.find((p) => p.status === 'planificado');
  if (project) run({ type: 'fund_plan_project', planId: plan.id, projectId: project.id });
}
const control = state.expansion!.institutionalControls.find((c) => c.status === 'abierto');
if (control) run({ type: 'respond_institutional_control', caseId: control.id, strategy: 'juridica' });

for (let i = 0; i < 8; i += 1) state = advanceOneMonth(state);

const e = state.expansion!;
console.log('presidente tras 8 meses:', {
  fecha: `${state.currentMonth}/${state.currentYear}`,
  aprobacion: state.macro.governmentApprovalPct,
  cp: state.player.politicalCapital,
  controles: e.institutionalControls.map((c) => `${c.kind}:${c.status}:${c.riskScore}`),
  evaluaciones: e.policyEvaluations.map((ev) => `${ev.kind}:${ev.deviationScore}`),
  fneg: e.foreignNegotiations.map((n) => `${n.partnerName}:${n.status}`),
  mercosur: e.mercosurIntegration,
  intendencia: e.intendencyRelations.find((r) => r.departmentId === 'salto'),
  planes: e.nationalPlans.map((p) => ({
    status: p.status,
    proyectos: p.projects.map((pr) => `${pr.title}:${pr.status}:${pr.remainingMonths}`),
  })),
  crisis: e.cabinetCrises.length,
});
