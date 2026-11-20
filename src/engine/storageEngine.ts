import {
  DEPARTAMENTAL_CANDIDATES_POOL,
  INITIAL_DEPARTAMENTAL_TEAM,
  INITIAL_PROGRAM_PROPOSALS,
  MINISTER_CANDIDATES_POOL,
} from '../data/uruguayData';
import { DepartmentId, GameState, PlayerMetaStats } from '../types/game';
import {
  CURRENT_SCHEMA_VERSION,
  backupRawSavesBeforeMigration,
  detectSaveVersion,
  migrateGameState,
} from './migrationEngine';
import { createInitialOppositionState } from './oppositionEngine';

const SAVES_KEY = 'qqgu_saves_v2';
const ACTIVE_SAVE_KEY = 'qqgu_active_save_id_v2';
const META_KEY = 'qqgu_meta_v2';

export function normalizeGameState(state: GameState): GameState {
  const prevDeptIncumbents: Record<string, string> = {};
  (state.departments ?? []).forEach((d) => {
    prevDeptIncumbents[d.id] = d.currentIntendentePartyId;
  });

  const existingCandIds = new Set((state.ministerCandidates ?? []).map((c) => c.id));
  const mergedCandidates = [
    ...(state.ministerCandidates ?? []),
    ...MINISTER_CANDIDATES_POOL.filter((c) => !existingCandIds.has(c.id)),
  ];

  const m = state.macro;
  const normalizedMacro = {
    ...m,
    employmentRatePct: m.employmentRatePct ?? Number((64 - m.unemploymentPct * 0.62).toFixed(1)),
    indigencePct: m.indigencePct ?? Number(Math.max(0.2, m.povertyPct * 0.085).toFixed(2)),
    giniIndex: m.giniIndex ?? 0.39,
    purchasingPowerIndex: m.purchasingPowerIndex ?? Number((100 + m.realWageGrowthPct).toFixed(1)),
    debtInterestPctGdp: m.debtInterestPctGdp ?? Number(((m.grossDebtPctGdp * (2.6 + m.countryRiskBps / 120)) / 100).toFixed(2)),
    publicInvestmentPctGdp: m.publicInvestmentPctGdp ?? Number((m.investmentPctGdp * 0.17).toFixed(2)),
    privateInvestmentPctGdp: m.privateInvestmentPctGdp ?? Number((m.investmentPctGdp * 0.83).toFixed(2)),
    productionIndex: m.productionIndex ?? Number((m.productivityIndex * 1.01).toFixed(1)),
  };

  const baseNormalized: GameState = {
    ...state,
    macro: normalizedMacro,
    resourceActionsThisMonth: state.resourceActionsThisMonth ?? 0,
    activePolicies: state.activePolicies ?? [],
    enactedLawModifiers: state.enactedLawModifiers ?? {},
    electoralAlliances: state.electoralAlliances ?? [],
    coalitionPromisedMinistries: state.coalitionPromisedMinistries ?? {},
    partyMergers: state.partyMergers ?? [],
    ministerCandidates: mergedCandidates,
    departamentalTeam: state.departamentalTeam ?? INITIAL_DEPARTAMENTAL_TEAM.map((d) => ({ ...d })),
    departamentalCandidates:
      state.departamentalCandidates ?? DEPARTAMENTAL_CANDIDATES_POOL.map((c) => ({ ...c })),
    programProposals: state.programProposals ?? INITIAL_PROGRAM_PROPOSALS.map((p) => ({ ...p })),
    nationalInauguratedInCycle:
      state.nationalInauguratedInCycle ??
      (state.careerPhase === 'gobierno' || state.electoralStage === 'departamentales_completadas'),
    opposition: state.opposition
      ? {
          ...state.opposition,
          parliamentaryControlsExecuted: state.opposition.parliamentaryControlsExecuted ?? 0,
        }
      : createInitialOppositionState(state.parties, state.nationalPresidentPartyId, normalizedMacro),
    progression: state.progression
      ? {
          ...state.progression,
          tacticalMissions: state.progression.tacticalMissions ?? [],
          careerStats: state.progression.careerStats ?? {
            lawsPassed: state.player?.legislativeWins ?? 0,
            policiesEnacted: state.activePolicies?.length ?? 0,
            electionsWon: state.player?.currentOffice ? 1 : 0,
            electionsLost: 0,
            coalitionsFormed: state.electoralAlliances?.length ?? 0,
            partiesMerged: state.partyMergers?.length ?? 0,
            ministersAppointed: 0,
            controlsExecuted: state.opposition?.parliamentaryControlsExecuted ?? 0,
          },
        }
      : {
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
          momentsArchive: [],
          cycleStartPovertyPct: normalizedMacro.povertyPct ?? 10.1,
          previousDeptIncumbents: prevDeptIncumbents,
        },
  };

  return migrateGameState(baseNormalized);
}

export function encodeGameToCode(state: GameState): string {
  const json = JSON.stringify(state);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `QQGUY3:${btoa(binary)}`;
}

export function decodeCodeToGame(rawCode: string): GameState {
  const trimmed = rawCode.trim();
  const payload = trimmed.startsWith('QQGUY3:')
    ? trimmed.slice(7)
    : trimmed.startsWith('QQGUY2:')
    ? trimmed.slice(7)
    : trimmed.startsWith('QQGUY1:')
    ? trimmed.slice(7)
    : trimmed;
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const json = new TextDecoder().decode(bytes);
  const parsed = JSON.parse(json) as GameState;
  if (!parsed || !parsed.id || !parsed.player || !Array.isArray(parsed.parties)) {
    throw new Error('Código de partida inválido.');
  }
  return normalizeGameState(parsed);
}

export function loadAllSaves(): GameState[] {
  try {
    const raw = localStorage.getItem(SAVES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    const hasLegacy = parsed.some((item) => detectSaveVersion(item) < CURRENT_SCHEMA_VERSION);
    if (hasLegacy) {
      backupRawSavesBeforeMigration(raw);
    }
    const migrated: GameState[] = [];
    for (const item of parsed) {
      try {
        if (item && typeof item === 'object' && (item as Partial<GameState>).id) {
          migrated.push(normalizeGameState(item as GameState));
        }
      } catch {
        // Ignorar un registro corrupto puntual sin descartar las demás partidas
      }
    }
    return migrated;
  } catch {
    return [];
  }
}

export function saveGame(state: GameState): void {
  const saves = loadAllSaves();
  const updated: GameState = { ...state, updatedAt: new Date().toISOString() };
  const idx = saves.findIndex((s) => s.id === updated.id);
  if (idx >= 0) {
    saves[idx] = updated;
  } else {
    saves.unshift(updated);
  }
  localStorage.setItem(SAVES_KEY, JSON.stringify(saves.slice(0, 20)));
  localStorage.setItem(ACTIVE_SAVE_KEY, updated.id);
}

export function deleteSave(id: string): void {
  const saves = loadAllSaves().filter((s) => s.id !== id);
  localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
  if (localStorage.getItem(ACTIVE_SAVE_KEY) === id) {
    localStorage.removeItem(ACTIVE_SAVE_KEY);
  }
}

export function getActiveSave(): GameState | null {
  const activeId = localStorage.getItem(ACTIVE_SAVE_KEY);
  const saves = loadAllSaves();
  if (saves.length === 0) return null;
  if (!activeId) return saves[0];
  return saves.find((s) => s.id === activeId) ?? saves[0];
}

export function loadMetaStats(): PlayerMetaStats {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) {
      return { gamesPlayed: 0, governedDepartments: [], unlockedAchievements: [], completedRuns: [] };
    }
    return JSON.parse(raw) as PlayerMetaStats;
  } catch {
    return { gamesPlayed: 0, governedDepartments: [], unlockedAchievements: [], completedRuns: [] };
  }
}

export function recordAchievementAndMeta(
  state: GameState,
  newAchievements: string[],
  governedDept?: DepartmentId,
  completedOutcomeLabel?: string
): PlayerMetaStats {
  const meta = loadMetaStats();
  const setAch = new Set([...meta.unlockedAchievements, ...newAchievements]);
  const setDepts = new Set(meta.governedDepartments);
  if (governedDept) setDepts.add(governedDept);

  const playerParty = state.parties.find((p) => p.id === state.player.partyId);
  const completedRuns = [...meta.completedRuns];
  if (completedOutcomeLabel) {
    const existingIdx = completedRuns.findIndex((r) => r.id === state.id);
    const entry = {
      id: state.id,
      playerName: state.player.name,
      partyName: playerParty?.name ?? 'Partido',
      scenarioTitle: state.scenarioId,
      outcomeLabel: completedOutcomeLabel,
      dateSaved: new Date().toISOString(),
    };
    if (existingIdx >= 0) completedRuns[existingIdx] = entry;
    else completedRuns.unshift(entry);
  }

  const next: PlayerMetaStats = {
    gamesPlayed: Math.max(meta.gamesPlayed, completedRuns.length),
    governedDepartments: Array.from(setDepts),
    unlockedAchievements: Array.from(setAch),
    completedRuns: completedRuns.slice(0, 25),
  };
  localStorage.setItem(META_KEY, JSON.stringify(next));
  return next;
}

export function bumpGamesPlayed(): void {
  const meta = loadMetaStats();
  meta.gamesPlayed += 1;
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}
