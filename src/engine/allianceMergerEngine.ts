import { MONTH_NAMES } from '../data/uruguayData';
import {
  ElectoralAlliance,
  EmblemId,
  GameState,
  Party,
  PartyMergerRecord,
} from '../types/game';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function getPartyCompatibilityScore(a: Party, b: Party, relationAffinity: number): number {
  const ideoDist = Math.hypot(a.ideology.economic - b.ideology.economic, a.ideology.social - b.ideology.social);
  const ideoScore = clamp(100 - ideoDist * 1.15, 0, 100);
  const affScore = clamp((relationAffinity + 100) / 2, 0, 100);
  return Math.round(ideoScore * 0.55 + affScore * 0.45);
}

/**
 * Negocia una alianza electoral o pacto de coalición con uno o más partidos compatibles.
 */
export function negotiateElectoralAlliance(
  state: GameState,
  params: {
    name: string;
    partnerPartyIds: string[];
    promisedMinistries: Record<string, number>;
    programPoints: string[];
  }
): { ok: boolean; message: string; nextState: GameState } {
  const playerParty = state.parties.find((p) => p.id === state.player.partyId);
  if (!playerParty) {
    return { ok: false, message: 'No se encontró tu partido.', nextState: state };
  }
  if (params.partnerPartyIds.length === 0) {
    return { ok: false, message: 'Seleccioná al menos un partido socio para negociar la alianza.', nextState: state };
  }
  if (state.player.politicalCapital < 8) {
    return { ok: false, message: 'Necesitás al menos 8 CP para sellar una alianza formal.', nextState: state };
  }

  const negBonus = (state.player.attributes.negotiation - 50) * 0.35;
  const rejectedPartners: string[] = [];

  for (const pid of params.partnerPartyIds) {
    const partner = state.parties.find((p) => p.id === pid);
    if (!partner) continue;
    const rel = state.player.relations.find((r) => r.partyId === pid);
    const minPromised = params.promisedMinistries[pid] ?? 0;
    const compat = getPartyCompatibilityScore(playerParty, partner, rel?.affinity ?? 0) + minPromised * 6 + negBonus;
    if (compat < 46) {
      rejectedPartners.push(partner.name);
    }
  }

  if (rejectedPartners.length > 0) {
    return {
      ok: false,
      message: `${rejectedPartners.join(', ')} rechazó el pacto por baja afinidad o distancia ideológica. Mejorá diálogo u ofrecé ministerios.`,
      nextState: state,
    };
  }

  const dateLabel = `${MONTH_NAMES[state.currentMonth - 1]} ${state.currentYear}`;
  const alliance: ElectoralAlliance = {
    id: `ali_${Date.now()}`,
    name: params.name.trim() || `Acuerdo ${playerParty.acronym}`,
    partnerPartyIds: params.partnerPartyIds,
    leadPartyId: playerParty.id,
    promisedMinistries: params.promisedMinistries,
    programPoints: params.programPoints.length > 0 ? params.programPoints : ['Coordinación parlamentaria y programática'],
    createdDateLabel: dateLabel,
    active: true,
  };

  const nextRelations = state.player.relations.map((r) =>
    params.partnerPartyIds.includes(r.partyId)
      ? { ...r, inCoalition: true, affinity: Math.min(100, r.affinity + 10) }
      : r
  );

  // Impulso acotado de campaña por coordinación (sin exagerar)
  const nextParties = state.parties.map((p) =>
    p.id === playerParty.id
      ? {
          ...p,
          campaignMomentum: Number(clamp(p.campaignMomentum + 1.2, -15, 15).toFixed(2)),
          partyStrength: Math.min(100, p.partyStrength + 3),
        }
      : p
  );

  const nextCoalitionIds = Array.from(new Set([...state.coalitionPartyIds, playerParty.id, ...params.partnerPartyIds]));
  const nextPromised = { ...(state.coalitionPromisedMinistries ?? {}), ...params.promisedMinistries };

  const stats = state.progression.careerStats ?? {
    lawsPassed: state.player.legislativeWins,
    policiesEnacted: state.activePolicies?.length ?? 0,
    electionsWon: 0,
    electionsLost: 0,
    coalitionsFormed: 0,
    partiesMerged: 0,
    ministersAppointed: 0,
    controlsExecuted: state.opposition.parliamentaryControlsExecuted,
  };

  const nextState: GameState = {
    ...state,
    parties: nextParties,
    coalitionPartyIds: state.careerPhase === 'gobierno' && state.coalitionPartyIds.includes(playerParty.id)
      ? nextCoalitionIds
      : state.coalitionPartyIds,
    coalitionPromisedMinistries: nextPromised,
    electoralAlliances: [alliance, ...(state.electoralAlliances ?? [])],
    player: {
      ...state.player,
      politicalCapital: state.player.politicalCapital - 8,
      relations: nextRelations,
    },
    progression: {
      ...state.progression,
      careerStats: {
        ...stats,
        coalitionsFormed: stats.coalitionsFormed + 1,
      },
    },
    history: [
      {
        id: `ali_log_${Date.now()}`,
        dateLabel,
        category: 'campana',
        title: `Alianza sellada: ${alliance.name}`,
        detail: `Acuerdo programático con ${params.partnerPartyIds.map((id) => state.parties.find((x) => x.id === id)?.acronym ?? id).join(', ')}.`,
      },
      ...state.history,
    ],
  };

  return {
    ok: true,
    message: `Alianza «${alliance.name}» formalizada con ${params.partnerPartyIds.length} socio(s).`,
    nextState,
  };
}

/**
 * Ejecuta la fusión orgánica entre el partido del jugador y uno o más lemas compatibles.
 * Aplica costo político y pérdida realista por fuga de sectores disconformes.
 */
export function executePartyMerger(
  state: GameState,
  params: {
    partnerPartyIds: string[];
    newName: string;
    newAcronym: string;
    newColor: string;
    newEmblem: EmblemId;
  }
): { ok: boolean; message: string; nextState: GameState } {
  const playerParty = state.parties.find((p) => p.id === state.player.partyId);
  if (!playerParty) return { ok: false, message: 'No se encontró tu partido.', nextState: state };
  if (params.partnerPartyIds.length === 0) {
    return { ok: false, message: 'Elegí al menos un lema para fusionar.', nextState: state };
  }
  if (state.player.politicalCapital < 16) {
    return { ok: false, message: 'Una fusión de lemas requiere al menos 16 CP.', nextState: state };
  }
  if (state.parties.length - params.partnerPartyIds.length < 3) {
    return { ok: false, message: 'Debe mantenerse competencia multipartidaria (mínimo 3 lemas en el sistema).', nextState: state };
  }

  const partners = params.partnerPartyIds
    .map((id) => state.parties.find((p) => p.id === id))
    .filter((p): p is Party => Boolean(p));

  const negBonus = (state.player.attributes.negotiation - 50) * 0.25;
  for (const pt of partners) {
    const rel = state.player.relations.find((r) => r.partyId === pt.id);
    const compat = getPartyCompatibilityScore(playerParty, pt, rel?.affinity ?? 0) + negBonus;
    if (compat < 56) {
      return {
        ok: false,
        message: `${pt.name} rechazó la fusión orgánica (compatibilidad ${Math.round(compat)}/100; requiere >=56). Construí afinidad previa.`,
        nextState: state,
      };
    }
  }

  const mergingIds = new Set([playerParty.id, ...partners.map((p) => p.id)]);
  const mergingList = [playerParty, ...partners];
  const newPartyId = `merged_${Date.now().toString(36)}`;
  const totalRawShare = mergingList.reduce((s, p) => s + p.currentPollShare, 0);
  // Fuga realista de votantes disconformes (8% a 14% del caudal combinado)
  const defectionRate = clamp(0.14 - (state.player.attributes.negotiation - 50) * 0.001, 0.06, 0.16);
  const defectionPenaltyPct = Number((totalRawShare * defectionRate).toFixed(2));
  const mergedShare = Number(clamp(totalRawShare - defectionPenaltyPct, 2, 62).toFixed(2));

  const weightedEco = Math.round(
    mergingList.reduce((s, p) => s + p.ideology.economic * Math.max(1, p.currentPollShare), 0) /
      Math.max(1, totalRawShare)
  );
  const weightedSoc = Math.round(
    mergingList.reduce((s, p) => s + p.ideology.social * Math.max(1, p.currentPollShare), 0) /
      Math.max(1, totalRawShare)
  );

  const combinedSectors = mergingList.flatMap((p) =>
    p.sectors.map((sec) => ({
      ...sec,
      internalWeight: Math.max(6, Math.round(sec.internalWeight / mergingList.length)),
    }))
  );

  const mergedParty: Party = {
    id: newPartyId,
    name: params.newName.trim() || `${playerParty.acronym}-${partners.map((p) => p.acronym).join('-')} Unificado`,
    acronym: (params.newAcronym.trim() || playerParty.acronym).toUpperCase().slice(0, 5),
    color: params.newColor || playerParty.color,
    secondaryColor: '#FAF6EE',
    emblem: params.newEmblem || playerParty.emblem,
    ideology: { economic: weightedEco, social: weightedSoc },
    isCustom: true,
    coalitionGroup:
      weightedEco < 42 ? 'izquierda' : weightedEco > 58 ? 'coalicion_republicana' : 'tercera_via',
    aiPersonality: playerParty.aiPersonality,
    sectors: combinedSectors.slice(0, 6),
    baseNationalShare: mergedShare,
    currentPollShare: mergedShare,
    partyStrength: Math.min(100, Math.round(mergingList.reduce((s, p) => s + p.partyStrength, 0) / mergingList.length) + 4),
    campaignMomentum: 1.5,
    programPriority: mergingList.map((p) => p.programPriority).slice(0, 2).join(' · '),
    historicalNote: `Lema unificado tras la fusión de ${mergingList.map((p) => p.name).join(' + ')}.`,
  };

  // Redistribuye el pequeño porcentaje de fuga entre partidos restantes para conservar suma ~100%
  const survivors = state.parties.filter((p) => !mergingIds.has(p.id));
  const survivorShareBonus = defectionPenaltyPct / Math.max(1, survivors.length);
  const nextParties: Party[] = [
    mergedParty,
    ...survivors.map((p) => ({
      ...p,
      currentPollShare: Number((p.currentPollShare + survivorShareBonus).toFixed(2)),
    })),
  ];

  // Actualizar departamentos, gabinete, candidatos, relaciones y bills
  const nextDepartments = state.departments.map((d) => {
    const mergedMult =
      mergingList.reduce((s, p) => s + (d.partyMultipliers[p.id] ?? 1), 0) / mergingList.length;
    const nextMults = { ...d.partyMultipliers, [newPartyId]: Number(mergedMult.toFixed(2)) };
    return {
      ...d,
      currentIntendentePartyId: mergingIds.has(d.currentIntendentePartyId)
        ? newPartyId
        : d.currentIntendentePartyId,
      partyMultipliers: nextMults,
    };
  });

  const nextCabinet = state.cabinet.map((m) =>
    mergingIds.has(m.partyId) ? { ...m, partyId: newPartyId } : m
  );
  const nextCandidates = state.ministerCandidates.map((c) =>
    mergingIds.has(c.partyId) ? { ...c, partyId: newPartyId } : c
  );

  const nextRelations = survivors.map((p) => {
    const prevRel = state.player.relations.find((r) => r.partyId === p.id);
    return {
      partyId: p.id,
      partyName: p.name,
      leaderName: p.sectors[0]?.leader ?? 'Dirección partidaria',
      affinity: prevRel?.affinity ?? 0,
      inCoalition: prevRel?.inCoalition ?? false,
    };
  });

  const dateLabel = `${MONTH_NAMES[state.currentMonth - 1]} ${state.currentYear}`;
  const mergerRec: PartyMergerRecord = {
    id: `mrg_${Date.now()}`,
    dateLabel,
    sourcePartyIds: Array.from(mergingIds),
    newPartyId,
    newPartyName: mergedParty.name,
    newAcronym: mergedParty.acronym,
    defectionPenaltyPct,
  };

  const stats = state.progression.careerStats ?? {
    lawsPassed: state.player.legislativeWins,
    policiesEnacted: state.activePolicies?.length ?? 0,
    electionsWon: 0,
    electionsLost: 0,
    coalitionsFormed: state.electoralAlliances?.length ?? 0,
    partiesMerged: 0,
    ministersAppointed: 0,
    controlsExecuted: state.opposition.parliamentaryControlsExecuted,
  };

  const nextState: GameState = {
    ...state,
    parties: nextParties,
    departments: nextDepartments,
    cabinet: nextCabinet,
    ministerCandidates: nextCandidates,
    nationalPresidentPartyId: mergingIds.has(state.nationalPresidentPartyId)
      ? newPartyId
      : state.nationalPresidentPartyId,
    coalitionPartyIds: Array.from(
      new Set(state.coalitionPartyIds.map((id) => (mergingIds.has(id) ? newPartyId : id)))
    ),
    partyMergers: [mergerRec, ...(state.partyMergers ?? [])],
    player: {
      ...state.player,
      partyId: newPartyId,
      sectorId: combinedSectors[0]?.id ?? state.player.sectorId,
      politicalCapital: state.player.politicalCapital - 16,
      ideology: mergedParty.ideology,
      relations: nextRelations,
    },
    progression: {
      ...state.progression,
      careerStats: {
        ...stats,
        partiesMerged: stats.partiesMerged + 1,
      },
    },
    history: [
      {
        id: `mrg_log_${Date.now()}`,
        dateLabel,
        category: 'sistema',
        title: `Fusión histórica: nace ${mergedParty.name} (${mergedParty.acronym})`,
        detail: `Se fusionaron ${mergingList.map((p) => p.acronym).join(' + ')} alcanzando ${mergedShare}% (fuga sectorial de -${defectionPenaltyPct}%).`,
      },
      ...state.history,
    ],
  };

  return {
    ok: true,
    message: `Fusión completada: nace «${mergedParty.name}» (${mergedParty.acronym}) con ${mergedShare}% de intención de voto.`,
    nextState,
  };
}
