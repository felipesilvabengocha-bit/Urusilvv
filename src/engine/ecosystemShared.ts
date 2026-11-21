import type {
  AdvisorRole,
  DepartmentPollState,
  EcosystemActionResult,
  OpinionSegmentId,
  OpinionSegmentState,
  PoliticalEcosystemState,
  SegmentPollState,
} from '../types/expansion';
import type { GameState, IdeologyAxis, Party } from '../types/game';

export const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));

export const r1 = (v: number): number => Number(v.toFixed(1));
export const r2 = (v: number): number => Number(v.toFixed(2));

export function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function weightedPick<T>(items: T[], weight: (item: T) => number): T {
  const total = items.reduce((sum, item) => sum + Math.max(0.01, weight(item)), 0);
  let cursor = Math.random() * total;
  for (const item of items) {
    cursor -= Math.max(0.01, weight(item));
    if (cursor <= 0) return item;
  }
  return items[items.length - 1];
}

export function postureFor(loyalty: number): 'apoyo' | 'neutral' | 'obstruccion' {
  if (loyalty >= 62) return 'apoyo';
  if (loyalty <= 38) return 'obstruccion';
  return 'neutral';
}

export function ideologyAlignment(a: IdeologyAxis, b: IdeologyAxis): number {
  const distance = (Math.abs(a.economic - b.economic) + Math.abs(a.social - b.social)) / 2;
  return clamp(100 - distance, 0, 100);
}

export function getPlayerParty(state: GameState): Party | undefined {
  return state.parties.find((p) => p.id === state.player.partyId);
}

export function getAdvisorCapacity(state: GameState, role: AdvisorRole): number {
  const eco = state.expansion;
  if (!eco) return 0;
  return eco.advisors
    .filter((a) => a.status === 'contratado' && a.role === role)
    .reduce((sum, a) => sum + a.capacity, 0);
}

export function ensureEcosystem(
  state: GameState,
  factory: (s: GameState) => PoliticalEcosystemState
): PoliticalEcosystemState {
  const eco = state.expansion ?? factory(state);
  return {
    ...eco,
    segmentPolls: eco.segmentPolls ?? [],
    departmentPolls: eco.departmentPolls ?? [buildDepartmentPoll(state)],
  };
}

export function withLog(
  state: GameState,
  next: GameState,
  title: string,
  detail: string,
  category: GameState['history'][number]['category'] = 'gobierno'
): GameState {
  return {
    ...next,
    history: [
      {
        id: `eco_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
        dateLabel: `${state.currentYear}-${String(state.currentMonth).padStart(2, '0')}`,
        category,
        title,
        detail,
      },
      ...next.history,
    ].slice(0, 120),
  };
}

export function applyApproval(
  state: GameState,
  approvalDelta: number,
  popularityDelta: number
): GameState {
  const approval = clamp(state.politicalIndicators.governmentApproval + approvalDelta, 10, 88);
  return {
    ...state,
    macro: { ...state.macro, governmentApprovalPct: r1(approval) },
    politicalIndicators: {
      ...state.politicalIndicators,
      governmentApproval: r1(approval),
      presidentialPopularity: r1(
        clamp(state.politicalIndicators.presidentialPopularity + popularityDelta, 8, 95)
      ),
      publicOpinionIndex: Math.round(
        (approval + clamp(state.player.attributes.popularity + popularityDelta, 8, 95)) / 2
      ),
    },
    player: {
      ...state.player,
      attributes: {
        ...state.player.attributes,
        popularity: r1(clamp(state.player.attributes.popularity + popularityDelta, 8, 95)),
      },
    },
  };
}

export function adjustStability(state: GameState, delta: number): GameState {
  return {
    ...state,
    politicalIndicators: {
      ...state.politicalIndicators,
      coalitionStability: r1(clamp(state.politicalIndicators.coalitionStability + delta, 12, 98)),
    },
  };
}

export function segmentIdeal(segment: OpinionSegmentState): IdeologyAxis {
  const text = segment.priorities.join(' ').toLowerCase();
  let economic = 50;
  let social = 50;
  if (/empleo|salario|ingreso|vivienda|negociaci|jubilaci|salud|educaci/.test(text)) economic -= 16;
  if (/inflaci|carga|competitividad|seguridad jur/.test(text)) economic += 20;
  if (/seguridad/.test(text)) social -= 14;
  if (/derechos|educaci|salud|ambiente/.test(text)) social += 10;
  return { economic: clamp(economic, 10, 90), social: clamp(social, 10, 90) };
}

export function buildSegmentPoll(
  state: GameState,
  segments: OpinionSegmentState[]
): SegmentPollState {
  const shares = state.parties.map((party) => {
    const base = Math.max(0.5, party.currentPollShare);
    return { partyId: party.id, base };
  });
  const totalBase = shares.reduce((sum, s) => sum + s.base, 0) || 1;

  return {
    dateLabel: `${state.currentMonth}/${String(state.currentYear).slice(2)}`,
    segments: segments.map((segment) => {
      const ideal = segmentIdeal(segment);
      const weighted = shares.map(({ partyId, base }) => {
        const party = state.parties.find((p) => p.id === partyId);
        if (!party) return { partyId, value: 0 };
        const alignment = ideologyAlignment(party.ideology, ideal);
        const territorial =
          segment.territorialBias !== 0
            ? 1 +
              segment.territorialBias *
                (party.sectors.some((s) => s.strongholds.includes('montevideo')) ? -0.06 : 0.06)
            : 1;
        return { partyId, value: (base / totalBase) * (0.7 + alignment / 120) * territorial };
      });
      const total = weighted.reduce((sum, w) => sum + w.value, 0) || 1;
      const normalized = weighted.map((w) => ({
        partyId: w.partyId,
        pct: r1((w.value / total) * 100),
      }));
      const player = normalized.find((n) => n.partyId === state.player.partyId);
      const leader = normalized.reduce(
        (best, current) => (current.pct > best.pct ? current : best),
        normalized[0] ?? { partyId: state.player.partyId, pct: 0 }
      );
      return {
        segmentId: segment.id as OpinionSegmentId,
        approval: segment.governmentApproval,
        playerPartyPct: player?.pct ?? 0,
        leadingPartyId: leader.partyId,
      };
    }),
  };
}

export function buildDepartmentPoll(state: GameState): DepartmentPollState {
  const nationalUnemployment = state.macro.unemploymentPct;
  const nationalPoverty = state.macro.povertyPct;
  const playerPartyId = state.player.partyId;
  const isIntendente = state.player.currentOffice === 'intendente';

  return {
    dateLabel: `${state.currentMonth}/${String(state.currentYear).slice(2)}`,
    departments: state.departments.map((department) => {
      const localMood =
        (nationalUnemployment - department.unemploymentRate) * 1.8 +
        (nationalPoverty - department.povertyRate) * 1.1 +
        (department.localServiceQuality - 50) * 0.18;
      const approval = r1(clamp(state.macro.governmentApprovalPct + localMood, 5, 95));
      const weighted = state.parties.map((party) => {
        const multiplier = department.partyMultipliers[party.id] ?? 1;
        const ownDepartment =
          isIntendente &&
          state.player.targetDepartment === department.id &&
          party.id === playerPartyId
            ? 1.18
            : 1;
        const territorialMachine =
          party.id === playerPartyId
            ? 1 + (state.player.attributes.territorialMachine - 50) * 0.0015
            : 1;
        return {
          partyId: party.id,
          value:
            Math.max(0.1, party.currentPollShare) *
            multiplier *
            ownDepartment *
            territorialMachine,
        };
      });
      const total = weighted.reduce((sum, item) => sum + item.value, 0) || 1;
      const normalized = weighted.map((item) => ({
        partyId: item.partyId,
        pct: r1((item.value / total) * 100),
      }));
      const player = normalized.find((item) => item.partyId === playerPartyId);
      const leader = normalized.reduce(
        (best, current) => (current.pct > best.pct ? current : best),
        normalized[0] ?? { partyId: playerPartyId, pct: 0 }
      );
      return {
        departmentId: department.id,
        approval,
        playerPartyPct: player?.pct ?? 0,
        leadingPartyId: leader.partyId,
      };
    }),
  };
}

export function readMetric(state: GameState, metric: string): number {
  const macro = state.macro as unknown as Record<string, unknown>;
  const indicators = state.politicalIndicators as unknown as Record<string, unknown>;
  const value = macro[metric] ?? indicators[metric];
  return typeof value === 'number' ? value : 0;
}

export function metricMet(
  goal: { metric: string; currentValue: number; targetValue: number }
): boolean {
  // Para métricas donde "menos es mejor" el objetivo se guarda por debajo del valor inicial.
  if (
    ['inflationPct', 'unemploymentPct', 'povertyPct', 'fiscalDeficitPctGdp'].includes(goal.metric)
  ) {
    return goal.currentValue <= goal.targetValue;
  }
  return goal.currentValue >= goal.targetValue;
}

export function fail(state: GameState, message: string): EcosystemActionResult {
  return { ok: false, message, nextState: state };
}

export function success(
  state: GameState,
  message: string,
  nextState: GameState
): EcosystemActionResult {
  return { ok: true, message, nextState };
}

export function canSpend(state: GameState, cp: number, funds = 0): string | null {
  if (state.player.politicalCapital < cp) {
    return `Capital político insuficiente (${cp} CP requeridos).`;
  }
  if (state.player.campaignFundsUYU < funds) {
    return `Fondos insuficientes ($${(funds / 1000000).toFixed(1)}M requeridos).`;
  }
  return null;
}

export function spend(state: GameState, cp: number, funds = 0): GameState {
  return {
    ...state,
    player: {
      ...state.player,
      politicalCapital: Math.max(0, state.player.politicalCapital - cp),
      campaignFundsUYU: Math.max(0, state.player.campaignFundsUYU - funds),
    },
  };
}

export function setExpansion(
  state: GameState,
  expansion: PoliticalEcosystemState
): GameState {
  return { ...state, expansion };
}

export function changeRelation(state: GameState, partyId: string, delta: number): GameState {
  return {
    ...state,
    player: {
      ...state.player,
      relations: state.player.relations.map((rel) =>
        rel.partyId === partyId
          ? { ...rel, affinity: clamp(rel.affinity + delta, -100, 100) }
          : rel
      ),
    },
  };
}

export function addBillsSupport(state: GameState, partyId: string, delta: number): GameState {
  return {
    ...state,
    bills: state.bills.map((bill) => {
      if (bill.status !== 'en_negociacion') return bill;
      const prev = bill.negotiatedPartySupport[partyId] ?? 0;
      return {
        ...bill,
        negotiatedPartySupport: {
          ...bill.negotiatedPartySupport,
          [partyId]: clamp(prev + delta, 0, 0.5),
        },
      };
    }),
  };
}

export const MACRO_METRIC_LABELS: Record<string, string> = {
  gdpGrowthPct: 'Crecimiento del PIB',
  inflationPct: 'Inflación',
  unemploymentPct: 'Desempleo',
  povertyPct: 'Pobreza',
  fiscalDeficitPctGdp: 'Déficit fiscal',
  realWageGrowthPct: 'Salario real',
  investmentPctGdp: 'Inversión',
  publicInvestmentPctGdp: 'Inversión pública',
  productivityIndex: 'Productividad',
  spendingPctGdp: 'Gasto público',
  governmentApprovalPct: 'Aprobación',
};
