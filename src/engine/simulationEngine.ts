import { DIFFICULTIES, MONTH_NAMES, OFFICES } from '../data/uruguayData';
import {
  DepartmentId,
  GameState,
  OfficeId,
  Party,
} from '../types/game';
import { stepMonthlyEconomy } from './economyEngine';
import {
  didPlayerWinDeputySeat,
  didPlayerWinSenateSeat,
  generatePollSnapshot,
  seededRandom,
} from './electoralEngine';
import { maybeGenerateContextualEvent, processAIPartiesTurn } from './eventsAndAiEngine';
import {
  applyOppositionStanceMonthlyDrift,
  buildPromisesForParty,
  processAIGovernmentTurn,
} from './oppositionEngine';
import { getActiveChambers, processMonthlyParliamentDeadlines } from './parliamentEngine';
import {
  buildPreviousDeptIncumbents,
  generateContextualObjectives,
  syncProgression,
} from './progressionEngine';
import { stepMonthlyCabinetEnterprisesAndActors } from './publicEnterprisesAndActorsEngine';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function buildGoverningCoalitionPartyIds(state: GameState, presParty: Party, parties: Party[]): string[] {
  const ids = new Set<string>([presParty.id]);
  if (presParty.coalitionGroup === 'coalicion_republicana') {
    parties
      .filter((p) => p.coalitionGroup === 'coalicion_republicana')
      .forEach((p) => ids.add(p.id));
  }
  for (const al of state.electoralAlliances ?? []) {
    if (!al.active) continue;
    if (al.leadPartyId === presParty.id || al.partnerPartyIds.includes(presParty.id)) {
      ids.add(al.leadPartyId);
      al.partnerPartyIds.forEach((pid) => ids.add(pid));
    }
  }
  return Array.from(ids);
}

/**
 * MOTOR CENTRAL DE SIMULACIÓN MENSUAL (Secuencia exacta de 10 pasos):
 * 1. Actualizar economía
 * 2. Actualizar indicadores sociales (departamentales + nacionales)
 * 3. Procesar decisiones diferidas pendientes
 * 4. Actualizar popularidad del jugador y aprobación del gobierno
 * 5. Actualizar relaciones políticas y estabilidad de coalición
 * 6. Procesar acciones autónomas de partidos de IA y encuestas
 * 7. Generar acontecimientos contextuales
 * 8. Actualizar apoyo parlamentario real
 * 9. Comprobar calendario electoral y fin de mandato (ciclos de 5 años)
 * 10. Actualizar registro histórico y series temporales
 */
export function advanceOneMonth(state: GameState): GameState {
  const difficulty = DIFFICULTIES.find((d) => d.id === state.difficultyId) ?? DIFFICULTIES[2];

  // Avanzar reloj calendario
  let nextMonth = state.currentMonth + 1;
  let nextYear = state.currentYear;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  const dateLabel = `${MONTH_NAMES[nextMonth - 1]} ${nextYear}`;

  // 1 & 2. Actualizar economía, políticas públicas activas e indicadores sociales/departamentales
  const econStep = stepMonthlyEconomy(state);
  let nextMacro = econStep.nextMacro;
  let nextDepartments = econStep.nextDepartments;
  const nextNationalBudget = econStep.nextNationalBudget;
  const nextActivePolicies = econStep.nextActivePolicies;

  // 3. Procesar decisiones pendientes con retardo temporal
  const remainingDelayed: GameState['pendingDelayedEffects'] = [];
  let delayedPop = 0;
  let delayedApp = 0;
  const delayedNotes: string[] = [];

  for (const eff of state.pendingDelayedEffects) {
    if (eff.triggerInMonths <= 1) {
      nextMacro = {
        ...nextMacro,
        gdpGrowthPct: Number((nextMacro.gdpGrowthPct + (eff.gdpDelta ?? 0)).toFixed(2)),
        inflationPct: Number(clamp(nextMacro.inflationPct + (eff.inflationDelta ?? 0), 1.5, 25).toFixed(2)),
        unemploymentPct: Number(clamp(nextMacro.unemploymentPct + (eff.unemploymentDelta ?? 0), 4, 20).toFixed(2)),
        povertyPct: Number(clamp(nextMacro.povertyPct + (eff.povertyDelta ?? 0), 4, 38).toFixed(2)),
        productivityIndex: Number((nextMacro.productivityIndex + (eff.productivityDelta ?? 0)).toFixed(2)),
      };
      delayedApp += eff.approvalDelta ?? 0;
      delayedPop += (eff.approvalDelta ?? 0) * 0.6;
      delayedNotes.push(`Efecto madurado: ${eff.label}`);
    } else {
      remainingDelayed.push({ ...eff, triggerInMonths: eff.triggerInMonths - 1 });
    }
  }

  // 4. Actualizar popularidad del presidente/jugador y aprobación del gobierno
  const econMood =
    (nextMacro.gdpGrowthPct - 2.0) * 1.4 -
    Math.max(0, nextMacro.inflationPct - 6.0) * 1.1 -
    Math.max(0, nextMacro.unemploymentPct - 8.2) * 1.2 +
    nextMacro.realWageGrowthPct * 0.7;

  const activeMinisters = state.cabinet.filter((c) => !c.isVacant);
  const vacantCount = state.cabinet.length - activeMinisters.length;
  const cabinetPopularity =
    activeMinisters.reduce((s, c) => s + c.popularity, 0) / Math.max(1, activeMinisters.length);

  const nextGovApproval = Number(
    clamp(
      state.politicalIndicators.governmentApproval * 0.82 +
        (46 + econMood + (cabinetPopularity - 58) * 0.25) * 0.18 +
        delayedApp +
        econStep.policyApprovalDelta -
        vacantCount * 0.6,
      15,
      82
    ).toFixed(1)
  );
  nextMacro = { ...nextMacro, governmentApprovalPct: nextGovApproval };

  const playerIsInNationalExec =
    state.player.currentOffice === 'presidente' || state.player.currentOffice === 'vicepresidente';
  const nextPlayerPop = Number(
    clamp(
      state.player.attributes.popularity * 0.92 +
        (playerIsInNationalExec ? nextGovApproval : state.player.attributes.popularity + econMood * 0.15) * 0.08 +
        delayedPop,
      15,
      95
    ).toFixed(1)
  );

  // Recuperación mensual equilibrada de capital político y aportes partidarios
  const monthlyCapitalRegen = 2;
  const nextPoliticalCapital = Math.round(clamp(state.player.politicalCapital + monthlyCapitalRegen, 0, 100));
  const monthlyFunds =
    state.careerPhase === 'campana'
      ? Math.round(550000 * difficulty.startingFundsMultiplier)
      : Math.round(320000 * difficulty.startingFundsMultiplier);

  // 5. Actualizar relaciones políticas, cupos de coalición y estabilidad
  const avgCabinetLoyalty =
    activeMinisters.reduce((s, c) => s + c.loyalty, 0) / Math.max(1, activeMinisters.length);

  // Verificar cumplimiento de ministerios prometidos a socios de coalición
  let coalitionQuotaPenalty = 0;
  const promised = state.coalitionPromisedMinistries ?? {};
  for (const [partnerId, reqCount] of Object.entries(promised)) {
    if (reqCount > 0 && state.player.currentOffice === 'presidente') {
      const actualCount = activeMinisters.filter((m) => m.partyId === partnerId).length;
      if (actualCount < reqCount) {
        coalitionQuotaPenalty += (reqCount - actualCount) * 1.4;
      }
    }
  }

  const nextCoalitionStability = Number(
    clamp(
      state.politicalIndicators.coalitionStability * 0.9 +
        (60 + (nextGovApproval - 45) * 0.4 + (avgCabinetLoyalty - 75) * 0.25) * 0.1 -
        difficulty.negotiationPenalty * 0.05 -
        coalitionQuotaPenalty,
      18,
      98
    ).toFixed(1)
  );

  // 6. Procesar acciones autónomas de partidos de IA y encuesta mensual
  const tempStateForAI: GameState = {
    ...state,
    currentMonth: nextMonth,
    currentYear: nextYear,
    macro: nextMacro,
    politicalIndicators: {
      ...state.politicalIndicators,
      governmentApproval: nextGovApproval,
      coalitionStability: nextCoalitionStability,
    },
  };
  const { updatedParties, aiLogNote } = processAIPartiesTurn(tempStateForAI, difficulty);
  // Sincroniza intención de voto del partido del jugador con su popularidad y momentum
  const syncedParties = updatedParties.map((p) => {
    if (p.id !== state.player.partyId) return p;
    const popShift = (nextPlayerPop - state.player.attributes.popularity) * 0.25;
    return {
      ...p,
      currentPollShare: Number(clamp(p.currentPollShare + popShift, 0.5, 62).toFixed(2)),
    };
  });

  const tempWithParties: GameState = { ...tempStateForAI, parties: syncedParties };
  const latestPoll = generatePollSnapshot(tempWithParties, difficulty);

  // 7. Generar acontecimiento contextual
  const newEvent = maybeGenerateContextualEvent(tempWithParties, difficulty);
  let nextEvents = newEvent ? [newEvent, ...state.events].slice(0, 18) : state.events;
  let nextFiscalLevers = state.fiscalLevers;
  let nextBills = state.bills;
  let nextOpposition = state.opposition;
  let aiGovLogNote: string | null = null;

  if (state.nationalPresidentPartyId !== state.player.partyId) {
    const aiGov = processAIGovernmentTurn(
      { ...tempWithParties, events: nextEvents },
      difficulty
    );
    nextFiscalLevers = aiGov.nextFiscalLevers;
    nextBills = aiGov.nextBills;
    nextEvents = aiGov.nextEvents;
    nextOpposition = aiGov.nextOpposition;
    aiGovLogNote = aiGov.aiGovLogNote;
  }

  // 7b. Procesar plazos constitucionales del Parlamento (45+45+15+15 Arts. 217-219 y Venias Art. 187)
  const parlDeadlineStep = processMonthlyParliamentDeadlines(nextBills, state.pendingVenias, {
    nextYear,
    nextMonth,
    careerPhase: state.careerPhase,
    govPartyId: state.nationalPresidentPartyId,
    dateLabel,
    deficitPct: nextMacro.fiscalDeficitPctGdp,
  });
  nextBills = parlDeadlineStep.nextBills;
  const nextPendingVenias = parlDeadlineStep.nextPendingVenias;

  // 7c. Evolución mensual de Gabinete, 5 Empresas Públicas y 4 Actores Sociales
  const cabEntStep = stepMonthlyCabinetEnterprisesAndActors(tempWithParties, dateLabel);

  // 7d. Avance mensual de obras públicas territoriales (costo, plazo y resultado medible)
  const nextWorkOrders: GameState['publicWorksOrders'] = [];
  const workOrderLogs: GameState['history'] = [];
  for (const work of state.publicWorksOrders ?? []) {
    if (work.status === 'completada') {
      nextWorkOrders.push(work);
      continue;
    }
    const remaining = work.remainingMonths - 1;
    if (remaining <= 0) {
      nextDepartments = nextDepartments.map((d) => {
        if (d.id !== work.departmentId) return d;
        const infra = (d.infrastructureScore ?? d.localServiceQuality ?? 50) + 4;
        const unemp = Math.max(3.5, d.unemploymentRate - 0.25);
        return {
          ...d,
          infrastructureScore: Math.min(98, infra),
          localServiceQuality: Math.min(98, d.localServiceQuality + 3),
          unemploymentRate: Number(unemp.toFixed(1)),
          accumulatedInvestmentUYU: (d.accumulatedInvestmentUYU ?? 0) + work.costMillionsUYU,
        };
      });
      const completedWork = { ...work, remainingMonths: 0, status: 'completada' as const };
      nextWorkOrders.push(completedWork);
      workOrderLogs.push({
        id: `obra_done_${work.id}_${Date.now()}`,
        dateLabel,
        category: 'gobierno',
        title: `Obra completada: ${work.title}`,
        detail: `${work.effectSummary} · ${work.departmentId} · Inversión $ ${work.costMillionsUYU}M UYU.`,
      });
    } else {
      nextWorkOrders.push({ ...work, remainingMonths: remaining });
    }
  }

  // 8. Actualizar apoyo parlamentario real en función de bancas + coalición
  const chambers = getActiveChambers(tempWithParties);
  const coalitionSeats = state.coalitionPartyIds.reduce(
    (sum, pid) => sum + (chambers.deputiesByParty[pid] ?? 0),
    0
  );
  const parliamentarySupportPct = Math.round((coalitionSeats / 99) * 100);

  // 9. Comprobar calendario electoral, asunción nacional (1° de marzo) y fin de mandato
  let nextPhase = state.careerPhase;
  let termLegacySummary = state.termLegacySummary;
  const extraLogs: GameState['history'] = [];
  let nextPlayer = {
    ...state.player,
    politicalCapital: nextPoliticalCapital,
    campaignFundsUYU: state.player.campaignFundsUYU + monthlyFunds,
    totalMonthsInCareer: state.player.totalMonthsInCareer + 1,
    attributes: {
      ...state.player.attributes,
      popularity: nextPlayerPop,
    },
  };
  let nextNatPresPartyId = state.nationalPresidentPartyId;
  let nextNatPresName = state.nationalPresidentName;
  let nextCoalitionPartyIds = state.coalitionPartyIds;
  let nextNationalInaugurated = state.nationalInauguratedInCycle;
  let nextProgressionStats = state.progression.careerStats;

  if (parlDeadlineStep.parliamentLogs.length > 0) {
    extraLogs.push(...parlDeadlineStep.parliamentLogs);
  }
  if (cabEntStep.cabinetLogs.length > 0) {
    extraLogs.push(...cabEntStep.cabinetLogs);
  }
  if (workOrderLogs.length > 0) {
    extraLogs.push(...workOrderLogs);
  }
  if (aiGovLogNote) {
    extraLogs.push({
      id: `aigov_${Date.now()}_${Math.floor(seededRandom(dateLabel)() * 999)}`,
      dateLabel,
      category: 'gobierno',
      title: 'Gestión del Poder Ejecutivo',
      detail: aiGovLogNote,
    });
  }

  if (delayedNotes.length > 0) {
    extraLogs.push({
      id: `del_${Date.now()}`,
      dateLabel,
      category: 'economia',
      title: 'Impacto de políticas previas',
      detail: delayedNotes.join(' · '),
    });
  }
  if (aiLogNote) {
    extraLogs.push({
      id: `ai_${Date.now()}_${Math.floor(seededRandom(dateLabel)() * 1000)}`,
      dateLabel,
      category: 'campana',
      title: 'Actividad de adversarios políticos',
      detail: aiLogNote,
    });
  }
  if (newEvent) {
    extraLogs.push({
      id: `evlog_${Date.now()}`,
      dateLabel,
      category: 'evento',
      title: `Acontecimiento: ${newEvent.title}`,
      detail: newEvent.description,
    });
  }

  // Hitos constitucionales del ciclo uruguayo (Rendición de Cuentas en Junio / Presupuesto Quinquenal en Agosto Año 1)
  if (state.careerPhase === 'gobierno' && nextMonth === 6) {
    extraLogs.push({
      id: `rendicion_${nextYear}_${Date.now()}`,
      dateLabel,
      category: 'parlamento',
      title: `Rendición de Cuentas ${nextYear} ingresada al Parlamento`,
      detail: `Balance fiscal ejecutado: déficit ${nextMacro.fiscalDeficitPctGdp.toFixed(2)}% PIB, deuda ${nextMacro.grossDebtPctGdp.toFixed(1)}% PIB y gasto ${nextMacro.spendingPctGdp.toFixed(1)}% PIB.`,
    });
  }
  if (state.careerPhase === 'gobierno' && nextYear === state.cycleStartYear + 1 && nextMonth === 8) {
    extraLogs.push({
      id: `pres_quinq_${nextYear}_${Date.now()}`,
      dateLabel,
      category: 'economia',
      title: `Vence plazo constitucional del Presupuesto Quinquenal (${nextYear}–${nextYear + 4})`,
      detail: 'El Poder Ejecutivo remite proyecciones fiscales y topes presupuestales al Palacio Legislativo.',
    });
  }

  // Asunción constitucional nacional el 1.° de marzo del año siguiente a las elecciones de octubre/noviembre
  if (
    nextYear > state.cycleStartYear &&
    nextMonth >= 3 &&
    !state.nationalInauguratedInCycle &&
    state.electoralStage === 'balotaje_completado'
  ) {
    const playerPartyObj = syncedParties.find((p) => p.id === state.player.partyId)!;
    const presWinnerId =
      state.nationalResult?.directWinnerPartyId ??
      state.runoffResult?.winnerPartyId ??
      state.nationalPresidentPartyId;
    const presParty = syncedParties.find((p) => p.id === presWinnerId) ?? playerPartyObj;

    let obtainedNatOffice: OfficeId | null = null;
    if (
      (state.player.targetOffice === 'presidente' || state.player.targetOffice === 'vicepresidente') &&
      presWinnerId === playerPartyObj.id &&
      state.internalResult?.playerWonPrimary
    ) {
      obtainedNatOffice = state.player.targetOffice;
    } else if (state.player.targetOffice === 'senador') {
      if (didPlayerWinSenateSeat(state, state.nationalResult)) obtainedNatOffice = 'senador';
    } else if (state.player.targetOffice === 'diputado') {
      if (didPlayerWinDeputySeat(state, state.nationalResult)) obtainedNatOffice = 'diputado';
    } else if (state.player.targetOffice === 'dirigente_partidario') {
      obtainedNatOffice = 'dirigente_partidario';
    }

    nextNatPresPartyId = presWinnerId;
    nextNatPresName =
      obtainedNatOffice === 'presidente'
        ? state.player.name
        : state.internalResult?.partyResults.find((r) => r.partyId === presWinnerId)?.winnerCandidate ??
          presParty.sectors[0].leader;
    nextCoalitionPartyIds = buildGoverningCoalitionPartyIds(state, presParty, syncedParties);
    nextNationalInaugurated = true;

    const isNationalTarget =
      state.player.targetOffice === 'presidente' ||
      state.player.targetOffice === 'vicepresidente' ||
      state.player.targetOffice === 'senador' ||
      state.player.targetOffice === 'diputado' ||
      state.player.targetOffice === 'dirigente_partidario';

    if (isNationalTarget) {
      nextPlayer = {
        ...nextPlayer,
        currentOffice: obtainedNatOffice,
        termsServedInCurrentOffice:
          obtainedNatOffice && obtainedNatOffice === state.player.currentOffice
            ? state.player.termsServedInCurrentOffice + 1
            : obtainedNatOffice
            ? 1
            : 0,
      };
      nextPhase = 'gobierno';
      if (state.player.targetOffice !== 'dirigente_partidario') {
        const baseStats = nextProgressionStats ?? {
          lawsPassed: state.player.legislativeWins,
          policiesEnacted: state.activePolicies?.length ?? 0,
          electionsWon: 0,
          electionsLost: 0,
          coalitionsFormed: state.electoralAlliances?.length ?? 0,
          partiesMerged: state.partyMergers?.length ?? 0,
          ministersAppointed: 0,
          controlsExecuted: state.opposition.parliamentaryControlsExecuted,
        };
        const wonNat = obtainedNatOffice !== null;
        nextProgressionStats = {
          ...baseStats,
          electionsWon: baseStats.electionsWon + (wonNat ? 1 : 0),
          electionsLost: baseStats.electionsLost + (!wonNat ? 1 : 0),
        };
      }
      const natLabel = obtainedNatOffice
        ? OFFICES.find((o) => o.id === obtainedNatOffice)?.name ?? obtainedNatOffice
        : 'Dirigente de oposición (sin cargo electivo)';
      const enteredOpposition = !nextCoalitionPartyIds.includes(state.player.partyId);

      nextOpposition = {
        ...nextOpposition,
        governmentPromises: buildPromisesForParty(presParty, nextMacro),
        opportunities: [],
      };
      // Etiqueta los proyectos abiertos según el nuevo gobierno
      nextBills = nextBills.map((b) =>
        b.status === 'en_negociacion'
          ? {
              ...b,
              origin: b.sponsorPartyId === presWinnerId ? 'oficialismo' : 'propio',
              playerBenchPosition: 'sin_definir',
            }
          : b
      );

      extraLogs.push({
        id: `nat_inaug_${Date.now()}`,
        dateLabel,
        category: 'gobierno',
        title: enteredOpposition
          ? `1.° de marzo: Paso a la oposición (${natLabel})`
          : `1.° de marzo: Transmisión de mando nacional (${natLabel})`,
        detail: enteredOpposition
          ? `${presParty.name} (${nextNatPresName}) asume el gobierno. Tu espacio pasa a la oposición como ${natLabel} con control parlamentario y político activo.`
          : `Asume la Presidencia ${nextNatPresName} (${presParty.name}). Tu cargo efectivo pasa a ser: ${natLabel}.`,
      });
    } else {
      const prevWasNational =
        state.player.currentOffice === 'presidente' ||
        state.player.currentOffice === 'vicepresidente' ||
        state.player.currentOffice === 'senador' ||
        state.player.currentOffice === 'diputado';
      if (prevWasNational) {
        nextPlayer = { ...nextPlayer, currentOffice: null };
      }
      nextOpposition = {
        ...nextOpposition,
        governmentPromises: buildPromisesForParty(presParty, nextMacro),
        opportunities: [],
      };
      extraLogs.push({
        id: `nat_inaug_dep_${Date.now()}`,
        dateLabel,
        category: 'gobierno',
        title: `1.° de marzo: Nuevo gobierno nacional (${nextNatPresName})`,
        detail: `Asume el nuevo Ejecutivo y Parlamento nacional mientras continúa tu campaña departamental rumbo a mayo.`,
      });
    }
  }

  // En fase de gobierno: fin de período constitucional (febrero del 5.º año)
  const yearsSinceCycleStart = nextYear - state.cycleStartYear;
  const reachedTermEnd =
    nextPhase === 'gobierno' &&
    ((yearsSinceCycleStart >= 5 && nextMonth >= 2) || yearsSinceCycleStart >= 6);

  if (reachedTermEnd) {
    nextPhase = 'fin_mandato';
    const endedInOpposition =
      nextNatPresPartyId !== state.player.partyId &&
      !nextCoalitionPartyIds.includes(state.player.partyId);

    const canSeekReelection =
      nextPlayer.currentOffice !== 'presidente' &&
      nextPlayer.currentOffice !== 'vicepresidente' &&
      !(nextPlayer.currentOffice === 'intendente' && nextPlayer.termsServedInCurrentOffice >= 2);

    if (endedInOpposition) {
      const playerPartyPoll = syncedParties.find((p) => p.id === state.player.partyId)?.currentPollShare ?? 0;
      const oppScore =
        (nextOpposition.credibility - 55) * 0.9 +
        (nextOpposition.internalLeadership - 55) * 0.6 +
        (playerPartyPoll - 20) * 0.8 +
        state.player.legislativeWins * 4;
      const grade: NonNullable<GameState['termLegacySummary']>['grade'] =
        oppScore >= 24 ? 'Histórico' : oppScore >= 10 ? 'Sólido' : oppScore >= -5 ? 'Disputado' : 'Desgastado';

      termLegacySummary = {
        grade,
        headline: `Balance desde la Oposición (${state.cycleStartYear + 1}–${nextYear})`,
        summary: `Completaste el período ejerciendo control opositor con ${Math.round(nextOpposition.credibility)}/100 de credibilidad partidaria, ${playerPartyPoll.toFixed(1)}% de intención de voto para tu lema y ${state.player.legislativeWins} iniciativas impulsadas.`,
        achievementsThisTerm: [
          nextOpposition.credibility >= 70 ? 'Oposición de alta credibilidad pública' : 'Credibilidad partidaria en disputa',
          nextOpposition.oppositionBlocPartyIds.length >= 1
            ? `Articulación con ${nextOpposition.oppositionBlocPartyIds.length} socio(s) opositores`
            : 'Estrategia opositora autónoma',
          playerPartyPoll >= 30 ? 'Fuerte posicionamiento para volver al gobierno' : 'Desafío de crecimiento electoral pendiente',
        ],
        canSeekReelection,
      };
    } else {
      const score =
        (nextGovApproval - 40) * 1.1 +
        (nextMacro.gdpGrowthPct - 1.8) * 8 -
        Math.max(0, nextMacro.inflationPct - 6) * 4 -
        Math.max(0, nextMacro.fiscalDeficitPctGdp - 3.2) * 6 +
        state.player.legislativeWins * 4;

      const grade: NonNullable<GameState['termLegacySummary']>['grade'] =
        score >= 28 ? 'Histórico' : score >= 12 ? 'Sólido' : score >= -5 ? 'Disputado' : 'Desgastado';

      termLegacySummary = {
        grade,
        headline: `Cierre del período ${state.cycleStartYear + 1}–${nextYear}`,
        summary: `Finalizás el mandato con ${nextGovApproval}% de aprobación, PIB creciendo al ${nextMacro.gdpGrowthPct}% anual, inflación en ${nextMacro.inflationPct}% y ${state.player.legislativeWins} leyes/decretos clave impulsados.`,
        achievementsThisTerm: [
          nextMacro.fiscalDeficitPctGdp < 2.8 ? 'Cuentas fiscales ordenadas (<2.8% PIB)' : 'Presión fiscal exigente',
          nextMacro.unemploymentPct < 8 ? 'Mercado laboral con bajo desempleo' : 'Desafío pendiente en empleo',
          state.player.legislativeWins >= 2 ? 'Alta productividad parlamentaria' : 'Oposición parlamentaria restrictiva',
        ],
        canSeekReelection,
      };
    }

    extraLogs.push({
      id: `term_end_${Date.now()}`,
      dateLabel,
      category: 'sistema',
      title: `Fin del período institucional (${termLegacySummary.grade})`,
      detail: termLegacySummary.summary,
    });
  }

  // 10. Registrar punto histórico mensual
  const playerParty = syncedParties.find((p) => p.id === state.player.partyId);
  const nextHistoryPoint = {
    dateLabel: `${nextMonth}/${String(nextYear).slice(2)}`,
    gdpGrowthPct: nextMacro.gdpGrowthPct,
    inflationPct: nextMacro.inflationPct,
    unemploymentPct: nextMacro.unemploymentPct,
    povertyPct: nextMacro.povertyPct,
    fiscalDeficitPctGdp: nextMacro.fiscalDeficitPctGdp,
    countryRiskBps: nextMacro.countryRiskBps,
    approvalPct: nextGovApproval,
    playerPopularity: nextPlayerPop,
    playerPartyPollPct: playerParty?.currentPollShare ?? 0,
  };

  const rawNextState: GameState = {
    ...state,
    careerPhase: nextPhase,
    currentYear: nextYear,
    currentMonth: nextMonth,
    monthsExecutedInTurn: 0,
    resourceActionsThisMonth: 0,
    macro: nextMacro,
    fiscalLevers: nextFiscalLevers,
    bills: nextBills,
    pendingVenias: nextPendingVenias,
    lastMacroReasons: econStep.reasons,
    macroHistory: [...state.macroHistory, nextHistoryPoint].slice(-60),
    nationalBudget: nextNationalBudget,
    revenueItems: econStep.nextRevenueItems,
    debtProfile: econStep.nextDebtProfile,
    fiscalLedger: econStep.nextFiscalLedger,
    bcuPolicyRatePct: econStep.nextBcuPolicyRatePct,
    effectPipeline: econStep.nextEffectPipeline,
    cabinet: cabEntStep.nextCabinet,
    publicEnterprises: cabEntStep.nextPublicEnterprises,
    socialActors: cabEntStep.nextSocialActors,
    departments: nextDepartments,
    publicWorksOrders: nextWorkOrders,
    parties: syncedParties,
    activePolicies: nextActivePolicies,
    latestPoll,
    events: nextEvents,
    pendingDelayedEffects: remainingDelayed,
    nationalInauguratedInCycle: nextNationalInaugurated,
    nationalPresidentPartyId: nextNatPresPartyId,
    nationalPresidentName: nextNatPresName,
    coalitionPartyIds: nextCoalitionPartyIds,
    opposition: nextOpposition,
    progression: {
      ...state.progression,
      careerStats: nextProgressionStats ?? state.progression.careerStats,
    },
    politicalIndicators: {
      ...state.politicalIndicators,
      partyStrength: playerParty?.partyStrength ?? state.politicalIndicators.partyStrength,
      presidentialPopularity: playerIsInNationalExec ? nextPlayerPop : nextGovApproval,
      governmentApproval: nextGovApproval,
      coalitionStability: Number(clamp(nextCoalitionStability + cabEntStep.stabilityDelta, 15, 98).toFixed(1)),
      parliamentarySupportPct,
      businessConfidence: cabEntStep.nextBusinessConfidence,
      unionConfidence: cabEntStep.nextUnionConfidence,
      publicOpinionIndex: Math.round((nextGovApproval + nextPlayerPop) / 2),
    },
    player: nextPlayer,
    termLegacySummary,
    history: [...extraLogs, ...state.history].slice(0, 120),
  };

  const afterDrift = applyOppositionStanceMonthlyDrift(rawNextState);
  return syncProgression(state, afterDrift);
}

/**
 * Transición al terminar las elecciones departamentales de mayo hacia la fase de Gobierno
 * (Preserva el cargo nacional si ya asumió el 1.º de marzo).
 */
export function enterGovernmentPhase(state: GameState): GameState {
  const playerParty = state.parties.find((p) => p.id === state.player.partyId)!;
  const presWinnerId =
    state.nationalResult?.directWinnerPartyId ?? state.runoffResult?.winnerPartyId ?? state.nationalPresidentPartyId;
  const presParty = state.parties.find((p) => p.id === presWinnerId) ?? playerParty;

  const isTargetDepartamental =
    state.player.targetOffice === 'intendente' ||
    state.player.targetOffice === 'edil' ||
    state.player.targetOffice === 'alcalde';

  let obtainedOffice: OfficeId | null = state.player.currentOffice;

  if (!state.nationalInauguratedInCycle && !isTargetDepartamental) {
    if (
      (state.player.targetOffice === 'presidente' || state.player.targetOffice === 'vicepresidente') &&
      presWinnerId === playerParty.id &&
      state.internalResult?.playerWonPrimary
    ) {
      obtainedOffice = state.player.targetOffice;
    } else if (state.player.targetOffice === 'senador') {
      obtainedOffice = didPlayerWinSenateSeat(state, state.nationalResult) ? 'senador' : null;
    } else if (state.player.targetOffice === 'diputado') {
      obtainedOffice = didPlayerWinDeputySeat(state, state.nationalResult) ? 'diputado' : null;
    } else if (state.player.targetOffice === 'dirigente_partidario') {
      obtainedOffice = 'dirigente_partidario';
    }
  } else if (isTargetDepartamental) {
    obtainedOffice = state.departamentalResult?.playerWonDepartamentalOffice
      ? state.player.targetOffice
      : null;
  }

  // Configura coalición de gobierno nacional (preserva alianzas electorales activas)
  const coalitionPartyIds = buildGoverningCoalitionPartyIds(state, presParty, state.parties);

  // Actualiza departamentos según resultado de mayo
  const updatedDepartments = state.departments.map((d) => {
    const depRes = state.departamentalResult?.departments.find((x) => x.departmentId === d.id);
    if (!depRes) return d;
    return {
      ...d,
      currentIntendentePartyId: depRes.winningLemaId,
      currentIntendenteName: depRes.winningIntendente,
    };
  });

  // Ajusta presupuesto departamental al departamento objetivo
  const targetDept = updatedDepartments.find((d) => d.id === state.player.targetDepartment)!;
  const nextDeptBudget = state.departamentalBudget.map((b) => ({
    ...b,
    annualMillionsUYU: Math.round((b.sharePct / 100) * targetDept.annualBudgetMillionsUYU),
  }));

  const presName =
    obtainedOffice === 'presidente'
      ? state.player.name
      : state.internalResult?.partyResults.find((r) => r.partyId === presWinnerId)?.winnerCandidate ??
        presParty.sectors[0].leader;

  const officeLabel = obtainedOffice
    ? OFFICES.find((o) => o.id === obtainedOffice)?.name ?? obtainedOffice
    : 'Dirigente sin cargo público';

  const enteredOpposition = !coalitionPartyIds.includes(playerParty.id);
  const nextOpposition = !state.nationalInauguratedInCycle
    ? {
        ...state.opposition,
        governmentPromises: buildPromisesForParty(presParty, state.macro),
        opportunities: [],
      }
    : state.opposition;

  const nextBills = !state.nationalInauguratedInCycle
    ? state.bills.map((b) =>
        b.status === 'en_negociacion'
          ? {
              ...b,
              origin: (b.sponsorPartyId === presWinnerId ? 'oficialismo' : 'propio') as
                | 'oficialismo'
                | 'propio',
              playerBenchPosition: 'sin_definir' as const,
            }
          : b
      )
    : state.bills;

  const prevStats = state.progression.careerStats ?? {
    lawsPassed: state.player.legislativeWins,
    policiesEnacted: state.activePolicies?.length ?? 0,
    electionsWon: 0,
    electionsLost: 0,
    coalitionsFormed: state.electoralAlliances?.length ?? 0,
    partiesMerged: state.partyMergers?.length ?? 0,
    ministersAppointed: 0,
    controlsExecuted: state.opposition.parliamentaryControlsExecuted,
  };
  const shouldRecordOutcome =
    (isTargetDepartamental || !state.nationalInauguratedInCycle) &&
    state.player.targetOffice !== 'dirigente_partidario';
  const wonSeatOrExec = obtainedOffice !== null && obtainedOffice !== 'dirigente_partidario';

  const nextGovState: GameState = {
    ...state,
    careerPhase: 'gobierno',
    currentMonth: Math.max(5, state.currentMonth),
    departments: updatedDepartments,
    departamentalBudget: nextDeptBudget,
    nationalInauguratedInCycle: true,
    nationalPresidentPartyId: presWinnerId,
    nationalPresidentName: presName,
    coalitionPartyIds,
    opposition: nextOpposition,
    bills: nextBills,
    progression: {
      ...state.progression,
      careerStats: shouldRecordOutcome
        ? {
            ...prevStats,
            electionsWon: prevStats.electionsWon + (wonSeatOrExec ? 1 : 0),
            electionsLost: prevStats.electionsLost + (!wonSeatOrExec ? 1 : 0),
          }
        : prevStats,
    },
    player: {
      ...state.player,
      currentOffice: obtainedOffice,
      termsServedInCurrentOffice:
        obtainedOffice && obtainedOffice === state.player.currentOffice
          ? state.player.termsServedInCurrentOffice + 1
          : obtainedOffice
          ? 1
          : 0,
    },
    history: [
      {
        id: `gov_start_${Date.now()}`,
        dateLabel: `${MONTH_NAMES[Math.max(5, state.currentMonth) - 1]} ${state.currentYear}`,
        category: 'gobierno',
        title: enteredOpposition
          ? `Elecciones departamentales completadas · En oposición (${officeLabel})`
          : `Elecciones departamentales completadas (${officeLabel})`,
        detail: `Presidencia Nacional: ${presName} (${presParty.name}). Tu cargo institucional efectivo: ${officeLabel}.`,
      },
      ...state.history,
    ],
  };

  return syncProgression(state, nextGovState);
}

/**
 * Inicia un nuevo ciclo electoral de 5 años conservando el cargo actual vigente durante la campaña (Regla 6).
 */
export function startNextCareerCycle(
  state: GameState,
  nextOffice: OfficeId,
  nextDepartment: DepartmentId
): GameState {
  const newCycleYear = state.currentYear;
  const resetEvents = state.events.filter((e) => !e.resolved);

  const nextCycleState: GameState = {
    ...state,
    careerPhase: 'campana',
    cycleNumber: state.cycleNumber + 1,
    cycleStartYear: newCycleYear,
    currentMonth: 3,
    monthsExecutedInTurn: 0,
    resourceActionsThisMonth: 0,
    electoralStage: 'pre_internas',
    nationalInauguratedInCycle: false,
    internalResult: undefined,
    nationalResult: undefined,
    runoffResult: undefined,
    departamentalResult: undefined,
    termLegacySummary: undefined,
    events: resetEvents,
    opposition: {
      ...state.opposition,
      opportunities: state.opposition.opportunities.filter((o) => !o.capitalized).slice(0, 2),
    },
    progression: {
      ...state.progression,
      cycleStartPovertyPct: state.macro.povertyPct,
      previousDeptIncumbents: buildPreviousDeptIncumbents(state.departments),
      activeObjectives: [],
    },
    player: {
      ...state.player,
      targetOffice: nextOffice,
      targetDepartment: nextDepartment,
      politicalCapital: state.player.politicalCapital,
    },
    history: [
      {
        id: `cycle_${state.cycleNumber + 1}_${Date.now()}`,
        dateLabel: `Marzo ${newCycleYear}`,
        category: 'sistema',
        title: `Nuevo ciclo electoral #${state.cycleNumber + 1}`,
        detail: `Iniciás campaña rumbo a ${OFFICES.find((o) => o.id === nextOffice)?.name ?? nextOffice} conservando tus atribuciones actuales hasta el cambio de mando.`,
      },
      ...state.history,
    ],
  };

  nextCycleState.progression.activeObjectives = generateContextualObjectives(nextCycleState);
  return syncProgression(state, nextCycleState);
}
