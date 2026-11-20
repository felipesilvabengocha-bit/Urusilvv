import { MONTH_NAMES } from '../data/uruguayData';
import {
  DepartamentalElectionResult,
  DepartmentData,
  DepartmentVoteBreakdown,
  DifficultyConfig,
  GameState,
  InternalElectionResult,
  NationalElectionResult,
  PlebisciteResult,
  PollSnapshot,
  RunoffResult,
} from '../types/game';

export function seededRandom(seedStr: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function allocateDHondt(
  votesByKey: Record<string, number>,
  totalSeats: number
): Record<string, number> {
  const keys = Object.keys(votesByKey).filter((k) => (votesByKey[k] ?? 0) > 0);
  const seats: Record<string, number> = {};
  keys.forEach((k) => (seats[k] = 0));
  if (keys.length === 0 || totalSeats <= 0) return seats;

  for (let s = 0; s < totalSeats; s++) {
    let bestKey = keys[0];
    let bestQuotient = -1;
    for (const k of keys) {
      const q = votesByKey[k] / (seats[k] + 1);
      if (q > bestQuotient) {
        bestQuotient = q;
        bestKey = k;
      }
    }
    seats[bestKey] += 1;
  }
  return seats;
}

function ideologicalCloseness(
  a: { economic: number; social: number },
  b: { economic: number; social: number }
): number {
  const dist = Math.hypot(a.economic - b.economic, a.social - b.social);
  return Math.max(0, 1 - dist / 141.42);
}

function computeEconomicIncumbentDelta(state: GameState): number {
  const { gdpGrowthPct, inflationPct, unemploymentPct, realWageGrowthPct } = state.macro;
  const growthScore = (gdpGrowthPct - 2.0) * 1.4;
  const inflationPenalty = Math.max(0, inflationPct - 6.0) * 0.9;
  const unemploymentPenalty = Math.max(0, unemploymentPct - 8.0) * 1.3;
  const wageBonus = realWageGrowthPct * 0.8;
  return Math.max(-7, Math.min(6, growthScore - inflationPenalty - unemploymentPenalty + wageBonus));
}

export function generatePollSnapshot(state: GameState, difficulty: DifficultyConfig): PollSnapshot {
  const rng = seededRandom(`${state.id}-poll-${state.currentYear}-${state.currentMonth}`);
  const firmNames = ['Equipos Consultores', 'Cifra', 'Opción Consultores', 'Factum', 'Usina de Percepción'];
  const firmName = firmNames[(state.currentMonth + state.currentYear) % firmNames.length];
  const sampleSize = 1000 + Math.round(rng() * 400);
  const marginOfErrorPct = Number((1.96 * Math.sqrt(0.25 / sampleSize) * 100).toFixed(1));
  const undecidedPct = Number((7 + rng() * 5).toFixed(1));
  const validPool = 100 - undecidedPct;

  const totalPollRaw = state.parties.reduce((s, p) => s + Math.max(0.2, p.currentPollShare), 0);
  const shares = state.parties
    .map((p) => {
      const trueShare = (Math.max(0.2, p.currentPollShare) / totalPollRaw) * validPool;
      const noise = (rng() - 0.5) * marginOfErrorPct * 0.7 * difficulty.volatility;
      return {
        partyId: p.id,
        partyName: p.name,
        color: p.color,
        pct: Number(Math.max(0.1, trueShare + noise).toFixed(1)),
      };
    })
    .sort((a, b) => b.pct - a.pct);

  return {
    dateLabel: `${MONTH_NAMES[state.currentMonth - 1]} ${state.currentYear}`,
    firmName,
    sampleSize,
    marginOfErrorPct,
    shares,
    undecidedPct,
  };
}

export function runInternalElections(
  state: GameState,
  difficulty: DifficultyConfig
): InternalElectionResult {
  const rng = seededRandom(`${state.id}-internas-${state.currentYear}`);
  const registeredTotal = 2725000;
  const turnoutPct = Number((37 + rng() * 8).toFixed(1));
  const totalVoters = Math.round(registeredTotal * (turnoutPct / 100));

  const partyResults: InternalElectionResult['partyResults'] = [];
  let playerWonPrimary = false;
  let playerRankInParty = 1;

  const partyWeights: Record<string, number> = {};
  let sumWeight = 0;
  for (const p of state.parties) {
    const isPlayerParty = p.id === state.player.partyId;
    const playerBoost = isPlayerParty ? (state.player.attributes.territorialMachine - 50) * 0.14 : 0;
    const w = Math.max(0.5, p.currentPollShare + playerBoost);
    partyWeights[p.id] = w;
    sumWeight += w;
  }

  for (const party of state.parties) {
    const partyVoters = Math.max(600, Math.round(totalVoters * (partyWeights[party.id] / sumWeight)));
    const sectors = party.sectors;
    const sectorScores: Record<string, number> = {};

    for (const sec of sectors) {
      const isPlayerSector = party.id === state.player.partyId && sec.id === state.player.sectorId;
      let base = sec.internalWeight * 0.85;
      if (isPlayerSector) {
        const attrScore =
          (state.player.attributes.popularity - 52) * 0.32 +
          (state.player.attributes.charisma - 52) * 0.22 +
          (state.player.attributes.territorialMachine - 52) * 0.44 +
          party.campaignMomentum * 1.15 -
          difficulty.negotiationPenalty * 0.18;
        base = Math.max(4, base + attrScore);
      } else {
        base = base * (0.84 + rng() * 0.34 * difficulty.volatility) + Math.max(0, difficulty.aiAggressiveness - 0.8) * 3.5;
      }
      sectorScores[sec.id] = Math.max(2, base);
    }

    const totalSecScore = Object.values(sectorScores).reduce((a, b) => a + b, 0);
    const sectorBreakdown = sectors
      .map((sec) => {
        const isPlayerSector = party.id === state.player.partyId && sec.id === state.player.sectorId;
        const pct = (sectorScores[sec.id] / totalSecScore) * 100;
        const votes = Math.round((pct / 100) * partyVoters);
        return {
          sectorId: sec.id,
          sectorName: sec.name,
          leader: isPlayerSector ? state.player.name : sec.leader,
          votes,
          pctWithinParty: Number(pct.toFixed(1)),
        };
      })
      .sort((a, b) => b.votes - a.votes);

    const first = sectorBreakdown[0];
    const second = sectorBreakdown[1];
    const leadDiff = second ? first.pctWithinParty - second.pctWithinParty : 100;
    const directWinner =
      first.pctWithinParty > 50 || (first.pctWithinParty >= 40 && leadDiff >= 10);

    let winner = first;
    let decidedByConvention = false;
    if (!directWinner && second) {
      decidedByConvention = true;
      const playerIsSecond =
        party.id === state.player.partyId && second.sectorId === state.player.sectorId;
      if (playerIsSecond && state.player.attributes.negotiation > 66 && leadDiff < 5) {
        winner = second;
      }
    }

    const viceCandidate =
      second && second.sectorId !== winner.sectorId
        ? second.leader
        : `${party.acronym} · Fórmula de unidad`;

    const unityScore = Math.round(
      Math.max(
        45,
        Math.min(
          98,
          72 +
            (leadDiff > 15 ? 12 : -6) +
            (party.id === state.player.partyId ? (state.player.attributes.negotiation - 50) * 0.25 : 0)
        )
      )
    );

    if (party.id === state.player.partyId) {
      playerRankInParty = sectorBreakdown.findIndex((s) => s.sectorId === state.player.sectorId) + 1;
      playerWonPrimary = winner.sectorId === state.player.sectorId;
    }

    partyResults.push({
      partyId: party.id,
      partyName: party.name,
      partyColor: party.color,
      totalVotes: partyVoters,
      winnerSectorId: winner.sectorId,
      winnerCandidate: winner.leader,
      viceCandidate,
      decidedByConvention,
      unityScore,
      sectorBreakdown,
    });
  }

  const playerPartyRes = partyResults.find((p) => p.partyId === state.player.partyId);
  const explanation: string[] = [
    `Participación en internas (voto voluntario): ${turnoutPct}% del padrón.`,
    `Constitución (Disp. Transitoria W): gana directo quien supera 50%, o 40% con >=10 puntos de ventaja; si no, define la Convención Nacional.`,
  ];
  if (playerPartyRes) {
    explanation.push(
      playerWonPrimary
        ? `Ganaste la interna de ${playerPartyRes.partyName} (${playerPartyRes.winnerCandidate}) con unidad partidaria de ${playerPartyRes.unityScore}%.`
        : `Puesto #${playerRankInParty} en la interna de ${playerPartyRes.partyName}. La candidatura única corresponde a ${playerPartyRes.winnerCandidate}.`
    );
  }

  return {
    dateLabel: `Junio ${state.currentYear}`,
    turnoutPct,
    partyResults: partyResults.sort((a, b) => b.totalVotes - a.totalVotes),
    playerWonPrimary,
    playerRankInParty,
    explanation,
  };
}

export function runNationalElections(
  state: GameState,
  difficulty: DifficultyConfig
): NationalElectionResult {
  const rng = seededRandom(`${state.id}-octubre-${state.currentYear}`);
  const scenarioIncumbentDelta = computeEconomicIncumbentDelta(state);
  const incumbentPartyId = state.nationalPresidentPartyId;

  const totalRegistered = 2727120;
  const turnoutPct = Number((88.5 + rng() * 2.2).toFixed(2));
  const totalEmitted = Math.round(totalRegistered * (turnoutPct / 100));
  const blankAndNullPct = Number((3.4 + rng() * 1.4).toFixed(2));
  const blankAndNullVotes = Math.round(totalEmitted * (blankAndNullPct / 100));

  const adjustedNationalWeights: Record<string, number> = {};
  for (const party of state.parties) {
    let score = party.currentPollShare;
    if (party.id === incumbentPartyId) {
      score += scenarioIncumbentDelta * 0.4;
    }
    if (party.id === state.player.partyId) {
      const unity =
        state.internalResult?.partyResults.find((r) => r.partyId === party.id)?.unityScore ?? 72;
      const playerEffect =
        (state.player.attributes.popularity - 55) * 0.12 +
        (state.player.attributes.charisma - 55) * 0.07 +
        (state.player.attributes.territorialMachine - 55) * 0.08 +
        (unity - 74) * 0.09 +
        party.campaignMomentum * 0.42 -
        difficulty.negotiationPenalty * 0.18;
      score += playerEffect;
    } else {
      score +=
        (rng() - 0.45) * 3.0 * difficulty.volatility * difficulty.aiAggressiveness +
        party.campaignMomentum * 0.4;
    }
    adjustedNationalWeights[party.id] = Math.max(0.25, score);
  }

  const partyNationalVotes: Record<string, number> = {};
  state.parties.forEach((p) => (partyNationalVotes[p.id] = 0));

  const rawDeptResults: Array<{
    dept: DepartmentData;
    deptValidVotes: number;
    deptEmitted: number;
    deptBlankNull: number;
    partyVotes: Record<string, number>;
  }> = [];

  for (const dept of state.departments) {
    const deptEmitted = Math.round(totalEmitted * dept.electoralShare);
    const deptBlankNull = Math.round(deptEmitted * (blankAndNullPct / 100));
    const deptValid = deptEmitted - deptBlankNull;

    const deptScores: Record<string, number> = {};
    let sumDeptScore = 0;

    for (const party of state.parties) {
      const mult = dept.partyMultipliers[party.id] ?? 1.0;
      const homeBoost =
        party.id === state.player.partyId && dept.id === state.player.targetDepartment ? 1.12 : 1.0;
      const val = adjustedNationalWeights[party.id] * mult * homeBoost * (0.96 + rng() * 0.08);
      deptScores[party.id] = val;
      sumDeptScore += val;
    }

    const partyVotes: Record<string, number> = {};
    let assigned = 0;
    state.parties.forEach((party, idx) => {
      const v =
        idx === state.parties.length - 1
          ? Math.max(0, deptValid - assigned)
          : Math.round((deptScores[party.id] / sumDeptScore) * deptValid);
      partyVotes[party.id] = v;
      assigned += v;
      partyNationalVotes[party.id] += v;
    });

    rawDeptResults.push({
      dept,
      deptValidVotes: deptValid,
      deptEmitted,
      deptBlankNull,
      partyVotes,
    });
  }

  const grandValidVotes = Object.values(partyNationalVotes).reduce((a, b) => a + b, 0);
  const senateSeatsByParty = allocateDHondt(partyNationalVotes, 30);
  const nationalDeputyEntitlement = allocateDHondt(partyNationalVotes, 99);
  const deptDeputiesByDept: Record<string, Record<string, number>> = {};

  const runningPartyDeputies: Record<string, number> = {};
  state.parties.forEach((p) => (runningPartyDeputies[p.id] = 0));

  for (const dr of rawDeptResults) {
    const allocated = allocateDHondt(dr.partyVotes, dr.dept.baselineDeputies);
    deptDeputiesByDept[dr.dept.id] = allocated;
    for (const pid of Object.keys(allocated)) {
      runningPartyDeputies[pid] += allocated[pid];
    }
  }

  // Tercer escrutinio simulado para honrar proporcionalidad integral de las 99 bancas
  const overParties = state.parties
    .map((p) => p.id)
    .filter((id) => runningPartyDeputies[id] > (nationalDeputyEntitlement[id] ?? 0));
  const underParties = state.parties
    .map((p) => p.id)
    .filter((id) => runningPartyDeputies[id] < (nationalDeputyEntitlement[id] ?? 0));

  for (const uId of underParties) {
    while (runningPartyDeputies[uId] < (nationalDeputyEntitlement[uId] ?? 0)) {
      const oId = overParties.find(
        (id) => runningPartyDeputies[id] > (nationalDeputyEntitlement[id] ?? 0)
      );
      if (!oId) break;
      let bestDeptId: string | null = null;
      let bestRatio = -1;
      for (const dr of rawDeptResults) {
        const curSeats = deptDeputiesByDept[dr.dept.id];
        if ((curSeats[oId] ?? 0) > 0) {
          const ratio = (dr.partyVotes[uId] ?? 0) / Math.max(1, (curSeats[uId] ?? 0) + 1);
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestDeptId = dr.dept.id;
          }
        }
      }
      if (!bestDeptId) break;
      deptDeputiesByDept[bestDeptId][oId] -= 1;
      deptDeputiesByDept[bestDeptId][uId] = (deptDeputiesByDept[bestDeptId][uId] ?? 0) + 1;
      runningPartyDeputies[oId] -= 1;
      runningPartyDeputies[uId] += 1;
    }
  }

  const byDepartment: DepartmentVoteBreakdown[] = rawDeptResults.map((dr) => {
    const pctValid: Record<string, number> = {};
    let topParty = state.parties[0].id;
    let topVotes = -1;
    for (const p of state.parties) {
      const v = dr.partyVotes[p.id] ?? 0;
      pctValid[p.id] = Number(((v / Math.max(1, dr.deptValidVotes)) * 100).toFixed(1));
      if (v > topVotes) {
        topVotes = v;
        topParty = p.id;
      }
    }
    return {
      departmentId: dr.dept.id,
      departmentName: dr.dept.name,
      emittedVotes: dr.deptEmitted,
      validPartyVotes: dr.deptValidVotes,
      blankAndNullVotes: dr.deptBlankNull,
      winningPartyId: topParty,
      partyVotes: dr.partyVotes,
      partyPctOfValid: pctValid,
      deputiesAllocated: deptDeputiesByDept[dr.dept.id],
    };
  });

  const partyTotals = state.parties
    .map((party) => {
      const votes = partyNationalVotes[party.id] ?? 0;
      const pctOfEmitted = Number(((votes / totalEmitted) * 100).toFixed(2));
      const pctOfValid = Number(((votes / grandValidVotes) * 100).toFixed(2));
      const senateSeats = senateSeatsByParty[party.id] ?? 0;
      const deputySeats = runningPartyDeputies[party.id] ?? 0;

      const sectorVotes: Record<string, number> = {};
      const internalParty = state.internalResult?.partyResults.find((r) => r.partyId === party.id);
      party.sectors.forEach((sec) => {
        const secInternal = internalParty?.sectorBreakdown.find((s) => s.sectorId === sec.id);
        sectorVotes[sec.shortName] = secInternal ? secInternal.votes : sec.internalWeight;
      });
      const senateSub = allocateDHondt(sectorVotes, senateSeats);
      const senateSectorBreakdown = Object.entries(senateSub)
        .filter(([, count]) => count > 0)
        .map(([sectorName, seats]) => ({ sectorName, seats }))
        .sort((a, b) => b.seats - a.seats);

      return {
        partyId: party.id,
        partyName: party.name,
        color: party.color,
        votes,
        pctOfEmitted,
        pctOfValid,
        senateSeats,
        deputySeats,
        senateSectorBreakdown,
      };
    })
    .sort((a, b) => b.votes - a.votes);

  const leader = partyTotals[0];
  const runnerUp = partyTotals[1];
  const directWin = leader.pctOfEmitted > 50.0;

  const plebiscites: PlebisciteResult[] = [
    {
      id: 'pleb_seguridad',
      title: 'Plebiscito Constitucional — Seguridad y Allanamientos Nocturnos',
      description: 'Habilita allanamientos nocturnos en hogares con orden judicial fundada.',
      yesVotes: Math.round(totalEmitted * (0.37 + rng() * 0.16)),
      yesPctOfEmitted: 0,
      approved: false,
    },
    {
      id: 'pleb_prevision',
      title: 'Plebiscito Constitucional — Reforma del Régimen Previsional',
      description: 'Fija edad mínima jubilatoria en 60 años y reordena pilares de ahorro previsional.',
      yesVotes: Math.round(totalEmitted * (0.35 + rng() * 0.17)),
      yesPctOfEmitted: 0,
      approved: false,
    },
  ].map((pl) => {
    const pct = Number(((pl.yesVotes / totalEmitted) * 100).toFixed(2));
    return { ...pl, yesPctOfEmitted: pct, approved: pct > 50 };
  });

  const playerPartyStats = partyTotals.find((p) => p.partyId === state.player.partyId)!;
  const playerPartyObj = state.parties.find((p) => p.id === state.player.partyId)!;
  const playerSectorObj = playerPartyObj.sectors.find((s) => s.id === state.player.sectorId);
  const playerDeptStats = byDepartment.find((d) => d.departmentId === state.player.targetDepartment)!;
  let playerElectedOffice = '';

  if (state.player.targetOffice === 'senador') {
    const sectorSeats =
      playerPartyStats.senateSectorBreakdown.find((s) => s.sectorName === playerSectorObj?.shortName)?.seats ?? 0;
    const won = sectorSeats > 0;
    playerElectedOffice = won
      ? `Electo Senador por ${playerSectorObj?.shortName ?? 'tu sector'} (${sectorSeats} banca/s del sector de ${playerPartyStats.senateSeats} del lema)`
      : `Tu sector (${playerSectorObj?.shortName ?? 'propio'}) no alcanzó cociente en Senado (${playerPartyStats.senateSeats} bancas del lema)`;
  } else if (state.player.targetOffice === 'diputado') {
    const deptSeats = playerDeptStats.deputiesAllocated[state.player.partyId] ?? 0;
    const partialResult = {
      partyTotals,
      byDepartment,
    } as Pick<NationalElectionResult, 'partyTotals' | 'byDepartment'>;
    const { won, sectorSeats } = computePlayerDeputySeatOutcome(state, partialResult);
    playerElectedOffice =
      won
        ? `Electo Diputado por ${playerDeptStats.departmentName} (${sectorSeats} banca/s de tu sector)`
        : deptSeats > 0
        ? `Tu lema obtuvo ${deptSeats} banca/s en ${playerDeptStats.departmentName}, pero las ganaron listas rivales del partido`
        : `Sin banca de Diputado para tu lema en ${playerDeptStats.departmentName}`;
  } else if (state.player.targetOffice === 'presidente' || state.player.targetOffice === 'vicepresidente') {
    if (directWin && leader.partyId === state.player.partyId && state.internalResult?.playerWonPrimary) {
      playerElectedOffice = `Electo ${state.player.targetOffice === 'presidente' ? 'Presidente' : 'Vicepresidente'} en Primera Vuelta (${leader.pctOfEmitted}%)`;
    } else if (
      !directWin &&
      (leader.partyId === state.player.partyId || runnerUp.partyId === state.player.partyId) &&
      state.internalResult?.playerWonPrimary
    ) {
      playerElectedOffice = `Clasificaste al Balotaje de noviembre (${playerPartyStats.pctOfEmitted}% emitidos)`;
    } else if (
      (leader.partyId === state.player.partyId || runnerUp.partyId === state.player.partyId) &&
      !state.internalResult?.playerWonPrimary
    ) {
      playerElectedOffice = `Tu lema pasó al balotaje con ${state.internalResult?.partyResults.find((r) => r.partyId === state.player.partyId)?.winnerCandidate ?? 'otra fórmula'} (perdiste la interna)`;
    } else {
      playerElectedOffice = `Sin paso al balotaje (${playerPartyStats.pctOfEmitted}% emitidos)`;
    }
  } else {
    playerElectedOffice = `${playerPartyStats.pctOfValid}% nacional; tu contienda principal se define en mayo`;
  }

  return {
    dateLabel: `Octubre ${state.currentYear}`,
    turnoutPct,
    totalRegistered,
    totalEmitted,
    totalValidPartyVotes: grandValidVotes,
    blankAndNullVotes,
    partyTotals,
    senateTotalSeats: 30,
    deputiesTotalSeats: 99,
    requiresRunoff: !directWin,
    runoffPair: directWin ? undefined : [leader.partyId, runnerUp.partyId],
    directWinnerPartyId: directWin ? leader.partyId : undefined,
    plebiscites,
    byDepartment,
    playerElectedOffice,
    explanation: [
      `${leader.partyName} obtuvo ${leader.pctOfEmitted}% de emitidos (${leader.pctOfValid}% de válidos).`,
      directWin
        ? `Superó el 50% de los votos emitidos (Art. 151) y evita la segunda vuelta.`
        : `Ninguna fórmula alcanzó el 50% de emitidos. Balotaje en noviembre entre ${leader.partyName} y ${runnerUp.partyName}.`,
    ],
  };
}

export function runRunoffElection(
  state: GameState,
  difficulty: DifficultyConfig
): RunoffResult {
  const nat = state.nationalResult;
  if (!nat || !nat.runoffPair) {
    throw new Error('No hay balotaje pendiente.');
  }
  const rng = seededRandom(`${state.id}-balotaje-${state.currentYear}`);
  const [idA, idB] = nat.runoffPair;
  const partyA = state.parties.find((p) => p.id === idA)!;
  const partyB = state.parties.find((p) => p.id === idB)!;

  const turnoutPct = Number((nat.turnoutPct - 0.6 + rng() * 0.8).toFixed(2));
  const totalEmitted = Math.round(nat.totalRegistered * (turnoutPct / 100));
  const blankNullPct = Number((4.0 + rng() * 1.1).toFixed(2));
  const blankAndNullVotes = Math.round(totalEmitted * (blankNullPct / 100));
  const totalValid = totalEmitted - blankAndNullVotes;

  const internalA = state.internalResult?.partyResults.find((p) => p.partyId === idA);
  const internalB = state.internalResult?.partyResults.find((p) => p.partyId === idB);

  const byDepartment: RunoffResult['byDepartment'] = [];
  let nationalVotesA = 0;
  let nationalVotesB = 0;

  for (const deptBreak of nat.byDepartment) {
    const dept = state.departments.find((d) => d.id === deptBreak.departmentId)!;
    let baseA = deptBreak.partyVotes[idA] ?? 0;
    let baseB = deptBreak.partyVotes[idB] ?? 0;

    for (const p of state.parties) {
      if (p.id === idA || p.id === idB) continue;
      const v = deptBreak.partyVotes[p.id] ?? 0;
      const alliedWithA = (state.electoralAlliances ?? []).some(
        (al) =>
          al.active &&
          (al.leadPartyId === idA || al.partnerPartyIds.includes(idA)) &&
          (al.leadPartyId === p.id || al.partnerPartyIds.includes(p.id))
      );
      const alliedWithB = (state.electoralAlliances ?? []).some(
        (al) =>
          al.active &&
          (al.leadPartyId === idB || al.partnerPartyIds.includes(idB)) &&
          (al.leadPartyId === p.id || al.partnerPartyIds.includes(p.id))
      );
      const sameCoalitionA = (p.coalitionGroup === partyA.coalitionGroup ? 0.34 : 0) + (alliedWithA ? 0.48 : 0);
      const sameCoalitionB = (p.coalitionGroup === partyB.coalitionGroup ? 0.34 : 0) + (alliedWithB ? 0.48 : 0);

      const closeA = ideologicalCloseness(p.ideology, partyA.ideology) + sameCoalitionA;
      const closeB = ideologicalCloseness(p.ideology, partyB.ideology) + sameCoalitionB;

      const relPlayer = state.player.relations.find((r) => r.partyId === p.id)?.affinity ?? 0;
      const playerBonusA = idA === state.player.partyId ? (relPlayer / 100) * 0.16 : 0;
      const playerBonusB = idB === state.player.partyId ? (relPlayer / 100) * 0.16 : 0;

      const scoreA = Math.max(0.05, closeA + playerBonusA);
      const scoreB = Math.max(0.05, closeB + playerBonusB);
      const shareA = scoreA / (scoreA + scoreB);

      baseA += v * 0.94 * shareA;
      baseB += v * 0.94 * (1 - shareA);
    }

    const econIncDelta = computeEconomicIncumbentDelta(state);
    const incBoostA = idA === state.nationalPresidentPartyId ? econIncDelta * 0.003 : 0;
    const incBoostB = idB === state.nationalPresidentPartyId ? econIncDelta * 0.003 : 0;
    const playerBoostA =
      idA === state.player.partyId
        ? (state.player.attributes.negotiation - 55) * 0.0018 + (state.player.attributes.popularity - 55) * 0.0014
        : 0;
    const playerBoostB =
      idB === state.player.partyId
        ? (state.player.attributes.negotiation - 55) * 0.0018 + (state.player.attributes.popularity - 55) * 0.0014
        : 0;
    const swing = (rng() - 0.5) * 0.048 * difficulty.volatility;

    const rawShareA = Math.max(
      0.15,
      Math.min(0.85, baseA / Math.max(1, baseA + baseB) + playerBoostA - playerBoostB + incBoostA - incBoostB + swing)
    );
    const deptValidTarget = Math.round(totalValid * dept.electoralShare);
    const deptVotesA = Math.round(deptValidTarget * rawShareA);
    const deptVotesB = deptValidTarget - deptVotesA;

    nationalVotesA += deptVotesA;
    nationalVotesB += deptVotesB;

    byDepartment.push({
      departmentId: dept.id,
      departmentName: dept.name,
      pctAValid: Number(((deptVotesA / deptValidTarget) * 100).toFixed(2)),
      pctBValid: Number(((deptVotesB / deptValidTarget) * 100).toFixed(2)),
      winnerPartyId: deptVotesA >= deptVotesB ? idA : idB,
    });
  }

  const grandValid = nationalVotesA + nationalVotesB;
  const winnerPartyId = nationalVotesA >= nationalVotesB ? idA : idB;

  return {
    dateLabel: `Noviembre ${state.currentYear}`,
    turnoutPct,
    totalEmitted,
    blankAndNullVotes,
    candidateA: {
      partyId: idA,
      partyName: partyA.name,
      formula: `${internalA?.winnerCandidate ?? partyA.sectors[0].leader} / ${internalA?.viceCandidate ?? 'Fórmula'}`,
      color: partyA.color,
      votes: nationalVotesA,
      pctOfEmitted: Number(((nationalVotesA / totalEmitted) * 100).toFixed(2)),
      pctOfValid: Number(((nationalVotesA / grandValid) * 100).toFixed(2)),
    },
    candidateB: {
      partyId: idB,
      partyName: partyB.name,
      formula: `${internalB?.winnerCandidate ?? partyB.sectors[0].leader} / ${internalB?.viceCandidate ?? 'Fórmula'}`,
      color: partyB.color,
      votes: nationalVotesB,
      pctOfEmitted: Number(((nationalVotesB / totalEmitted) * 100).toFixed(2)),
      pctOfValid: Number(((nationalVotesB / grandValid) * 100).toFixed(2)),
    },
    winnerPartyId,
    byDepartment,
    explanation: [
      `Balotaje con ${turnoutPct}% de participación.`,
      `Transferencia calculada por bloques, afinidad programática y acuerdos políticos del jugador.`,
      `${winnerPartyId === idA ? partyA.name : partyB.name} asume la Presidencia el 1.º de marzo de ${state.currentYear + 1}.`,
    ],
  };
}

export function runDepartamentalElections(
  state: GameState,
  difficulty: DifficultyConfig
): DepartamentalElectionResult {
  const electionYear = state.currentYear;
  const rng = seededRandom(`${state.id}-departamentales-${electionYear}`);
  const turnoutPct = Number((84.5 + rng() * 2.5).toFixed(2));
  const nat = state.nationalResult;

  const departmentsResult: DepartamentalElectionResult['departments'] = [];
  let playerWonDepartamentalOffice = false;
  let playerDepartamentalOutcomeLabel = 'Contienda departamental completada.';

  for (const dept of state.departments) {
    const natDept = nat?.byDepartment.find((d) => d.departmentId === dept.id);
    const deptVotes: Record<string, number> = {};
    let totalDeptVotes = 0;

    for (const party of state.parties) {
      const baseVotes =
        natDept?.partyVotes[party.id] ??
        Math.round(50000 * dept.electoralShare * (party.currentPollShare / 100));
      const incumbentLocalBoost = dept.currentIntendentePartyId === party.id ? 1.16 : 0.96;
      const playerLocalBoost =
        party.id === state.player.partyId && dept.id === state.player.targetDepartment
          ? Math.max(
              0.78,
              1 +
                (state.player.attributes.territorialMachine - 55) * 0.0042 +
                (state.player.attributes.popularity - 55) * 0.0032 +
                party.campaignMomentum * 0.0075 -
                difficulty.negotiationPenalty * 0.0025
            )
          : 1.0;

      const v = Math.max(
        50,
        Math.round(
          baseVotes *
            incumbentLocalBoost *
            playerLocalBoost *
            (0.9 + rng() * 0.2 * difficulty.volatility)
        )
      );
      deptVotes[party.id] = v;
      totalDeptVotes += v;
    }

    const sortedParties = [...state.parties].sort(
      (a, b) => (deptVotes[b.id] ?? 0) - (deptVotes[a.id] ?? 0)
    );
    const winningLema = sortedParties[0];
    const winningPct = Number(
      (((deptVotes[winningLema.id] ?? 0) / Math.max(1, totalDeptVotes)) * 100).toFixed(1)
    );

    const proportional31 = allocateDHondt(deptVotes, 31);
    let juntaSeats = { ...proportional31 };
    let automaticMajorityApplied = false;

    if ((juntaSeats[winningLema.id] ?? 0) < 16) {
      automaticMajorityApplied = true;
      const otherVotes: Record<string, number> = {};
      for (const p of state.parties) {
        if (p.id !== winningLema.id) otherVotes[p.id] = deptVotes[p.id];
      }
      const remaining15 = allocateDHondt(otherVotes, 15);
      juntaSeats = { ...remaining15, [winningLema.id]: 16 };
    }

    const winningIntendente =
      winningLema.id === state.player.partyId &&
      dept.id === state.player.targetDepartment &&
      state.player.targetOffice === 'intendente'
        ? state.player.name
        : dept.currentIntendentePartyId === winningLema.id
        ? dept.currentIntendenteName
        : `${winningLema.sectors[0].leader} (${winningLema.acronym})`;

    const playerShareInDept = (deptVotes[state.player.partyId] ?? 0) / Math.max(1, totalDeptVotes);
    const municipalitiesWonByPlayerParty = Math.min(
      dept.municipalitiesCount,
      Math.max(
        winningLema.id === state.player.partyId ? 1 : 0,
        Math.round(dept.municipalitiesCount * Math.max(0, playerShareInDept - 0.12) * 1.05)
      )
    );

    if (dept.id === state.player.targetDepartment) {
      const playerPartySeats = juntaSeats[state.player.partyId] ?? 0;
      const playerPartyObj = state.parties.find((p) => p.id === state.player.partyId)!;
      const playerSectorWeight =
        (playerPartyObj.sectors.find((s) => s.id === state.player.sectorId)?.internalWeight ?? 25) / 100;
      if (state.player.targetOffice === 'intendente') {
        playerWonDepartamentalOffice = winningLema.id === state.player.partyId;
        playerDepartamentalOutcomeLabel = playerWonDepartamentalOffice
          ? `Electo Intendente de ${dept.name} (${winningPct}% del lema, ${juntaSeats[winningLema.id]} ediles).`
          : `${winningLema.name} ganó la Intendencia de ${dept.name} (${winningPct}%). Tu lema logró ${playerPartySeats} ediles.`;
      } else if (state.player.targetOffice === 'edil') {
        const expectedSectorEdiles = Math.floor(playerPartySeats * Math.min(1, playerSectorWeight * 1.55 + (state.player.attributes.territorialMachine - 50) * 0.008));
        playerWonDepartamentalOffice = expectedSectorEdiles >= 1;
        playerDepartamentalOutcomeLabel = playerWonDepartamentalOffice
          ? `Electo Edil Departamental en ${dept.name} (${playerPartySeats}/31 bancas del lema).`
          : `Tu lista no alcanzó banca de Edil en ${dept.name} (${playerPartySeats} del lema).`;
      } else if (state.player.targetOffice === 'alcalde') {
        const localWinThreshold = winningLema.id === state.player.partyId || (playerShareInDept >= 0.32 && state.player.attributes.territorialMachine >= 56);
        playerWonDepartamentalOffice = municipalitiesWonByPlayerParty > 0 && localWinThreshold;
        playerDepartamentalOutcomeLabel = playerWonDepartamentalOffice
          ? `Electo Alcalde en ${state.player.targetMunicipality ?? dept.sampleMunicipalities[0]} (${dept.name}).`
          : `Tu lema no conquistó la Alcaldía de ${state.player.targetMunicipality ?? dept.sampleMunicipalities[0]} en ${dept.name}.`;
      }
    }

    departmentsResult.push({
      departmentId: dept.id,
      departmentName: dept.name,
      winningLemaId: winningLema.id,
      winningLemaName: winningLema.name,
      winningColor: winningLema.color,
      winningIntendente,
      winningLemaPct: winningPct,
      juntaSeats,
      automaticMajorityApplied,
      municipalitiesWonByPlayerParty,
      partyVotes: deptVotes,
    });
  }

  return {
    dateLabel: `Mayo ${electionYear}`,
    turnoutPct,
    departments: departmentsResult,
    playerWonDepartamentalOffice,
    playerDepartamentalOutcomeLabel,
    explanation: [
      `Elecciones en los 19 departamentos y municipios (Ley N.º 19.272) con participación del ${turnoutPct}%.`,
      `Se aplicó la Ley de Lemas departamental (Art. 271) y mayoría automática de 16 ediles en la Junta (Art. 272).`,
    ],
  };
}

export function didPlayerWinSenateSeat(
  state: GameState,
  nat?: Pick<NationalElectionResult, 'partyTotals'>
): boolean {
  if (!nat) return false;
  const playerParty = state.parties.find((p) => p.id === state.player.partyId);
  const playerSector = playerParty?.sectors.find((s) => s.id === state.player.sectorId);
  const partyStats = nat.partyTotals.find((p) => p.partyId === state.player.partyId);
  if (!partyStats || !playerSector) return false;
  const sectorSeats =
    partyStats.senateSectorBreakdown.find((s) => s.sectorName === playerSector.shortName)?.seats ?? 0;
  return sectorSeats > 0;
}

export function computePlayerDeputySeatOutcome(
  state: GameState,
  nat?: Pick<NationalElectionResult, 'byDepartment'>
): { won: boolean; sectorSeats: number } {
  if (!nat) return { won: false, sectorSeats: 0 };
  const playerPartyObj = state.parties.find((p) => p.id === state.player.partyId);
  const deptStats = nat.byDepartment.find((d) => d.departmentId === state.player.targetDepartment);
  if (!playerPartyObj || !deptStats) return { won: false, sectorSeats: 0 };
  const deptSeats = deptStats.deputiesAllocated[state.player.partyId] ?? 0;
  if (deptSeats <= 0) return { won: false, sectorSeats: 0 };

  const subRng = seededRandom(
    `${state.id}-octubre-dip-sub-${state.currentYear}-${state.player.targetDepartment}`
  );
  const deptSecVotes: Record<string, number> = {};
  playerPartyObj.sectors.forEach((sec) => {
    const isPlayer = sec.id === state.player.sectorId;
    const strongholdBonus = sec.strongholds.includes(state.player.targetDepartment) ? 1.25 : 0.92;
    const personalFactor = isPlayer
      ? 1 +
        (state.player.attributes.territorialMachine - 54) * 0.012 +
        (state.player.attributes.popularity - 54) * 0.008
      : 1.0 + (subRng() - 0.4) * 0.25;
    deptSecVotes[sec.id] = Math.max(1, sec.internalWeight * strongholdBonus * personalFactor);
  });
  const deptSubSeats = allocateDHondt(deptSecVotes, deptSeats);
  const sectorSeats = deptSubSeats[state.player.sectorId] ?? 0;
  return { won: sectorSeats > 0, sectorSeats };
}

export function didPlayerWinDeputySeat(
  state: GameState,
  nat?: Pick<NationalElectionResult, 'byDepartment'>
): boolean {
  return computePlayerDeputySeatOutcome(state, nat).won;
}

