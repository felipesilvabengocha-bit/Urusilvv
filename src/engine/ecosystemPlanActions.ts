import {
  PLAN_FOCUS_TEMPLATES,
  PLAN_HORIZON_LABELS,
  TRANSPARENCY_TEMPLATES,
} from '../data/expansionData';
import type {
  EcosystemActionResult,
  NationalPlanState,
  PlanHorizon,
  PolicyEvaluationState,
} from '../types/expansion';
import type { ActivePublicPolicy, GameState, PolicyMacroEffect } from '../types/game';
import { getPlayerCapabilities } from './capabilitiesEngine';
import { createInitialEcosystemState } from './ecosystemFactory';
import {
  applyApproval,
  canSpend,
  clamp,
  ensureEcosystem,
  fail,
  MACRO_METRIC_LABELS,
  pick,
  r1,
  r2,
  readMetric,
  setExpansion,
  spend,
  success,
  withLog,
} from './ecosystemShared';

/* ============================================================
   10 · EVALUACIÓN DE POLÍTICAS
   11 · PLANIFICACIÓN NACIONAL 5/10/20 AÑOS
   12 · TRANSPARENCIA E INVESTIGACIONES
   ============================================================ */

function observedFromPolicy(policy: ActivePublicPolicy): PolicyMacroEffect {
  return {
    gdpDelta: policy.observedEffects.gdpImpactAcc,
    inflationDelta: policy.observedEffects.inflationImpactAcc,
    unemploymentDelta: policy.observedEffects.employmentImpactAcc,
    povertyDelta: policy.observedEffects.povertyImpactAcc,
    approvalDelta: policy.observedEffects.approvalImpactAcc,
  };
}

function evaluateDeviation(expected: PolicyMacroEffect, observed: PolicyMacroEffect): number {
  const keys: Array<keyof PolicyMacroEffect> = [
    'gdpDelta',
    'inflationDelta',
    'unemploymentDelta',
    'povertyDelta',
    'approvalDelta',
  ];
  const sum = keys.reduce((acc, key) => {
    const e = typeof expected[key] === 'number' ? (expected[key] as number) : 0;
    const o = typeof observed[key] === 'number' ? (observed[key] as number) : 0;
    return acc + Math.abs(e - o);
  }, 0);
  return Math.min(100, Math.round(sum * 14));
}

export function evaluatePolicy(state: GameState, policyId: string): EcosystemActionResult {
  const eco = ensureEcosystem(state, createInitialEcosystemState);
  const policy = (state.activePolicies ?? []).find((p) => p.id === policyId);
  if (!policy) return fail(state, 'Esa política no está en ejecución.');
  if (eco.policyEvaluations.some((e) => e.policyId === policyId && e.kind === 'previa')) {
    return fail(state, 'Esa política ya tiene una evaluación previa.');
  }
  const costError = canSpend(state, 2);
  if (costError) return fail(state, costError);

  const observed = observedFromPolicy(policy);
  const deviation = evaluateDeviation(policy.estimatedEffects, observed);
  const evaluation: PolicyEvaluationState = {
    id: `eval_pre_${policy.id}_${Date.now()}`,
    policyId: policy.id,
    policyTitle: policy.title,
    kind: policy.activeMonths >= 3 ? 'posterior' : 'previa',
    dateLabel: `${state.currentYear}-${state.currentMonth}`,
    estimatedCostPctGdp: policy.estimatedEffects.fiscalCostPctGdp ?? 0,
    estimatedBeneficiaries: policy.beneficiaries,
    estimatedRisk: policy.riskLevel ?? 'medio',
    expectedEffects: { ...policy.estimatedEffects },
    observedEffects: observed,
    deviationScore: deviation,
    verdict:
      deviation <= 18
        ? 'Ejecución alineada a lo previsto.'
        : deviation <= 38
        ? 'Desvío moderado; conviene ajustar instrumentos.'
        : 'Desvío alto: el diseño o la ejecución requieren revisión.',
  };
  let next = spend(state, 2);
  next = {
    ...next,
    politicalIndicators: {
      ...next.politicalIndicators,
      businessConfidence: r1(
        clamp(next.politicalIndicators.businessConfidence + 0.4, 0, 100)
      ),
    },
  };
  next = setExpansion(next, {
    ...eco,
    policyEvaluations: [evaluation, ...eco.policyEvaluations].slice(0, 40),
  });
  return success(
    state,
    `Evaluación de «${policy.title}»: desvío ${deviation}/100.`,
    withLog(
      state,
      next,
      `Evaluación de política: ${policy.title}`,
      evaluation.verdict,
      'economia'
    )
  );
}

export function createNationalPlan(
  state: GameState,
  horizon: PlanHorizon,
  focus: string
): EcosystemActionResult {
  const caps = getPlayerCapabilities(state);
  if (!caps.canDirectMinistriesAndStateAgencies) {
    return fail(state, caps.lockReasons.executiveNational);
  }
  const eco = ensureEcosystem(state, createInitialEcosystemState);
  if (eco.nationalPlans.filter((p) => p.status === 'vigente').length >= 2) {
    return fail(state, 'Ya tenés dos planes vigentes. Archivá uno antes de crear otro.');
  }
  if (eco.nationalPlans.some((p) => p.status === 'vigente' && p.horizonYears === horizon)) {
    return fail(state, 'Ya existe un plan vigente con ese horizonte.');
  }
  const template = PLAN_FOCUS_TEMPLATES.find((t) => t.id === focus);
  if (!template) return fail(state, 'No encontré ese eje de planificación.');
  const costError = canSpend(state, 8);
  if (costError) return fail(state, costError);

  const base = { ...state, macro: state.macro, politicalIndicators: state.politicalIndicators };
  const goals = template.goals.map((goal, index) => {
    const currentValue = readMetric(base, goal.metric);
    return {
      id: `goal_${Date.now()}_${index}`,
      title: goal.title,
      metric: goal.metric,
      currentValue: r2(currentValue),
      targetValue: r2(currentValue + goal.targetOffset),
      unit: goal.unit,
    };
  });
  const plan: NationalPlanState = {
    id: `plan_${Date.now()}`,
    name: `${PLAN_HORIZON_LABELS[horizon]} · ${template.label}`,
    horizonYears: horizon,
    startYear: state.currentYear,
    endYear: state.currentYear + horizon,
    status: 'vigente',
    goals,
    projects: template.projects.map((project, index) => ({
      id: `proj_${Date.now()}_${index}`,
      title: project.title,
      sector: project.sector,
      costBillionsUYU: project.costBillionsUYU,
      totalMonths: project.months,
      remainingMonths: project.months,
      status: 'planificado',
      effectSummary: project.effectSummary,
    })),
    politicalCapitalInvested: 8,
    continuityScore: 70,
    lastProgressNote: 'Plan aprobado y publicado.',
  };
  let next = spend(state, 8);
  next = applyApproval(next, 0.6, 0.3);
  next = setExpansion(next, {
    ...eco,
    nationalPlans: [plan, ...eco.nationalPlans],
  });
  return success(
    state,
    `${plan.name} aprobado con ${goals.length} objetivos y ${plan.projects.length} proyectos.`,
    withLog(
      state,
      next,
      `Nuevo plan nacional: ${template.label}`,
      `Horizonte ${horizon} años (${plan.startYear}-${plan.endYear}). Objetivos: ${goals
        .map((g) => MACRO_METRIC_LABELS[g.metric] ?? g.metric)
        .join(', ')}.`,
      'gobierno'
    )
  );
}

export function fundPlanProject(
  state: GameState,
  planId: string,
  projectId: string
): EcosystemActionResult {
  const caps = getPlayerCapabilities(state);
  if (!caps.canDirectMinistriesAndStateAgencies) {
    return fail(state, caps.lockReasons.executiveNational);
  }
  const eco = ensureEcosystem(state, createInitialEcosystemState);
  const plan = eco.nationalPlans.find((p) => p.id === planId && p.status === 'vigente');
  if (!plan) return fail(state, 'No encontré ese plan vigente.');
  const project = plan.projects.find((p) => p.id === projectId);
  if (!project) return fail(state, 'No encontré ese proyecto.');
  if (project.status !== 'planificado') return fail(state, 'Ese proyecto ya está en marcha.');
  const costError = canSpend(state, 5, 2500000);
  if (costError) return fail(state, costError);

  const nationalPlans = eco.nationalPlans.map((p) =>
    p.id === planId
      ? {
          ...p,
          projects: p.projects.map((proj) =>
            proj.id === projectId
              ? { ...proj, status: 'en_ejecucion' as const, remainingMonths: proj.totalMonths }
              : proj
          ),
          politicalCapitalInvested: p.politicalCapitalInvested + 5,
          lastProgressNote: `Comenzó la ejecución de ${project.title}.`,
        }
      : p
  );
  let next = spend(state, 5, 2500000);
  next = {
    ...next,
    macro: {
      ...next.macro,
      publicInvestmentPctGdp: r2(
        clamp((next.macro.publicInvestmentPctGdp ?? 0) + project.costBillionsUYU * 0.05, 0, 15)
      ),
    },
  };
  next = setExpansion(next, { ...eco, nationalPlans });
  return success(
    state,
    `Proyecto en ejecución: ${project.title} (${project.totalMonths} meses).`,
    withLog(
      state,
      next,
      `Obra iniciada: ${project.title}`,
      `${project.effectSummary} Inversión estimada: ${project.costBillionsUYU.toFixed(1)} mil millones de UYU.`,
      'gobierno'
    )
  );
}

export function launchTransparencyCase(
  state: GameState,
  kind: 'auditoria' | 'investigacion' | 'pedido_informe'
): EcosystemActionResult {
  const eco = ensureEcosystem(state, createInitialEcosystemState);
  const costError = canSpend(state, 3);
  if (costError) return fail(state, costError);

  const matching = TRANSPARENCY_TEMPLATES.filter((t) => t.kind === kind);
  const template = matching.length > 0 ? pick(matching) : pick(TRANSPARENCY_TEMPLATES);
  const playerParty = state.parties.find((p) => p.id === state.player.partyId);
  const transparencyScore = state.partyFinances?.[state.player.partyId]?.transparencyScore ?? 60;
  const severity = r1(
    clamp(template.severity + (60 - transparencyScore) * 0.25 + (Math.random() * 10 - 5), 10, 95)
  );
  const openCases = eco.transparencyCases.filter((c) => c.status !== 'cerrado').length;
  const transparencyCases = [
    {
      id: `transp_${Date.now()}`,
      title: template.title,
      kind,
      area: template.area,
      dateLabel: `${state.currentYear}-${state.currentMonth}`,
      severity,
      status: 'abierto' as const,
      credibilityImpact: 0,
      trustImpact: 0,
      description: template.description,
      monthsOpen: 0,
    },
    ...eco.transparencyCases,
  ].slice(0, 30);
  let next = spend(state, 3);
  next = applyApproval(next, openCases > 0 ? -0.2 : 0.2, 0.1);
  if (playerParty) {
    next = {
      ...next,
      politicalIndicators: {
        ...next.politicalIndicators,
        businessConfidence: r1(
          clamp(next.politicalIndicators.businessConfidence + (openCases > 0 ? -0.4 : 0.6), 0, 100)
        ),
      },
    };
  }
  next = setExpansion(next, { ...eco, transparencyCases });
  return success(
    state,
    `Caso abierto: ${template.title} (severidad ${Math.round(severity)}/100).`,
    withLog(
      state,
      next,
      `Iniciativa de transparencia`,
      template.description,
      'gobierno'
    )
  );
}

export function respondTransparencyCase(
  state: GameState,
  caseId: string,
  strategy: 'transparente' | 'reservada' | 'tecnica'
): EcosystemActionResult {
  const eco = ensureEcosystem(state, createInitialEcosystemState);
  const current = eco.transparencyCases.find(
    (c) => c.id === caseId && c.status !== 'cerrado'
  );
  if (!current) return fail(state, 'No encontré ese caso abierto.');
  const cost =
    strategy === 'transparente'
      ? { cp: 3, funds: 1000000 }
      : strategy === 'tecnica'
      ? { cp: 4, funds: 500000 }
      : { cp: 2, funds: 0 };
  const costError = canSpend(state, cost.cp, cost.funds);
  if (costError) return fail(state, costError);

  const reduction =
    strategy === 'transparente' ? 34 : strategy === 'tecnica' ? 24 : 12;
  const severity = r1(clamp(current.severity - reduction, 0, 100));
  const closed = severity <= 20;
  const credibilityImpact =
    strategy === 'transparente' ? 3 : strategy === 'tecnica' ? 1 : -2;
  const trustImpact =
    strategy === 'transparente' ? 2 : strategy === 'tecnica' ? 0.5 : -1.5;
  const transparencyCases = eco.transparencyCases.map((c) =>
    c.id === caseId
      ? {
          ...c,
          severity,
          status: closed ? ('cerrado' as const) : c.status === 'abierto' ? ('respondido' as const) : c.status,
          credibilityImpact: r1(c.credibilityImpact + credibilityImpact),
          trustImpact: r1(c.trustImpact + trustImpact),
          responseNote:
            strategy === 'transparente'
              ? 'El gobierno publicó la información y respondió ante los medios.'
              : strategy === 'tecnica'
              ? 'Se presentó un informe técnico con cronograma de cumplimiento.'
              : 'La respuesta fue reservada y generó nuevas críticas.',
        }
      : c
  );
  let next = spend(state, cost.cp, cost.funds);
  next = applyApproval(
    next,
    closed ? (strategy === 'transparente' ? 0.8 : 0.3) : strategy === 'reservada' ? -0.6 : -0.1,
    strategy === 'reservada' ? -0.5 : 0.2
  );
  next = {
    ...next,
    politicalIndicators: {
      ...next.politicalIndicators,
      businessConfidence: r1(
        clamp(next.politicalIndicators.businessConfidence + (closed ? 1.2 : -0.2), 0, 100)
      ),
    },
  };
  next = setExpansion(next, { ...eco, transparencyCases });
  return success(
    state,
    closed
      ? `Caso cerrado: ${current.title}.`
      : `Severidad reducida a ${Math.round(severity)}/100; el caso sigue abierto.`,
    withLog(
      state,
      next,
      `Respuesta a caso de transparencia`,
      `${current.title}. Estrategia ${strategy}. Severidad ${Math.round(severity)}/100.`,
      'gobierno'
    )
  );
}
