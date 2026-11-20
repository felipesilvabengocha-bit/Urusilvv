import { MONTH_NAMES } from '../data/uruguayData';
import {
  BillProposal,
  DifficultyConfig,
  GameState,
  GovernmentPromise,
  MacroSnapshot,
  OppositionOpportunity,
  OppositionStance,
  OppositionState,
  Party,
} from '../types/game';
import { seededRandom } from './electoralEngine';

export const OPPOSITION_STANCES: Array<{
  id: OppositionStance;
  label: string;
  summary: string;
  effectsHint: string;
}> = [
  {
    id: 'constructiva',
    label: 'Oposición Constructiva',
    summary: 'Prioriza estabilidad institucional, dialoga y acompaña proyectos coincidentes con tu programa.',
    effectsHint: '+Credibilidad institucional y confianza empresarial, +afinidad con gobierno, menor voto protesta.',
  },
  {
    id: 'critica',
    label: 'Oposición Crítica',
    summary: 'Fiscaliza con firmeza errores de gestión y promesas incumplidas sin bloquear sistemáticamente.',
    effectsHint: 'Equilibrio entre desgaste al oficialismo, credibilidad y visibilidad pública.',
  },
  {
    id: 'confrontativa',
    label: 'Oposición Confrontativa',
    summary: 'Enfrentamiento político frontal, movilización opositora y rechazo en bloque a iniciativas oficialistas.',
    effectsHint: 'Alto desgaste al oficialismo e impulso si la economía cae; riesgo de rechazo si el gobierno es popular.',
  },
  {
    id: 'negociadora',
    label: 'Oposición Negociadora',
    summary: 'Busca incidir en la agenda arrancando concesiones presupuestales y modificaciones en leyes del gobierno.',
    effectsHint: '+Facilidad de acuerdos parlamentarios y apoyo transversal en proyectos propios.',
  },
  {
    id: 'propositiva',
    label: 'Oposición Propositiva',
    summary: 'Contrasta con proyectos de ley alternativos, propuestas técnicas y renovación programática.',
    effectsHint: '+Credibilidad del partido, +popularidad sostenida y mejora de base electoral para el próximo ciclo.',
  },
];

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function isPlayerInNationalOpposition(state: GameState): boolean {
  return (
    state.nationalPresidentPartyId !== state.player.partyId &&
    !state.coalitionPartyIds.includes(state.player.partyId)
  );
}

export function buildPromisesForParty(party: Party, macro: MacroSnapshot): GovernmentPromise[] {
  const isLeft = party.ideology.economic < 45;
  if (isLeft) {
    return [
      {
        id: 'prom_wage',
        title: 'Crecimiento sostenido del salario real (> +1.8% anual)',
        metric: 'realWageGrowthPct',
        comparator: 'gte',
        targetValue: 1.8,
        targetLabel: 'Salario real ≥ +1.8%',
        denounced: false,
      },
      {
        id: 'prom_pov',
        title: `Reducir la pobreza por debajo de ${Math.max(7, Number((macro.povertyPct - 1.2).toFixed(1)))}%`,
        metric: 'povertyPct',
        comparator: 'lte',
        targetValue: Math.max(7, Number((macro.povertyPct - 1.2).toFixed(1))),
        targetLabel: `Pobreza ≤ ${Math.max(7, Number((macro.povertyPct - 1.2).toFixed(1)))}%`,
        denounced: false,
      },
      {
        id: 'prom_emp',
        title: 'Contener el desempleo debajo del 8.0%',
        metric: 'unemploymentPct',
        comparator: 'lte',
        targetValue: 8.0,
        targetLabel: 'Desempleo ≤ 8.0%',
        denounced: false,
      },
      {
        id: 'prom_inf',
        title: 'Mantener la inflación dentro del rango meta (≤ 6.0%)',
        metric: 'inflationPct',
        comparator: 'lte',
        targetValue: 6.0,
        targetLabel: 'Inflación ≤ 6.0%',
        denounced: false,
      },
    ];
  }

  return [
    {
      id: 'prom_def',
      title: 'Reducir el déficit fiscal por debajo del 3.0% del PIB',
      metric: 'fiscalDeficitPctGdp',
      comparator: 'lte',
      targetValue: 3.0,
      targetLabel: 'Déficit ≤ 3.0% PIB',
      denounced: false,
    },
    {
      id: 'prom_inf',
      title: 'Mantener la inflación controlada (≤ 5.8%)',
      metric: 'inflationPct',
      comparator: 'lte',
      targetValue: 5.8,
      targetLabel: 'Inflación ≤ 5.8%',
      denounced: false,
    },
    {
      id: 'prom_gdp',
      title: 'Sostener el crecimiento del PIB por encima de +2.3%',
      metric: 'gdpGrowthPct',
      comparator: 'gte',
      targetValue: 2.3,
      targetLabel: 'PIB ≥ +2.3%',
      denounced: false,
    },
    {
      id: 'prom_emp',
      title: 'Bajar el desempleo debajo del 7.9%',
      metric: 'unemploymentPct',
      comparator: 'lte',
      targetValue: 7.9,
      targetLabel: 'Desempleo ≤ 7.9%',
      denounced: false,
    },
  ];
}

export function evaluatePromiseStatus(
  promise: GovernmentPromise,
  macro: MacroSnapshot
): 'cumplida' | 'incumplida' {
  const actual = macro[promise.metric];
  if (promise.comparator === 'lte') {
    return actual <= promise.targetValue ? 'cumplida' : 'incumplida';
  }
  return actual >= promise.targetValue ? 'cumplida' : 'incumplida';
}

export function createInitialOppositionState(
  parties: Party[],
  incumbentPartyId: string,
  macro: MacroSnapshot
): OppositionState {
  const govParty = parties.find((p) => p.id === incumbentPartyId) ?? parties[0];
  const strategies: Record<string, OppositionStance> = {};
  parties.forEach((p) => {
    if (p.aiPersonality === 'disruptivo') strategies[p.id] = 'confrontativa';
    else if (p.aiPersonality === 'reformista') strategies[p.id] = 'propositiva';
    else if (p.aiPersonality === 'pragmatico') strategies[p.id] = 'negociadora';
    else if (p.aiPersonality === 'conservador') strategies[p.id] = 'critica';
    else strategies[p.id] = 'constructiva';
  });

  return {
    stance: 'critica',
    credibility: 64,
    internalLeadership: 62,
    oppositionBlocPartyIds: [],
    recruitedLeadersCount: 0,
    parliamentaryControlsExecuted: 0,
    partyOppositionStrategies: strategies,
    governmentPromises: buildPromisesForParty(govParty, macro),
    opportunities: [],
  };
}

const AI_GOV_BILLS: Array<Omit<BillProposal, 'id' | 'sponsorPartyId' | 'status' | 'concessionsApplied' | 'negotiatedPartySupport'>> = [
  {
    title: 'Proyecto de Ajuste de Tarifas y Regla Fiscal Plurianual (Oficialismo)',
    category: 'economica',
    origin: 'oficialismo',
    playerBenchPosition: 'sin_definir',
    summary: 'Iniciativa del Poder Ejecutivo para reordenar topes de gasto corriente y metas de déficit fiscal.',
    effectsDescription: '-0.35% déficit fiscal, -6 pb riesgo país, tensión con sindicatos.',
    politicalCapitalCost: 8,
    chamber: 'ambas',
    payload: { deficitDelta: -0.35, riskDelta: -6, businessTrustDelta: 4, unionTrustDelta: -4 },
  },
  {
    title: 'Ley de Rendición de Cuentas y Refuerzo Social (Oficialismo)',
    category: 'presupuestal',
    origin: 'oficialismo',
    playerBenchPosition: 'sin_definir',
    summary: 'Asigna partidas del Poder Ejecutivo para programas territoriales, seguridad e infraestructura vial.',
    effectsDescription: '+0.25% PIB, +0.25% déficit, +2 aprobación del gobierno.',
    politicalCapitalCost: 8,
    chamber: 'ambas',
    payload: { gdpDelta: 0.25, deficitDelta: 0.25, approvalDelta: 2, unemploymentDelta: -0.2 },
  },
  {
    title: 'Marco de Fomento a Inversiones y Zonas Francas (Oficialismo)',
    category: 'laboral',
    origin: 'oficialismo',
    playerBenchPosition: 'sin_definir',
    summary: 'Crea estímulos tributarios condicionados a generación de empleo formal en el interior.',
    effectsDescription: '+0.3% PIB, -0.3% desempleo, +4 confianza empresarial.',
    politicalCapitalCost: 8,
    chamber: 'ambas',
    payload: { gdpDelta: 0.3, unemploymentDelta: -0.3, businessTrustDelta: 4, revenueDelta: -0.15 },
  },
];

/**
 * Ejecuta el turno autónomo del Gobierno controlado por IA cuando el jugador NO ocupa la Presidencia.
 * Toma decisiones fiscales reales, envía proyectos al Parlamento y genera coyunturas aprovechables por la oposición.
 */
export function processAIGovernmentTurn(
  state: GameState,
  difficulty: DifficultyConfig
): {
  nextFiscalLevers: GameState['fiscalLevers'];
  nextBills: GameState['bills'];
  nextEvents: GameState['events'];
  nextOpposition: OppositionState;
  aiGovLogNote: string | null;
} {
  const rng = seededRandom(`${state.id}-aigov-${state.currentYear}-${state.currentMonth}`);
  const govParty = state.parties.find((p) => p.id === state.nationalPresidentPartyId) ?? state.parties[0];
  const dateLabel = `${MONTH_NAMES[state.currentMonth - 1]} ${state.currentYear}`;

  // 1. El Ejecutivo IA ajusta sutilmente palancas fiscales según su orientación ideológica
  const nextLevers = { ...state.fiscalLevers };
  let govActionNote: string | null = null;

  if (rng() < 0.45) {
    if (govParty.ideology.economic < 45) {
      nextLevers.socialSubsidiesIndex = Math.min(135, nextLevers.socialSubsidiesIndex + 2);
      nextLevers.publicWageAdjustment = Number(Math.min(4, nextLevers.publicWageAdjustment + 0.2).toFixed(1));
      govActionNote = `El Ejecutivo (${govParty.acronym}) amplió transferencias sociales y pautas salariales públicas.`;
    } else {
      nextLevers.publicInvestmentBoost = Math.min(24, nextLevers.publicInvestmentBoost + 2);
      nextLevers.tradeOpenness = Math.min(82, nextLevers.tradeOpenness + 2);
      nextLevers.productiveIncentives = Math.min(85, nextLevers.productiveIncentives + 2);
      govActionNote = `El Ejecutivo (${govParty.acronym}) profundizó incentivos a la inversión privada y apertura comercial.`;
    }
  }

  // 2. El Gobierno IA presenta proyectos oficialistas al Parlamento si hay espacio
  let nextBills = [...state.bills];
  const openGovBills = nextBills.filter((b) => b.origin === 'oficialismo' && b.status === 'en_negociacion').length;
  if (state.careerPhase === 'gobierno' && openGovBills < 2 && rng() < 0.32) {
    const tpl = AI_GOV_BILLS[(state.currentMonth + state.currentYear) % AI_GOV_BILLS.length];
    const alreadyExists = nextBills.some((b) => b.title === tpl.title && b.status === 'en_negociacion');
    if (!alreadyExists) {
      nextBills = [
        {
          ...tpl,
          id: `bill_gov_${state.currentYear}_${state.currentMonth}`,
          sponsorPartyId: govParty.id,
          status: 'en_negociacion',
          concessionsApplied: [],
          negotiatedPartySupport: {},
        },
        ...nextBills,
      ];
      govActionNote = `El Poder Ejecutivo (${govParty.acronym}) envió al Parlamento: «${tpl.title}».`;
    }
  }

  // 3. El Presidente IA resuelve crisis nacionales pendientes si llevan más de 1 mes sin resolverse
  const nextEvents = state.events.map((evt, idx) => {
    if (!evt.resolved && idx >= 1) {
      const opt = evt.options[govParty.ideology.economic < 45 ? Math.min(1, evt.options.length - 1) : 0];
      return {
        ...evt,
        resolved: true,
        chosenOptionId: opt?.id,
        resolutionOutcome: `Resuelto por el Ejecutivo (${govParty.acronym}): ${opt?.label ?? 'Decisión ministerial'}.`,
      };
    }
    return evt;
  });

  // 4. Genera oportunidades de opinión pública aprovechables por la oposición
  const oppList = [...state.opposition.opportunities];
  const openOpp = oppList.filter((o) => !o.capitalized).length;

  if (openOpp < 3 && rng() < 0.58 * difficulty.crisisFrequency) {
    const pool: Omit<OppositionOpportunity, 'id' | 'dateLabel' | 'capitalized'>[] = [];
    if (state.macro.unemploymentPct > 8.1) {
      pool.push({
        category: 'desempleo',
        title: 'Aumento del desempleo y cierre de líneas industriales',
        summary: `La desocupación escaló a ${state.macro.unemploymentPct.toFixed(1)}% y gremiales reclaman respuestas urgentes al Ministerio de Trabajo.`,
        severity: 7,
      });
    }
    if (state.politicalIndicators.coalitionStability < 68) {
      pool.push({
        category: 'coalicion',
        title: 'Cruces públicos dentro de la coalición gobernante',
        summary: `Sectores aliados de ${govParty.name} discrepan públicamente por prioridades presupuestales y cargos en entes autónomos.`,
        severity: 6,
      });
    }
    if (state.macro.inflationPct > 6.0 || state.macro.fiscalDeficitPctGdp > 3.4) {
      pool.push({
        category: 'economia',
        title: 'Desvíos en metas de inflación y déficit fiscal',
        summary: `Indicadores macroeconómicos muestran presión sobre precios (${state.macro.inflationPct.toFixed(1)}%) y cuentas públicas (${state.macro.fiscalDeficitPctGdp.toFixed(2)}% PIB).`,
        severity: 7,
      });
    }
    pool.push(
      {
        category: 'seguridad',
        title: 'Cuestionamientos por seguridad pública en área metropolitana',
        summary: 'Comisiones vecinales y prensa reportan alza de delitos complejos y demoras en despliegue preventivo.',
        severity: 8,
      },
      {
        category: 'educacion',
        title: 'Conflicto docente y reclamos presupuestales en ANEP',
        summary: 'Gremios de enseñanza media ocupan centros reclamando horas docentes, infraestructura y becas.',
        severity: 6,
      },
      {
        category: 'escandalo',
        title: 'Cuestionamiento por adjudicación directa en ente autónomo',
        summary: 'Informe técnico observa discrecionalidad en licitación pública del directorio oficialista.',
        severity: 8,
      }
    );

    const chosen = pool[Math.floor(rng() * pool.length)];
    if (chosen) {
      oppList.unshift({
        ...chosen,
        id: `opp_${state.currentYear}_${state.currentMonth}_${Math.floor(rng() * 999)}`,
        dateLabel,
        capitalized: false,
      });
    }
  }

  return {
    nextFiscalLevers: nextLevers,
    nextBills,
    nextEvents,
    nextOpposition: {
      ...state.opposition,
      opportunities: oppList.slice(0, 12),
      lastAIGovActionNote: govActionNote ?? state.opposition.lastAIGovActionNote,
    },
    aiGovLogNote: govActionNote,
  };
}

/**
 * Efecto mensual pasivo de la estrategia de oposición adoptada por el jugador.
 */
export function applyOppositionStanceMonthlyDrift(state: GameState): GameState {
  if (!isPlayerInNationalOpposition(state)) return state;
  const stance = state.opposition.stance;
  const govApp = state.politicalIndicators.governmentApproval;

  let credDelta = 0;
  let momDelta = 0;
  let relGovDelta = 0;
  let popDelta = 0;

  if (stance === 'constructiva') {
    credDelta = 0.8;
    relGovDelta = 1;
    momDelta = 0.1;
  } else if (stance === 'critica') {
    credDelta = 0.3;
    momDelta = govApp < 48 ? 0.5 : 0.2;
    relGovDelta = -1;
  } else if (stance === 'confrontativa') {
    momDelta = govApp < 45 ? 0.9 : -0.35;
    credDelta = govApp > 54 ? -0.9 : -0.15;
    relGovDelta = -2;
    popDelta = govApp > 55 ? -0.3 : 0.2;
  } else if (stance === 'negociadora') {
    credDelta = 0.5;
    relGovDelta = 0.6;
    momDelta = 0.25;
  } else if (stance === 'propositiva') {
    credDelta = 1.0;
    popDelta = 0.35;
    momDelta = 0.4;
  }

  const nextParties = state.parties.map((p) =>
    p.id === state.player.partyId
      ? {
          ...p,
          campaignMomentum: Number(clamp(p.campaignMomentum + momDelta, -12, 15).toFixed(2)),
          currentPollShare: Number(clamp(p.currentPollShare + momDelta * 0.2, 0.5, 60).toFixed(2)),
        }
      : p
  );

  const nextRelations = state.player.relations.map((r) =>
    r.partyId === state.nationalPresidentPartyId
      ? { ...r, affinity: Math.round(clamp(r.affinity + relGovDelta, -100, 100)) }
      : r
  );

  return {
    ...state,
    parties: nextParties,
    opposition: {
      ...state.opposition,
      credibility: Number(clamp(state.opposition.credibility + credDelta, 15, 98).toFixed(1)),
    },
    player: {
      ...state.player,
      relations: nextRelations,
      attributes: {
        ...state.player.attributes,
        popularity: Number(clamp(state.player.attributes.popularity + popDelta, 12, 98).toFixed(1)),
      },
    },
  };
}

/**
 * Capitalizar políticamente un error/coyuntura del gobierno adversario (con riesgo real de fracaso o rechazo).
 */
export function capitalizeOppositionOpportunity(
  state: GameState,
  oppId: string,
  approach: 'denuncia_dura' | 'alternativa_tecnica'
): { nextState: GameState; message: string } {
  const opp = state.opposition.opportunities.find((o) => o.id === oppId);
  if (!opp || opp.capitalized) {
    return { nextState: state, message: 'Esta coyuntura ya fue procesada.' };
  }

  const costCap = approach === 'denuncia_dura' ? 4 : 5;
  if (state.player.politicalCapital < costCap) {
    return { nextState: state, message: `Necesitás ${costCap} de capital político.` };
  }

  const rng = seededRandom(`${state.id}-cap-${oppId}-${approach}`);
  const govPopularPenalty = Math.max(0, state.politicalIndicators.governmentApproval - 50) * 0.8;
  const credBonus = (state.opposition.credibility - 55) * 0.45;
  const baseSuccess = approach === 'alternativa_tecnica' ? 76 : 64;
  const successProb = clamp(baseSuccess + credBonus - govPopularPenalty + opp.severity * 1.5, 22, 92);
  const succeeded = rng() * 100 < successProb;

  let popDelta = 0;
  let pollDelta = 0;
  let credDelta = 0;
  let govAppDelta = 0;
  let note = '';

  if (succeeded) {
    popDelta = approach === 'denuncia_dura' ? 2.1 : 1.7;
    pollDelta = approach === 'denuncia_dura' ? 0.9 : 0.7;
    credDelta = approach === 'alternativa_tecnica' ? 3.5 : 1.5;
    govAppDelta = -2.2;
    note =
      approach === 'denuncia_dura'
        ? `Tu denuncia pública sobre «${opp.title}» marcó agenda y erosionó al oficialismo (+${popDelta} pop., -2.2% aprob. gobierno).`
        : `Presentaste salida técnica frente a «${opp.title}», elevando credibilidad (+${credDelta}) y respaldo ciudadano (+${popDelta} pop.).`;
  } else {
    popDelta = -1.3;
    credDelta = -3.0;
    govAppDelta = 0.8;
    note = `Rechazo público: la ciudadanía percibió oportunismo político ante «${opp.title}» (${popDelta} pop., -3 credibilidad).`;
  }

  const nextOpps = state.opposition.opportunities.map((o) =>
    o.id === oppId ? { ...o, capitalized: true, outcomeNote: note } : o
  );
  const nextParties = state.parties.map((p) =>
    p.id === state.player.partyId
      ? {
          ...p,
          currentPollShare: Number(clamp(p.currentPollShare + pollDelta, 0.5, 62).toFixed(2)),
          campaignMomentum: Number(clamp(p.campaignMomentum + (succeeded ? 1.4 : -0.9), -12, 15).toFixed(2)),
        }
      : p
  );

  const nextState: GameState = {
    ...state,
    parties: nextParties,
    politicalIndicators: {
      ...state.politicalIndicators,
      governmentApproval: Number(
        clamp(state.politicalIndicators.governmentApproval + govAppDelta, 15, 85).toFixed(1)
      ),
    },
    opposition: {
      ...state.opposition,
      credibility: Number(clamp(state.opposition.credibility + credDelta, 15, 98).toFixed(1)),
      opportunities: nextOpps,
    },
    player: {
      ...state.player,
      politicalCapital: state.player.politicalCapital - costCap,
      attributes: {
        ...state.player.attributes,
        popularity: Number(clamp(state.player.attributes.popularity + popDelta, 12, 98).toFixed(1)),
      },
    },
    history: [
      {
        id: `oppcap_${Date.now()}`,
        dateLabel: `${MONTH_NAMES[state.currentMonth - 1]} ${state.currentYear}`,
        category: 'campana',
        title: `Oposición frente a: ${opp.title}`,
        detail: note,
      },
      ...state.history,
    ],
  };

  return { nextState, message: note };
}
