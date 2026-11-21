import {
  ADVISOR_POOL,
  FACTION_GOAL_DEMANDS,
  MEDIA_OUTLETS,
  OPINION_SEGMENTS,
} from '../data/expansionData';
import type {
  AdvisorState,
  DebateKind,
  DebateSessionState,
  FactionGoal,
  IntendencyRelationState,
  MediaNewsState,
  MediaOutletState,
  OpinionSegmentState,
  PartyFactionState,
  PoliticalEcosystemState,
} from '../types/expansion';
import type { GameState } from '../types/game';
import {
  buildDepartmentPoll,
  buildSegmentPoll,
  clamp,
  ideologyAlignment,
  postureFor,
  r1,
} from './ecosystemShared';

const FACTION_GOALS: FactionGoal[] = [
  'liderazgo',
  'cargos',
  'programa',
  'presupuesto',
  'territorio',
  'identidad',
];

function buildDebates(state: GameState): DebateSessionState[] {
  if (state.careerPhase !== 'campana' || state.currentMonth > 10) return [];
  const kind: DebateKind =
    state.player.targetOffice === 'presidente'
      ? 'presidencial'
      : state.player.targetOffice === 'senador' || state.player.targetOffice === 'diputado'
      ? 'parlamentario'
      : 'departamental';
  const scheduledMonth = state.currentMonth < 9 ? 9 : state.currentMonth;
  const rivals = state.parties
    .filter((p) => p.id !== state.player.partyId)
    .sort((a, b) => b.currentPollShare - a.currentPollShare)
    .slice(0, kind === 'presidencial' ? 2 : 3)
    .map((p) => p.sectors[0]?.leader ?? p.acronym);

  return [
    {
      id: `debate_${state.currentYear}_${kind}`,
      dateLabel: `Debate ${kind}`,
      kind,
      status: 'programado',
      scheduledYear: state.currentYear,
      scheduledMonth,
      opponentNames: rivals,
      currentQuestionIndex: 0,
      answers: [],
      score: 0,
      pollImpact: 0,
      approvalImpact: 0,
      reputationImpact: 0,
    },
  ];
}

function buildInitialNews(state: GameState): MediaNewsState[] {
  const first = MEDIA_OUTLETS[0];
  const second = MEDIA_OUTLETS[3];
  const label = `${state.currentYear}-${String(state.currentMonth).padStart(2, '0')}`;
  return [
    {
      id: 'news_init_1',
      dateLabel: label,
      outletId: first.id,
      outletName: first.name,
      headline: `Comienza el año político con la mira puesta en ${state.player.targetOffice}`,
      tone: 'neutra',
      impact: 0,
      topic: 'Agenda',
    },
    {
      id: 'news_init_2',
      dateLabel: label,
      outletId: second.id,
      outletName: second.name,
      headline: 'La opinión pública sigue de cerca la interna partidaria',
      tone: 'neutra',
      impact: 0,
      topic: 'Interna',
    },
  ];
}

function buildFactions(state: GameState): PartyFactionState[] {
  const playerIdeology = state.player.ideology;
  const playerSectorId = state.player.sectorId;
  const factions: PartyFactionState[] = [];

  state.parties.forEach((party) => {
    party.sectors.forEach((sector, index) => {
      const alignment = ideologyAlignment(sector.ideology, playerIdeology);
      const isPlayerParty = party.id === state.player.partyId;
      const isOwnSector = sector.id === playerSectorId;
      const loyalty = isPlayerParty
        ? clamp(38 + alignment * 0.38 + (isOwnSector ? 18 : 0), 18, 92)
        : 50;
      const goal: FactionGoal = isOwnSector
        ? 'programa'
        : FACTION_GOALS[index % FACTION_GOALS.length];
      factions.push({
        id: `faction_${party.id}_${sector.id}`,
        partyId: party.id,
        sectorId: sector.id,
        name: sector.name,
        shortName: sector.shortName,
        leaderName: sector.leader,
        ideology: { ...sector.ideology },
        influence: clamp(sector.internalWeight, 3, 100),
        loyalty: r1(loyalty),
        mood: r1(clamp(loyalty + 4, 5, 95)),
        goal,
        demand: FACTION_GOAL_DEMANDS[goal],
        posture: postureFor(loyalty),
        demandsMet: 0,
      });
    });
  });

  return factions;
}

function buildMedia(state: GameState): MediaOutletState[] {
  const playerCentered = state.player.ideology.economic - 50;
  return MEDIA_OUTLETS.map((outlet) => ({
    ...outlet,
    affinity: r1(clamp(55 - Math.abs(outlet.editorialLine - playerCentered) * 0.35, 5, 95)),
  }));
}

function buildOpinionSegments(state: GameState): OpinionSegmentState[] {
  return OPINION_SEGMENTS.map((segment) => ({
    ...segment,
    governmentApproval: r1(
      clamp(
        state.macro.governmentApprovalPct +
          (segment.economicSensitivity - 1) * 6 -
          Math.max(0, state.macro.inflationPct - 6) * segment.economicSensitivity * 0.6,
        8,
        92
      )
    ),
    playerAffinity: r1(
      clamp(
        state.player.attributes.popularity +
          segment.territorialBias * 3 +
          (state.player.ideology.social > 55 ? segment.socialSensitivity * 2 : -2),
        8,
        92
      )
    ),
  }));
}

function buildIntendencies(state: GameState): IntendencyRelationState[] {
  const playerPartyId = state.player.partyId;
  return state.departments.map((dept) => {
    const sameParty = dept.currentIntendentePartyId === playerPartyId;
    const coalition = state.coalitionPartyIds.includes(dept.currentIntendentePartyId);
    const isOwnDepartment =
      state.player.currentOffice === 'intendente' &&
      state.player.targetDepartment === dept.id;
    const relation = isOwnDepartment ? 82 : sameParty ? 72 : coalition ? 58 : 34;
    return {
      departmentId: dept.id,
      departmentName: dept.name,
      intendenteName: dept.currentIntendenteName,
      partyId: dept.currentIntendentePartyId,
      relationScore: relation,
      conflictLevel: r1(clamp(100 - relation + (Math.random() * 10 - 5), 0, 100)),
    };
  });
}

export function createInitialEcosystemState(state: GameState): PoliticalEcosystemState {
  const advisors: AdvisorState[] = ADVISOR_POOL.map((advisor) => ({
    ...advisor,
    status: 'disponible',
  }));
  const opinionSegments = buildOpinionSegments(state);
  const segmentPoll = buildSegmentPoll(state, opinionSegments);
  const departmentPoll = buildDepartmentPoll(state);

  return {
    version: 1,
    factions: buildFactions(state),
    challenges: [],
    advisors,
    mediaOutlets: buildMedia(state),
    mediaNews: buildInitialNews(state),
    debates: buildDebates(state),
    opinionSegments,
    segmentPolls: [segmentPoll],
    departmentPolls: [departmentPoll],
    cabinetCrises: [],
    institutionalControls: [],
    policyEvaluations: [],
    nationalPlans: [],
    transparencyCases: [],
    intendencyRelations: buildIntendencies(state),
    negotiations: [],
    foreignNegotiations: [],
    mercosurIntegration: 62,
    lastMonthlyNotes: [],
  };
}
