import { DIFFICULTIES } from '../data/uruguayData';
import type {
  EcosystemActionResult,
  InstitutionalControlKind,
  NegotiationKind,
  PoliticalNegotiationState,
} from '../types/expansion';
import type { GameState } from '../types/game';
import { getPlayerCapabilities } from './capabilitiesEngine';
import { createInitialEcosystemState } from './ecosystemFactory';
import {
  addBillsSupport,
  adjustStability,
  applyApproval,
  canSpend,
  changeRelation,
  clamp,
  ensureEcosystem,
  fail,
  getAdvisorCapacity,
  pick,
  r1,
  setExpansion,
  spend,
  success,
  withLog,
} from './ecosystemShared';

const NEGOTIATION_BENEFITS: Record<NegotiationKind, string> = {
  apoyo_parlamentario: '+0.15 de apoyo por proyecto en trámite.',
  cargos: 'Ministerios y mayor estabilidad de coalición.',
  programa: 'Compromiso programático y respaldo público.',
};

export function startNegotiation(
  state: GameState,
  partyId: string,
  kind: NegotiationKind
): EcosystemActionResult {
  const eco = ensureEcosystem(state, createInitialEcosystemState);
  const party = state.parties.find((p) => p.id === partyId && p.id !== state.player.partyId);
  if (!party) return fail(state, 'No podés negociar con ese partido.');
  const costError = canSpend(state, 4);
  if (costError) return fail(state, costError);

  const difficulty = DIFFICULTIES.find((d) => d.id === state.difficultyId) ?? DIFFICULTIES[2];
  const affinity = state.player.relations.find((r) => r.partyId === partyId)?.affinity ?? 0;
  const chance = clamp(
    25 +
      affinity * 0.45 +
      (state.player.attributes.negotiation - 50) * 0.4 +
      getAdvisorCapacity(state, 'negociacion') * 0.2 -
      difficulty.negotiationPenalty,
    5,
    95
  );

  if (Math.random() * 100 > chance) {
    const next = changeRelation(spend(state, 4), partyId, -2);
    return success(
      state,
      `${party.name} rechazó abrir una mesa formal (${Math.round(chance)}% de probabilidad).`,
      withLog(
        state,
        next,
        `Negociación rechazada con ${party.name}`,
        'El partido no aceptó iniciar conversaciones formales en este momento.',
        'politica'
      )
    );
  }

  const demandedMinistries = kind === 'cargos' ? (party.currentPollShare > 15 ? 2 : 1) : 0;
  const demandedPolicy =
    kind === 'programa'
      ? pick(
          state.governmentPriorities.length > 0
            ? state.governmentPriorities
            : ['Descentralización', 'Empleo joven', 'Transparencia']
        )
      : '';
  const demandLabel =
    kind === 'cargos'
      ? `${demandedMinistries} ministerio(s) en el gabinete`
      : kind === 'programa'
      ? `Incluir «${demandedPolicy}» en el programa`
      : 'Respaldo parlamentario para los proyectos en trámite';
  const negotiation: PoliticalNegotiationState = {
    id: `neg_${Date.now()}`,
    partyId,
    partyName: party.name,
    kind,
    dateLabel: `${state.currentYear}-${state.currentMonth}`,
    status: 'abierta',
    demandLabel,
    demandedMinistries,
    demandedPolicy,
    demandedFundsMillions: 0,
    durationMonths: kind === 'cargos' ? 12 : kind === 'programa' ? 9 : 6,
    monthsRemaining: 0,
    affinityAtOffer: affinity,
    compliance: 70,
    acceptanceChance: Math.round(chance),
    benefitsSummary: NEGOTIATION_BENEFITS[kind],
  };
  const next = setExpansion(spend(state, 4), {
    ...eco,
    negotiations: [negotiation, ...eco.negotiations],
  });
  return success(
    state,
    `Mesa abierta con ${party.name}: ${demandLabel}.`,
    withLog(
      state,
      next,
      `Mesa de negociación con ${party.name}`,
      `Oferta: ${demandLabel}. Beneficio: ${NEGOTIATION_BENEFITS[kind]}`,
      'politica'
    )
  );
}

export function acceptNegotiation(
  state: GameState,
  negotiationId: string
): EcosystemActionResult {
  const eco = ensureEcosystem(state, createInitialEcosystemState);
  const negotiation = eco.negotiations.find(
    (n) => n.id === negotiationId && n.status === 'abierta'
  );
  if (!negotiation) return fail(state, 'Esa negociación no está abierta.');

  let next: GameState = state;
  if (negotiation.kind === 'cargos') {
    next = {
      ...next,
      coalitionPromisedMinistries: {
        ...(next.coalitionPromisedMinistries ?? {}),
        [negotiation.partyId]: negotiation.demandedMinistries,
      },
    };
    next = adjustStability(next, 4);
    next = changeRelation(next, negotiation.partyId, 6);
  } else if (negotiation.kind === 'apoyo_parlamentario') {
    next = addBillsSupport(next, negotiation.partyId, 0.15);
    next = changeRelation(next, negotiation.partyId, 4);
  } else {
    next = {
      ...next,
      governmentPriorities: Array.from(
        new Set([...next.governmentPriorities, negotiation.demandedPolicy])
      ),
    };
    next = applyApproval(next, 0.4, 0.2);
    next = changeRelation(next, negotiation.partyId, 3);
  }

  const negotiations = eco.negotiations.map((n) =>
    n.id === negotiationId
      ? {
          ...n,
          status: 'aceptada' as const,
          monthsRemaining: n.durationMonths,
          compliance: 70,
        }
      : n
  );
  next = setExpansion(next, { ...eco, negotiations });
  return success(
    state,
    `Acuerdo con ${negotiation.partyName}: ${negotiation.demandLabel}.`,
    withLog(
      state,
      next,
      `Acuerdo cerrado con ${negotiation.partyName}`,
      `${negotiation.demandLabel}. Duración: ${negotiation.durationMonths} meses.`,
      'politica'
    )
  );
}

export function rejectNegotiation(
  state: GameState,
  negotiationId: string
): EcosystemActionResult {
  const eco = ensureEcosystem(state, createInitialEcosystemState);
  const negotiation = eco.negotiations.find(
    (n) => n.id === negotiationId && n.status === 'abierta'
  );
  if (!negotiation) return fail(state, 'Esa negociación no está abierta.');
  const negotiations = eco.negotiations.map((n) =>
    n.id === negotiationId ? { ...n, status: 'rechazada' as const } : n
  );
  const next = setExpansion(changeRelation(state, negotiation.partyId, -3), {
    ...eco,
    negotiations,
  });
  return success(
    state,
    `Rechazaste la oferta de ${negotiation.partyName}.`,
    withLog(
      state,
      next,
      `Oferta rechazada`,
      `${negotiation.partyName} quedó molesto por el rechazo (-3 afinidad).`,
      'politica'
    )
  );
}

export function breakAgreement(
  state: GameState,
  negotiationId: string
): EcosystemActionResult {
  const eco = ensureEcosystem(state, createInitialEcosystemState);
  const negotiation = eco.negotiations.find(
    (n) =>
      n.id === negotiationId && (n.status === 'aceptada' || n.status === 'cumplida')
  );
  if (!negotiation) return fail(state, 'Ese acuerdo no está vigente.');

  const promised = { ...(state.coalitionPromisedMinistries ?? {}) };
  delete promised[negotiation.partyId];
  const negotiations = eco.negotiations.map((n) =>
    n.id === negotiationId ? { ...n, status: 'rota' as const, monthsRemaining: 0 } : n
  );
  let next: GameState = {
    ...state,
    coalitionPromisedMinistries: promised,
    bills: state.bills.map((bill) => {
      const prev = bill.negotiatedPartySupport[negotiation.partyId] ?? 0;
      return {
        ...bill,
        negotiatedPartySupport: {
          ...bill.negotiatedPartySupport,
          [negotiation.partyId]: Math.max(0, prev - 0.1),
        },
      };
    }),
  };
  next = changeRelation(next, negotiation.partyId, -15);
  next = adjustStability(next, -5);
  next = applyApproval(next, -0.5, -0.3);
  next = setExpansion(next, { ...eco, negotiations });
  return success(
    state,
    `Rompiste el acuerdo con ${negotiation.partyName}. Costo político alto.`,
    withLog(
      state,
      next,
      `Ruptura del acuerdo con ${negotiation.partyName}`,
      'La contraparte retiró su respaldo y la estabilidad de la coalición cayó.',
      'politica'
    )
  );
}

export function negotiateSocialActor(
  state: GameState,
  actorId: string,
  offer: 'salarial' | 'programatico' | 'presupuesto'
): EcosystemActionResult {
  const actor = (state.socialActors ?? []).find((a) => a.id === actorId);
  if (!actor) return fail(state, 'No encontré esa organización.');
  const cost =
    offer === 'salarial'
      ? { cp: 4, funds: 2000000 }
      : offer === 'presupuesto'
      ? { cp: 5, funds: 5000000 }
      : { cp: 4, funds: 0 };
  const costError = canSpend(state, cost.cp, cost.funds);
  if (costError) return fail(state, costError);

  const chance = clamp(
    40 +
      (actor.governmentTrust ?? 50) * 0.3 +
      (actor.politicalAffinity ?? 0) * 0.2 +
      (state.player.attributes.negotiation - 50) * 0.3 +
      getAdvisorCapacity(state, 'negociacion') * 0.15 -
      (actor.conflictLevel ?? 20) * 0.2,
    10,
    90
  );
  const agreed = Math.random() * 100 < chance;
  const topic =
    offer === 'salarial'
      ? 'Mejora salarial y condiciones de trabajo'
      : offer === 'presupuesto'
      ? 'Partida presupuestal para el sector'
      : 'Acuerdo programático y mesa de diálogo';
  const trustDelta = agreed ? (offer === 'presupuesto' ? 12 : offer === 'salarial' ? 9 : 7) : -4;
  const conflictDelta = agreed ? (offer === 'presupuesto' ? -14 : -10) : 6;

  const socialActors = (state.socialActors ?? []).map((a) =>
    a.id === actorId
      ? {
          ...a,
          governmentTrust: r1(clamp((a.governmentTrust ?? 50) + trustDelta, 0, 100)),
          conflictLevel: r1(clamp((a.conflictLevel ?? 20) + conflictDelta, 0, 100)),
          politicalAffinity: clamp((a.politicalAffinity ?? 0) + (agreed ? 3 : -2), -100, 100),
          activeAgreement: agreed
            ? { topic, monthsRemaining: 6, fulfilled: false }
            : a.activeAgreement,
          negotiationHistory: [
            {
              dateLabel: `${state.currentYear}-${state.currentMonth}`,
              topic,
              agreed,
              fulfilled: false,
            },
            ...a.negotiationHistory,
          ].slice(0, 8),
        }
      : a
  );

  let next = spend(state, cost.cp, cost.funds);
  next = applyApproval(next, agreed ? 0.2 : -0.2, agreed ? 0.1 : -0.2);
  next = {
    ...next,
    socialActors,
    politicalIndicators: {
      ...next.politicalIndicators,
      unionConfidence: r1(
        clamp(next.politicalIndicators.unionConfidence + (agreed ? 1.5 : -1), 0, 100)
      ),
    },
  };
  return success(
    state,
    agreed
      ? `Acuerdo con ${actor.name}: ${topic}.`
      : `${actor.name} rechazó la oferta y aumentó la conflictividad.`,
    withLog(
      state,
      next,
      agreed ? `Acuerdo con ${actor.name}` : `Fracaso con ${actor.name}`,
      `${topic}. Confianza ${agreed ? '+' : ''}${trustDelta} · conflicto ${conflictDelta}.`,
      'sociedad'
    )
  );
}

export function resolveCabinetCrisis(
  state: GameState,
  crisisId: string,
  option: 'mediar' | 'reestructurar' | 'cesar'
): EcosystemActionResult {
  const caps = getPlayerCapabilities(state);
  if (!caps.canDirectCabinetCouncil) {
    return fail(state, caps.lockReasons.executiveNational);
  }
  const eco = ensureEcosystem(state, createInitialEcosystemState);
  const crisis = eco.cabinetCrises.find((c) => c.id === crisisId && c.status === 'abierta');
  if (!crisis) return fail(state, 'No hay esa crisis de gabinete abierta.');
  const cost =
    option === 'reestructurar'
      ? { cp: 6, funds: 2000000 }
      : option === 'cesar'
      ? { cp: 3, funds: 0 }
      : { cp: 4, funds: 0 };
  const costError = canSpend(state, cost.cp, cost.funds);
  if (costError) return fail(state, costError);

  let cabinet = state.cabinet;
  let resolved = true;
  let stability = 0;
  let approval = 0;
  let note = '';

  if (option === 'mediar') {
    resolved = Math.random() < 0.65;
    if (resolved) {
      cabinet = cabinet.map((m) =>
        m.id === crisis.ministerId ? { ...m, loyalty: r1(clamp(m.loyalty + 12, 0, 100)) } : m
      );
      stability = 2;
      approval = 0.2;
      note = 'La mediación presidencial contuvo la crisis y el ministro permaneció en el cargo.';
    } else {
      stability = -2;
      approval = -0.3;
      note = 'La mediación falló; la crisis sigue abierta y el gabinete quedó más tensionado.';
    }
  } else if (option === 'reestructurar') {
    const minister = cabinet.find((m) => m.id === crisis.ministerId);
    const candidate =
      state.ministerCandidates.find((c) => c.specialization === minister?.specialization) ??
      state.ministerCandidates[0];
    if (candidate) {
      cabinet = cabinet.map((m) =>
        m.id === crisis.ministerId
          ? {
              ...m,
              holderName: candidate.name,
              partyId: candidate.partyId,
              sectorName: candidate.sectorName,
              management: candidate.management,
              popularity: candidate.popularity,
              experience: candidate.experience,
              affinity: candidate.affinity,
              loyalty: candidate.loyalty,
              isVacant: false,
            }
          : m
      );
    } else {
      cabinet = cabinet.map((m) =>
        m.id === crisis.ministerId ? { ...m, isVacant: true, holderName: 'Vacante' } : m
      );
    }
    stability = 3;
    approval = 0.5;
    note = 'Reestructuraste el ministerio con un nuevo titular y recuperaste iniciativa.';
  } else {
    cabinet = cabinet.map((m) =>
      m.id === crisis.ministerId ? { ...m, isVacant: true, holderName: 'Vacante' } : m
    );
    cabinet = cabinet.map((m) =>
      m.id !== crisis.ministerId && !m.isVacant
        ? { ...m, loyalty: r1(clamp(m.loyalty + 2, 0, 100)) }
        : m
    );
    stability = -3;
    approval = -1;
    note = 'Cesaste al ministro. El resto del gabinete valoró la decisión, pero la crisis dejó costo.';
  }

  const cabinetCrises = eco.cabinetCrises.map((c) =>
    c.id === crisisId
      ? {
          ...c,
          status: resolved ? ('resuelta' as const) : c.status,
          resolutionNote: note,
        }
      : c
  );
  let next = spend(state, cost.cp, cost.funds);
  next = { ...next, cabinet };
  next = adjustStability(next, stability);
  next = applyApproval(next, approval, approval * 0.4);
  next = setExpansion(next, { ...eco, cabinetCrises });
  return success(
    state,
    note,
    withLog(
      state,
      next,
      `Crisis de gabinete: ${crisis.ministryName}`,
      note,
      'gobierno'
    )
  );
}

export function fileInstitutionalControl(
  state: GameState,
  targetId: string,
  kind: InstitutionalControlKind
): EcosystemActionResult {
  const caps = getPlayerCapabilities(state);
  if (!caps.canVoteOrSubmitInParliament && !caps.canDirectForeignPolicyExecutive) {
    return fail(state, caps.lockReasons.parliamentActions);
  }
  const policy = (state.activePolicies ?? []).find((p) => p.id === targetId);
  if (!policy) return fail(state, 'No encontré la medida a controlar.');
  const costError = canSpend(state, 4);
  if (costError) return fail(state, costError);

  const eco = ensureEcosystem(state, createInitialEcosystemState);
  const isOpposition = caps.isInNationalOpposition;
  const control = {
    id: `control_${Date.now()}`,
    targetType: 'politica' as const,
    targetId: policy.id,
    targetTitle: policy.title,
    kind,
    filedBy: isOpposition ? ('oposicion' as const) : ('jugador' as const),
    dateLabel: `${state.currentYear}-${state.currentMonth}`,
    status: 'abierto' as const,
    riskScore: r1(
      clamp(
        30 +
          (policy.riskLevel === 'alto' ? 25 : policy.riskLevel === 'medio' ? 12 : 0) +
          Math.random() * 20,
        10,
        95
      )
    ),
    description:
      kind === 'constitucionalidad'
        ? 'Se presentó un cuestionamiento de constitucionalidad contra la medida.'
        : kind === 'competencia'
        ? 'Se denunció un conflicto de competencias entre organismos.'
        : kind === 'pedido_informe'
        ? 'Se presentó un pedido de informe sobre la implementación.'
        : 'Se solicitó una auditoría legal del procedimiento.',
    monthsOpen: 0,
  };
  let next = spend(state, 4);
  next = applyApproval(next, isOpposition ? 0.3 : -0.1, isOpposition ? 0.4 : 0);
  next = setExpansion(next, {
    ...eco,
    institutionalControls: [control, ...eco.institutionalControls],
  });
  return success(
    state,
    `Control institucional presentado contra «${policy.title}».`,
    withLog(
      state,
      next,
      `Control institucional`,
      `${control.description} Riesgo estimado: ${control.riskScore}/100.`,
      'parlamento'
    )
  );
}

export function respondInstitutionalControl(
  state: GameState,
  caseId: string,
  strategy: 'juridica' | 'politica' | 'tecnica'
): EcosystemActionResult {
  const caps = getPlayerCapabilities(state);
  if (!caps.canDirectMinistriesAndStateAgencies) {
    return fail(state, caps.lockReasons.executiveNational);
  }
  const eco = ensureEcosystem(state, createInitialEcosystemState);
  const control = eco.institutionalControls.find(
    (c) => c.id === caseId && c.status === 'abierto'
  );
  if (!control) return fail(state, 'No hay ese control abierto.');
  const costError = canSpend(state, 3);
  if (costError) return fail(state, costError);

  const reduction = strategy === 'juridica' ? 28 : strategy === 'tecnica' ? 22 : 18;
  const riskScore = r1(clamp(control.riskScore - reduction, 0, 100));
  const resolved = riskScore <= 25;
  const controls = eco.institutionalControls.map((c) =>
    c.id === caseId
      ? {
          ...c,
          riskScore,
          status: resolved ? ('resuelto' as const) : c.status,
          resolutionNote: resolved
            ? 'La respuesta institucional desactivó el cuestionamiento.'
            : 'La respuesta redujo el riesgo, pero el expediente sigue abierto.',
        }
      : c
  );
  let next = spend(state, 3);
  if (strategy === 'politica') next = applyApproval(next, 0.3, 0.6);
  else if (strategy === 'tecnica') {
    next = {
      ...next,
      politicalIndicators: {
        ...next.politicalIndicators,
        businessConfidence: r1(
          clamp(next.politicalIndicators.businessConfidence + 0.8, 0, 100)
        ),
      },
    };
  } else next = applyApproval(next, -0.1, 0.1);
  if (resolved) next = applyApproval(next, 0.5, 0.2);
  next = setExpansion(next, { ...eco, institutionalControls: controls });
  return success(
    state,
    resolved
      ? 'La respuesta institucional desactivó el control.'
      : `Riesgo reducido a ${riskScore}/100; el expediente sigue abierto.`,
    withLog(
      state,
      next,
      `Respuesta a control institucional`,
      `Estrategia ${strategy}. Riesgo: ${riskScore}/100.`,
      'parlamento'
    )
  );
}
