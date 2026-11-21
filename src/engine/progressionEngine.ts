import { ACHIEVEMENTS, MONTH_NAMES } from '../data/uruguayData';
import {
  DepartmentData,
  DynamicObjective,
  GameState,
  NarrativeMoment,
  ProgressionState,
  UnlockedAchievementRecord,
} from '../types/game';
import { getPlayerCapabilities } from './capabilitiesEngine';
import { recordAchievementAndMeta } from './storageEngine';

export interface NewsHeadline {
  id: string;
  section: 'Economía' | 'Parlamento' | 'Oposición' | 'Territorio' | 'Campaña' | 'Gobierno';
  headline: string;
  deck: string;
  tone: 'positive' | 'neutral' | 'warning';
}

function formatDateLabel(state: Pick<GameState, 'currentMonth' | 'currentYear'>): string {
  const m = MONTH_NAMES[(state.currentMonth - 1 + 12) % 12] ?? 'Marzo';
  return `${m} ${state.currentYear}`;
}

export function buildPreviousDeptIncumbents(departments: DepartmentData[]): Record<string, string> {
  const rec: Record<string, string> = {};
  for (const d of departments) {
    rec[d.id] = d.currentIntendentePartyId;
  }
  return rec;
}

function getDifficultyScale(difficultyId: GameState['difficultyId']): number {
  switch (difficultyId) {
    case 'muy_facil':
      return 0.85;
    case 'facil':
      return 0.95;
    case 'normal':
      return 1.0;
    case 'dificil':
      return 1.25;
    case 'realista':
      return 1.45;
    default:
      return 1.0;
  }
}

function scaleReward(baseCp: number, baseMoney: number, difficultyId: GameState['difficultyId']) {
  const mult = getDifficultyScale(difficultyId);
  return {
    capitalReward: Math.max(5, Math.round(baseCp * mult)),
    moneyRewardUYU: Math.round((baseMoney * mult) / 50000) * 50000,
  };
}

/**
 * Genera misiones tácticas rotativas de corto plazo (3 a 6 meses) con recompensas proporcionales.
 */
export function generateTacticalMissions(state: GameState): NonNullable<ProgressionState['tacticalMissions']> {
  const diff = state.difficultyId;
  const party = state.parties.find((p) => p.id === state.player.partyId);
  const poll = party?.currentPollShare ?? 15;
  const missions: NonNullable<ProgressionState['tacticalMissions']> = [];

  if (state.careerPhase === 'campana') {
    const r1 = scaleReward(6, 650000, diff);
    missions.push({
      id: `mis_pop_${state.cycleNumber}_${state.currentMonth}`,
      title: 'Impulso de Opinión Pública',
      description: 'Subí tu popularidad personal mediante actos, recorridas o debates.',
      currentValue: Math.round(state.player.attributes.popularity),
      targetValue: Math.min(92, Math.round(state.player.attributes.popularity + 3)),
      unitLabel: 'pts',
      capitalReward: r1.capitalReward,
      moneyRewardUYU: r1.moneyRewardUYU,
      expiresInMonths: 4,
      completed: false,
    });
    const r2 = scaleReward(7, 800000, diff);
    missions.push({
      id: `mis_poll_${state.cycleNumber}_${state.currentMonth}`,
      title: 'Despegue de Encuestas',
      description: `Consolidá intención de voto de ${party?.acronym ?? 'tu lema'} en todo el país.`,
      currentValue: Number(poll.toFixed(1)),
      targetValue: Number(Math.min(58, poll + 1.8).toFixed(1)),
      unitLabel: '%',
      capitalReward: r2.capitalReward,
      moneyRewardUYU: r2.moneyRewardUYU,
      expiresInMonths: 5,
      completed: false,
    });
  } else if (state.player.currentOffice === 'presidente') {
    const r1 = scaleReward(9, 1100000, diff);
    missions.push({
      id: `mis_pol_${state.cycleNumber}_${state.currentMonth}`,
      title: 'Implementar Política Pública Estratégica',
      description: 'Diseñá y promulgá una política pública en el Laboratorio OPP/MEF.',
      currentValue: (state.activePolicies ?? []).length,
      targetValue: (state.activePolicies ?? []).length + 1,
      unitLabel: 'políticas',
      capitalReward: r1.capitalReward,
      moneyRewardUYU: r1.moneyRewardUYU,
      expiresInMonths: 6,
      completed: false,
    });
    const r2 = scaleReward(8, 950000, diff);
    missions.push({
      id: `mis_def_${state.cycleNumber}_${state.currentMonth}`,
      title: 'Contener el Déficit Fiscal',
      description: 'Mantené o reducí el déficit fiscal por debajo de la meta mensual.',
      currentValue: Number(state.macro.fiscalDeficitPctGdp.toFixed(2)),
      targetValue: Number(Math.max(1.8, state.macro.fiscalDeficitPctGdp - 0.35).toFixed(2)),
      unitLabel: '% PIB máx',
      capitalReward: r2.capitalReward,
      moneyRewardUYU: r2.moneyRewardUYU,
      expiresInMonths: 6,
      completed: false,
    });
  } else {
    const r1 = scaleReward(7, 750000, diff);
    missions.push({
      id: `mis_all_${state.cycleNumber}_${state.currentMonth}`,
      title: 'Construcción de Vínculos Partidarios',
      description: 'Sumá afinidad o acuerdos con otros sectores y lemas del sistema.',
      currentValue: state.player.relations.filter((r) => r.affinity >= 25).length,
      targetValue: Math.min(state.player.relations.length, state.player.relations.filter((r) => r.affinity >= 25).length + 1),
      unitLabel: 'aliados',
      capitalReward: r1.capitalReward,
      moneyRewardUYU: r1.moneyRewardUYU,
      expiresInMonths: 5,
      completed: false,
    });
  }

  return missions.slice(0, 2);
}

/**
 * Genera objetivos contextuales estrictamente ligados al rol real del jugador y su momento institucional.
 */
export function generateContextualObjectives(
  state: GameState,
  existingIds: Set<string> = new Set()
): DynamicObjective[] {
  const caps = getPlayerCapabilities(state);
  const playerParty = state.parties.find((p) => p.id === state.player.partyId);
  const partyPoll = playerParty?.currentPollShare ?? 15;
  const objectives: DynamicObjective[] = [];
  const diff = state.difficultyId;

  if (state.careerPhase === 'campana') {
    if (!existingIds.has('obj_camp_poll')) {
      const target = Number(Math.min(54, Math.max(partyPoll + 4.5, 18)).toFixed(1));
      const rew = scaleReward(12, 1300000, diff);
      objectives.push({
        id: 'obj_camp_poll',
        title: 'Crecer en la intención de voto nacional',
        description: `Ubicar a ${playerParty?.acronym ?? 'tu lema'} en ${target}% en encuestas.`,
        category: 'campana',
        currentValue: Number(partyPoll.toFixed(1)),
        targetValue: target,
        unitLabel: '%',
        xpReward: 0,
        capitalReward: rew.capitalReward,
        moneyRewardUYU: rew.moneyRewardUYU,
        difficultyTier: 'alta',
        completed: false,
      });
    }
    if (!existingIds.has('obj_camp_pop')) {
      const targetPop = Math.min(88, Math.round(state.player.attributes.popularity + 6));
      const rew = scaleReward(10, 950000, diff);
      objectives.push({
        id: 'obj_camp_pop',
        title: 'Consolidar imagen pública',
        description: 'Elevar popularidad personal mediante actos, debates y recorridas.',
        category: 'campana',
        currentValue: Math.round(state.player.attributes.popularity),
        targetValue: targetPop,
        unitLabel: 'pts',
        xpReward: 0,
        capitalReward: rew.capitalReward,
        moneyRewardUYU: rew.moneyRewardUYU,
        difficultyTier: 'media',
        completed: false,
      });
    }
    if (!existingIds.has('obj_camp_program')) {
      const adoptedCount = state.programProposals.filter((p) => p.adopted).length;
      const rew = scaleReward(8, 700000, diff);
      objectives.push({
        id: 'obj_camp_program',
        title: 'Estructurar plataforma programática',
        description: 'Adoptar propuestas concretas de gobierno para respaldar tu campaña.',
        category: 'campana',
        currentValue: adoptedCount,
        targetValue: Math.min(state.programProposals.length, Math.max(3, adoptedCount + 2)),
        unitLabel: 'propuestas',
        xpReward: 0,
        capitalReward: rew.capitalReward,
        moneyRewardUYU: rew.moneyRewardUYU,
        difficultyTier: 'baja',
        completed: false,
      });
    }
    return objectives.slice(0, 3);
  }

  // Fase de gobierno / mandato
  if (caps.canSignPresidentialDecrees) {
    if (!existingIds.has('obj_pres_infl')) {
      const rew = scaleReward(13, 1400000, diff);
      objectives.push({
        id: 'obj_pres_infl',
        title: 'Inflación dentro del rango meta (<6.0%)',
        description: 'Sostener estabilidad de precios con política fiscal y salarial equilibrada.',
        category: 'gobierno',
        currentValue: Number(state.macro.inflationPct.toFixed(1)),
        targetValue: 6.0,
        unitLabel: '% máx',
        xpReward: 0,
        capitalReward: rew.capitalReward,
        moneyRewardUYU: rew.moneyRewardUYU,
        difficultyTier: 'media',
        completed: false,
      });
    }
    if (!existingIds.has('obj_pres_laws')) {
      const targetWins = state.player.legislativeWins + 2;
      const rew = scaleReward(15, 1650000, diff);
      objectives.push({
        id: 'obj_pres_laws',
        title: 'Sancionar agenda legislativa',
        description: 'Lograr mayorías en el Parlamento para aprobar proyectos clave.',
        category: 'gobierno',
        currentValue: state.player.legislativeWins,
        targetValue: targetWins,
        unitLabel: 'leyes',
        xpReward: 0,
        capitalReward: rew.capitalReward,
        moneyRewardUYU: rew.moneyRewardUYU,
        difficultyTier: 'alta',
        completed: false,
      });
    }
    if (!existingIds.has('obj_pres_pov')) {
      const targetPov = Number(Math.max(4.5, state.macro.povertyPct - 1.2).toFixed(1));
      const rew = scaleReward(16, 1800000, diff);
      objectives.push({
        id: 'obj_pres_pov',
        title: 'Reducir la pobreza nacional',
        description: 'Impulsar empleo formal, productividad y políticas sociales eficaces.',
        category: 'gobierno',
        currentValue: Number(state.macro.povertyPct.toFixed(1)),
        targetValue: targetPov,
        unitLabel: '% meta',
        xpReward: 0,
        capitalReward: rew.capitalReward,
        moneyRewardUYU: rew.moneyRewardUYU,
        difficultyTier: 'alta',
        completed: false,
      });
    }
    return objectives.slice(0, 3);
  }

  if (caps.canAdministerDepartamentalBudget || caps.currentOffice === 'alcalde') {
    const dept = state.departments.find((d) => d.id === state.player.targetDepartment);
    const deptSupport = dept?.localServiceQuality ?? 50;
    if (!existingIds.has('obj_int_support')) {
      const rew = scaleReward(11, 1100000, diff);
      objectives.push({
        id: 'obj_int_support',
        title: `Mejorar servicios en ${dept?.name ?? 'tu departamento'}`,
        description: 'Ejecutar obras, gestionar servicios locales y sostener la gestión comunal.',
        category: 'intendencia',
        currentValue: Math.round(deptSupport),
        targetValue: Math.min(92, Math.round(deptSupport + 6)),
        unitLabel: 'pts',
        xpReward: 0,
        capitalReward: rew.capitalReward,
        moneyRewardUYU: rew.moneyRewardUYU,
        difficultyTier: 'media',
        completed: false,
      });
    }
    if (!existingIds.has('obj_int_unemp')) {
      const currUnemp = dept?.unemploymentRate ?? state.macro.unemploymentPct;
      const rew = scaleReward(14, 1500000, diff);
      objectives.push({
        id: 'obj_int_unemp',
        title: 'Dinamizar el empleo departamental',
        description: 'Atraer inversión local y reducir el desempleo en tu jurisdicción.',
        category: 'intendencia',
        currentValue: Number(currUnemp.toFixed(1)),
        targetValue: Number(Math.max(4.5, currUnemp - 0.8).toFixed(1)),
        unitLabel: '% meta',
        xpReward: 0,
        capitalReward: rew.capitalReward,
        moneyRewardUYU: rew.moneyRewardUYU,
        difficultyTier: 'alta',
        completed: false,
      });
    }
    if (!existingIds.has('obj_int_junta')) {
      const rew = scaleReward(10, 900000, diff);
      objectives.push({
        id: 'obj_int_junta',
        title: 'Aprobar ordenanzas en Junta Departamental',
        description: 'Articular acuerdos con ediles para sancionar iniciativas y presupuesto local.',
        category: 'intendencia',
        currentValue: state.player.legislativeWins,
        targetValue: state.player.legislativeWins + 1,
        unitLabel: 'normas',
        xpReward: 0,
        capitalReward: rew.capitalReward,
        moneyRewardUYU: rew.moneyRewardUYU,
        difficultyTier: 'baja',
        completed: false,
      });
    }
    return objectives.slice(0, 3);
  }

  // Oposición o legislador no ejecutivo
  if (caps.isInNationalOpposition) {
    if (!existingIds.has('obj_opp_cred')) {
      const rew = scaleReward(12, 1150000, diff);
      objectives.push({
        id: 'obj_opp_cred',
        title: 'Elevar la credibilidad opositora',
        description: 'Combinar control responsable, coherencia estratégica y propuestas verificables.',
        category: 'oposicion',
        currentValue: Math.round(state.opposition.credibility),
        targetValue: Math.min(90, Math.round(state.opposition.credibility + 8)),
        unitLabel: 'pts',
        xpReward: 0,
        capitalReward: rew.capitalReward,
        moneyRewardUYU: rew.moneyRewardUYU,
        difficultyTier: 'media',
        completed: false,
      });
    }
    if (!existingIds.has('obj_opp_ctrl')) {
      const rew = scaleReward(11, 1000000, diff);
      objectives.push({
        id: 'obj_opp_ctrl',
        title: 'Ejercer control parlamentario y político',
        description: 'Realizar llamados a sala, interpelaciones o comisiones investigadoras.',
        category: 'oposicion',
        currentValue: state.opposition.parliamentaryControlsExecuted,
        targetValue: state.opposition.parliamentaryControlsExecuted + 2,
        unitLabel: 'acciones',
        xpReward: 0,
        capitalReward: rew.capitalReward,
        moneyRewardUYU: rew.moneyRewardUYU,
        difficultyTier: 'media',
        completed: false,
      });
    }
    if (!existingIds.has('obj_opp_poll')) {
      const rew = scaleReward(15, 1600000, diff);
      objectives.push({
        id: 'obj_opp_poll',
        title: 'Posicionar alternativa electoral',
        description: `Expandir la base electoral de ${playerParty?.acronym ?? 'tu partido'} desde la oposición.`,
        category: 'oposicion',
        currentValue: Number(partyPoll.toFixed(1)),
        targetValue: Number(Math.min(50, partyPoll + 4.0).toFixed(1)),
        unitLabel: '%',
        xpReward: 0,
        capitalReward: rew.capitalReward,
        moneyRewardUYU: rew.moneyRewardUYU,
        difficultyTier: 'alta',
        completed: false,
      });
    }
    return objectives.slice(0, 3);
  }

  // Legislador oficialista o dirigente partidario sin cartera ejecutiva
  const rewWins = scaleReward(12, 1200000, diff);
  objectives.push({
    id: 'obj_leg_wins',
    title: 'Impulsar proyectos y acuerdos legislativos',
    description: 'Negociar con otras bancadas para convertir iniciativas en leyes sancionadas.',
    category: 'gobierno',
    currentValue: state.player.legislativeWins,
    targetValue: state.player.legislativeWins + 2,
    unitLabel: 'leyes',
    xpReward: 0,
    capitalReward: rewWins.capitalReward,
    moneyRewardUYU: rewWins.moneyRewardUYU,
    difficultyTier: 'media',
    completed: false,
  });

  const rewAllies = scaleReward(10, 950000, diff);
  const currentStrongAllies = state.player.relations.filter((r) => r.affinity >= 30).length;
  objectives.push({
    id: 'obj_leg_allies',
    title: 'Construir acuerdos entre partidos',
    description: 'Alcanzar afinidad bilateral (>=30) con más fuerzas del Parlamento.',
    category: 'gobierno',
    currentValue: currentStrongAllies,
    targetValue: Math.min(state.player.relations.length, currentStrongAllies + 2),
    unitLabel: 'partidos',
    xpReward: 0,
    capitalReward: rewAllies.capitalReward,
    moneyRewardUYU: rewAllies.moneyRewardUYU,
    difficultyTier: 'media',
    completed: false,
  });

  return objectives;
}

export function createInitialProgressionState(params: {
  initialPovertyPct: number;
  departments: DepartmentData[];
  dateLabel: string;
  isCustomParty: boolean;
  partyName: string;
  playerName: string;
}): ProgressionState {
  const fundacionMoment: NarrativeMoment | undefined = params.isCustomParty
    ? {
        id: `moment_fundacion_${Date.now()}`,
        kind: 'fundacion_partido',
        newspaperName: 'CRÓNICA POLÍTICA DEL URUGUAY',
        kicker: 'NUEVO LEMA REGISTRADO ANTE LA CORTE ELECTORAL',
        headline: `Nace «${params.partyName}» para disputar el sistema político`,
        subheadline: `Encabezado por ${params.playerName}, el nuevo espacio presenta su declaración de principios y se alista para la competencia electoral.`,
        bodyText:
          'Con fuerte presencia territorial y listas propias, la nueva fuerza política ingresa al escenario nacional con el desafío de superar el umbral electoral en octubre y conquistar representación parlamentaria.',
        quoteText: `«No venimos a administrar inercias: venimos a abrir una alternativa real para la República.»`,
        dateLabel: params.dateLabel,
        imageKey: 'campaignRally',
        seen: false,
      }
    : undefined;

  return {
    xp: 0,
    levelNumber: 1,
    levelTitle: 'Trayectoria Republicana',
    unlockedAchievements: [],
    activeObjectives: [],
    tacticalMissions: [],
    careerStats: {
      lawsPassed: 0,
      policiesEnacted: 0,
      electionsWon: 0,
      electionsLost: 0,
      coalitionsFormed: 0,
      partiesMerged: 0,
      ministersAppointed: 0,
      controlsExecuted: 0,
    },
    completedObjectivesCount: 0,
    xpHistory: [],
    pendingMoment: fundacionMoment,
    momentsArchive: fundacionMoment ? [fundacionMoment] : [],
    cycleStartPovertyPct: params.initialPovertyPct,
    previousDeptIncumbents: buildPreviousDeptIncumbents(params.departments),
  };
}

/**
 * Evalúa TODOS los logros contra el estado real del juego (cero falsos positivos).
 */
export function evaluateRealAchievements(state: GameState): string[] {
  const unlocked = new Set(state.progression.unlockedAchievements.map((u) => u.id));
  const newlyUnlocked: string[] = [];

  const check = (id: string, condition: boolean) => {
    if (!unlocked.has(id) && condition) {
      newlyUnlocked.push(id);
    }
  };

  const playerParty = state.parties.find((p) => p.id === state.player.partyId);
  const playerNat = state.nationalResult?.partyTotals.find((p) => p.partyId === state.player.partyId);
  const totalSeats = (playerNat?.senateSeats ?? 0) + (playerNat?.deputySeats ?? 0);
  const presWonByPlayer =
    state.player.currentOffice === 'presidente' ||
    (state.nationalPresidentPartyId === state.player.partyId &&
      state.internalResult?.playerWonPrimary &&
      state.player.targetOffice === 'presidente');

  const resolvedEventsCount = state.events.filter((e) => e.resolved).length;
  const approvedBills = state.bills.filter((b) => b.status === 'aprobada');
  const prevIncs = state.progression.previousDeptIncumbents ?? {};
  const flippedDept = state.departamentalResult?.departments.some(
    (d) =>
      d.winningLemaId === state.player.partyId &&
      prevIncs[d.departmentId] &&
      prevIncs[d.departmentId] !== state.player.partyId
  );

  // Electorales
  check('primera_interna', Boolean(state.internalResult?.playerWonPrimary));
  check(
    'banca_parlamentaria',
    state.player.currentOffice === 'senador' || state.player.currentOffice === 'diputado'
  );
  check(
    'primera_vuelta_historica',
    Boolean(state.nationalResult?.directWinnerPartyId === state.player.partyId && presWonByPlayer)
  );
  check(
    'rey_del_balotaje',
    Boolean(state.runoffResult?.winnerPartyId === state.player.partyId && presWonByPlayer)
  );
  check('jefe_comunal', state.player.currentOffice === 'intendente');

  // Gobierno
  check(
    'reduccion_pobreza',
    state.careerPhase === 'gobierno' &&
      state.coalitionPartyIds.includes(state.player.partyId) &&
      state.progression.cycleStartPovertyPct - state.macro.povertyPct >= 1.5
  );
  check(
    'crecimiento_sostenido',
    state.careerPhase === 'gobierno' &&
      state.macro.gdpGrowthPct >= 3.5 &&
      state.macro.unemploymentPct <= 8.0
  );
  check(
    'equilibrio_macro',
    state.careerPhase === 'gobierno' &&
      state.macro.fiscalDeficitPctGdp < 2.5 &&
      state.macro.inflationPct >= 3.0 &&
      state.macro.inflationPct <= 6.0
  );
  check('crisis_superada', resolvedEventsCount >= 3);
  check(
    'mandato_completo',
    state.careerPhase === 'fin_mandato' &&
      Boolean(state.termLegacySummary && state.termLegacySummary.grade !== 'Desgastado')
  );

  // Parlamentarios
  check('ley_aprobada', state.player.legislativeWins >= 1 || approvedBills.length >= 1);
  check(
    'mayoria_parlamentaria',
    Boolean(playerNat && (playerNat.senateSeats >= 16 || playerNat.deputySeats >= 50))
  );
  check('coalicion_legislativa', state.player.legislativeWins >= 3 || approvedBills.length >= 3);
  check('fiscalizador_activo', state.opposition.parliamentaryControlsExecuted >= 2);
  check(
    'pacto_presupuestal',
    approvedBills.some((b) => b.category === 'presupuestal' || b.category === 'economica')
  );

  // Políticos
  check('partido_nuevo_banca', Boolean(playerParty?.isCustom && totalSeats >= 1));
  check('alternancia_departamental', Boolean(flippedDept));
  check(
    'lider_oposicion',
    state.opposition.credibility >= 70 && state.opposition.oppositionBlocPartyIds.length >= 1
  );
  check('carrera_completa', state.cycleNumber >= 2);
  check('hegemonia_electoral', (playerParty?.currentPollShare ?? 0) >= 42);

  return newlyUnlocked;
}

function updateObjectivesProgress(state: GameState, objectives: DynamicObjective[]): DynamicObjective[] {
  const playerParty = state.parties.find((p) => p.id === state.player.partyId);
  const dept = state.departments.find((d) => d.id === state.player.targetDepartment);

  return objectives.map((obj) => {
    if (obj.completed) return obj;
    let current = obj.currentValue;
    let isDone = false;

    switch (obj.id) {
      case 'obj_camp_poll':
      case 'obj_opp_poll':
        current = Number((playerParty?.currentPollShare ?? 0).toFixed(1));
        isDone = current >= obj.targetValue;
        break;
      case 'obj_camp_pop':
        current = Math.round(state.player.attributes.popularity);
        isDone = current >= obj.targetValue;
        break;
      case 'obj_camp_program':
        current = state.programProposals.filter((p) => p.adopted).length;
        isDone = current >= obj.targetValue;
        break;
      case 'obj_pres_infl':
        current = Number(state.macro.inflationPct.toFixed(1));
        isDone = current <= obj.targetValue;
        break;
      case 'obj_pres_laws':
      case 'obj_int_junta':
      case 'obj_leg_wins':
        current = state.player.legislativeWins;
        isDone = current >= obj.targetValue;
        break;
      case 'obj_pres_pov':
        current = Number(state.macro.povertyPct.toFixed(1));
        isDone = current <= obj.targetValue;
        break;
      case 'obj_int_support':
        current = Math.round(dept?.localServiceQuality ?? 50);
        isDone = current >= obj.targetValue;
        break;
      case 'obj_int_unemp':
        current = Number((dept?.unemploymentRate ?? state.macro.unemploymentPct).toFixed(1));
        isDone = current <= obj.targetValue;
        break;
      case 'obj_opp_cred':
        current = Math.round(state.opposition.credibility);
        isDone = current >= obj.targetValue;
        break;
      case 'obj_opp_ctrl':
        current = state.opposition.parliamentaryControlsExecuted;
        isDone = current >= obj.targetValue;
        break;
      case 'obj_leg_allies':
        current = state.player.relations.filter((r) => r.affinity >= 30).length;
        isDone = current >= obj.targetValue;
        break;
      case 'obj_leg_cap':
        current = Math.round(state.player.politicalCapital);
        isDone = current >= obj.targetValue;
        break;
    }

    return {
      ...obj,
      currentValue: current,
      completed: isDone,
      completedDateLabel: isDone ? formatDateLabel(state) : undefined,
    };
  });
}

function maybeBuildMilestoneMoment(prev: GameState, next: GameState): NarrativeMoment | undefined {
  const dateLabel = formatDateLabel(next);
  const playerParty = next.parties.find((p) => p.id === next.player.partyId);
  const presParty = next.parties.find((p) => p.id === next.nationalPresidentPartyId);

  // 1. Asunción presidencial o paso a la oposición el 1.° de marzo
  if (!prev.nationalInauguratedInCycle && next.nationalInauguratedInCycle && next.careerPhase === 'gobierno') {
    const isPlayerPres = next.player.currentOffice === 'presidente';
    const inOpp = !next.coalitionPartyIds.includes(next.player.partyId);

    if (isPlayerPres) {
      return {
        id: `moment_asuncion_${next.cycleNumber}_${Date.now()}`,
        kind: 'asuncion_presidencial',
        newspaperName: 'DIARIO OFICIAL Y CRÓNICA NACIONAL',
        kicker: '1.° DE MARZO · TRANSMISIÓN DE MANDO PRESIDENCIAL',
        headline: `${next.player.name} asume la Presidencia de la República`,
        subheadline: `Tras prestar juramento ante la Asamblea General en el Palacio Legislativo, recibe la banda presidencial en Plaza Independencia.`,
        bodyText: `El nuevo Poder Ejecutivo liderado por ${playerParty?.name ?? 'su partido'} inicia su período constitucional de cinco años con agenda económica, social e institucional propia.`,
        quoteText: `«Gobernaremos con apego a la Constitución, diálogo democrático y responsabilidad ante toda la ciudadanía.»`,
        dateLabel,
        imageKey: 'ceremonyPalacio',
        seen: false,
      };
    }

    if (inOpp) {
      return {
        id: `moment_opp_${next.cycleNumber}_${Date.now()}`,
        kind: 'derrota_oposicion',
        newspaperName: 'EL OBSERVADOR REPUBLICANO',
        kicker: 'CAMBIO DE MANDO · NUEVO EQUILIBRIO PARLAMENTARIO',
        headline: `${playerParty?.name ?? 'Tu lema'} inicia el ciclo como fuerza de oposición`,
        subheadline: `${presParty?.name ?? 'El oficialismo'} asume la conducción del Ejecutivo con ${next.nationalPresidentName} al frente de Torre Ejecutiva.`,
        bodyText: `Desde el rol institucional que conquistaste en las urnas, comienza la etapa de control parlamentario, articulación opositora y construcción programática para el próximo ciclo.`,
        quoteText: `«La alternancia fortalece a la República; nuestra bancada ejercerá un control firme y propositivo.»`,
        dateLabel,
        imageKey: 'ceremonyPalacio',
        seen: false,
      };
    }
  }

  // 2. Victoria electoral confirmada (balotaje o primera vuelta directa o intendencia ganada)
  if (!prev.runoffResult && next.runoffResult?.winnerPartyId === next.player.partyId) {
    const winnerCand =
      next.runoffResult.winnerPartyId === next.runoffResult.candidateA.partyId
        ? next.runoffResult.candidateA
        : next.runoffResult.candidateB;
    return {
      id: `moment_vic_runoff_${next.cycleNumber}_${Date.now()}`,
      kind: 'victoria_electoral',
      newspaperName: 'EDICIÓN EXTRAORDINARIA DE NOVIEMBRE',
      kicker: 'CORTE ELECTORAL CONFIRMA EL TRIUNFO EN BALOTAJE',
      headline: `Victoria de ${winnerCand.formula} en segunda vuelta`,
      subheadline: `La fórmula de ${playerParty?.name ?? ''} alcanzó ${winnerCand.pctOfEmitted.toFixed(1)}% de los votos emitidos en todo el país.`,
      bodyText: `La ciudadanía definió la conducción nacional en balotaje. Comienza la transición institucional hacia el 1.° de marzo y la conformación de acuerdos en el nuevo Parlamento.`,
      quoteText: `«Hoy ganó la democracia uruguaya y empieza el tiempo de construir acuerdos para toda la nación.»`,
      dateLabel,
      imageKey: 'campaignRally',
      seen: false,
    };
  }

  if (!prev.nationalResult && next.nationalResult?.directWinnerPartyId === next.player.partyId) {
    const winnerPct =
      next.nationalResult.partyTotals.find((p) => p.partyId === next.player.partyId)?.pctOfEmitted ?? 50;
    return {
      id: `moment_vic_oct_${next.cycleNumber}_${Date.now()}`,
      kind: 'victoria_electoral',
      newspaperName: 'EDICIÓN ESPECIAL DE OCTUBRE',
      kicker: 'MAYORÍA ABSOLUTA EN PRIMERA VUELTA',
      headline: `${playerParty?.name ?? ''} conquista la Presidencia en octubre`,
      subheadline: `Con ${winnerPct.toFixed(1)}% de los sufragios, la fórmula triunfa sin necesidad de balotaje.`,
      bodyText: `El escrutinio nacional consagra un mandato directo y otorga fuerte legitimidad parlamentaria en ambas cámaras del Palacio Legislativo.`,
      dateLabel,
      imageKey: 'campaignRally',
      seen: false,
    };
  }

  // 3. Intendencia ganada en mayo
  if (!prev.departamentalResult && next.departamentalResult?.playerWonDepartamentalOffice && next.player.targetOffice === 'intendente') {
    const deptName = next.departments.find((d) => d.id === next.player.targetDepartment)?.name ?? 'el departamento';
    return {
      id: `moment_int_${next.cycleNumber}_${Date.now()}`,
      kind: 'victoria_electoral',
      newspaperName: 'CRÓNICA DEPARTAMENTAL',
      kicker: 'ELECCIONES DEPARTAMENTALES DE MAYO',
      headline: `${next.player.name} electo Intendente de ${deptName}`,
      subheadline: `Triunfo territorial con respaldo mayoritario en la Junta Departamental.`,
      bodyText: `La campaña territorial rinde frutos y abre cinco años de ejecución de obras, servicios públicos y articulación con municipios.`,
      dateLabel,
      imageKey: 'campaignRally',
      seen: false,
    };
  }

  // 4. Primera gran reforma aprobada o ley estructural
  if (prev.player.legislativeWins === 0 && next.player.legislativeWins >= 1) {
    const latestApproved = next.bills.find((b) => b.status === 'aprobada');
    return {
      id: `moment_ley_${Date.now()}`,
      kind: 'reforma_historica',
      newspaperName: 'GACETA PARLAMENTARIA',
      kicker: 'SANCIÓN LEGISLATIVA EN EL PALACIO',
      headline: `Aprobada la ley: ${latestApproved?.title ?? 'Reforma estructural'}`,
      subheadline: `El Parlamento sancionó la iniciativa tras rondas de negociación entre sectores y bancadas.`,
      bodyText: `Tu capacidad de articulación política convirtió un proyecto estratégico en legislación vigente para la República.`,
      dateLabel,
      imageKey: 'presidentialDesk',
      seen: false,
    };
  }

  return undefined;
}

/**
 * Sincroniza logros reales, objetivos dinámicos, misiones tácticas (CP + dinero UYU) y estadísticas históricas.
 */
export function syncProgression(prev: GameState, next: GameState): GameState {
  const dateLabel = formatDateLabel(next);
  const advancedMonth = prev.currentMonth !== next.currentMonth || prev.currentYear !== next.currentYear;

  const existingObjs =
    next.progression.activeObjectives.length > 0
      ? next.progression.activeObjectives
      : generateContextualObjectives(next);
  const evaluatedObjs = updateObjectivesProgress(next, existingObjs);

  let capitalBonus = 0;
  let moneyBonus = 0;
  let completedCount = next.progression.completedObjectivesCount;
  const newlyCompletedIds = new Set<string>();
  const keptActive: DynamicObjective[] = [];
  const rewardNotes: string[] = [];

  for (const obj of evaluatedObjs) {
    if (obj.completed) {
      newlyCompletedIds.add(obj.id);
      capitalBonus += obj.capitalReward;
      moneyBonus += obj.moneyRewardUYU ?? 500000;
      completedCount += 1;
      rewardNotes.push(`Objetivo cumplido: ${obj.title} (+${obj.capitalReward} CP · +$${((obj.moneyRewardUYU ?? 500000) / 1000).toLocaleString('es-UY')} mil UYU)`);
    } else {
      const isCampObj = obj.category === 'campana';
      if (next.careerPhase === 'gobierno' && isCampObj) {
        continue;
      }
      keptActive.push(obj);
    }
  }

  const activeObjectives = keptActive;
  if (next.careerPhase !== 'fin_mandato' && activeObjectives.length < 3) {
    const exclude = new Set([...activeObjectives.map((o) => o.id), ...newlyCompletedIds]);
    const replacements = generateContextualObjectives(next, exclude);
    for (const rep of replacements) {
      if (activeObjectives.length < 3) {
        activeObjectives.push(rep);
      }
    }
  }

  // Evaluar misiones tácticas de corto plazo
  const playerParty = next.parties.find((p) => p.id === next.player.partyId);
  const baseMissions =
    next.progression.tacticalMissions && next.progression.tacticalMissions.length > 0
      ? next.progression.tacticalMissions
      : generateTacticalMissions(next);

  const keptMissions: NonNullable<ProgressionState['tacticalMissions']> = [];
  for (const m of baseMissions) {
    if (m.completed) continue;
    let curr = m.currentValue;
    let done = false;
    if (m.id.startsWith('mis_pop_')) {
      curr = Math.round(next.player.attributes.popularity);
      done = curr >= m.targetValue;
    } else if (m.id.startsWith('mis_poll_')) {
      curr = Number((playerParty?.currentPollShare ?? 0).toFixed(1));
      done = curr >= m.targetValue;
    } else if (m.id.startsWith('mis_pol_')) {
      curr = (next.activePolicies ?? []).length;
      done = curr >= m.targetValue;
    } else if (m.id.startsWith('mis_def_')) {
      curr = Number(next.macro.fiscalDeficitPctGdp.toFixed(2));
      done = curr <= m.targetValue;
    } else if (m.id.startsWith('mis_all_')) {
      curr = next.player.relations.filter((r) => r.affinity >= 25).length;
      done = curr >= m.targetValue;
    }
    if (done) {
      capitalBonus += m.capitalReward;
      moneyBonus += m.moneyRewardUYU;
      rewardNotes.push(`Misión táctica: ${m.title} (+${m.capitalReward} CP · +$${(m.moneyRewardUYU / 1000).toLocaleString('es-UY')} mil)`);
    } else {
      const remMonths = advancedMonth ? m.expiresInMonths - 1 : m.expiresInMonths;
      if (remMonths > 0) {
        keptMissions.push({ ...m, currentValue: curr, expiresInMonths: remMonths });
      }
    }
  }
  if (next.careerPhase !== 'fin_mandato' && keptMissions.length < 2) {
    const fresh = generateTacticalMissions(next);
    for (const fm of fresh) {
      if (keptMissions.length < 2 && !keptMissions.some((k) => k.title === fm.title)) {
        keptMissions.push(fm);
      }
    }
  }

  // Logros reales
  const newAchIds = evaluateRealAchievements(next);
  const newAchRecords: UnlockedAchievementRecord[] = newAchIds.map((id) => ({
    id,
    unlockedAtDate: dateLabel,
    cycleNumber: next.cycleNumber,
  }));

  if (newAchIds.length > 0) {
    const achCp = newAchIds.length * 6;
    const achMoney = newAchIds.length * 600000;
    capitalBonus += achCp;
    moneyBonus += achMoney;
    recordAchievementAndMeta(
      next,
      newAchIds,
      next.player.currentOffice === 'intendente' ? next.player.targetDepartment : undefined
    );
  }

  const milestoneMoment =
    next.progression.pendingMoment ?? maybeBuildMilestoneMoment(prev, next);

  const momentsArchive =
    milestoneMoment && !next.progression.momentsArchive.some((m) => m.id === milestoneMoment.id)
      ? [milestoneMoment, ...next.progression.momentsArchive].slice(0, 30)
      : next.progression.momentsArchive;

  const extraRewardLogs = rewardNotes.map((msg, idx) => ({
    id: `rew_${Date.now()}_${idx}`,
    dateLabel,
    category: 'sistema' as const,
    title: 'Recompensa por objetivo cumplido',
    detail: msg,
  }));

  const prevStats = next.progression.careerStats ?? {
    lawsPassed: next.player.legislativeWins,
    policiesEnacted: next.activePolicies?.length ?? 0,
    electionsWon: 0,
    electionsLost: 0,
    coalitionsFormed: next.electoralAlliances?.length ?? 0,
    partiesMerged: next.partyMergers?.length ?? 0,
    ministersAppointed: 0,
    controlsExecuted: next.opposition.parliamentaryControlsExecuted,
  };

  return {
    ...next,
    player: {
      ...next.player,
      politicalCapital: Math.min(100, next.player.politicalCapital),
      campaignFundsUYU: next.player.campaignFundsUYU + moneyBonus,
    },
    progression: {
      ...next.progression,
      unlockedAchievements: [...next.progression.unlockedAchievements, ...newAchRecords],
      activeObjectives,
      tacticalMissions: keptMissions,
      careerStats: {
        ...prevStats,
        lawsPassed: Math.max(prevStats.lawsPassed, next.player.legislativeWins),
        policiesEnacted: Math.max(prevStats.policiesEnacted, next.activePolicies?.length ?? 0),
        coalitionsFormed: Math.max(prevStats.coalitionsFormed, next.electoralAlliances?.length ?? 0),
        partiesMerged: Math.max(prevStats.partiesMerged, next.partyMergers?.length ?? 0),
        controlsExecuted: Math.max(prevStats.controlsExecuted, next.opposition.parliamentaryControlsExecuted),
      },
      completedObjectivesCount: completedCount,
      pendingMoment: milestoneMoment,
      momentsArchive,
    },
    history: extraRewardLogs.length > 0 ? [...extraRewardLogs, ...next.history].slice(0, 120) : next.history,
  };
}

/**
 * Construye titulares dinámicos reales para la sección «Crónica Política» del juego.
 */
export function buildDynamicNewsHeadlines(state: GameState): NewsHeadline[] {
  const headlines: NewsHeadline[] = [];
  const playerParty = state.parties.find((p) => p.id === state.player.partyId);
  const presParty = state.parties.find((p) => p.id === state.nationalPresidentPartyId);
  const inOpposition =
    state.careerPhase === 'gobierno' && !state.coalitionPartyIds.includes(state.player.partyId);

  // 1. Titular macroeconómico real
  if (state.macro.inflationPct > 6.8) {
    headlines.push({
      id: 'news_infl_high',
      section: 'Economía',
      headline: `La inflación escala al ${state.macro.inflationPct.toFixed(1)}% y tensiona la negociación salarial`,
      deck: `Analistas observan presiones sobre la canasta básica y el tipo de cambio ($${state.macro.exchangeRateUYU.toFixed(1)}).`,
      tone: 'warning',
    });
  } else if (state.macro.gdpGrowthPct >= 2.8) {
    headlines.push({
      id: 'news_gdp_pos',
      section: 'Economía',
      headline: `La actividad crece ${state.macro.gdpGrowthPct.toFixed(1)}% interanual con riesgo país en ${state.macro.countryRiskBps} pts`,
      deck: `El desempleo se ubica en ${state.macro.unemploymentPct.toFixed(1)}% y la pobreza registra ${state.macro.povertyPct.toFixed(1)}%.`,
      tone: 'positive',
    });
  } else {
    headlines.push({
      id: 'news_eco_neutral',
      section: 'Economía',
      headline: `Economía cierra el mes con crecimiento de ${state.macro.gdpGrowthPct.toFixed(1)}% y déficit de ${state.macro.fiscalDeficitPctGdp.toFixed(1)}%`,
      deck: `Inflación en ${state.macro.inflationPct.toFixed(1)}% anual, riesgo país en ${state.macro.countryRiskBps} pb y dólar a $${state.macro.exchangeRateUYU.toFixed(1)}.`,
      tone: 'neutral',
    });
  }

  // 2. Titular electoral / encuestas
  const sortedParties = [...state.parties].sort((a, b) => b.currentPollShare - a.currentPollShare);
  const leader = sortedParties[0];
  const second = sortedParties[1];
  if (leader && second) {
    headlines.push({
      id: 'news_poll',
      section: state.careerPhase === 'campana' ? 'Campaña' : 'Gobierno',
      headline: `${state.latestPoll.firmName}: ${leader.acronym} marca ${leader.currentPollShare.toFixed(1)}% frente a ${second.currentPollShare.toFixed(1)}% de ${second.acronym}`,
      deck: `Tu lema (${playerParty?.acronym ?? ''}) registra ${playerParty?.currentPollShare.toFixed(1)}% con ${state.latestPoll.undecidedPct.toFixed(1)}% de indecisos.`,
      tone: playerParty?.id === leader.id ? 'positive' : 'neutral',
    });
  }

  // 3. Titular parlamentario o de oposición
  const latestApproved = state.bills.find((b) => b.status === 'aprobada');
  const openBill = state.bills.find((b) => b.status === 'en_negociacion');
  if (inOpposition) {
    headlines.push({
      id: 'news_opp',
      section: 'Oposición',
      headline: `${playerParty?.acronym ?? 'Oposición'} adopta postura «${state.opposition.stance}» frente al gobierno de ${presParty?.acronym ?? ''}`,
      deck: `Credibilidad opositora en ${Math.round(state.opposition.credibility)}/100 y ${state.opposition.parliamentaryControlsExecuted} controles parlamentarios impulsados.`,
      tone: state.opposition.credibility >= 65 ? 'positive' : 'warning',
    });
  } else if (latestApproved) {
    headlines.push({
      id: 'news_bill_ok',
      section: 'Parlamento',
      headline: `Sancionan proyecto en el Palacio: ${latestApproved.title}`,
      deck: `La norma ya impacta en la agenda nacional con respaldo parlamentario verificado.`,
      tone: 'positive',
    });
  } else if (openBill) {
    headlines.push({
      id: 'news_bill_open',
      section: 'Parlamento',
      headline: `Intensa negociación en comisiones por «${openBill.title}»`,
      deck: `El gobierno mantiene ${Math.round(state.politicalIndicators.parliamentarySupportPct)}% de respaldo legislativo proyectado.`,
      tone: 'neutral',
    });
  }

  // 4. Titular territorial o evento reciente
  const activeCrisis = state.events.find((e) => !e.resolved);
  if (activeCrisis) {
    headlines.push({
      id: 'news_event',
      section: 'Territorio',
      headline: `Foco de coyuntura: ${activeCrisis.title}`,
      deck: activeCrisis.description.slice(0, 115) + (activeCrisis.description.length > 115 ? '…' : ''),
      tone: 'warning',
    });
  } else {
    const dept = state.departments.find((d) => d.id === state.player.targetDepartment);
    if (dept) {
      headlines.push({
        id: 'news_dept',
        section: 'Territorio',
        headline: `${dept.name} evalúa servicios locales con ${Math.round(dept.localServiceQuality)}/100 de calidad`,
        deck: `Desempleo departamental en ${dept.unemploymentRate.toFixed(1)}% y actividad orientada a ${dept.economicProfile[0] ?? 'servicios'}.`,
        tone: dept.localServiceQuality >= 58 ? 'positive' : 'neutral',
      });
    }
  }

  return headlines;
}

export function getAchievementById(id: string) {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
