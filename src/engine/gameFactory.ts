import {
  BASE_PARTIES,
  BILL_TEMPLATES,
  DEFAULT_FINANCING_MIX,
  DEFAULT_FISCAL_LEVERS,
  DEPARTAMENTAL_CANDIDATES_POOL,
  DEPARTMENTS_DATA,
  DIFFICULTIES,
  INITIAL_DEPARTAMENTAL_BUDGET,
  INITIAL_DEPARTAMENTAL_TEAM,
  INITIAL_DIPLOMACY,
  INITIAL_MINISTERS,
  INITIAL_PROGRAM_PROPOSALS,
  INITIAL_PUBLIC_ENTERPRISES,
  INITIAL_SOCIAL_ACTORS,
  MINISTER_CANDIDATES_POOL,
  MONTH_NAMES,
  OFFICES,
  SCENARIOS,
  createInitialDebtProfile,
  createInitialFiscalLedger,
  createInitialPartyFinances,
  createInitialRevenueItems,
  enrichDepartmentTerritorial,
  scaleNationalBudgetToMacro,
} from '../data/uruguayData';
import {
  CharacterAttributes,
  DepartmentId,
  DifficultyId,
  EmblemId,
  GameState,
  OfficeId,
  Party,
  ScenarioId,
} from '../types/game';
import { generatePollSnapshot } from './electoralEngine';
import { createInitialOppositionState } from './oppositionEngine';
import { createInitialProgressionState, generateContextualObjectives } from './progressionEngine';

export interface CreateGameOptions {
  scenarioId: ScenarioId;
  difficultyId: DifficultyId;
  originMode: 'partido_existente' | 'partido_nuevo' | 'personaje_historico';
  selectedPartyId: string;
  selectedSectorId: string;
  selectedPresetId?: string;
  playerName: string;
  biography: string;
  attributes: CharacterAttributes;
  targetOffice: OfficeId;
  targetDepartment: DepartmentId;
  targetMunicipality?: string;
  customParty?: {
    name: string;
    acronym: string;
    color: string;
    emblem: EmblemId;
    economic: number;
    social: number;
    program: string;
  };
}

export function buildNewGameState(opts: CreateGameOptions): GameState {
  const difficulty = DIFFICULTIES.find((d) => d.id === opts.difficultyId) ?? DIFFICULTIES[2];
  const scenario = SCENARIOS.find((s) => s.id === opts.scenarioId) ?? SCENARIOS[0];

  const parties: Party[] = BASE_PARTIES.map((p) => {
    const share = scenario.partySharesOverride?.[p.id] ?? p.baseNationalShare;
    return {
      ...p,
      baseNationalShare: share,
      currentPollShare: share,
      sectors: p.sectors.map((s) => ({ ...s })),
    };
  });

  const activePartyPreview = parties.find((p) => p.id === opts.selectedPartyId) ?? parties[0];
  let finalPartyId = activePartyPreview.id;
  let finalSectorId = opts.selectedSectorId || activePartyPreview.sectors[0].id;
  let finalIdeology = { ...activePartyPreview.ideology };

  if (opts.originMode === 'partido_nuevo' && opts.customParty) {
    finalPartyId = 'custom_party';
    finalSectorId = 'custom_sector_1';
    finalIdeology = { economic: opts.customParty.economic, social: opts.customParty.social };
    const coalitionGroup =
      opts.customParty.economic < 40
        ? 'izquierda'
        : opts.customParty.economic > 60
        ? 'coalicion_republicana'
        : 'tercera_via';

    const initialNewShare = 4.5;
    parties.forEach((p) => {
      const adjusted = Number((p.baseNationalShare * ((100 - initialNewShare) / 100)).toFixed(2));
      p.baseNationalShare = adjusted;
      p.currentPollShare = adjusted;
    });

    const acr = (opts.customParty.acronym.trim() || 'NPU').toUpperCase().slice(0, 4);
    parties.push({
      id: finalPartyId,
      name: opts.customParty.name.trim() || 'Nuevo Partido Uruguayo',
      acronym: acr,
      color: opts.customParty.color,
      secondaryColor: '#FAF6EE',
      emblem: opts.customParty.emblem,
      ideology: finalIdeology,
      isCustom: true,
      coalitionGroup,
      aiPersonality: 'pragmatico',
      baseNationalShare: initialNewShare,
      currentPollShare: initialNewShare,
      partyStrength: 58,
      campaignMomentum: 1.5,
      programPriority: opts.customParty.program,
      historicalNote: 'Lema fundado por el jugador.',
      sectors: [
        {
          id: finalSectorId,
          name: `Lista Fundacional (${acr})`,
          shortName: `${acr} · Lista 1`,
          leader: opts.playerName.trim() || 'Fundador',
          ideology: finalIdeology,
          internalWeight: 72,
          strongholds: [opts.targetDepartment],
          description: 'Corriente fundadora del nuevo partido.',
        },
        {
          id: 'custom_sector_2',
          name: 'Corriente Territorial del Interior',
          shortName: 'Corriente Interior',
          leader: 'Referente del Interior',
          ideology: {
            economic: Math.min(90, opts.customParty.economic + 8),
            social: Math.max(10, opts.customParty.social - 8),
          },
          internalWeight: 28,
          strongholds: ['canelones', 'colonia'],
          description: 'Ala departamental que disputa orientación interna.',
        },
      ],
    });
  } else {
    const chosenSector = activePartyPreview.sectors.find((s) => s.id === finalSectorId);
    if (chosenSector) finalIdeology = { ...chosenSector.ideology };
  }

  const relations = parties
    .filter((p) => p.id !== finalPartyId)
    .map((p) => {
      const dist = Math.hypot(
        finalIdeology.economic - p.ideology.economic,
        finalIdeology.social - p.ideology.social
      );
      const baseAff = Math.round(45 - dist * 0.85);
      return {
        partyId: p.id,
        partyName: p.name,
        leaderName: p.sectors[0]?.leader ?? p.acronym,
        affinity: Math.max(-75, Math.min(75, baseAff)),
        inCoalition: p.coalitionGroup === parties.find((x) => x.id === finalPartyId)?.coalitionGroup,
      };
    });

  const departments = DEPARTMENTS_DATA.map((d) =>
    enrichDepartmentTerritorial({
      ...d,
      partyMultipliers: { ...d.partyMultipliers },
    })
  );
  if (opts.originMode === 'partido_nuevo') {
    departments.forEach((d) => {
      d.partyMultipliers[finalPartyId] = d.id === opts.targetDepartment ? 1.55 : 0.92;
    });
  }

  const activeDeptData = departments.find((d) => d.id === opts.targetDepartment) ?? departments[0];
  const incumbentParty = parties.find((p) => p.id === scenario.incumbentPartyId) ?? parties[0];
  const coalitionPartyIds =
    incumbentParty.coalitionGroup === 'coalicion_republicana'
      ? parties.filter((p) => p.coalitionGroup === 'coalicion_republicana').map((p) => p.id)
      : [incumbentParty.id];

  const bills = BILL_TEMPLATES.map((tpl, idx) => {
    const isInitGov = idx < 2;
    const originChamber: 'diputados' | 'senado' | 'junta_departamental' =
      tpl.chamber === 'junta_departamental' ? 'junta_departamental' : tpl.chamber === 'senado' ? 'senado' : 'diputados';
    return {
      ...tpl,
      id: `bill_${idx + 1}`,
      sponsorPartyId: isInitGov ? incumbentParty.id : finalPartyId,
      origin: (isInitGov ? 'oficialismo' : 'propio') as 'oficialismo' | 'propio',
      playerBenchPosition: 'sin_definir' as const,
      originChamber,
      legislativeStage: 'camara_origen_comision' as const,
      committeeName:
        tpl.category === 'presupuestal'
          ? 'Comisión de Presupuestos y Hacienda'
          : tpl.category === 'economica'
          ? 'Comisión de Hacienda'
          : 'Comisión de Constitución y Legislación',
      executiveVetoKind: 'ninguno' as const,
      isConstitutionalBudgetBill: tpl.category === 'presupuestal' && tpl.chamber !== 'junta_departamental',
      deadlineDaysRemaining: tpl.category === 'presupuestal' && tpl.chamber !== 'junta_departamental' ? 45 : undefined,
      status: 'en_negociacion' as const,
      concessionsApplied: [],
      negotiatedPartySupport: {},
    };
  });

  const deptBudget = INITIAL_DEPARTAMENTAL_BUDGET.map((b) => ({
    ...b,
    annualMillionsUYU: Math.round((b.sharePct / 100) * activeDeptData.annualBudgetMillionsUYU),
  }));

  const startDateLabel = `${MONTH_NAMES[(scenario.startMonth - 1 + 12) % 12] ?? 'Marzo'} ${scenario.startYear}`;
  const chosenPartyObj = parties.find((p) => p.id === finalPartyId);

  const initialNationalBudget = scaleNationalBudgetToMacro(scenario.macro);
  const initialRevenueItems = createInitialRevenueItems(scenario.macro);
  const initialDebtProfile = createInitialDebtProfile(scenario.macro);
  const initialFinancingMix = { ...DEFAULT_FINANCING_MIX };
  const initialFiscalLedger = createInitialFiscalLedger(
    scenario.macro,
    initialNationalBudget,
    initialRevenueItems,
    initialDebtProfile,
    initialFinancingMix
  );
  const initialBcuRate = Number(Math.max(4.5, Math.min(14.5, 4.0 + scenario.macro.inflationPct * 0.82)).toFixed(2));

  const baseState: GameState = {
    version: 3,
    id: `uy_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    scenarioId: opts.scenarioId,
    difficultyId: opts.difficultyId,
    careerPhase: 'campana',
    cycleNumber: 1,
    cycleStartYear: scenario.startYear,
    currentYear: scenario.startYear,
    currentMonth: scenario.startMonth,
    monthsExecutedInTurn: 0,
    resourceActionsThisMonth: 0,
    activePolicies: [],
    electoralAlliances: [],
    electoralSupporters: [],
    coalitionPromisedMinistries: {},
    partyMergers: [],
    player: {
      name: opts.playerName.trim() || 'Dirigente Oriental',
      originMode: opts.originMode,
      historicalPresetId: opts.originMode === 'personaje_historico' ? opts.selectedPresetId : undefined,
      partyId: finalPartyId,
      sectorId: finalSectorId,
      targetOffice: opts.targetOffice,
      currentOffice: null,
      targetDepartment: opts.targetDepartment,
      targetMunicipality: opts.targetOffice === 'alcalde' ? opts.targetMunicipality : undefined,
      ideology: finalIdeology,
      biography: opts.biography,
      attributes: opts.attributes,
      relations,
      politicalCapital: Math.round(40 + (opts.attributes.negotiation - 50) * 0.4),
      campaignFundsUYU: Math.round(12000000 * difficulty.startingFundsMultiplier),
      termsServedInCurrentOffice: 0,
      totalMonthsInCareer: 0,
      legislativeWins: 0,
    },
    parties,
    departments,
    macro: { ...scenario.macro },
    lastMacroReasons: [
      {
        indicator: 'Estado inicial del escenario',
        deltaLabel: 'Base verificada',
        direction: 'flat',
        causes: [scenario.dataSourceNote],
      },
    ],
    macroHistory: [
      {
        dateLabel: `${scenario.startMonth}/${String(scenario.startYear).slice(2)}`,
        gdpGrowthPct: scenario.macro.gdpGrowthPct,
        inflationPct: scenario.macro.inflationPct,
        unemploymentPct: scenario.macro.unemploymentPct,
        povertyPct: scenario.macro.povertyPct,
        fiscalDeficitPctGdp: scenario.macro.fiscalDeficitPctGdp,
        countryRiskBps: scenario.macro.countryRiskBps,
        approvalPct: scenario.macro.governmentApprovalPct,
        playerPopularity: opts.attributes.popularity,
        playerPartyPollPct: parties.find((p) => p.id === finalPartyId)?.currentPollShare ?? 0,
      },
    ],
    fiscalLevers: { ...DEFAULT_FISCAL_LEVERS },
    nationalBudget: initialNationalBudget,
    departamentalBudget: deptBudget,
    revenueItems: initialRevenueItems,
    debtProfile: initialDebtProfile,
    deficitFinancingMix: initialFinancingMix,
    fiscalLedger: initialFiscalLedger,
    bcuPolicyRatePct: initialBcuRate,
    effectPipeline: [],
    publicEnterprises: INITIAL_PUBLIC_ENTERPRISES.map((e) => ({ ...e })),
    socialActors: INITIAL_SOCIAL_ACTORS.map((a) => ({ ...a, negotiationHistory: [] })),
    governmentAnnouncements: [],
    publicWorksOrders: [],
    partyFinances: createInitialPartyFinances(parties),
    governmentArchive: [],
    politicalIndicators: {
      presidentialPopularity: scenario.macro.governmentApprovalPct,
      governmentApproval: scenario.macro.governmentApprovalPct,
      partyStrength: parties.find((p) => p.id === finalPartyId)?.partyStrength ?? 60,
      coalitionStability: 72,
      parliamentarySupportPct: 50,
      businessConfidence: 62,
      unionConfidence: 58,
      publicOpinionIndex: Math.round((scenario.macro.governmentApprovalPct + opts.attributes.popularity) / 2),
    },
    latestPoll: {
      dateLabel: '',
      firmName: 'Equipos Consultores',
      sampleSize: 1200,
      marginOfErrorPct: 2.8,
      shares: [],
      undecidedPct: 9,
    },
    cabinet: INITIAL_MINISTERS.map((m) => ({ ...m })),
    ministerCandidates: MINISTER_CANDIDATES_POOL.map((c) => ({ ...c })),
    departamentalTeam: INITIAL_DEPARTAMENTAL_TEAM.map((d) => ({ ...d })),
    departamentalCandidates: DEPARTAMENTAL_CANDIDATES_POOL.map((c) => ({ ...c })),
    programProposals: INITIAL_PROGRAM_PROPOSALS.map((p) => ({ ...p })),
    governmentPriorities: [
      'Estabilidad macroeconómica y empleo',
      'Seguridad pública y prevención',
      'Infraestructura y descentralización',
    ],
    bills,
    diplomacy: INITIAL_DIPLOMACY.map((d) => ({ ...d })),
    events: [],
    pendingDelayedEffects: [],
    electoralStage: 'pre_internas',
    nationalInauguratedInCycle: false,
    nationalPresidentPartyId: incumbentParty.id,
    nationalPresidentName: incumbentParty.sectors[0].leader,
    coalitionPartyIds,
    opposition: createInitialOppositionState(parties, incumbentParty.id, scenario.macro),
    progression: createInitialProgressionState({
      initialPovertyPct: scenario.macro.povertyPct,
      departments,
      dateLabel: startDateLabel,
      isCustomParty: opts.originMode === 'partido_nuevo',
      partyName: chosenPartyObj?.name ?? opts.customParty?.name ?? 'Nuevo Partido',
      playerName: opts.playerName.trim() || 'Dirigente Oriental',
    }),
    history: [
      {
        id: 'init_1',
        dateLabel: startDateLabel,
        category: 'sistema',
        title: 'Inicio de campaña electoral',
        detail: `${opts.playerName.trim()} inicia la carrera en «${scenario.title}» (${difficulty.name}) postulándose a ${OFFICES.find((o) => o.id === opts.targetOffice)?.name}.`,
      },
    ],
  };

  baseState.latestPoll = generatePollSnapshot(baseState, difficulty);
  baseState.progression.activeObjectives = generateContextualObjectives(baseState);
  return baseState;
}
