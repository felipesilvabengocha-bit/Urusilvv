import { FOREIGN_NEGOTIATION_LABELS, TRANSPARENCY_TEMPLATES } from '../data/expansionData';
import type {
  AdvisorState,
  CabinetCrisisKind,
  DebateKind,
  DebateSessionState,
  InstitutionalControlKind,
  MediaNewsState,
  NewsTone,
  PoliticalEcosystemState,
} from '../types/expansion';
import type { ActivePublicPolicy, GameState, PolicyMacroEffect } from '../types/game';
import { getPlayerCapabilities } from './capabilitiesEngine';
import { createInitialEcosystemState } from './ecosystemFactory';
import {
  buildDepartmentPoll,
  buildSegmentPoll,
  clamp,
  ensureEcosystem,
  getPlayerParty,
  ideologyAlignment,
  pick,
  postureFor,
  r1,
  r2,
  readMetric,
  metricMet,
  weightedPick,
} from './ecosystemShared';

const CRISIS_DESCRIPTIONS: Record<CabinetCrisisKind, string> = {
  renuncia: 'El titular presentó su renuncia por diferencias con la conducción política.',
  conflicto: 'Dos ministerios chocan por competencias y filtran la disputa a la prensa.',
  error_gestion: 'Un error de gestión en una repartición pública generó costos y críticas.',
  escandalo: 'Una denuncia periodística salpica al ministerio y exige una respuesta rápida.',
};

const CONTROL_DESCRIPTIONS: Record<InstitutionalControlKind, string> = {
  constitucionalidad: 'Se cuestiona la constitucionalidad de una medida vigente.',
  competencia: 'Un organismo reclama competencias que el Poder Ejecutivo ejerció.',
  pedido_informe: 'La oposición exige información detallada sobre la ejecución de la medida.',
  auditoria_legal: 'El Tribunal de Cuentas observa el procedimiento administrativo.',
};

function deviationScore(expected: PolicyMacroEffect, observed: PolicyMacroEffect): number {
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

function buildHeadline(tone: NewsTone, state: GameState, outletName: string): string {
  const player = state.player.name;
  if (tone === 'positiva') {
    return pick([
      `${player} recupera la iniciativa política`,
      `El oficialismo muestra señales de estabilidad`,
      `Baja la tensión y mejora la expectativa económica`,
      `La gestión suma respaldos en el Parlamento`,
    ]);
  }
  if (tone === 'negativa') {
    return pick([
      `Crece la preocupación por la inflación y el empleo`,
      `La oposición cuestiona la conducción del gobierno`,
      `Nuevo roce interno complica la agenda oficial`,
      `La calle vuelve a marcar el ritmo político`,
    ]);
  }
  return pick([
    `${outletName} analiza el nuevo escenario político`,
    `La agenda pública se reordena tras la última encuesta`,
    `El Parlamento retoma el debate presupuestal`,
    `Expectativa por el próximo movimiento del gobierno`,
  ]);
}

function buildDebate(state: GameState): DebateSessionState {
  const kind: DebateKind =
    state.player.targetOffice === 'presidente'
      ? 'presidencial'
      : state.player.targetOffice === 'senador' || state.player.targetOffice === 'diputado'
      ? 'parlamentario'
      : 'departamental';
  const rivals = state.parties
    .filter((p) => p.id !== state.player.partyId)
    .sort((a, b) => b.currentPollShare - a.currentPollShare)
    .slice(0, kind === 'presidencial' ? 2 : 3)
    .map((p) => p.sectors[0]?.leader ?? p.acronym);
  return {
    id: `debate_${state.currentYear}_${kind}_${Date.now()}`,
    dateLabel: `Debate ${kind}`,
    kind,
    status: 'programado',
    scheduledYear: state.currentYear,
    scheduledMonth: state.currentMonth,
    opponentNames: rivals,
    currentQuestionIndex: 0,
    answers: [],
    score: 0,
    pollImpact: 0,
    approvalImpact: 0,
    reputationImpact: 0,
  };
}

export function stepMonthlyEcosystem(state: GameState, dateLabel: string): GameState {
  const eco = ensureEcosystem(state, createInitialEcosystemState);
  const playerParty = getPlayerParty(state);
  if (!playerParty) return { ...state, expansion: eco };
  const caps = getPlayerCapabilities(state);

  let macro = { ...state.macro };
  let indicators = { ...state.politicalIndicators };
  let player = { ...state.player, attributes: { ...state.player.attributes } };
  let parties = state.parties.map((p) => ({ ...p }));
  let cabinet = state.cabinet.map((c) => ({ ...c }));
  let departments = state.departments.map((d) => ({ ...d }));
  let activePolicies = (state.activePolicies ?? []).map((p) => ({ ...p }));
  let bills = state.bills.map((b) => ({ ...b }));
  let coalitionPromised = { ...(state.coalitionPromisedMinistries ?? {}) };
  let socialActors = (state.socialActors ?? []).map((a) => ({ ...a }));
  let diplomacy = state.diplomacy.map((d) => ({ ...d }));

  const notes: string[] = [];
  const logs: GameState['history'] = [];
  const log = (
    title: string,
    detail: string,
    category: GameState['history'][number]['category'] = 'gobierno'
  ) => {
    logs.push({
      id: `eco_m_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
      dateLabel,
      category,
      title,
      detail,
    });
  };

  let approvalDelta = 0;
  let popularityDelta = 0;
  let stabilityDelta = 0;
  let businessDelta = 0;
  let unionDelta = 0;
  let partyStrengthDelta = 0;
  let fiscalDelta = 0;
  let gdpDelta = 0;
  let inflationDelta = 0;
  let unemploymentDelta = 0;
  let povertyDelta = 0;
  let productivityDelta = 0;

  /* 3. ASESORES · salarios, lealtad, renuncias y efectos reales */
  const hiredBefore = eco.advisors.filter((a) => a.status === 'contratado');
  const totalSalary = hiredBefore.reduce((sum, a) => sum + a.salaryMonthlyUYU, 0);
  const canPay = state.player.campaignFundsUYU >= totalSalary;
  let funds = state.player.campaignFundsUYU - totalSalary;
  if (totalSalary > 0 && !canPay) {
    funds = 0;
    notes.push('No alcanzaron los fondos para pagar a todo el equipo.');
  }
  let advisors = eco.advisors.map((advisor) => {
    if (advisor.status !== 'contratado') return advisor;
    let loyalty = clamp(advisor.loyalty + (canPay ? 0.4 : -6), 0, 100);
    let status: AdvisorState['status'] = advisor.status;
    if (loyalty < 32 && Math.random() < 0.16) {
      status = 'renuncio';
      notes.push(`${advisor.name} renunció al equipo.`);
      log(`Renuncia de asesor`, `${advisor.name} (${advisor.roleLabel}) dejó el equipo por diferencias y falta de pago.`, 'gobierno');
    }
    return { ...advisor, loyalty: r1(loyalty), status };
  });
  const capOf = (role: string) =>
    advisors
      .filter((a) => a.status === 'contratado' && a.role === role)
      .reduce((sum, a) => sum + a.capacity, 0);

  approvalDelta += capOf('comunicacion') * 0.0018;
  popularityDelta += capOf('comunicacion') * 0.0015;
  stabilityDelta += capOf('negociacion') * 0.0022;
  fiscalDelta -= capOf('economia') * 0.00035;
  productivityDelta += capOf('economia') * 0.001;
  businessDelta += capOf('legal') * 0.0012;
  const territoryCapacity = capOf('territorio');
  if (territoryCapacity > 0) {
    departments = departments.map((d) =>
      d.id === state.player.targetDepartment
        ? {
            ...d,
            localServiceQuality: r1(clamp(d.localServiceQuality + territoryCapacity * 0.003, 0, 100)),
          }
        : d
    );
  }
  if (caps.isCampaigning) {
    popularityDelta += capOf('campana') * 0.0015;
    parties = parties.map((p) =>
      p.id === playerParty.id
        ? {
            ...p,
            campaignMomentum: r1(clamp(p.campaignMomentum + capOf('campana') * 0.002, -15, 15)),
          }
        : p
    );
  }

  /* 1. FACCIONES · lealtad, disputa interna y apoyo/obstrucción */
  let factions = eco.factions.map((faction) => {
    if (faction.partyId !== playerParty.id) {
      return {
        ...faction,
        influence: r1(clamp(faction.influence + (Math.random() - 0.5) * 1.2, 3, 100)),
      };
    }
    const alignment = ideologyAlignment(faction.ideology, player.ideology);
    const targetLoyalty = clamp(
      36 +
        alignment * 0.44 +
        (indicators.governmentApproval - 45) * 0.18 +
        (state.player.currentOffice === 'presidente' ? 5 : 0) +
        faction.demandsMet * 2,
      12,
      94
    );
    const loyalty = clamp(faction.loyalty + (targetLoyalty - faction.loyalty) * 0.22, 5, 98);
    const mood = clamp(faction.mood + (targetLoyalty - faction.mood) * 0.18, 5, 98);
    const influence = clamp(faction.influence + (Math.random() - 0.5) * 2, 3, 100);
    return {
      ...faction,
      loyalty: r1(loyalty),
      mood: r1(mood),
      influence: r1(influence),
      posture: postureFor(loyalty),
    };
  });
  const playerFactions = factions.filter((f) => f.partyId === playerParty.id);
  const obstructing = playerFactions.filter((f) => f.posture === 'obstruccion');
  const backing = playerFactions.filter((f) => f.posture === 'apoyo');
  stabilityDelta += backing.length * 0.25 - obstructing.length * 0.45;
  partyStrengthDelta += backing.length * 0.15 - obstructing.length * 0.2;
  if (obstructing.length > 0) {
    notes.push(`${obstructing.length} sector(es) del partido obstruyen la conducción.`);
  }

  let challenges = eco.challenges.map((c) =>
    c.status === 'abierta' ? { ...c, monthsOpen: c.monthsOpen + 1 } : c
  );
  const hasOpenChallenge = challenges.some(
    (c) => c.partyId === playerParty.id && c.status === 'abierta'
  );
  if (!hasOpenChallenge && playerFactions.length > 0) {
    const avgLoyalty =
      playerFactions.reduce((sum, f) => sum + f.loyalty, 0) / playerFactions.length;
    const strongest = [...playerFactions].sort((a, b) => b.influence - a.influence)[0];
    if (avgLoyalty < 46 && strongest.influence > 45 && Math.random() < 0.14) {
      const support = clamp(100 - avgLoyalty + (Math.random() * 14 - 7), 25, 78);
      challenges.push({
        id: `challenge_${Date.now()}`,
        partyId: playerParty.id,
        factionId: strongest.id,
        factionName: strongest.shortName,
        challengerName: strongest.leaderName,
        dateLabel,
        internalSupportPct: r1(support),
        monthsOpen: 0,
        status: 'abierta',
      });
      notes.push(`Desafío interno de ${strongest.shortName}.`);
      log(
        `Desafío interno en ${playerParty.acronym}`,
        `${strongest.leaderName} cuestiona la conducción con ${support.toFixed(0)}% de apoyo interno.`,
        'politica'
      );
    }
  }
  challenges = challenges.map((challenge) => {
    if (challenge.status !== 'abierta' || challenge.monthsOpen < 3) return challenge;
    if (challenge.internalSupportPct >= 55) {
      approvalDelta -= 2;
      stabilityDelta -= 3;
      partyStrengthDelta -= 5;
      factions = factions.map((f) =>
        f.partyId === challenge.partyId
          ? { ...f, loyalty: r1(clamp(f.loyalty - 8, 0, 100)) }
          : f
      );
      log(
        `La conducción partidaria quedó debilitada`,
        `El desafío de ${challenge.factionName} prosperó y limitó la autoridad interna.`,
        'politica'
      );
      return {
        ...challenge,
        status: 'resuelta',
        resolutionNote: 'El desafío prosperó y limitó la conducción del partido.',
      };
    }
    partyStrengthDelta += 1;
    log(
      `Desafío interno superado`,
      `La conducción de ${playerParty.acronym} quedó ratificada frente a ${challenge.factionName}.`,
      'politica'
    );
    return {
      ...challenge,
      status: 'derrotada',
      resolutionNote: 'El desafío no prosperó; la conducción quedó ratificada.',
    };
  });

  /* 4. MEDIOS · cobertura automática y afinidad editorial */
  let outlets = eco.mediaOutlets.map((outlet) => {
    const target = clamp(
      55 - Math.abs(outlet.editorialLine - (state.player.ideology.economic - 50)) * 0.35,
      5,
      95
    );
    return {
      ...outlet,
      affinity: r1(clamp(outlet.affinity + (target - outlet.affinity) * 0.08, 5, 95)),
    };
  });
  let mediaNews = [...eco.mediaNews];
  const scandalOpen = eco.transparencyCases.some((c) => c.status !== 'cerrado');
  const outlet = weightedPick(outlets, (o) => o.audiencePct);
  const toneScore =
    indicators.governmentApproval +
    (outlet.affinity - 50) * 0.25 +
    (Math.random() * 30 - 15) -
    (scandalOpen ? 12 : 0);
  const tone: NewsTone = toneScore >= 58 ? 'positiva' : toneScore <= 42 ? 'negativa' : 'neutra';
  const weight = (outlet.audiencePct / 100) * (outlet.credibility / 100);
  const impact = tone === 'positiva' ? 1 : tone === 'negativa' ? -1 : 0;
  approvalDelta += impact * weight * 1.4;
  popularityDelta += impact * weight * 1.6;
  const news: MediaNewsState = {
    id: `news_${Date.now()}`,
    dateLabel,
    outletId: outlet.id,
    outletName: outlet.name,
    headline: buildHeadline(tone, state, outlet.name),
    tone,
    impact,
    topic: tone === 'positiva' ? 'Gestión' : tone === 'negativa' ? 'Crisis' : 'Agenda',
  };
  mediaNews = [news, ...mediaNews].slice(0, 12);
  outlets = outlets.map((o) =>
    o.id === outlet.id
      ? {
          ...o,
          affinity: r1(clamp(o.affinity + impact * 2, 5, 95)),
          lastCoverageDateLabel: dateLabel,
        }
      : o
  );

  /* 5. DEBATES · programación automática del calendario */
  let debates = eco.debates.map((d) => ({ ...d }));
  if (
    state.careerPhase === 'campana' &&
    state.currentMonth >= 8 &&
    state.currentMonth <= 10 &&
    !debates.some((d) => d.scheduledYear === state.currentYear)
  ) {
    debates.push(buildDebate(state));
  }
  debates = debates.map((debate) => {
    if (
      debate.status === 'programado' &&
      (state.currentYear > debate.scheduledYear ||
        (state.currentYear === debate.scheduledYear &&
          state.currentMonth > debate.scheduledMonth + 1))
    ) {
      return {
        ...debate,
        status: 'finalizado',
        summary: 'El debate se realizó sin tu participación.',
      };
    }
    return debate;
  });

  /* 6. OPINIÓN PÚBLICA · segmentos sociales, etarios y territoriales */
  let segments = eco.opinionSegments.map((segment) => {
    const macroMood =
      (macro.gdpGrowthPct - 2) * 2 -
      Math.max(0, macro.inflationPct - 6) * 1.6 -
      Math.max(0, macro.unemploymentPct - 8) * 1.6 +
      macro.realWageGrowthPct * 1.2 -
      Math.max(0, macro.povertyPct - 10) * 0.25;
    const targetApproval = clamp(
      45 + macroMood * segment.economicSensitivity * 0.8 + (indicators.governmentApproval - 50) * 0.35,
      5,
      95
    );
    const targetAffinity = clamp(
      player.attributes.popularity +
        (caps.isInNationalOpposition ? 0 : (indicators.governmentApproval - 50) * 0.3) +
        segment.territorialBias * 2,
      5,
      95
    );
    return {
      ...segment,
      governmentApproval: r1(
        segment.governmentApproval + (targetApproval - segment.governmentApproval) * 0.22
      ),
      playerAffinity: r1(
        segment.playerAffinity + (targetAffinity - segment.playerAffinity) * 0.18
      ),
    };
  });
  const segmentPoll = buildSegmentPoll(
    { ...state, macro, politicalIndicators: indicators, player, parties },
    segments
  );
  const segmentPolls = [...eco.segmentPolls, segmentPoll].slice(-12);
  const segmentWeight =
    segments.reduce((sum, segment) => sum + segment.populationPct, 0) || 1;
  const weightedAffinity =
    segments.reduce((sum, segment) => sum + segment.playerAffinity * segment.populationPct, 0) /
    segmentWeight;
  const weightedApproval =
    segments.reduce((sum, segment) => sum + segment.governmentApproval * segment.populationPct, 0) /
    segmentWeight;
  popularityDelta += (weightedAffinity - player.attributes.popularity) * 0.015;
  approvalDelta += (weightedApproval - macro.governmentApprovalPct) * 0.012;

  const departmentPoll = buildDepartmentPoll({
    ...state,
    macro,
    politicalIndicators: indicators,
    player,
    parties,
    departments,
  });
  const departmentPolls = [...(eco.departmentPolls ?? []), departmentPoll].slice(-12);

  /* 8. CRISIS DE GABINETE */
  let cabinetCrises = eco.cabinetCrises.map((c) =>
    c.status === 'abierta' ? { ...c, monthsOpen: c.monthsOpen + 1 } : c
  );
  const hasOpenCrisis = cabinetCrises.some((c) => c.status === 'abierta');
  const activeMinisters = cabinet.filter((m) => !m.isVacant);
  if (!hasOpenCrisis && activeMinisters.length > 0) {
    const avgLoyalty =
      activeMinisters.reduce((sum, m) => sum + m.loyalty, 0) / activeMinisters.length;
    const vulnerable = activeMinisters.filter((m) => m.management < 48 || m.loyalty < 45);
    const chance =
      0.03 +
      Math.max(0, 52 - avgLoyalty) * 0.002 +
      Math.max(0, 45 - indicators.governmentApproval) * 0.002 +
      (vulnerable.length > 0 ? 0.015 : 0);
    if (Math.random() < chance) {
      const target = vulnerable.length > 0 ? pick(vulnerable) : pick(activeMinisters);
      const kind = pick<CabinetCrisisKind>(['renuncia', 'conflicto', 'error_gestion', 'escandalo']);
      const severity = r1(clamp(35 + Math.random() * 50, 20, 95));
      cabinetCrises.push({
        id: `crisis_${Date.now()}`,
        ministerId: target.id,
        ministerName: target.holderName,
        ministryCode: target.ministryCode,
        ministryName: target.ministryName,
        kind,
        severity,
        dateLabel,
        status: 'abierta',
        description: CRISIS_DESCRIPTIONS[kind],
        monthsOpen: 0,
      });
      notes.push(`Crisis de gabinete en ${target.ministryName}.`);
      log(`Crisis de gabinete: ${target.ministryName}`, CRISIS_DESCRIPTIONS[kind], 'gobierno');
    }
  }
  cabinetCrises = cabinetCrises.map((crisis) => {
    if (crisis.status !== 'abierta' || crisis.monthsOpen < 3) return crisis;
    cabinet = cabinet.map((m) =>
      m.id === crisis.ministerId ? { ...m, isVacant: true, holderName: 'Vacante' } : m
    );
    approvalDelta -= 2;
    stabilityDelta -= 5;
    businessDelta -= 2;
    notes.push(`Renuncia en ${crisis.ministryName} por crisis no resuelta.`);
    log(
      `Renuncia en ${crisis.ministryName}`,
      'La crisis de gabinete terminó con la salida del ministro y un costo de estabilidad.',
      'gobierno'
    );
    return {
      ...crisis,
      status: 'resuelta',
      resolutionNote: 'El ministro terminó renunciando.',
    };
  });

  /* 9. CONTROL INSTITUCIONAL */
  let controls = eco.institutionalControls.map((c) =>
    c.status === 'abierto' ? { ...c, monthsOpen: c.monthsOpen + 1 } : c
  );
  const openControls = controls.filter((c) => c.status === 'abierto');
  const openTransparency = eco.transparencyCases.filter((c) => c.status !== 'cerrado');
  if (openControls.length < 2 && activePolicies.length > 0) {
    const credibility = state.opposition?.credibility ?? 50;
    const chance =
      0.035 + Math.max(0, credibility - 55) * 0.002 + openTransparency.length * 0.01;
    if (Math.random() < chance) {
      const target = pick(activePolicies);
      const kind = pick<InstitutionalControlKind>([
        'constitucionalidad',
        'competencia',
        'pedido_informe',
        'auditoria_legal',
      ]);
      controls.push({
        id: `control_${Date.now()}`,
        targetType: 'politica',
        targetId: target.id,
        targetTitle: target.title,
        kind,
        filedBy: 'oposicion',
        dateLabel,
        status: 'abierto',
        riskScore: r1(clamp(35 + Math.random() * 45, 10, 95)),
        description: CONTROL_DESCRIPTIONS[kind],
        monthsOpen: 0,
      });
      notes.push(`Control institucional sobre «${target.title}».`);
      log(`Control institucional`, `${CONTROL_DESCRIPTIONS[kind]} (${target.title})`, 'parlamento');
    }
  }
  approvalDelta -= openControls.length * 0.12;
  businessDelta -= openControls.length * 0.25;
  controls = controls.map((control) => {
    if (control.status !== 'abierto' || control.monthsOpen < 4) return control;
    if (control.riskScore > 60) {
      activePolicies = activePolicies.map((p) =>
        p.id === control.targetId ? { ...p, status: 'bloqueada' as const } : p
      );
      approvalDelta -= 1.5;
      businessDelta -= 2;
      notes.push(`La medida «${control.targetTitle}» quedó suspendida.`);
      log(
        `Control institucional prosperó`,
        `La medida «${control.targetTitle}» quedó suspendida por riesgo jurídico.`,
        'parlamento'
      );
      return {
        ...control,
        status: 'resuelto',
        resolutionNote: 'El control prosperó y la medida quedó suspendida.',
      };
    }
    businessDelta += 0.5;
    return {
      ...control,
      status: 'resuelto',
      resolutionNote: 'El órgano de control rechazó la impugnación.',
    };
  });

  /* 10. EVALUACIÓN DE POLÍTICAS · seguimiento posterior */
  let evaluations = [...eco.policyEvaluations];
  let postEvaluationsThisMonth = 0;
  for (const policy of activePolicies) {
    if (policy.activeMonths < 6 || postEvaluationsThisMonth >= 2) continue;
    if (evaluations.some((e) => e.policyId === policy.id && e.kind === 'posterior')) continue;
    const observed: PolicyMacroEffect = {
      gdpDelta: policy.observedEffects.gdpImpactAcc,
      inflationDelta: policy.observedEffects.inflationImpactAcc,
      unemploymentDelta: policy.observedEffects.employmentImpactAcc,
      povertyDelta: policy.observedEffects.povertyImpactAcc,
      approvalDelta: policy.observedEffects.approvalImpactAcc,
    };
    const deviation = deviationScore(policy.estimatedEffects, observed);
    evaluations.push({
      id: `eval_post_${policy.id}_${Date.now()}`,
      policyId: policy.id,
      policyTitle: policy.title,
      kind: 'posterior',
      dateLabel,
      estimatedCostPctGdp: policy.estimatedEffects.fiscalCostPctGdp ?? 0,
      estimatedBeneficiaries: policy.beneficiaries,
      estimatedRisk: policy.riskLevel ?? 'medio',
      expectedEffects: { ...policy.estimatedEffects },
      observedEffects: observed,
      deviationScore: deviation,
      verdict:
        deviation <= 18
          ? 'Resultado ajustado a lo previsto.'
          : deviation <= 38
          ? 'Desvío moderado respecto a la evaluación previa.'
          : 'Desvío alto: revisar diseño o ejecución.',
    });
    postEvaluationsThisMonth += 1;
    if (deviation > 40) {
      approvalDelta -= 0.3;
      businessDelta -= 0.5;
      activePolicies = activePolicies.map((p) =>
        p.id === policy.id ? { ...p, riskLevel: 'alto' as const } : p
      );
      notes.push(`Evaluación adversa: «${policy.title}» pasó a riesgo alto.`);
    }
    log(
      `Evaluación posterior: ${policy.title}`,
      `Desvío ${deviation}/100. ${policy.beneficiaries}.`,
      'economia'
    );
  }

  /* 11. PLANIFICACIÓN NACIONAL · proyectos y objetivos de largo plazo */
  let plans = eco.nationalPlans.map((plan) => {
    if (plan.status !== 'vigente') return plan;
    const planProjects = plan.projects.map((project) => {
      if (project.status !== 'en_ejecucion') return project;
      const remaining = project.remainingMonths - 1;
      if (remaining <= 0) {
        gdpDelta += 0.03;
        productivityDelta += 0.25;
        unemploymentDelta -= 0.03;
        departments = departments.map((d) =>
          d.id === state.player.targetDepartment
            ? {
                ...d,
                infrastructureScore: r1(
                  clamp((d.infrastructureScore ?? d.localServiceQuality) + 1.5, 0, 100)
                ),
                localServiceQuality: r1(clamp(d.localServiceQuality + 1.2, 0, 100)),
              }
            : d
        );
        log(`Obra concluida: ${project.title}`, project.effectSummary, 'gobierno');
        return { ...project, remainingMonths: 0, status: 'completado' as const };
      }
      return { ...project, remainingMonths: remaining };
    });
    const goals = plan.goals.map((goal) => ({
      ...goal,
      currentValue: r2(
        readMetric({ ...state, macro, politicalIndicators: indicators }, goal.metric)
      ),
    }));
    if (goals.every(metricMet)) {
      approvalDelta += 2;
      partyStrengthDelta += 2;
      notes.push(`Plan cumplido: ${plan.name}.`);
      log(`Plan nacional cumplido`, `${plan.name} alcanzó sus objetivos.`, 'gobierno');
      return {
        ...plan,
        goals,
        projects: planProjects,
        status: 'cumplido' as const,
        lastProgressNote: 'Objetivos cumplidos.',
      };
    }
    return {
      ...plan,
      goals,
      projects: planProjects,
      continuityScore: r1(
        clamp(
          plan.continuityScore +
            (state.nationalPresidentPartyId === playerParty.id ? 0.3 : -0.1),
          0,
          100
        )
      ),
    };
  });

  /* 12. TRANSPARENCIA E INVESTIGACIONES */
  let transparency = eco.transparencyCases.map((c) =>
    c.status === 'abierto' || c.status === 'respondido'
      ? { ...c, monthsOpen: c.monthsOpen + 1 }
      : c
  );
  const openCases = transparency.filter((c) => c.status !== 'cerrado');
  approvalDelta -= openCases.length * 0.15;
  popularityDelta -= openCases.length * 0.12;
  businessDelta -= openCases.length * 0.2;
  if (openCases.length < 2) {
    const transparencyScore = state.partyFinances?.[playerParty.id]?.transparencyScore ?? 60;
    const chance =
      0.025 +
      Math.max(0, 60 - transparencyScore) * 0.002 +
      (indicators.governmentApproval < 45 ? 0.02 : 0);
    if (Math.random() < chance) {
      const template = pick(TRANSPARENCY_TEMPLATES);
      transparency.push({
        id: `transp_${Date.now()}`,
        title: template.title,
        kind: template.kind,
        area: template.area,
        dateLabel,
        severity: template.severity,
        status: 'abierto',
        credibilityImpact: 0,
        trustImpact: 0,
        description: template.description,
        monthsOpen: 0,
      });
      notes.push(`Nuevo caso de transparencia: ${template.title}.`);
      log(`Caso de transparencia`, template.description, 'evento');
    }
  }
  transparency = transparency.map((c) => {
    if ((c.status !== 'abierto' && c.status !== 'respondido') || c.monthsOpen < 3) return c;
    approvalDelta -= 1.2;
    popularityDelta -= 0.8;
    businessDelta -= 1.5;
    notes.push(`El caso «${c.title}» escaló.`);
    log(`Escaló el caso de transparencia`, c.title, 'evento');
    return {
      ...c,
      status: 'escalado' as const,
      responseNote: 'El caso escaló por falta de respuesta.',
    };
  });

  /* 2. NEGOCIACIONES · cumplimiento, incumplimiento y ruptura */
  let negotiations = eco.negotiations.map((negotiation) => {
    if (negotiation.status !== 'aceptada') return negotiation;
    let compliance = negotiation.compliance;
    if (negotiation.kind === 'cargos') {
      const actual = cabinet.filter(
        (m) => !m.isVacant && m.partyId === negotiation.partyId
      ).length;
      compliance += actual >= negotiation.demandedMinistries ? 3 : -8;
    } else if (negotiation.kind === 'programa') {
      compliance += state.governmentPriorities.includes(negotiation.demandedPolicy) ? 4 : -6;
    } else {
      compliance -= 1;
    }
    compliance = clamp(compliance, 0, 100);
    const months = negotiation.monthsRemaining - 1;
    if (compliance < 40 && Math.random() < 0.22) {
      delete coalitionPromised[negotiation.partyId];
      parties = parties.map((p) =>
        p.id === negotiation.partyId
          ? { ...p, currentPollShare: r1(clamp(p.currentPollShare + 0.4, 0, 70)) }
          : p
      );
      player = {
        ...player,
        relations: player.relations.map((rel) =>
          rel.partyId === negotiation.partyId
            ? { ...rel, affinity: clamp(rel.affinity - 12, -100, 100) }
            : rel
        ),
      };
      stabilityDelta -= 4;
      approvalDelta -= 0.5;
      notes.push(`Se rompió el acuerdo con ${negotiation.partyName}.`);
      log(
        `Ruptura de acuerdo`,
        `${negotiation.partyName} abandonó el entendimiento por incumplimiento.`,
        'politica'
      );
      return { ...negotiation, compliance, monthsRemaining: Math.max(0, months), status: 'rota' as const };
    }
    if (months <= 0) {
      approvalDelta += 0.5;
      stabilityDelta += 2;
      notes.push(`Acuerdo cumplido con ${negotiation.partyName}.`);
      return { ...negotiation, compliance, monthsRemaining: 0, status: 'cumplida' as const };
    }
    return { ...negotiation, compliance, monthsRemaining: months };
  });

  /* 7. ORGANIZACIONES SOCIALES · confianza, conflicto y movilización */
  socialActors = socialActors.map((actor) => {
    const currentTrust = actor.governmentTrust ?? 50;
    const targetTrust = clamp(
      50 + (actor.politicalAffinity ?? 0) * 0.25 + (indicators.governmentApproval - 50) * 0.2,
      10,
      90
    );
    let trust = clamp(currentTrust + (targetTrust - currentTrust) * 0.08, 5, 95);
    let conflict = clamp(
      (actor.conflictLevel ?? 20) + (50 - trust) * 0.03 + (Math.random() * 4 - 2),
      0,
      100
    );
    let agreement = actor.activeAgreement;
    if (agreement?.monthsRemaining) {
      const months = agreement.monthsRemaining - 1;
      if (months <= 0) {
        trust = clamp(trust + 4, 5, 95);
        conflict = clamp(conflict - 6, 0, 100);
        agreement = { ...agreement, monthsRemaining: 0, fulfilled: true };
      } else {
        agreement = { ...agreement, monthsRemaining: months };
      }
    }
    if (conflict > 70) {
      approvalDelta -= 0.4;
      gdpDelta -= 0.01;
      unionDelta -= 1;
      notes.push(`Movilización de ${actor.name}.`);
      log(
        `Movilización social`,
        `${actor.name} se moviliza por sus demandas y presiona la agenda.`,
        'sociedad'
      );
      return {
        ...actor,
        governmentTrust: r1(trust),
        conflictLevel: r1(conflict),
        activeAgreement: agreement,
        lastMobilizationDateLabel: dateLabel,
        mobilizationCapacity: actor.mobilizationCapacity ?? actor.pressureCapacity,
      };
    }
    return {
      ...actor,
      governmentTrust: r1(trust),
      conflictLevel: r1(conflict),
      activeAgreement: agreement,
      mobilizationCapacity: actor.mobilizationCapacity ?? actor.pressureCapacity,
    };
  });

  /* 13. INTENDENCIAS · relación política individual con las 19 */
  let intendencies = eco.intendencyRelations.map((relation) => {
    const pollEntry = departmentPoll.departments.find(
      (entry) => entry.departmentId === relation.departmentId
    );
    const pollingBonus = pollEntry
      ? pollEntry.leadingPartyId === state.player.partyId
        ? 3
        : pollEntry.playerPartyPct < 15
        ? -3
        : 0
      : 0;
    const baseTarget =
      relation.partyId === state.nationalPresidentPartyId
        ? 70
        : state.coalitionPartyIds.includes(relation.partyId)
        ? 58
        : 35;
    const target = clamp(baseTarget + pollingBonus, 20, 85);
    let score = clamp(relation.relationScore + (target - relation.relationScore) * 0.08, -100, 100);
    let agreement = relation.agreement;
    if (agreement?.active) {
      const months = agreement.monthsRemaining - 1;
      if (months <= 0) {
        score = clamp(score + 4, -100, 100);
        agreement = { ...agreement, active: false, monthsRemaining: 0 };
        departments = departments.map((d) =>
          d.id === relation.departmentId
            ? { ...d, localServiceQuality: r1(clamp(d.localServiceQuality + 1, 0, 100)) }
            : d
        );
        notes.push(`Convenio cumplido con ${relation.departmentName}.`);
      } else {
        agreement = { ...agreement, monthsRemaining: months };
      }
    }
    const conflict = clamp(100 - (score + 100) / 2 + (Math.random() * 10 - 5), 0, 100);
    if (score < 20) {
      departments = departments.map((d) =>
        d.id === relation.departmentId
          ? { ...d, localServiceQuality: r1(clamp(d.localServiceQuality - 0.3, 0, 100)) }
          : d
      );
      approvalDelta -= 0.03;
    }
    return {
      ...relation,
      relationScore: r1(score),
      conflictLevel: r1(conflict),
      agreement,
    };
  });

  /* 14. POLÍTICA EXTERIOR · negociaciones, Mercosur y relaciones */
  let foreignNegotiations = eco.foreignNegotiations.map((negotiation) => {
    if (negotiation.status !== 'en_curso') return negotiation;
    const months = negotiation.monthsRemaining - 1;
    if (months > 0) return { ...negotiation, monthsRemaining: months };
    const partner = diplomacy.find((d) => d.id === negotiation.partnerId);
    const successChance = clamp(
      35 +
        (partner?.relationScore ?? 50) * 0.4 +
        capOf('negociacion') * 0.15 +
        (eco.mercosurIntegration - 50) * 0.1,
      20,
      90
    );
    if (Math.random() * 100 < successChance) {
      diplomacy = diplomacy.map((d) =>
        d.id === negotiation.partnerId
          ? {
              ...d,
              relationScore: clamp(d.relationScore + negotiation.relationDelta, 0, 100),
              tradeVolumeBillionsUSD: r2(
                d.tradeVolumeBillionsUSD * (1 + negotiation.tradeDelta / 100)
              ),
              investmentFlowScore: clamp(d.investmentFlowScore + 2, 0, 100),
              activeAgreement: negotiation.title,
            }
          : d
      );
      approvalDelta += negotiation.approvalEffect;
      if (negotiation.kind === 'comercial') {
        macro = {
          ...macro,
          exportsBillionsUSD: r2(macro.exportsBillionsUSD * 1.008),
        };
        gdpDelta += 0.03;
      }
      notes.push(`${negotiation.title} firmado con ${negotiation.partnerName}.`);
      log(
        `Acuerdo internacional firmado`,
        `${negotiation.title} con ${negotiation.partnerName}. ${negotiation.expectedBenefit}`,
        'diplomacia'
      );
      return { ...negotiation, status: 'firmado' as const, monthsRemaining: 0 };
    }
    diplomacy = diplomacy.map((d) =>
      d.id === negotiation.partnerId
        ? { ...d, relationScore: clamp(d.relationScore - 4, 0, 100) }
        : d
    );
    notes.push(`Fracasó la negociación con ${negotiation.partnerName}.`);
    log(
      `Negociación internacional fracasada`,
      `No se alcanzó un acuerdo con ${negotiation.partnerName}.`,
      'diplomacia'
    );
    return { ...negotiation, status: 'fracasado' as const, monthsRemaining: 0 };
  });
  diplomacy = diplomacy.map((d) => ({
    ...d,
    relationScore: r1(
      clamp(d.relationScore + (50 - d.relationScore) * 0.02 + (Math.random() * 2 - 1), 0, 100)
    ),
  }));
  const avgRelation =
    diplomacy.reduce((sum, d) => sum + d.relationScore, 0) / Math.max(1, diplomacy.length);
  const mercosurIntegration = r1(
    clamp(eco.mercosurIntegration + (avgRelation - 50) * 0.02, 0, 100)
  );

  /* Aplicación consolidada de efectos */
  macro = {
    ...macro,
    gdpGrowthPct: r2(clamp(macro.gdpGrowthPct + gdpDelta, -8, 10)),
    inflationPct: r2(clamp(macro.inflationPct + inflationDelta, 1.5, 30)),
    unemploymentPct: r2(clamp(macro.unemploymentPct + unemploymentDelta, 3, 25)),
    povertyPct: r2(clamp(macro.povertyPct + povertyDelta, 3, 45)),
    fiscalDeficitPctGdp: r2(clamp(macro.fiscalDeficitPctGdp + fiscalDelta, 0, 10)),
    productivityIndex: r2(clamp(macro.productivityIndex + productivityDelta, 60, 140)),
    governmentApprovalPct: r1(clamp(macro.governmentApprovalPct + approvalDelta, 10, 88)),
  };
  const nextApproval = macro.governmentApprovalPct;
  const nextPopularity = r1(
    clamp(player.attributes.popularity + popularityDelta, 8, 95)
  );
  indicators = {
    ...indicators,
    governmentApproval: nextApproval,
    presidentialPopularity: r1(clamp(indicators.presidentialPopularity + popularityDelta * 0.6, 8, 95)),
    coalitionStability: r1(clamp(indicators.coalitionStability + stabilityDelta, 12, 98)),
    businessConfidence: r1(clamp(indicators.businessConfidence + businessDelta, 5, 98)),
    unionConfidence: r1(clamp(indicators.unionConfidence + unionDelta, 5, 98)),
    partyStrength: r1(clamp(indicators.partyStrength + partyStrengthDelta, 5, 100)),
    publicOpinionIndex: Math.round((nextApproval + nextPopularity) / 2),
  };
  player = {
    ...player,
    campaignFundsUYU: Math.max(0, Math.round(funds)),
    attributes: { ...player.attributes, popularity: nextPopularity },
  };

  const nextExpansion: PoliticalEcosystemState = {
    ...eco,
    factions,
    challenges,
    advisors,
    mediaOutlets: outlets,
    mediaNews,
    debates,
    opinionSegments: segments,
    segmentPolls,
    departmentPolls,
    cabinetCrises,
    institutionalControls: controls,
    policyEvaluations: evaluations,
    nationalPlans: plans,
    transparencyCases: transparency,
    intendencyRelations: intendencies,
    negotiations,
    foreignNegotiations,
    mercosurIntegration,
    lastMonthlyNotes: notes.slice(0, 8),
  };

  return {
    ...state,
    macro,
    politicalIndicators: indicators,
    player,
    parties,
    cabinet,
    departments,
    activePolicies,
    bills,
    coalitionPromisedMinistries: coalitionPromised,
    socialActors,
    diplomacy,
    expansion: nextExpansion,
    history: [...logs.slice(0, 8), ...state.history].slice(0, 120),
  };
}
