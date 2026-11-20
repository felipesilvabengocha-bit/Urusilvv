import { MONTH_NAMES } from '../data/uruguayData';
import {
  ActivePublicPolicy,
  BillProposal,
  DelayedEffectPipelineItem,
  GameState,
  LegislativeStage,
  MinisterialCensureState,
  Party,
  SenateVeniaRequest,
} from '../types/game';
import { enqueueDelayedEffects } from './economyEngine';
import { seededRandom } from './electoralEngine';

export interface ChamberSeats {
  senateByParty: Record<string, number>;
  deputiesByParty: Record<string, number>;
  juntaByParty: Record<string, number>;
}

export interface ConstitutionalThresholdInfo {
  stageLabel: string;
  articleRef: string;
  requiredDesc: string;
  totalMembers: number;
  requiredVotes: number;
}

export const STAGE_META: Record<LegislativeStage, ConstitutionalThresholdInfo> = {
  camara_origen_comision: {
    stageLabel: 'Comisión en Cámara de Origen',
    articleRef: 'Art. 133 Constitución',
    requiredDesc: 'Despacho de comisión para pasar al Plenario',
    totalMembers: 99,
    requiredVotes: 50,
  },
  camara_origen_plenario: {
    stageLabel: 'Plenario de Cámara de Origen',
    articleRef: 'Arts. 94 y 133 Constitución',
    requiredDesc: 'Mayoría simple (Diputados 50/99 o Senado 16/31 c/ VP)',
    totalMembers: 99,
    requiredVotes: 50,
  },
  camara_revisora: {
    stageLabel: 'Cámara Revisora',
    articleRef: 'Art. 134 Constitución',
    requiredDesc: 'Aprobación en la segunda Cámara (o devolución con modificaciones)',
    totalMembers: 31,
    requiredVotes: 16,
  },
  devuelta_origen: {
    stageLabel: 'Devuelta a Cámara de Origen',
    articleRef: 'Art. 135 Constitución',
    requiredDesc: 'Aceptar modificaciones o remitir a Asamblea General',
    totalMembers: 99,
    requiredVotes: 50,
  },
  asamblea_general: {
    stageLabel: 'Asamblea General (130 miembros)',
    articleRef: 'Arts. 135 y 138 Constitución',
    requiredDesc: '2/3 (87/130) en desacuerdo bicameral · 3/5 por Cámara en vetos',
    totalMembers: 130,
    requiredVotes: 87,
  },
  promulgacion_ejecutivo: {
    stageLabel: 'Poder Ejecutivo (Promulgación / Veto)',
    articleRef: 'Arts. 137–139 Constitución',
    requiredDesc: '10 días para promulgar o interponer observaciones/veto',
    totalMembers: 1,
    requiredVotes: 1,
  },
  veto_parcial_o_total: {
    stageLabel: 'Veto / Observaciones del Ejecutivo',
    articleRef: 'Art. 138 Constitución',
    requiredDesc: 'Asamblea General requiere 3/5 por Cámara (60 Dip. y 19 Sen.)',
    totalMembers: 130,
    requiredVotes: 79,
  },
  aprobada: {
    stageLabel: 'Ley Promulgada / Sancionada',
    articleRef: 'Art. 140 Constitución',
    requiredDesc: 'Vigente en el ordenamiento jurídico',
    totalMembers: 130,
    requiredVotes: 66,
  },
  rechazada: {
    stageLabel: 'Archivada / Rechazada',
    articleRef: 'Arts. 136 y 217 Constitución',
    requiredDesc: 'Sin sanción legislativa',
    totalMembers: 130,
    requiredVotes: 66,
  },
};

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function getDateLabel(state: GameState): string {
  return `${MONTH_NAMES[(state.currentMonth - 1 + 12) % 12] ?? 'Marzo'} ${state.currentYear}`;
}

/**
 * Obtiene la composición vigente de Senado (30 bancas electas + Vicepresidente Art. 94),
 * Diputados (99) y Junta Departamental (31 ediles).
 */
export function getActiveChambers(state: GameState): ChamberSeats {
  const senateByParty: Record<string, number> = {};
  const deputiesByParty: Record<string, number> = {};
  const juntaByParty: Record<string, number> = {};

  if (state.nationalResult) {
    state.nationalResult.partyTotals.forEach((p) => {
      senateByParty[p.partyId] = p.senateSeats;
      deputiesByParty[p.partyId] = p.deputySeats;
    });
  } else {
    const fallbackSeats: Record<string, { s: number; d: number }> =
      state.scenarioId === 'contemporaneo_2024'
        ? { fa: { s: 16, d: 48 }, pn: { s: 9, d: 29 }, pc: { s: 5, d: 17 }, is: { s: 0, d: 2 }, ca: { s: 0, d: 2 }, pi: { s: 0, d: 1 } }
        : state.scenarioId === 'historico_2019'
        ? { fa: { s: 13, d: 42 }, pn: { s: 10, d: 30 }, pc: { s: 4, d: 13 }, ca: { s: 3, d: 11 }, pi: { s: 0, d: 1 }, peri: { s: 0, d: 1 } }
        : { fa: { s: 15, d: 50 }, pn: { s: 11, d: 36 }, pc: { s: 3, d: 10 }, pi: { s: 1, d: 3 } };

    state.parties.forEach((p) => {
      senateByParty[p.id] = fallbackSeats[p.id]?.s ?? 0;
      deputiesByParty[p.id] = fallbackSeats[p.id]?.d ?? 0;
    });
  }

  const deptRes = state.departamentalResult?.departments.find(
    (d) => d.departmentId === state.player.targetDepartment
  );
  if (deptRes) {
    Object.assign(juntaByParty, deptRes.juntaSeats);
  } else {
    const dept = state.departments.find((d) => d.id === state.player.targetDepartment);
    const govId = dept?.currentIntendentePartyId ?? 'pn';
    state.parties.forEach((p) => (juntaByParty[p.id] = 0));
    juntaByParty[govId] = 16;
    const second = state.parties.find((p) => p.id !== govId && p.baseNationalShare > 10);
    const third = state.parties.find((p) => p.id !== govId && p.id !== second?.id && p.baseNationalShare > 5);
    if (second) juntaByParty[second.id] = 10;
    if (third) juntaByParty[third.id] = 5;
  }

  return { senateByParty, deputiesByParty, juntaByParty };
}

/** Calcula probabilidad (0..1) de que un partido vote a favor de un proyecto */
export function estimatePartyBillSupport(
  state: GameState,
  bill: BillProposal,
  party: Party
): number {
  if (party.id === state.player.partyId && bill.playerBenchPosition && bill.playerBenchPosition !== 'sin_definir') {
    if (bill.playerBenchPosition === 'a_favor') return 0.94;
    if (bill.playerBenchPosition === 'en_contra') return 0.06;
    if (bill.playerBenchPosition === 'abstencion') return 0.25;
  }

  if (party.id === bill.sponsorPartyId) {
    const internalDiscipline = 0.78 + (state.politicalIndicators.partyStrength / 100) * 0.2;
    return Math.min(0.98, internalDiscipline);
  }

  const sponsor = state.parties.find((p) => p.id === bill.sponsorPartyId);
  const relation = state.player.relations.find((r) => r.partyId === party.id);
  const affinity = relation?.affinity ?? 0;
  const inCoalition = state.coalitionPartyIds.includes(party.id);
  const inElectoralAlliance = (state.electoralAlliances ?? []).some(
    (al) =>
      al.active &&
      (al.leadPartyId === bill.sponsorPartyId || al.partnerPartyIds.includes(bill.sponsorPartyId)) &&
      (al.leadPartyId === party.id || al.partnerPartyIds.includes(party.id))
  );
  const negotiatedBoost = bill.negotiatedPartySupport[party.id] ?? 0;
  const inOppBloc = state.opposition?.oppositionBlocPartyIds.includes(party.id) ?? false;

  const ideoDist = sponsor
    ? Math.hypot(
        sponsor.ideology.economic - party.ideology.economic,
        sponsor.ideology.social - party.ideology.social
      )
    : 50;

  let prob = 0.48 - ideoDist * 0.005 + (affinity / 100) * 0.25 + negotiatedBoost;
  if (inCoalition && bill.sponsorPartyId === state.nationalPresidentPartyId) {
    prob += 0.28 + (state.politicalIndicators.coalitionStability - 60) * 0.003;
  } else if (inCoalition) {
    prob += 0.16;
  } else if (inElectoralAlliance) {
    prob += 0.18;
  }

  if (inOppBloc) {
    if (bill.origin === 'oficialismo') {
      if (bill.playerBenchPosition === 'en_contra' || state.opposition?.stance === 'confrontativa') {
        prob -= 0.26;
      } else if (bill.playerBenchPosition === 'a_favor') {
        prob += 0.16;
      }
    } else if (bill.sponsorPartyId === state.player.partyId) {
      prob += 0.24;
    }
  }

  if (party.aiPersonality === 'disruptivo') {
    prob -= 0.15;
  }
  return Math.max(0.04, Math.min(0.96, prob));
}

/**
 * Art. 94 de la Constitución: El Vicepresidente de la República preside la Cámara de Senadores
 * y la Asamblea General con voz y voto ordinario (31.º voto del Senado, 130.º de Asamblea General).
 */
export function resolveVicePresidentVote(state: GameState, bill: BillProposal, rng: () => number): 'a_favor' | 'en_contra' {
  if (state.player.currentOffice === 'vicepresidente' && bill.playerBenchPosition && bill.playerBenchPosition !== 'sin_definir') {
    return bill.playerBenchPosition === 'a_favor' ? 'a_favor' : 'en_contra';
  }
  const presParty = state.parties.find((p) => p.id === state.nationalPresidentPartyId);
  if (!presParty) return bill.origin === 'oficialismo' ? 'a_favor' : 'en_contra';
  const prob = estimatePartyBillSupport(state, bill, presParty);
  return rng() < prob ? 'a_favor' : 'en_contra';
}

export function simulateSingleChamberVote(
  state: GameState,
  bill: BillProposal,
  chamber: 'senado' | 'diputados' | 'junta_departamental',
  seedTag: string
): {
  chamberName: string;
  yes: number;
  no: number;
  total: number;
  approved: boolean;
  vpVoted?: 'a_favor' | 'en_contra';
  byParty: NonNullable<BillProposal['voteBreakdown']>['byParty'];
} {
  const chambers = getActiveChambers(state);
  const rng = seededRandom(`${state.id}-vote-${bill.id}-${chamber}-${seedTag}-${state.currentMonth}`);
  const seatsMap =
    chamber === 'junta_departamental'
      ? chambers.juntaByParty
      : chamber === 'senado'
      ? chambers.senateByParty
      : chambers.deputiesByParty;

  let totalYes = 0;
  let totalNo = 0;
  const byParty: NonNullable<BillProposal['voteBreakdown']>['byParty'] = [];

  for (const party of state.parties) {
    const seats = seatsMap[party.id] ?? 0;
    if (seats <= 0) continue;
    const pSupport = estimatePartyBillSupport(state, bill, party);
    let yes = 0;
    let no = 0;
    for (let i = 0; i < seats; i++) {
      if (rng() < pSupport) yes++;
      else no++;
    }
    totalYes += yes;
    totalNo += no;
    byParty.push({
      partyId: party.id,
      partyName: party.name,
      color: party.color,
      yes,
      no,
    });
  }

  let vpVoted: 'a_favor' | 'en_contra' | undefined;
  if (chamber === 'senado') {
    vpVoted = resolveVicePresidentVote(state, bill, rng);
    if (vpVoted === 'a_favor') totalYes += 1;
    else totalNo += 1;
  }

  const total = chamber === 'diputados' ? 99 : 31; // Senado = 30 + VP (Art. 94) = 31; Junta = 31
  const requiredMajority = Math.floor(total / 2) + 1; // 50 en Diputados, 16 en Senado (de 31) y Junta (de 31)
  const chamberName =
    chamber === 'junta_departamental'
      ? 'Junta Departamental (31 Ediles)'
      : chamber === 'senado'
      ? 'Cámara de Senadores (30 + VP · Art. 94)'
      : 'Cámara de Representantes (99 Diputados)';

  return {
    chamberName,
    yes: totalYes,
    no: totalNo,
    total,
    approved: totalYes >= requiredMajority,
    vpVoted,
    byParty,
  };
}

/**
 * Ejecuta votación bicameral completa en un solo paso (compatibilidad con flujos directos).
 * Respeta Art. 94 (Vicepresidente vota ordinariamente en Senado y Asamblea General).
 */
export function voteBillInParliament(
  state: GameState,
  bill: BillProposal
): {
  approved: boolean;
  voteBreakdown: NonNullable<BillProposal['voteBreakdown']>;
} {
  if (bill.chamber === 'junta_departamental') {
    const res = simulateSingleChamberVote(state, bill, 'junta_departamental', 'direct');
    return {
      approved: res.approved,
      voteBreakdown: {
        chamberName: res.chamberName,
        yes: res.yes,
        no: res.no,
        abstentions: 0,
        byParty: res.byParty,
      },
    };
  }

  const origin: 'diputados' | 'senado' =
    bill.chamber === 'senado' || bill.originChamber === 'senado' ? 'senado' : 'diputados';
  const review: 'diputados' | 'senado' = origin === 'diputados' ? 'senado' : 'diputados';

  const firstRes = simulateSingleChamberVote(state, bill, origin, 'direct1');
  if (bill.chamber !== 'ambas') {
    return {
      approved: firstRes.approved,
      voteBreakdown: {
        chamberName: firstRes.chamberName,
        yes: firstRes.yes,
        no: firstRes.no,
        abstentions: 0,
        byParty: firstRes.byParty,
      },
    };
  }

  const secondRes = simulateSingleChamberVote(state, bill, review, 'direct2');
  const combinedYes = firstRes.yes + secondRes.yes;
  const combinedNo = firstRes.no + secondRes.no;
  const approved = firstRes.approved && secondRes.approved;

  return {
    approved,
    voteBreakdown: {
      chamberName: `Trámite Bicameral (${origin === 'diputados' ? 'Dip. -> Sen.' : 'Sen. -> Dip.'})`,
      yes: combinedYes,
      no: combinedNo,
      abstentions: 0,
      byParty: firstRes.byParty,
    },
  };
}

/**
 * Promulga una ley sancionada activando su política pública vinculada (si existe)
 * y encolando sus impactos en el pipeline de 4 horizontes SIN doble contabilización.
 */
export function applyPromulgatedBillEffects(state: GameState, bill: BillProposal): GameState {
  const dateLabel = getDateLabel(state);
  const p = bill.payload;
  const nextBills = state.bills.map((b) =>
    b.id === bill.id
      ? {
          ...b,
          status: 'aprobada' as const,
          legislativeStage: 'aprobada' as const,
        }
      : b
  );

  // Activa política pública vinculada si este proyecto proviene del Catálogo A-J o Laboratorio OPP/MEF
  let nextActivePolicies = [...(state.activePolicies ?? [])];
  let nextPipeline = [...(state.effectPipeline ?? [])];
  let linkedPolicyActivated: ActivePublicPolicy | undefined;

  if (bill.linkedPolicyId) {
    nextActivePolicies = nextActivePolicies.map((pol) => {
      if (pol.id !== bill.linkedPolicyId) return pol;
      linkedPolicyActivated = {
        ...pol,
        status: 'en_implementacion',
        enactedDateLabel: dateLabel,
      };
      return linkedPolicyActivated;
    });
  }

  if (linkedPolicyActivated) {
    const est = linkedPolicyActivated.estimatedEffects;
    const del = linkedPolicyActivated.delayedEffects;
    const totalMonths = Math.max(6, linkedPolicyActivated.timelineMonths || 12);
    const newPipelineItems: DelayedEffectPipelineItem[] = [
      {
        id: `pol_imm_${linkedPolicyActivated.id}_${Date.now()}`,
        sourceType: 'politica',
        sourceId: linkedPolicyActivated.id,
        label: `${linkedPolicyActivated.title} (Implementación inicial)`,
        horizon: 'inmediato',
        remainingMonths: 1,
        totalMonths: 1,
        gdpDelta: Number(((est.gdpDelta ?? 0) * 0.4).toFixed(2)),
        inflationDelta: Number(((est.inflationDelta ?? 0) * 0.4).toFixed(2)),
        unemploymentDelta: Number(((est.unemploymentDelta ?? 0) * 0.4).toFixed(2)),
        povertyDelta: Number(((est.povertyDelta ?? 0) * 0.4).toFixed(2)),
        giniDelta: est.giniDelta ? Number((est.giniDelta * 0.35).toFixed(3)) : undefined,
        approvalDelta: est.approvalDelta ? Number((est.approvalDelta * 0.5).toFixed(1)) : undefined,
      },
      {
        id: `pol_med_${linkedPolicyActivated.id}_${Date.now()}`,
        sourceType: 'politica',
        sourceId: linkedPolicyActivated.id,
        label: `${linkedPolicyActivated.title} (Maduración estructural)`,
        horizon: totalMonths >= 18 ? 'largo' : 'mediano',
        remainingMonths: Math.min(24, Math.max(4, Math.round(totalMonths * 0.65))),
        totalMonths: Math.min(24, Math.max(4, Math.round(totalMonths * 0.65))),
        gdpDelta: Number(((del.gdpDelta ?? 0) * 0.7).toFixed(2)),
        inflationDelta: Number(((del.inflationDelta ?? 0) * 0.6).toFixed(2)),
        unemploymentDelta: Number(((del.unemploymentDelta ?? 0) * 0.7).toFixed(2)),
        povertyDelta: Number(((del.povertyDelta ?? 0) * 0.7).toFixed(2)),
        giniDelta: del.giniDelta ? Number((del.giniDelta * 0.7).toFixed(3)) : undefined,
        productivityDelta: del.productionDelta ? Number((del.productionDelta * 0.6).toFixed(2)) : undefined,
        approvalDelta: del.approvalDelta,
      },
    ];
    nextPipeline = enqueueDelayedEffects(nextPipeline, newPipelineItems);
  } else {
    // Ley autónoma: ingresa sus efectos reales al pipeline de 4 horizontes (sin duplicar en enactedLawModifiers)
    const billItems: DelayedEffectPipelineItem[] = [
      {
        id: `bill_imm_${bill.id}_${Date.now()}`,
        sourceType: 'ley',
        sourceId: bill.id,
        label: `${bill.title} (Entrada en vigor)`,
        horizon: 'corto',
        remainingMonths: 2,
        totalMonths: 2,
        gdpDelta: p.gdpDelta ? Number((p.gdpDelta * 0.45).toFixed(2)) : undefined,
        inflationDelta: p.inflationDelta ? Number((p.inflationDelta * 0.5).toFixed(2)) : undefined,
        unemploymentDelta: p.unemploymentDelta ? Number((p.unemploymentDelta * 0.45).toFixed(2)) : undefined,
        povertyDelta: p.povertyDelta ? Number((p.povertyDelta * 0.4).toFixed(2)) : undefined,
        productivityDelta: p.productivityDelta ? Number((p.productivityDelta * 0.4).toFixed(2)) : undefined,
      },
      {
        id: `bill_med_${bill.id}_${Date.now()}`,
        sourceType: 'ley',
        sourceId: bill.id,
        label: `${bill.title} (Régimen pleno)`,
        horizon: 'mediano',
        remainingMonths: 7,
        totalMonths: 7,
        gdpDelta: p.gdpDelta ? Number((p.gdpDelta * 0.55).toFixed(2)) : undefined,
        inflationDelta: p.inflationDelta ? Number((p.inflationDelta * 0.5).toFixed(2)) : undefined,
        unemploymentDelta: p.unemploymentDelta ? Number((p.unemploymentDelta * 0.55).toFixed(2)) : undefined,
        povertyDelta: p.povertyDelta ? Number((p.povertyDelta * 0.6).toFixed(2)) : undefined,
        productivityDelta: p.productivityDelta ? Number((p.productivityDelta * 0.6).toFixed(2)) : undefined,
      },
    ];
    nextPipeline = enqueueDelayedEffects(nextPipeline, billItems);
  }

  // Impacto inmediato en confianza política, riesgo país y parámetros fiscales directos
  const nextInd = {
    ...state.politicalIndicators,
    governmentApproval: clamp(
      Number((state.politicalIndicators.governmentApproval + (p.approvalDelta ?? 0)).toFixed(1)),
      15,
      85
    ),
    businessConfidence: clamp(
      Math.round(state.politicalIndicators.businessConfidence + (p.businessTrustDelta ?? 0)),
      15,
      95
    ),
    unionConfidence: clamp(
      Math.round(state.politicalIndicators.unionConfidence + (p.unionTrustDelta ?? 0)),
      15,
      95
    ),
  };

  const nextMacro = {
    ...state.macro,
    countryRiskBps: Math.max(45, Math.round(state.macro.countryRiskBps + (p.riskDelta ?? 0))),
    governmentApprovalPct: nextInd.governmentApproval,
  };

  // Ajuste único de revenueTargetDelta si la ley reforma tributos sin política vinculada
  const nextLawMods = linkedPolicyActivated
    ? state.enactedLawModifiers
    : {
        ...(state.enactedLawModifiers ?? {}),
        revenueTargetDelta: Number(
          (((state.enactedLawModifiers?.revenueTargetDelta ?? 0) + (p.revenueDelta ?? 0))).toFixed(3)
        ),
      };

  const prevStats = state.progression.careerStats ?? {
    lawsPassed: state.player.legislativeWins,
    policiesEnacted: nextActivePolicies.length,
    electionsWon: 0,
    electionsLost: 0,
    coalitionsFormed: state.electoralAlliances?.length ?? 0,
    partiesMerged: state.partyMergers?.length ?? 0,
    ministersAppointed: 0,
    controlsExecuted: state.opposition.parliamentaryControlsExecuted,
  };

  return {
    ...state,
    bills: nextBills,
    activePolicies: nextActivePolicies,
    effectPipeline: nextPipeline,
    macro: nextMacro,
    politicalIndicators: nextInd,
    enactedLawModifiers: nextLawMods,
    progression: {
      ...state.progression,
      careerStats: {
        ...prevStats,
        lawsPassed: prevStats.lawsPassed + 1,
      },
    },
    player: {
      ...state.player,
      legislativeWins: state.player.legislativeWins + 1,
      attributes: {
        ...state.player.attributes,
        popularity: clamp(Number((state.player.attributes.popularity + 1.5).toFixed(1)), 12, 98),
      },
    },
  };
}

function rejectBillAndLinkedPolicy(state: GameState, bill: BillProposal, reason: string): GameState {
  const nextBills = state.bills.map((b) =>
    b.id === bill.id
      ? {
          ...b,
          status: 'rechazada' as const,
          legislativeStage: 'rechazada' as const,
        }
      : b
  );
  const nextActivePolicies = (state.activePolicies ?? []).map((pol) =>
    pol.id === bill.linkedPolicyId ? { ...pol, status: 'bloqueada' as const } : pol
  );

  return {
    ...state,
    bills: nextBills,
    activePolicies: nextActivePolicies,
    history: [
      {
        id: `bill_rej_${Date.now()}`,
        dateLabel: getDateLabel(state),
        category: 'parlamento',
        title: `Proyecto rechazado: ${bill.title}`,
        detail: reason,
      },
      ...state.history,
    ],
  };
}

/**
 * Avanza un proyecto de ley una etapa constitucional dentro del flujo bicameral ROU:
 * Comisión Origen -> Plenario Origen -> Cámara Revisora -> (Devuelta Origen / Asamblea General) -> Promulgación Ejecutivo / Veto.
 */
export function advanceBillConstitutionalStage(
  state: GameState,
  billId: string
): { nextState: GameState; message: string; outcome?: 'approved' | 'rejected' | 'advanced' | 'needs_executive' } {
  const bill = state.bills.find((b) => b.id === billId);
  if (!bill || bill.status !== 'en_negociacion') {
    return { nextState: state, message: 'El proyecto ya culminó su trámite legislativo.' };
  }

  const stage: LegislativeStage = bill.legislativeStage ?? 'camara_origen_comision';
  const originChamber: 'diputados' | 'senado' | 'junta_departamental' =
    bill.originChamber ??
    (bill.chamber === 'junta_departamental'
      ? 'junta_departamental'
      : bill.chamber === 'senado'
      ? 'senado'
      : 'diputados');
  const reviewChamber: 'diputados' | 'senado' = originChamber === 'diputados' ? 'senado' : 'diputados';
  const dateLabel = getDateLabel(state);

  // 1. Comisión -> Plenario de Cámara de Origen
  if (stage === 'camara_origen_comision') {
    const nextBills = state.bills.map((b) =>
      b.id === bill.id
        ? {
            ...b,
            legislativeStage: 'camara_origen_plenario' as const,
            concessionsApplied: [
              ...b.concessionsApplied,
              `Despachado de ${b.committeeName ?? 'Comisión'} al Plenario`,
            ],
          }
        : b
    );
    const msg = `«${bill.title}» recibió despacho de comisión y pasa a votación en el Plenario de ${
      originChamber === 'junta_departamental'
        ? 'Junta Departamental'
        : originChamber === 'senado'
        ? 'Senadores'
        : 'Diputados'
    }.`;
    return {
      nextState: {
        ...state,
        bills: nextBills,
        history: [
          { id: `parl_com_${Date.now()}`, dateLabel, category: 'parlamento', title: `Despacho de comisión`, detail: msg },
          ...state.history,
        ],
      },
      message: msg,
      outcome: 'advanced',
    };
  }

  // 2. Plenario Cámara de Origen
  if (stage === 'camara_origen_plenario') {
    const res = simulateSingleChamberVote(state, bill, originChamber, 'origin');
    const breakdown = {
      chamberName: res.chamberName,
      yes: res.yes,
      no: res.no,
      abstentions: 0,
      byParty: res.byParty,
    };

    if (!res.approved) {
      const updated = {
        ...state,
        bills: state.bills.map((b) =>
          b.id === bill.id
            ? {
                ...b,
                originChamberResult: { chamberName: res.chamberName, yes: res.yes, no: res.no, total: res.total, approved: false, vpVoted: res.vpVoted },
                voteBreakdown: breakdown,
              }
            : b
        ),
      };
      const msg = `RECHAZADO en ${res.chamberName} (${res.yes} a favor vs. ${res.no} en contra).`;
      return {
        nextState: rejectBillAndLinkedPolicy(updated, bill, msg),
        message: msg,
        outcome: 'rejected',
      };
    }

    if (originChamber === 'junta_departamental') {
      const updated = {
        ...state,
        bills: state.bills.map((b) =>
          b.id === bill.id
            ? {
                ...b,
                originChamberResult: { chamberName: res.chamberName, yes: res.yes, no: res.no, total: res.total, approved: true },
                voteBreakdown: breakdown,
              }
            : b
        ),
      };
      const promulgated = applyPromulgatedBillEffects(updated, bill);
      const msg = `ORDENANZA SANCIONADA en ${res.chamberName} (${res.yes} a favor / ${res.no} en contra).`;
      return {
        nextState: {
          ...promulgated,
          history: [
            { id: `junta_ok_${Date.now()}`, dateLabel, category: 'parlamento', title: `Sanción departamental: ${bill.title}`, detail: msg },
            ...promulgated.history,
          ],
        },
        message: msg,
        outcome: 'approved',
      };
    }

    const nextBills = state.bills.map((b) =>
      b.id === bill.id
        ? {
            ...b,
            legislativeStage: 'camara_revisora' as const,
            deadlineDaysRemaining: b.isConstitutionalBudgetBill ? 45 : b.deadlineDaysRemaining,
            originChamberResult: {
              chamberName: res.chamberName,
              yes: res.yes,
              no: res.no,
              total: res.total,
              approved: true,
              vpVoted: res.vpVoted,
            },
            voteBreakdown: breakdown,
          }
        : b
    );
    const msg = `Media sanción en ${res.chamberName} (${res.yes}–${res.no}). Pasa a Cámara Revisora (${
      reviewChamber === 'senado' ? 'Senado 31 c/ VP' : 'Diputados 99'
    }).`;
    return {
      nextState: {
        ...state,
        bills: nextBills,
        history: [
          { id: `med_sanc_${Date.now()}`, dateLabel, category: 'parlamento', title: `Media sanción: ${bill.title}`, detail: msg },
          ...state.history,
        ],
      },
      message: msg,
      outcome: 'advanced',
    };
  }

  // 3. Cámara Revisora (Art. 134–135)
  if (stage === 'camara_revisora') {
    const res = simulateSingleChamberVote(state, bill, reviewChamber, 'review');
    const margin = res.yes - res.no;
    const isModified = res.approved && margin <= (reviewChamber === 'senado' ? 2 : 6);
    const breakdown = {
      chamberName: res.chamberName,
      yes: res.yes,
      no: res.no,
      abstentions: 0,
      byParty: res.byParty,
    };

    if (!res.approved) {
      // Si el proyecto obtuvo >= 38% en Revisora, habilita instancia de Asamblea General (Art. 135)
      if (res.yes / res.total >= 0.38) {
        const nextBills = state.bills.map((b) =>
          b.id === bill.id
            ? {
                ...b,
                legislativeStage: 'asamblea_general' as const,
                deadlineDaysRemaining: b.isConstitutionalBudgetBill ? 15 : b.deadlineDaysRemaining,
                reviewChamberResult: {
                  chamberName: res.chamberName,
                  yes: res.yes,
                  no: res.no,
                  total: res.total,
                  modified: false,
                  approved: false,
                  vpVoted: res.vpVoted,
                },
                voteBreakdown: breakdown,
              }
            : b
        );
        const msg = `Desacuerdo bicameral: rechazada en ${res.chamberName} (${res.yes}–${res.no}). Pasa a Asamblea General (requiere 2/3 = 87/130, Art. 135).`;
        return {
          nextState: {
            ...state,
            bills: nextBills,
            history: [
              { id: `desac_${Date.now()}`, dateLabel, category: 'parlamento', title: `A Asamblea General: ${bill.title}`, detail: msg },
              ...state.history,
            ],
          },
          message: msg,
          outcome: 'advanced',
        };
      }

      const updated = {
        ...state,
        bills: state.bills.map((b) =>
          b.id === bill.id
            ? {
                ...b,
                reviewChamberResult: {
                  chamberName: res.chamberName,
                  yes: res.yes,
                  no: res.no,
                  total: res.total,
                  modified: false,
                  approved: false,
                  vpVoted: res.vpVoted,
                },
                voteBreakdown: breakdown,
              }
            : b
        ),
      };
      const msg = `RECHAZADO ampliamente en ${res.chamberName} (${res.yes}–${res.no}).`;
      return {
        nextState: rejectBillAndLinkedPolicy(updated, bill, msg),
        message: msg,
        outcome: 'rejected',
      };
    }

    if (isModified) {
      const nextBills = state.bills.map((b) =>
        b.id === bill.id
          ? {
              ...b,
              legislativeStage: 'devuelta_origen' as const,
              deadlineDaysRemaining: b.isConstitutionalBudgetBill ? 15 : b.deadlineDaysRemaining,
              reviewChamberResult: {
                chamberName: res.chamberName,
                yes: res.yes,
                no: res.no,
                total: res.total,
                modified: true,
                approved: true,
                vpVoted: res.vpVoted,
              },
              voteBreakdown: breakdown,
            }
          : b
      );
      const msg = `${res.chamberName} aprobó con modificaciones (${res.yes}–${res.no}). Devuelve a Cámara de Origen (Art. 135).`;
      return {
        nextState: {
          ...state,
          bills: nextBills,
          history: [
            { id: `dev_${Date.now()}`, dateLabel, category: 'parlamento', title: `Devuelta con modificaciones`, detail: msg },
            ...state.history,
          ],
        },
        message: msg,
        outcome: 'advanced',
      };
    }

    // Sancionada por ambas Cámaras -> pasa al Poder Ejecutivo para Promulgación o Veto (Art. 137)
    const nextBills = state.bills.map((b) =>
      b.id === bill.id
        ? {
            ...b,
            legislativeStage: 'promulgacion_ejecutivo' as const,
            reviewChamberResult: {
              chamberName: res.chamberName,
              yes: res.yes,
              no: res.no,
              total: res.total,
              modified: false,
              approved: true,
              vpVoted: res.vpVoted,
            },
            voteBreakdown: breakdown,
          }
        : b
    );
    const updatedState = { ...state, bills: nextBills };

    // Si el jugador no es Presidente, el Poder Ejecutivo IA resuelve Promulgación o Veto inmediatamente
    if (state.player.currentOffice !== 'presidente') {
      return resolveExecutiveBillDecisionAI(updatedState, bill.id);
    }

    const msg = `Sancionada en ${res.chamberName} (${res.yes}–${res.no}). Pasa a tu despacho presidencial para Promulgar o Vetar (Art. 137).`;
    return {
      nextState: updatedState,
      message: msg,
      outcome: 'needs_executive',
    };
  }

  // 4. Devuelta a Cámara de Origen (acepta modificaciones o va a Asamblea General)
  if (stage === 'devuelta_origen') {
    const res = simulateSingleChamberVote(state, bill, originChamber, 'returned');
    const breakdown = {
      chamberName: `${res.chamberName} (Acepta modificaciones)`,
      yes: res.yes,
      no: res.no,
      abstentions: 0,
      byParty: res.byParty,
    };

    if (res.approved) {
      const nextBills = state.bills.map((b) =>
        b.id === bill.id
          ? { ...b, legislativeStage: 'promulgacion_ejecutivo' as const, voteBreakdown: breakdown }
          : b
      );
      const updatedState = { ...state, bills: nextBills };
      if (state.player.currentOffice !== 'presidente') {
        return resolveExecutiveBillDecisionAI(updatedState, bill.id);
      }
      const msg = `Cámara de Origen aceptó las modificaciones (${res.yes}–${res.no}). Pasa al Poder Ejecutivo (Art. 137).`;
      return { nextState: updatedState, message: msg, outcome: 'needs_executive' };
    }

    const nextBills = state.bills.map((b) =>
      b.id === bill.id
        ? {
            ...b,
            legislativeStage: 'asamblea_general' as const,
            deadlineDaysRemaining: b.isConstitutionalBudgetBill ? 15 : b.deadlineDaysRemaining,
            voteBreakdown: breakdown,
          }
        : b
    );
    const msg = `Cámara de Origen rechazó las modificaciones (${res.yes}–${res.no}). Pasa a Asamblea General (requiere 2/3 = 87/130, Art. 135).`;
    return {
      nextState: {
        ...state,
        bills: nextBills,
        history: [
          { id: `ag_pass_${Date.now()}`, dateLabel, category: 'parlamento', title: `Remitida a Asamblea General`, detail: msg },
          ...state.history,
        ],
      },
      message: msg,
      outcome: 'advanced',
    };
  }

  // 5. Asamblea General (Art. 135 desacuerdo 2/3 = 87/130; Art. 138 levantamiento de veto 3/5 por Cámara)
  if (stage === 'asamblea_general' || stage === 'veto_parcial_o_total') {
    const depRes = simulateSingleChamberVote(state, bill, 'diputados', 'ag_dep');
    const senRes = simulateSingleChamberVote(state, bill, 'senado', 'ag_sen');
    const totalYes = depRes.yes + senRes.yes; // de 130 (99 + 30 + VP Art. 94)
    const totalNo = depRes.no + senRes.no;
    const isVetoOverride = bill.executiveVetoKind === 'parcial' || bill.executiveVetoKind === 'total' || stage === 'veto_parcial_o_total';

    const passed = isVetoOverride
      ? depRes.yes >= 60 && senRes.yes >= 19 // Art. 138: 3/5 de presentes de cada Cámara (60 Dip. + 19 Sen.)
      : totalYes >= 87; // Art. 135: 2/3 del total de la Asamblea General (87/130)

    const assemblyResult = {
      chamberName: 'Asamblea General (130 miembros · 99 Dip. + 30 Sen. + VP)',
      yes: totalYes,
      no: totalNo,
      requiredVotes: isVetoOverride ? 79 : 87,
      total: 130,
      reason: isVetoOverride
        ? `Levantamiento de veto Art. 138 (3/5 por Cámara: Dip ${depRes.yes}/60, Sen ${senRes.yes}/19)`
        : 'Resolución de desacuerdo bicameral Art. 135 (2/3 = 87/130)',
      approved: passed,
    };

    const updated = {
      ...state,
      bills: state.bills.map((b) =>
        b.id === bill.id
          ? {
              ...b,
              assemblyResult,
              voteBreakdown: {
                chamberName: assemblyResult.chamberName,
                yes: totalYes,
                no: totalNo,
                abstentions: 0,
                byParty: depRes.byParty,
              },
            }
          : b
      ),
    };

    if (!passed) {
      const msg = isVetoOverride
        ? `Veto del Poder Ejecutivo mantenido en Asamblea General (Dip. ${depRes.yes}/60, Sen. ${senRes.yes}/19). Proyecto archivado.`
        : `No alcanzó los 2/3 en Asamblea General (${totalYes}/87 votos, Art. 135). Proyecto archivado.`;
      return {
        nextState: rejectBillAndLinkedPolicy(updated, bill, msg),
        message: msg,
        outcome: 'rejected',
      };
    }

    if (isVetoOverride) {
      const promulgated = applyPromulgatedBillEffects(updated, bill);
      const msg = `¡VETO LEVANTADO por Asamblea General! (Dip. ${depRes.yes}≥60 y Sen. ${senRes.yes}≥19, Art. 138). Ley promulgada.`;
      return {
        nextState: {
          ...promulgated,
          history: [
            { id: `veto_ovr_${Date.now()}`, dateLabel, category: 'parlamento', title: `Veto levantado: ${bill.title}`, detail: msg },
            ...promulgated.history,
          ],
        },
        message: msg,
        outcome: 'approved',
      };
    }

    const nextBills = updated.bills.map((b) =>
      b.id === bill.id ? { ...b, legislativeStage: 'promulgacion_ejecutivo' as const } : b
    );
    const readyExecState = { ...updated, bills: nextBills };
    if (state.player.currentOffice !== 'presidente') {
      return resolveExecutiveBillDecisionAI(readyExecState, bill.id);
    }
    const msg = `Asamblea General aprobó por 2/3 (${totalYes}/130). Pasa a tu despacho presidencial para Promulgar o Vetar.`;
    return { nextState: readyExecState, message: msg, outcome: 'needs_executive' };
  }

  // 6. Promulgación Ejecutivo si ya estaba en ese estadio
  if (stage === 'promulgacion_ejecutivo') {
    if (state.player.currentOffice === 'presidente') {
      return resolveExecutiveBillAction(state, billId, 'promulgar');
    }
    return resolveExecutiveBillDecisionAI(state, billId);
  }

  return { nextState: state, message: 'Estadio legislativo completado.' };
}

/** Decisión automática del Presidente IA ante ley sancionada por el Parlamento (Art. 137) */
function resolveExecutiveBillDecisionAI(
  state: GameState,
  billId: string
): { nextState: GameState; message: string; outcome: 'approved' | 'advanced' } {
  const bill = state.bills.find((b) => b.id === billId)!;
  const presParty = state.parties.find((p) => p.id === state.nationalPresidentPartyId);
  const dateLabel = getDateLabel(state);
  const aligned =
    bill.origin === 'oficialismo' ||
    state.coalitionPartyIds.includes(bill.sponsorPartyId) ||
    (presParty ? estimatePartyBillSupport(state, bill, presParty) >= 0.48 : true);

  if (aligned) {
    const promulgated = applyPromulgatedBillEffects(state, bill);
    const msg = `Ley sancionada y promulgada por el Poder Ejecutivo (${presParty?.acronym ?? 'PE'}, Art. 137): «${bill.title}».`;
    return {
      nextState: {
        ...promulgated,
        history: [
          { id: `prom_ai_${Date.now()}`, dateLabel, category: 'parlamento', title: `Ley promulgada: ${bill.title}`, detail: msg },
          ...promulgated.history,
        ],
      },
      message: msg,
      outcome: 'approved',
    };
  }

  // Veto presidencial IA
  const vetoKind: 'parcial' | 'total' = (bill.payload.deficitDelta ?? 0) > 0.25 ? 'parcial' : 'total';
  const nextBills = state.bills.map((b) =>
    b.id === bill.id
      ? {
          ...b,
          legislativeStage: 'veto_parcial_o_total' as const,
          executiveVetoKind: vetoKind,
        }
      : b
  );
  const msg = `El Poder Ejecutivo (${presParty?.acronym ?? 'PE'}) interpuso veto ${vetoKind} (Art. 137). Requiere 3/5 por Cámara en Asamblea General para levantarlo.`;
  return {
    nextState: {
      ...state,
      bills: nextBills,
      history: [
        { id: `veto_ai_${Date.now()}`, dateLabel, category: 'parlamento', title: `Veto ${vetoKind}: ${bill.title}`, detail: msg },
        ...state.history,
      ],
    },
    message: msg,
    outcome: 'advanced',
  };
}

/** Acción explícita del jugador cuando ejerce la Presidencia (Art. 137: Promulgar, Veto Parcial, Veto Total) */
export function resolveExecutiveBillAction(
  state: GameState,
  billId: string,
  action: 'promulgar' | 'veto_parcial' | 'veto_total'
): { nextState: GameState; message: string; outcome: 'approved' | 'advanced' } {
  const bill = state.bills.find((b) => b.id === billId);
  if (!bill) return { nextState: state, message: 'Proyecto no encontrado.', outcome: 'advanced' };
  const dateLabel = getDateLabel(state);

  if (action === 'promulgar') {
    const promulgated = applyPromulgatedBillEffects(state, bill);
    const msg = `PROMULGADA: «${bill.title}» firmada por el Poder Ejecutivo (Art. 137) y en vigencia.`;
    return {
      nextState: {
        ...promulgated,
        history: [
          { id: `prom_pe_${Date.now()}`, dateLabel, category: 'parlamento', title: `Ley promulgada: ${bill.title}`, detail: msg },
          ...promulgated.history,
        ],
      },
      message: msg,
      outcome: 'approved',
    };
  }

  const vetoKind = action === 'veto_parcial' ? 'parcial' : 'total';
  const nextBills = state.bills.map((b) =>
    b.id === bill.id
      ? {
          ...b,
          legislativeStage: 'veto_parcial_o_total' as const,
          executiveVetoKind: vetoKind as 'parcial' | 'total',
        }
      : b
  );
  const msg = `Observación / Veto ${vetoKind} interpuesto por Presidencia sobre «${bill.title}» (Art. 137). Pasa a Asamblea General (3/5 por Cámara).`;
  return {
    nextState: {
      ...state,
      bills: nextBills,
      history: [
        { id: `veto_pe_${Date.now()}`, dateLabel, category: 'parlamento', title: `Veto ${vetoKind} presidencial`, detail: msg },
        ...state.history,
      ],
    },
    message: msg,
    outcome: 'advanced',
  };
}

/**
 * Art. 119: Llamado a sala / Interpelación.
 * Requiere 1/3 del total de componentes de la Cámara (33 Diputados o 11 Senadores [1/3 de 31]).
 */
export function executeChamberInterpellation(
  state: GameState,
  chamber: 'diputados' | 'senado',
  ministerId: string
): { nextState: GameState; message: string; succeeded: boolean } {
  const minister = state.cabinet.find((m) => m.id === ministerId) ?? state.cabinet[0];
  if (!minister) {
    return { nextState: state, message: 'No hay ministro activo para interpelar.', succeeded: false };
  }

  const chambers = getActiveChambers(state);
  const seatsMap = chamber === 'senado' ? chambers.senateByParty : chambers.deputiesByParty;
  const required = chamber === 'senado' ? 11 : 33; // Art. 119: 1/3 de componentes (11 de 31 en Senado, 33 de 99 en Diputados)
  const isGovPlayer = state.coalitionPartyIds.includes(state.player.partyId);

  // Calcula votos disponibles del bloque opositor / jugador que acompaña la interpelación
  const oppSupportSeats = state.parties.reduce((sum, p) => {
    const seats = seatsMap[p.id] ?? 0;
    if (seats <= 0) return sum;
    if (p.id === state.player.partyId) return sum + seats;
    if (!state.coalitionPartyIds.includes(p.id)) {
      const inBloc = state.opposition?.oppositionBlocPartyIds.includes(p.id);
      return sum + Math.round(seats * (inBloc ? 0.95 : 0.65));
    }
    return sum;
  }, 0);

  const passed = oppSupportSeats >= required;
  const dateLabel = getDateLabel(state);
  if (!passed) {
    const msg = `El llamado a sala al Ministro ${minister.ministryCode} (${minister.holderName}) reunió ${oppSupportSeats} votos y no alcanzó el 1/3 constitucional en ${
      chamber === 'senado' ? 'Senado (11)' : 'Diputados (33)'
    } (Art. 119).`;
    return {
      nextState: {
        ...state,
        history: [
          { id: `interp_fail_${Date.now()}`, dateLabel, category: 'parlamento', title: 'Llamado a sala sin 1/3', detail: msg },
          ...state.history,
        ],
      },
      message: msg,
      succeeded: false,
    };
  }

  const nextCabinet = state.cabinet.map((m) =>
    m.id === minister.id ? { ...m, popularity: Math.max(25, m.popularity - 4) } : m
  );
  const govHit = isGovPlayer ? -0.5 : -2.6;
  const nextApproval = clamp(Number((state.politicalIndicators.governmentApproval + govHit).toFixed(1)), 15, 85);
  const nextControls = (state.opposition?.parliamentaryControlsExecuted ?? 0) + 1;
  const msg = `Interpelación Art. 119 aprobada en ${
    chamber === 'senado' ? 'Senado' : 'Diputados'
  } (${oppSupportSeats}/${required} votos requeridos) contra ${minister.holderName} (${minister.ministryCode}).`;

  return {
    nextState: {
      ...state,
      cabinet: nextCabinet,
      macro: { ...state.macro, governmentApprovalPct: nextApproval },
      politicalIndicators: { ...state.politicalIndicators, governmentApproval: nextApproval },
      opposition: { ...state.opposition, parliamentaryControlsExecuted: nextControls },
      progression: state.progression.careerStats
        ? { ...state.progression, careerStats: { ...state.progression.careerStats, controlsExecuted: nextControls } }
        : state.progression,
      player: {
        ...state.player,
        attributes: { ...state.player.attributes, popularity: clamp(state.player.attributes.popularity + 2.2, 12, 98) },
      },
      history: [
        { id: `interp_ok_${Date.now()}`, dateLabel, category: 'parlamento', title: `Interpelación Art. 119: ${minister.ministryCode}`, detail: msg },
        ...state.history,
      ],
    },
    message: msg,
    succeeded: true,
  };
}

/**
 * Art. 120: Comisión Investigadora parlamentaria (requiere mayoría de la Cámara).
 */
export function executeInvestigativeCommission(
  state: GameState,
  chamber: 'diputados' | 'senado',
  topic: string
): { nextState: GameState; message: string; succeeded: boolean } {
  const chambers = getActiveChambers(state);
  const seatsMap = chamber === 'senado' ? chambers.senateByParty : chambers.deputiesByParty;
  const required = chamber === 'senado' ? 16 : 50;
  const rng = seededRandom(`${state.id}-inv-${chamber}-${topic}-${state.currentMonth}`);
  let yes = 0;

  for (const party of state.parties) {
    const seats = seatsMap[party.id] ?? 0;
    const isGov = state.coalitionPartyIds.includes(party.id);
    const prob = party.id === state.player.partyId ? 0.96 : isGov ? 0.14 : 0.82;
    for (let i = 0; i < seats; i++) {
      if (rng() < prob) yes++;
    }
  }
  if (chamber === 'senado') {
    const vpSupports = state.player.currentOffice === 'vicepresidente' ? true : false;
    if (vpSupports) yes += 1;
  }

  const succeeded = yes >= required;
  const dateLabel = getDateLabel(state);
  if (!succeeded) {
    const msg = `Comisión Investigadora sobre «${topic}» no obtuvo mayoría (${yes}/${required} votos, Art. 120).`;
    return { nextState: state, message: msg, succeeded: false };
  }

  const nextControls = (state.opposition?.parliamentaryControlsExecuted ?? 0) + 1;
  const govHit = state.coalitionPartyIds.includes(state.player.partyId) ? -0.4 : -2.2;
  const nextApproval = clamp(Number((state.politicalIndicators.governmentApproval + govHit).toFixed(1)), 15, 85);
  const msg = `Comisión Investigadora creada (Art. 120) en ${
    chamber === 'senado' ? 'Senado' : 'Diputados'
  } (${yes}/${required}) sobre «${topic}».`;

  return {
    nextState: {
      ...state,
      macro: { ...state.macro, governmentApprovalPct: nextApproval },
      politicalIndicators: { ...state.politicalIndicators, governmentApproval: nextApproval },
      opposition: {
        ...state.opposition,
        credibility: clamp(Number((state.opposition.credibility + 2.5).toFixed(1)), 20, 98),
        parliamentaryControlsExecuted: nextControls,
      },
      progression: state.progression.careerStats
        ? { ...state.progression, careerStats: { ...state.progression.careerStats, controlsExecuted: nextControls } }
        : state.progression,
      history: [
        { id: `inv_${Date.now()}`, dateLabel, category: 'parlamento', title: `Comisión Investigadora (Art. 120)`, detail: msg },
        ...state.history,
      ],
    },
    message: msg,
    succeeded: true,
  };
}

/**
 * Arts. 147–148: Moción de Censura Ministerial en Asamblea General (130 miembros).
 * Mayoría absoluta (66/130) aprueba la censura; >= 87 (2/3) fuerza renuncia inmediata;
 * entre 66 y 86 el Presidente puede observarla (si Asamblea ratifica por 3/5 = 78/130, debe cesar al ministro o disolver Cámaras).
 */
export function executeMinisterialCensureMotion(
  state: GameState,
  ministerId: string,
  reason: string
): { nextState: GameState; message: string } {
  const minister = state.cabinet.find((m) => m.id === ministerId && !m.isVacant);
  if (!minister) {
    return { nextState: state, message: 'Seleccioná un ministro activo para someter a censura.' };
  }

  const chambers = getActiveChambers(state);
  const rng = seededRandom(`${state.id}-cens-${minister.id}-${state.currentMonth}`);
  let yes = 0;
  let no = 0;

  for (const party of state.parties) {
    const seats = (chambers.deputiesByParty[party.id] ?? 0) + (chambers.senateByParty[party.id] ?? 0);
    if (seats <= 0) continue;
    const isGov = state.coalitionPartyIds.includes(party.id);
    const baseProb =
      party.id === state.player.partyId
        ? 0.96
        : isGov
        ? clamp(0.12 + (100 - minister.popularity) * 0.003, 0.05, 0.35)
        : clamp(0.74 + (55 - state.politicalIndicators.governmentApproval) * 0.006, 0.35, 0.94);

    for (let i = 0; i < seats; i++) {
      if (rng() < baseProb) yes++;
      else no++;
    }
  }
  // Voto del Vicepresidente en Asamblea General (Art. 94)
  if (state.player.currentOffice === 'vicepresidente') yes += 1;
  else no += 1;

  const dateLabel = getDateLabel(state);
  if (yes < 66) {
    const msg = `Censura rechazada en Asamblea General contra ${minister.holderName} (${yes} Sí / ${no} No · requería 66/130, Art. 147).`;
    return {
      nextState: {
        ...state,
        censureProcess: {
          id: `cens_${Date.now()}`,
          ministerId: minister.id,
          ministryCode: minister.ministryCode,
          ministerName: minister.holderName,
          reason,
          status: 'superada',
          assemblyVotesYes: yes,
          assemblyVotesNo: no,
          createdDateLabel: dateLabel,
        },
        history: [
          { id: `cens_fail_${Date.now()}`, dateLabel, category: 'parlamento', title: `Censura rechazada: ${minister.ministryCode}`, detail: msg },
          ...state.history,
        ],
      },
      message: msg,
    };
  }

  // >= 87 (2/3): renuncia obligatoria inmediata
  if (yes >= 87) {
    const nextCabinet = state.cabinet.map((m) =>
      m.id === minister.id ? { ...m, isVacant: true, holderName: `Vacante (${m.ministryCode})` } : m
    );
    const msg = `CENSURA POR 2/3 (${yes}/130, Art. 148): ${minister.holderName} (${minister.ministryCode}) queda obligatoriamente separado del cargo.`;
    return {
      nextState: {
        ...state,
        cabinet: nextCabinet,
        censureProcess: null,
        politicalIndicators: {
          ...state.politicalIndicators,
          governmentApproval: Math.max(15, state.politicalIndicators.governmentApproval - 4.5),
          coalitionStability: Math.max(18, state.politicalIndicators.coalitionStability - 6),
        },
        history: [
          { id: `cens_23_${Date.now()}`, dateLabel, category: 'parlamento', title: `Renuncia forzosa: ${minister.ministryCode}`, detail: msg },
          ...state.history,
        ],
      },
      message: msg,
    };
  }

  // 66..86: Si jugador no es Presidente, IA decide observar o aceptar renuncia
  const censureRecord: MinisterialCensureState = {
    id: `cens_${Date.now()}`,
    ministerId: minister.id,
    ministryCode: minister.ministryCode,
    ministerName: minister.holderName,
    reason,
    status: state.player.currentOffice === 'presidente' ? 'en_asamblea' : 'observada_pe',
    assemblyVotesYes: yes,
    assemblyVotesNo: no,
    createdDateLabel: dateLabel,
  };

  if (state.player.currentOffice !== 'presidente') {
    const msg = `Censura aprobada por mayoría absoluta (${yes}/130, Art. 147). El Poder Ejecutivo observó la censura (Art. 148): Asamblea puede ratificar con 3/5 (78/130).`;
    return {
      nextState: {
        ...state,
        censureProcess: censureRecord,
        history: [
          { id: `cens_obs_${Date.now()}`, dateLabel, category: 'parlamento', title: `Censura observada por Presidencia`, detail: msg },
          ...state.history,
        ],
      },
      message: msg,
    };
  }

  const msg = `Asamblea General aprobó censura (${yes}/130, Art. 147) contra ${minister.holderName}. Como Presidente podés aceptar la renuncia u observarla (Art. 148).`;
  return {
    nextState: {
      ...state,
      censureProcess: censureRecord,
    },
    message: msg,
  };
}

export function resolveCensureAction(
  state: GameState,
  action: 'aceptar_renuncia' | 'observar_pe' | 'ratificar_35' | 'disolver_camaras'
): { nextState: GameState; message: string } {
  const proc = state.censureProcess;
  if (!proc) return { nextState: state, message: 'No hay proceso de censura activo.' };
  const dateLabel = getDateLabel(state);

  if (action === 'aceptar_renuncia') {
    const nextCabinet = state.cabinet.map((m) =>
      m.id === proc.ministerId ? { ...m, isVacant: true, holderName: `Vacante (${m.ministryCode})` } : m
    );
    const msg = `Presidencia aceptó la renuncia de ${proc.ministerName} (${proc.ministryCode}) tras la censura parlamentaria.`;
    return {
      nextState: {
        ...state,
        cabinet: nextCabinet,
        censureProcess: null,
        history: [{ id: `cens_res_${Date.now()}`, dateLabel, category: 'gobierno', title: `Cese ministerial: ${proc.ministryCode}`, detail: msg }, ...state.history],
      },
      message: msg,
    };
  }

  if (action === 'observar_pe') {
    const msg = `Presidencia observó la censura sobre ${proc.ministerName} (Art. 148). Si Asamblea General ratifica con 3/5 (78/130), se abre disolución o cese.`;
    return {
      nextState: {
        ...state,
        censureProcess: { ...proc, status: 'observada_pe' },
        history: [{ id: `cens_pe_obs_${Date.now()}`, dateLabel, category: 'gobierno', title: `Censura observada (Art. 148)`, detail: msg }, ...state.history],
      },
      message: msg,
    };
  }

  if (action === 'ratificar_35') {
    const yes = Math.min(130, (proc.assemblyVotesYes ?? 68) + 8);
    if (yes >= 78) {
      const nextCabinet = state.cabinet.map((m) =>
        m.id === proc.ministerId ? { ...m, isVacant: true, holderName: `Vacante (${m.ministryCode})` } : m
      );
      const msg = `Asamblea General ratificó la censura por 3/5 (${yes}/130, Art. 148). Cae ${proc.ministerName}.`;
      return {
        nextState: {
          ...state,
          cabinet: nextCabinet,
          censureProcess: { ...proc, status: 'ratificada', assemblyVotesYes: yes },
          history: [{ id: `cens_rat_${Date.now()}`, dateLabel, category: 'parlamento', title: `Censura ratificada 3/5`, detail: msg }, ...state.history],
        },
        message: msg,
      };
    }
    const msg = `Asamblea General no reunió 3/5 (${yes}/78). El ministro continúa en funciones.`;
    return {
      nextState: {
        ...state,
        censureProcess: { ...proc, status: 'superada' },
        history: [{ id: `cens_keep_${Date.now()}`, dateLabel, category: 'parlamento', title: `Censura no ratificada`, detail: msg }, ...state.history],
      },
      message: msg,
    };
  }

  // Disolución de Cámaras (Art. 148): reabre campaña legislativa anticipada preservando continuidad
  const msg = 'Art. 148 aplicado: Disolución constitucional de las Cámaras y convocatoria a elección parlamentaria anticipada.';
  return {
    nextState: {
      ...state,
      censureProcess: null,
      careerPhase: 'campana',
      electoralStage: 'internas_completadas',
      politicalIndicators: {
        ...state.politicalIndicators,
        coalitionStability: Math.max(20, state.politicalIndicators.coalitionStability - 12),
      },
      history: [{ id: `dissolve_${Date.now()}`, dateLabel, category: 'sistema', title: `Disolución de Cámaras (Art. 148)`, detail: msg }, ...state.history],
    },
    message: msg,
  };
}

/**
 * Art. 187 Constitución: Venia del Senado para designación de Directores de Entes Autónomos y Servicios Descentralizados.
 * Requiere 3/5 de los 30 Senadores electos (18 votos) dentro de 60 días; pasados 60 días basta mayoría absoluta (16 votos).
 */
export function voteSenateVenia(
  state: GameState,
  veniaId: string
): { nextState: GameState; message: string; approved: boolean } {
  const venia = (state.pendingVenias ?? []).find((v) => v.id === veniaId && v.status === 'pendiente');
  if (!venia) {
    return { nextState: state, message: 'Solicitud de venia no encontrada.', approved: false };
  }

  const chambers = getActiveChambers(state);
  const rng = seededRandom(`${state.id}-venia-${venia.id}-${state.currentMonth}`);
  const requiredVotes = venia.daysElapsed >= 60 ? 16 : 18;
  let yes = 0;
  let no = 0;

  for (const party of state.parties) {
    const seats = chambers.senateByParty[party.id] ?? 0;
    if (seats <= 0) continue;
    const isGov = state.coalitionPartyIds.includes(party.id);
    const rel = state.player.relations.find((r) => r.partyId === party.id)?.affinity ?? 0;
    const prob =
      party.id === venia.nomineePartyId || isGov
        ? 0.94
        : clamp(0.45 + rel * 0.004, 0.15, 0.85);
    for (let i = 0; i < seats; i++) {
      if (rng() < prob) yes++;
      else no++;
    }
  }

  const approved = yes >= requiredVotes;
  const dateLabel = getDateLabel(state);
  const nextVenias: SenateVeniaRequest[] = (state.pendingVenias ?? []).map((v) =>
    v.id === venia.id
      ? {
          ...v,
          status: approved ? 'aprobada' : 'rechazada',
          votesYes: yes,
          votesNo: no,
          requiredVotes,
        }
      : v
  );

  const nextEnterprises = approved
    ? (state.publicEnterprises ?? []).map((e) =>
        e.id === venia.enterpriseId
          ? { ...e, directorName: venia.nomineeName, senateVeniaApproved: true }
          : e
      )
    : state.publicEnterprises;

  const msg = approved
    ? `Venia concedida por el Senado (Art. 187 · ${yes}/${requiredVotes} votos): ${venia.nomineeName} asume en ${venia.enterpriseName}.`
    : `Venia denegada en el Senado (${yes}/${requiredVotes} votos requeridos, Art. 187) para ${venia.nomineeName} en ${venia.enterpriseName}.`;

  return {
    nextState: {
      ...state,
      pendingVenias: nextVenias,
      publicEnterprises: nextEnterprises,
      history: [
        { id: `venia_${Date.now()}`, dateLabel, category: 'parlamento', title: `Venia Art. 187: ${venia.enterpriseId.toUpperCase()}`, detail: msg },
        ...state.history,
      ],
    },
    message: msg,
    approved,
  };
}

/**
 * Procesamiento mensual constitucional de plazos parlamentarios:
 * - Descuenta 30 días en proyectos presupuestales (45+45+15+15 Arts. 217–219).
 * - Rechaza automáticamente si vence el plazo constitucional.
 * - Suma 30 días a venias pendientes del Senado (60 días Art. 187).
 * - Introduce automáticamente la Rendición de Cuentas en Junio (Art. 214) si estamos en fase de gobierno.
 */
export function processMonthlyParliamentDeadlines(
  bills: BillProposal[],
  pendingVenias: SenateVeniaRequest[] | undefined,
  context: { nextYear: number; nextMonth: number; careerPhase: GameState['careerPhase']; govPartyId: string; dateLabel: string; deficitPct: number }
): {
  nextBills: BillProposal[];
  nextPendingVenias: SenateVeniaRequest[];
  parliamentLogs: GameState['history'];
} {
  const parliamentLogs: GameState['history'] = [];

  const nextBills = bills.map((b) => {
    if (b.status !== 'en_negociacion' || b.deadlineDaysRemaining === undefined) return b;
    const remaining = b.deadlineDaysRemaining - 30;
    if (remaining <= 0 && b.isConstitutionalBudgetBill) {
      parliamentLogs.push({
        id: `exp_${b.id}_${Date.now()}`,
        dateLabel: context.dateLabel,
        category: 'parlamento',
        title: `Vencimiento constitucional (Art. 217): ${b.title}`,
        detail: 'Expiró el plazo constitucional de 45/15 días sin sanción; la iniciativa queda rechazada automáticamente.',
      });
      return {
        ...b,
        deadlineDaysRemaining: 0,
        status: 'rechazada' as const,
        legislativeStage: 'rechazada' as const,
      };
    }
    return { ...b, deadlineDaysRemaining: Math.max(1, remaining) };
  });

  // En junio (mes 6) de fase gobierno, ingresa Rendición de Cuentas si no existe una del año en curso
  if (context.careerPhase === 'gobierno' && context.nextMonth === 6) {
    const rendId = `bill_rendicion_${context.nextYear}`;
    if (!nextBills.some((b) => b.id === rendId)) {
      nextBills.unshift({
        id: rendId,
        title: `Rendición de Cuentas y Balance de Ejecución Presupuestal ${context.nextYear}`,
        category: 'presupuestal',
        summary: `Balance anual del ejercicio fiscal (déficit ${context.deficitPct.toFixed(2)}% PIB) presentado ante el Parlamento conforme al Art. 214.`,
        sponsorPartyId: context.govPartyId,
        origin: 'oficialismo',
        playerBenchPosition: 'sin_definir',
        effectsDescription: '+0.25% PIB potencial, orden fiscal e impulso a partidas prioritarias.',
        politicalCapitalCost: 12,
        chamber: 'ambas',
        originChamber: 'diputados',
        legislativeStage: 'camara_origen_comision',
        committeeName: 'Comisión de Presupuestos integrada con Hacienda',
        deadlineDaysRemaining: 45,
        isConstitutionalBudgetBill: true,
        executiveVetoKind: 'ninguno',
        status: 'en_negociacion',
        concessionsApplied: [],
        negotiatedPartySupport: {},
        payload: { gdpDelta: 0.25, approvalDelta: 2, productivityDelta: 1.0, riskDelta: -3 },
      });
    }
  }

  const nextPendingVenias = (pendingVenias ?? []).map((v) =>
    v.status === 'pendiente' ? { ...v, daysElapsed: v.daysElapsed + 30 } : v
  );

  return { nextBills, nextPendingVenias, parliamentLogs };
}
