export type DifficultyId = 'muy_facil' | 'facil' | 'normal' | 'dificil' | 'realista';

export type ScenarioId =
  | 'contemporaneo_2024'
  | 'historico_1999'
  | 'historico_2004'
  | 'historico_2019'
  | 'futuro_2029';

export type OfficeLevel = 'nacional' | 'departamental';

export type OfficeId =
  | 'presidente'
  | 'vicepresidente'
  | 'senador'
  | 'diputado'
  | 'dirigente_partidario'
  | 'intendente'
  | 'edil'
  | 'alcalde';

export type DepartmentId =
  | 'artigas'
  | 'canelones'
  | 'cerro_largo'
  | 'colonia'
  | 'durazno'
  | 'flores'
  | 'florida'
  | 'lavalleja'
  | 'maldonado'
  | 'montevideo'
  | 'paysandu'
  | 'rio_negro'
  | 'rivera'
  | 'rocha'
  | 'salto'
  | 'san_jose'
  | 'soriano'
  | 'tacuarembo'
  | 'treinta_y_tres';

export type EmblemId = 'sol' | 'ceibo' | 'bandera' | 'balanza' | 'espiga' | 'engranaje';

export type CareerPhase = 'campana' | 'gobierno' | 'fin_mandato';

export interface IdeologyAxis {
  /** 0 = estatista / redistributivo, 100 = pro-mercado / liberal */
  economic: number;
  /** 0 = tradicionalista / conservador, 100 = progresista / reformista */
  social: number;
}

export interface Sector {
  id: string;
  name: string;
  shortName: string;
  leader: string;
  ideology: IdeologyAxis;
  internalWeight: number;
  strongholds: DepartmentId[];
  description: string;
}

export type AIPersonality = 'pragmatico' | 'reformista' | 'conservador' | 'territorial' | 'disruptivo';

export interface Party {
  id: string;
  name: string;
  acronym: string;
  color: string;
  secondaryColor: string;
  emblem: EmblemId;
  ideology: IdeologyAxis;
  isCustom?: boolean;
  coalitionGroup: 'izquierda' | 'coalicion_republicana' | 'independiente_soberano' | 'tercera_via';
  aiPersonality: AIPersonality;
  sectors: Sector[];
  baseNationalShare: number;
  currentPollShare: number;
  partyStrength: number; // 0-100 fortaleza organizativa
  campaignMomentum: number; // -15 a +15
  programPriority: string;
  historicalNote: string;
}

export interface DepartmentData {
  id: DepartmentId;
  name: string;
  capital: string;
  population2023: number;
  electoralShare: number;
  baselineDeputies: number;
  economicProfile: string[];
  unemploymentRate: number;
  povertyRate: number;
  wageIndex: number;
  gdpPerCapitaIndex: number;
  currentIntendentePartyId: string;
  currentIntendenteName: string;
  municipalitiesCount: number;
  sampleMunicipalities: string[];
  partyMultipliers: Record<string, number>;
  /** Inversión local acumulada en infraestructura y servicios departamentales (0-100) */
  localServiceQuality: number;
  /** Presupuesto departamental anual estimado en millones de UYU */
  annualBudgetMillionsUYU: number;
  /** Indicadores territoriales ampliados (Etapa 1 / Etapa 6) */
  economicActivityIndex?: number;
  employmentRate?: number;
  infrastructureScore?: number;
  tourismFlowIndex?: number;
  accumulatedInvestmentUYU?: number;
  territorialNeeds?: string[];
}

export interface CharacterAttributes {
  popularity: number;
  charisma: number;
  management: number;
  territorialMachine: number;
  negotiation: number;
}

export interface LeaderRelation {
  partyId: string;
  partyName: string;
  leaderName: string;
  affinity: number; // -100 a +100
  inCoalition: boolean;
}

export interface PlayerCharacter {
  name: string;
  originMode: 'partido_existente' | 'partido_nuevo' | 'personaje_historico';
  historicalPresetId?: string;
  partyId: string;
  sectorId: string;
  targetOffice: OfficeId;
  currentOffice: OfficeId | null;
  targetDepartment: DepartmentId;
  targetMunicipality?: string;
  ideology: IdeologyAxis;
  biography: string;
  attributes: CharacterAttributes;
  relations: LeaderRelation[];
  politicalCapital: number; // 0-100
  campaignFundsUYU: number;
  termsServedInCurrentOffice: number;
  totalMonthsInCareer: number;
  legislativeWins: number;
}

export interface MacroSnapshot {
  sourceLabel: string;
  isSimulated: boolean;
  gdpBillionsUSD: number;
  gdpGrowthPct: number;
  inflationPct: number;
  unemploymentPct: number;
  employmentRatePct?: number;
  povertyPct: number;
  indigencePct?: number;
  giniIndex?: number;
  realWageGrowthPct: number;
  purchasingPowerIndex?: number;
  fiscalDeficitPctGdp: number;
  grossDebtPctGdp: number;
  debtInterestPctGdp?: number;
  revenuePctGdp: number;
  spendingPctGdp: number;
  investmentPctGdp: number;
  publicInvestmentPctGdp?: number;
  privateInvestmentPctGdp?: number;
  productionIndex?: number;
  exportsBillionsUSD: number;
  importsBillionsUSD: number;
  exchangeRateUYU: number;
  countryRiskBps: number;
  consumptionGrowthPct: number;
  productivityIndex: number; // Base 100
  governmentApprovalPct: number;
}

export interface IndicatorChangeReason {
  indicator: string;
  deltaLabel: string;
  direction: 'up' | 'down' | 'flat';
  causes: string[];
}

export interface MonthlyHistoryPoint {
  dateLabel: string;
  gdpGrowthPct: number;
  inflationPct: number;
  unemploymentPct: number;
  povertyPct: number;
  fiscalDeficitPctGdp: number;
  countryRiskBps: number;
  approvalPct: number;
  playerPopularity: number;
  playerPartyPollPct: number;
}

export interface FiscalPolicyLevers {
  incomeTaxRate: number;      // IRPF/IRAE índice relativo (10-35, base 22)
  vatRate: number;            // IVA efectivo base (18-24, base 22)
  publicInvestmentBoost: number; // -20 a +40 (% sobre base)
  socialSubsidiesIndex: number;  // 50 a 150 (base 100)
  publicWageAdjustment: number;  // -3 a +6 (% real anualizado)
  pensionAdjustment: number;     // -2 a +5 (% adicional sobre IMS)
  tradeOpenness: number;         // 20 a 90 (aranceles/acuerdos)
  productiveIncentives: number;  // 0 a 100
}

export type NationalBudgetCategory =
  | 'educacion'
  | 'salud'
  | 'seguridad'
  | 'jubilaciones'
  | 'desarrollo_social'
  | 'infraestructura'
  | 'transporte'
  | 'vivienda'
  | 'ciencia_tecnologia'
  | 'desarrollo_productivo'
  | 'cultura'
  | 'medioambiente'
  | 'defensa'
  | 'relaciones_exteriores'
  | 'administracion'
  | 'intereses_otros';

export type SpendingNature =
  | 'inversion_estructural'
  | 'gasto_social'
  | 'corriente'
  | 'financiero';

export interface BudgetAllocation {
  category: NationalBudgetCategory;
  label: string;
  sharePct: number; // Derivado dinámicamente (sin tope artificial ni auto-rebalanceo)
  annualBillionsUYU: number; // Monto vigente libre en miles de millones UYU
  approvedBillionsUYU?: number; // Monto aprobado por ley de Presupuesto / Rendición
  committedBillionsUYU?: number; // Obligaciones comprometidas (contratos/nóminas/políticas)
  executedBillionsUYU?: number; // Devengado efectivo acumulado
  pctOfGdp?: number;
  spendingNature?: SpendingNature;
  executionEfficiency: number; // 50-100
}

export type RevenueSourceId =
  | 'iva'
  | 'irpf'
  | 'irae'
  | 'patrimonio'
  | 'otros_tributarios'
  | 'empresas_publicas'
  | 'tasas_contribuciones'
  | 'otros_ingresos';

export interface RevenueLineItem {
  id: RevenueSourceId;
  label: string;
  projectedBillionsUYU: number;
  collectedBillionsUYU: number;
  pctOfGdp: number;
  effectiveRatePct: number;
}

export interface DebtProfile {
  grossDebtBillionsUSD: number;
  netDebtBillionsUSD: number;
  usdSharePct: number;
  uiSharePct: number;
  uyuSharePct: number;
  weightedAvgRatePct: number;
  annualMaturitiesBillionsUSD: number;
  treasuryLiquidAssetsBillionsUSD: number;
}

export interface DeficitFinancingMix {
  internalDebtUiUyuPct: number;
  externalDebtMultilateralPct: number;
  treasuryAssetsDrawPct: number;
  enterpriseDividendsPct: number;
}

export interface FiscalLedgerSummary {
  projectedRevenuePctGdp: number;
  collectedRevenuePctGdp: number;
  approvedSpendingPctGdp: number;
  currentSpendingPctGdp: number;
  committedSpendingPctGdp: number;
  executedSpendingPctGdp: number;
  primaryBalancePctGdp: number;
  debtInterestPctGdp: number;
  globalBalancePctGdp: number;
  taxBurdenPctGdp: number;
  avgFinancingCostPct: number;
  sustainabilityIndex: number; // 0-100
}

export type DepartamentalBudgetCategory =
  | 'obras'
  | 'transporte_local'
  | 'limpieza'
  | 'alumbrado'
  | 'espacios_publicos'
  | 'ordenamiento'
  | 'desarrollo_local'
  | 'politicas_sociales'
  | 'municipios';

export interface DepartamentalBudgetItem {
  category: DepartamentalBudgetCategory;
  label: string;
  sharePct: number;
  annualMillionsUYU: number;
}

export interface MinisterProfile {
  id: string;
  ministryCode: string;
  ministryName: string;
  holderName: string;
  partyId: string;
  sectorName: string;
  management: number;
  popularity: number;
  experience: number;
  affinity: number;
  loyalty: number;
  specialization: NationalBudgetCategory;
  age?: number;
  ideology?: IdeologyAxis;
  trajectory?: string;
  strengths?: string[];
  weaknesses?: string[];
  avatarSeed?: string;
  isVacant?: boolean;
}

export interface MinisterCandidate {
  id: string;
  name: string;
  partyId: string;
  sectorName: string;
  management: number;
  popularity: number;
  experience: number;
  affinity: number;
  loyalty: number;
  specialization: NationalBudgetCategory;
  age?: number;
  ideology?: IdeologyAxis;
  trajectory?: string;
  strengths?: string[];
  weaknesses?: string[];
  avatarSeed?: string;
}

export interface PolicyMacroEffect {
  gdpDelta?: number;
  inflationDelta?: number;
  unemploymentDelta?: number;
  employmentDelta?: number;
  povertyDelta?: number;
  indigenceDelta?: number;
  realWageDelta?: number;
  purchasingPowerDelta?: number;
  giniDelta?: number;
  publicInvestmentDelta?: number;
  privateInvestmentDelta?: number;
  productionDelta?: number;
  fiscalCostPctGdp?: number;
  expectedRevenuePctGdp?: number;
  approvalDelta?: number;
}

export type PolicyCategoryCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J';

export type LegalInstrumentType =
  | 'decreto_pe'
  | 'resolucion_admin'
  | 'reglamentacion'
  | 'proyecto_ley'
  | 'ley_presupuestal'
  | 'convenio'
  | 'ente_autonomo';

export type PolicyOrientation =
  | 'socialdemocrata'
  | 'liberal'
  | 'conservadora'
  | 'desarrollista'
  | 'socialista'
  | 'centrista'
  | 'productivista';

export interface PublicPolicyDraft {
  id: string;
  code?: string;
  categoryCode?: PolicyCategoryCode;
  orientation?: PolicyOrientation;
  legalInstrument?: LegalInstrumentType;
  responsibleBody?: string;
  requiredCompetence?: string;
  normativeText?: string;
  riskLevel?: 'bajo' | 'medio' | 'alto';
  socialResistance?: string[];
  targetIndicators?: string[];
  title: string;
  ministryArea: NationalBudgetCategory;
  summary: string;
  objectives: string[];
  instruments: string[];
  financingSource: string;
  beneficiaries: string;
  timelineMonths: number;
  implementationSteps: string[];
  conditions: string[];
  politicalCapitalCost: number;
  moneyCostUYU: number;
  estimatedEffects: PolicyMacroEffect;
  delayedEffects: PolicyMacroEffect;
  positiveExternalities: string[];
  negativeExternalities: string[];
  viabilityNote: string;
  synergyTags: string[];
}

export interface ActivePublicPolicy extends PublicPolicyDraft {
  enactedDateLabel: string;
  activeMonths: number;
  status:
    | 'en_tramite_parlamentario'
    | 'en_implementacion'
    | 'vigente'
    | 'retrasada'
    | 'bloqueada'
    | 'finalizada'
    | 'derogada';
  linkedBillId?: string;
  sponsorPartyId: string;
  synergies: string[];
  conflicts: string[];
  observedEffects: {
    gdpImpactAcc: number;
    inflationImpactAcc: number;
    employmentImpactAcc: number;
    povertyImpactAcc: number;
    fiscalNetAcc: number;
    approvalImpactAcc: number;
  };
}

export type EffectHorizon = 'inmediato' | 'corto' | 'mediano' | 'largo';

export interface DelayedEffectPipelineItem {
  id: string;
  sourceType: 'politica' | 'ley' | 'presupuesto' | 'tarifa' | 'obra' | 'evento';
  sourceId: string;
  label: string;
  horizon: EffectHorizon;
  remainingMonths: number;
  totalMonths: number;
  gdpDelta?: number;
  inflationDelta?: number;
  unemploymentDelta?: number;
  povertyDelta?: number;
  giniDelta?: number;
  productivityDelta?: number;
  approvalDelta?: number;
  applied?: boolean;
}

export interface ElectoralAlliance {
  id: string;
  name: string;
  partnerPartyIds: string[];
  leadPartyId: string;
  promisedMinistries: Record<string, number>;
  programPoints: string[];
  createdDateLabel: string;
  active: boolean;
}

export interface PartyMergerRecord {
  id: string;
  dateLabel: string;
  sourcePartyIds: string[];
  newPartyId: string;
  newPartyName: string;
  newAcronym: string;
  defectionPenaltyPct: number;
}

export interface DepartamentalDirectorProfile {
  id: string;
  areaCode: string;
  areaName: string;
  holderName: string;
  sectorName: string;
  management: number;
  popularity: number;
  loyalty: number;
}

export interface DepartamentalDirectorCandidate {
  id: string;
  name: string;
  sectorName: string;
  management: number;
  popularity: number;
  loyalty: number;
}

export interface ProgramProposal {
  id: string;
  title: string;
  area: string;
  summary: string;
  adopted: boolean;
  popularityImpact: number;
  momentumImpact: number;
}

export type LegislativeStage =
  | 'camara_origen_comision'
  | 'camara_origen_plenario'
  | 'camara_revisora'
  | 'devuelta_origen'
  | 'asamblea_general'
  | 'promulgacion_ejecutivo'
  | 'veto_parcial_o_total'
  | 'aprobada'
  | 'rechazada';

export interface BillProposal {
  id: string;
  title: string;
  category: 'economica' | 'social' | 'institucional' | 'presupuestal' | 'laboral' | 'seguridad';
  summary: string;
  sponsorPartyId: string;
  origin?: 'oficialismo' | 'oposicion' | 'propio';
  playerBenchPosition?: 'a_favor' | 'en_contra' | 'abstencion' | 'sin_definir';
  /** Efecto económico/social si se aprueba */
  effectsDescription: string;
  politicalCapitalCost: number;
  chamber: 'ambas' | 'senado' | 'diputados' | 'junta_departamental';
  originChamber?: 'diputados' | 'senado' | 'junta_departamental';
  legislativeStage?: LegislativeStage;
  deadlineDaysRemaining?: number;
  committeeName?: string;
  executiveVetoKind?: 'ninguno' | 'parcial' | 'total';
  isConstitutionalBudgetBill?: boolean;
  linkedPolicyId?: string;
  status: 'en_negociacion' | 'aprobada' | 'rechazada';
  concessionsApplied: string[];
  /** Modificador de voto negociado con cada partido */
  negotiatedPartySupport: Record<string, number>;
  /** Registro constitucional de instancias bicamerales */
  originChamberResult?: { chamberName: string; yes: number; no: number; total: number; approved: boolean; vpVoted?: 'a_favor' | 'en_contra' };
  reviewChamberResult?: { chamberName: string; yes: number; no: number; total: number; modified: boolean; approved: boolean; vpVoted?: 'a_favor' | 'en_contra' };
  assemblyResult?: { chamberName: string; yes: number; no: number; requiredVotes: number; total: number; reason: string; approved: boolean };
  /** Impactos estructurados al aprobarse */
  payload: {
    gdpDelta?: number;
    inflationDelta?: number;
    unemploymentDelta?: number;
    povertyDelta?: number;
    deficitDelta?: number;
    revenueDelta?: number;
    productivityDelta?: number;
    approvalDelta?: number;
    businessTrustDelta?: number;
    unionTrustDelta?: number;
    riskDelta?: number;
  };
  voteBreakdown?: {
    chamberName: string;
    yes: number;
    no: number;
    abstentions: number;
    byParty: Array<{ partyId: string; partyName: string; color: string; yes: number; no: number }>;
  };
}

export interface SenateVeniaRequest {
  id: string;
  enterpriseId: PublicEnterpriseId;
  enterpriseName: string;
  nomineeName: string;
  nomineePartyId: string;
  daysElapsed: number;
  status: 'pendiente' | 'aprobada' | 'rechazada';
  votesYes?: number;
  votesNo?: number;
  requiredVotes?: number;
  createdDateLabel: string;
}

export interface MinisterialCensureState {
  id: string;
  ministerId: string;
  ministryCode: string;
  ministerName: string;
  reason: string;
  status: 'en_asamblea' | 'observada_pe' | 'ratificada' | 'superada';
  assemblyVotesYes?: number;
  assemblyVotesNo?: number;
  createdDateLabel: string;
}

export type OppositionStance =
  | 'constructiva'
  | 'critica'
  | 'confrontativa'
  | 'negociadora'
  | 'propositiva';

export interface GovernmentPromise {
  id: string;
  title: string;
  metric:
    | 'inflationPct'
    | 'unemploymentPct'
    | 'fiscalDeficitPctGdp'
    | 'gdpGrowthPct'
    | 'povertyPct'
    | 'realWageGrowthPct';
  comparator: 'lte' | 'gte';
  targetValue: number;
  targetLabel: string;
  denounced: boolean;
}

export interface OppositionOpportunity {
  id: string;
  category: 'desempleo' | 'seguridad' | 'educacion' | 'escandalo' | 'promesas' | 'economia' | 'coalicion';
  title: string;
  summary: string;
  dateLabel: string;
  severity: number;
  capitalized: boolean;
  outcomeNote?: string;
}

export interface OppositionState {
  stance: OppositionStance;
  credibility: number;
  internalLeadership: number;
  oppositionBlocPartyIds: string[];
  recruitedLeadersCount: number;
  parliamentaryControlsExecuted: number;
  partyOppositionStrategies: Record<string, OppositionStance>;
  governmentPromises: GovernmentPromise[];
  opportunities: OppositionOpportunity[];
  lastAIGovActionNote?: string;
}

export interface DiplomaticPartner {
  id: 'argentina' | 'brasil' | 'paraguay' | 'chile' | 'eeuu' | 'china' | 'ue';
  name: string;
  bloc: 'Mercosur' | 'Asociado Regional' | 'Extra-regional';
  relationScore: number; // 0-100
  tradeVolumeBillionsUSD: number;
  exportSharePct: number;
  investmentFlowScore: number; // 0-100
  activeAgreement: string;
}

export interface EventOutcomeEffects {
  approval?: number;
  popularity?: number;
  gdpDelta?: number;
  inflationDelta?: number;
  unemploymentDelta?: number;
  deficitDelta?: number;
  riskDelta?: number;
  coalitionStability?: number;
  businessTrust?: number;
  unionTrust?: number;
  partyStrength?: number;
  diplomaticDelta?: Partial<Record<DiplomaticPartner['id'], number>>;
  note: string;
}

export interface GameEventOption {
  id: string;
  label: string;
  description: string;
  moneyCostUYU: number;
  politicalCapitalCost: number;
  successProbability: number; // 0-100
  expectedImpactSummary: string;
  onSuccess: EventOutcomeEffects;
  onFailure?: EventOutcomeEffects;
}

export interface GameEvent {
  id: string;
  domain: 'economia' | 'politica' | 'sociedad' | 'internacional';
  title: string;
  description: string;
  context: string;
  dateLabel: string;
  resolved: boolean;
  chosenOptionId?: string;
  resolutionOutcome?: string;
  options: GameEventOption[];
}

export interface PoliticalIndicators {
  presidentialPopularity: number;
  governmentApproval: number;
  partyStrength: number;
  coalitionStability: number;
  parliamentarySupportPct: number;
  businessConfidence: number;
  unionConfidence: number;
  publicOpinionIndex: number;
}

export interface PollSnapshot {
  dateLabel: string;
  firmName: string;
  sampleSize: number;
  marginOfErrorPct: number;
  shares: Array<{ partyId: string; partyName: string; color: string; pct: number }>;
  undecidedPct: number;
}

export type ElectoralStage =
  | 'pre_internas'
  | 'internas_completadas'
  | 'nacionales_completadas'
  | 'balotaje_completado'
  | 'departamentales_completadas';

export interface InternalElectionResult {
  dateLabel: string;
  turnoutPct: number;
  partyResults: Array<{
    partyId: string;
    partyName: string;
    partyColor: string;
    totalVotes: number;
    winnerSectorId: string;
    winnerCandidate: string;
    viceCandidate: string;
    decidedByConvention: boolean;
    unityScore: number;
    sectorBreakdown: Array<{
      sectorId: string;
      sectorName: string;
      leader: string;
      votes: number;
      pctWithinParty: number;
    }>;
  }>;
  playerWonPrimary: boolean;
  playerRankInParty: number;
  explanation: string[];
}

export interface PlebisciteResult {
  id: string;
  title: string;
  description: string;
  yesVotes: number;
  yesPctOfEmitted: number;
  approved: boolean;
}

export interface DepartmentVoteBreakdown {
  departmentId: DepartmentId;
  departmentName: string;
  emittedVotes: number;
  validPartyVotes: number;
  blankAndNullVotes: number;
  winningPartyId: string;
  partyVotes: Record<string, number>;
  partyPctOfValid: Record<string, number>;
  deputiesAllocated: Record<string, number>;
}

export interface NationalElectionResult {
  dateLabel: string;
  turnoutPct: number;
  totalRegistered: number;
  totalEmitted: number;
  totalValidPartyVotes: number;
  blankAndNullVotes: number;
  partyTotals: Array<{
    partyId: string;
    partyName: string;
    color: string;
    votes: number;
    pctOfEmitted: number;
    pctOfValid: number;
    senateSeats: number;
    deputySeats: number;
    senateSectorBreakdown: Array<{ sectorName: string; seats: number }>;
  }>;
  senateTotalSeats: number;
  deputiesTotalSeats: number;
  requiresRunoff: boolean;
  runoffPair?: [string, string];
  directWinnerPartyId?: string;
  plebiscites: PlebisciteResult[];
  byDepartment: DepartmentVoteBreakdown[];
  playerElectedOffice?: string;
  explanation: string[];
}

export interface RunoffResult {
  dateLabel: string;
  turnoutPct: number;
  totalEmitted: number;
  blankAndNullVotes: number;
  candidateA: {
    partyId: string;
    partyName: string;
    formula: string;
    color: string;
    votes: number;
    pctOfEmitted: number;
    pctOfValid: number;
  };
  candidateB: {
    partyId: string;
    partyName: string;
    formula: string;
    color: string;
    votes: number;
    pctOfEmitted: number;
    pctOfValid: number;
  };
  winnerPartyId: string;
  byDepartment: Array<{
    departmentId: DepartmentId;
    departmentName: string;
    pctAValid: number;
    pctBValid: number;
    winnerPartyId: string;
  }>;
  explanation: string[];
}

export interface DepartamentalElectionResult {
  dateLabel: string;
  turnoutPct: number;
  departments: Array<{
    departmentId: DepartmentId;
    departmentName: string;
    winningLemaId: string;
    winningLemaName: string;
    winningColor: string;
    winningIntendente: string;
    winningLemaPct: number;
    juntaSeats: Record<string, number>;
    automaticMajorityApplied: boolean;
    municipalitiesWonByPlayerParty: number;
    partyVotes: Record<string, number>;
  }>;
  playerWonDepartamentalOffice: boolean;
  playerDepartamentalOutcomeLabel: string;
  explanation: string[];
}

export interface HistoricalLogEntry {
  id: string;
  dateLabel: string;
  category: 'sistema' | 'eleccion' | 'campana' | 'gobierno' | 'economia' | 'parlamento' | 'diplomacia' | 'evento';
  title: string;
  detail: string;
}

export interface ScenarioConfig {
  id: ScenarioId;
  title: string;
  periodLabel: string;
  startYear: number;
  startMonth: number;
  description: string;
  dataSourceNote: string;
  incumbentPartyId: string;
  macro: MacroSnapshot;
  partySharesOverride?: Record<string, number>;
}

export interface DifficultyConfig {
  id: DifficultyId;
  name: string;
  summary: string;
  startingFundsMultiplier: number;
  attributeBudget: number;
  volatility: number;
  aiAggressiveness: number;
  negotiationPenalty: number;
  crisisFrequency: number;
}

export interface PendingDelayedEffect {
  id: string;
  triggerInMonths: number;
  label: string;
  gdpDelta?: number;
  inflationDelta?: number;
  unemploymentDelta?: number;
  povertyDelta?: number;
  approvalDelta?: number;
  productivityDelta?: number;
}

export type CareerLevelId =
  | 'militante'
  | 'dirigente_local'
  | 'referente_territorial'
  | 'dirigente_sectorial'
  | 'legislador'
  | 'lider_partidario'
  | 'candidato_nacional'
  | 'figura_nacional'
  | 'jefe_gobierno'
  | 'estadista';

export interface CareerLevelDef {
  level: number;
  id: CareerLevelId;
  title: string;
  minXp: number;
  unlockNote: string;
}

export type AchievementCategory = 'electoral' | 'gobierno' | 'parlamentario' | 'politico';

export interface AchievementDef {
  id: string;
  title: string;
  category: AchievementCategory;
  description: string;
  conditionText: string;
}

export interface UnlockedAchievementRecord {
  id: string;
  unlockedAtDate: string;
  cycleNumber: number;
}

export interface DynamicObjective {
  id: string;
  title: string;
  description: string;
  category: 'campana' | 'gobierno' | 'intendencia' | 'oposicion';
  currentValue: number;
  targetValue: number;
  unitLabel: string;
  xpReward: number;
  capitalReward: number;
  moneyRewardUYU?: number;
  difficultyTier?: 'baja' | 'media' | 'alta';
  completed: boolean;
  completedDateLabel?: string;
}

export interface TacticalMission {
  id: string;
  title: string;
  description: string;
  currentValue: number;
  targetValue: number;
  unitLabel: string;
  capitalReward: number;
  moneyRewardUYU: number;
  expiresInMonths: number;
  completed: boolean;
}

export interface CareerLifetimeStats {
  lawsPassed: number;
  policiesEnacted: number;
  electionsWon: number;
  electionsLost: number;
  coalitionsFormed: number;
  partiesMerged: number;
  ministersAppointed: number;
  controlsExecuted: number;
}

export interface NarrativeMoment {
  id: string;
  kind:
    | 'victoria_electoral'
    | 'derrota_oposicion'
    | 'asuncion_presidencial'
    | 'fundacion_partido'
    | 'reforma_historica'
    | 'mayoria_parlamentaria'
    | 'subida_nivel';
  newspaperName: string;
  kicker: string;
  headline: string;
  subheadline: string;
  bodyText: string;
  quoteText?: string;
  dateLabel: string;
  imageKey: 'homeHero' | 'ceremonyPalacio' | 'campaignRally' | 'presidentialDesk';
  seen: boolean;
}

export interface XpLogEntry {
  id: string;
  dateLabel: string;
  amount: number;
  reason: string;
}

export interface ProgressionState {
  xp: number;
  levelNumber: number;
  levelTitle: string;
  unlockedAchievements: UnlockedAchievementRecord[];
  activeObjectives: DynamicObjective[];
  tacticalMissions?: TacticalMission[];
  careerStats?: CareerLifetimeStats;
  completedObjectivesCount: number;
  xpHistory: XpLogEntry[];
  pendingMoment?: NarrativeMoment;
  momentsArchive: NarrativeMoment[];
  cycleStartPovertyPct: number;
  previousDeptIncumbents: Record<string, string>;
}

export interface GameState {
  version: number;
  id: string;
  createdAt: string;
  updatedAt: string;
  scenarioId: ScenarioId;
  difficultyId: DifficultyId;
  careerPhase: CareerPhase;
  cycleNumber: number;
  cycleStartYear: number;
  currentYear: number;
  currentMonth: number; // 1-12
  monthsExecutedInTurn: number; // acciones de campaña/operación usadas este mes
  resourceActionsThisMonth?: number; // acciones de obtención de capital/fondos usadas este mes
  player: PlayerCharacter;
  parties: Party[];
  departments: DepartmentData[];
  macro: MacroSnapshot;
  lastMacroReasons: IndicatorChangeReason[];
  macroHistory: MonthlyHistoryPoint[];
  fiscalLevers: FiscalPolicyLevers;
  nationalBudget: BudgetAllocation[];
  departamentalBudget: DepartamentalBudgetItem[];
  politicalIndicators: PoliticalIndicators;
  latestPoll: PollSnapshot;
  cabinet: MinisterProfile[];
  ministerCandidates: MinisterCandidate[];
  departamentalTeam: DepartamentalDirectorProfile[];
  departamentalCandidates: DepartamentalDirectorCandidate[];
  programProposals: ProgramProposal[];
  governmentPriorities: string[];
  bills: BillProposal[];
  diplomacy: DiplomaticPartner[];
  events: GameEvent[];
  pendingDelayedEffects: PendingDelayedEffect[];
  electoralStage: ElectoralStage;
  nationalInauguratedInCycle: boolean;
  nationalPresidentPartyId: string;
  nationalPresidentName: string;
  coalitionPartyIds: string[];
  coalitionPromisedMinistries?: Record<string, number>;
  electoralAlliances?: ElectoralAlliance[];
  electoralSupporters?: string[];
  partyMergers?: PartyMergerRecord[];
  activePolicies?: ActivePublicPolicy[];
  enactedLawModifiers?: {
    gdpTargetDelta?: number;
    revenueTargetDelta?: number;
    spendingTargetDelta?: number;
    inflationTargetDelta?: number;
    unemploymentTargetDelta?: number;
    povertyTargetDelta?: number;
    productivityDriftDelta?: number;
  };
  opposition: OppositionState;
  progression: ProgressionState;
  /** Nuevos subsistemas arquitectónicos v3 (hidratados por migrationEngine) */
  revenueItems?: RevenueLineItem[];
  debtProfile?: DebtProfile;
  deficitFinancingMix?: DeficitFinancingMix;
  fiscalLedger?: FiscalLedgerSummary;
  bcuPolicyRatePct?: number;
  effectPipeline?: DelayedEffectPipelineItem[];
  publicEnterprises?: PublicEnterpriseState[];
  socialActors?: SocialActorState[];
  governmentAnnouncements?: GovernmentAnnouncement[];
  publicWorksOrders?: DepartmentWorkOrder[];
  partyFinances?: Record<string, PartyFinanceState>;
  governmentArchive?: GovernmentArchiveRecord[];
  pendingVenias?: SenateVeniaRequest[];
  censureProcess?: MinisterialCensureState | null;
  internalResult?: InternalElectionResult;
  nationalResult?: NationalElectionResult;
  runoffResult?: RunoffResult;
  departamentalResult?: DepartamentalElectionResult;
  termLegacySummary?: {
    grade: 'Histórico' | 'Sólido' | 'Disputado' | 'Desgastado';
    headline: string;
    summary: string;
    achievementsThisTerm: string[];
    canSeekReelection: boolean;
  };
  history: HistoricalLogEntry[];
}

export type PublicEnterpriseId = 'ute' | 'ancap' | 'antel' | 'ose' | 'brou';

export interface PublicEnterpriseState {
  id: PublicEnterpriseId;
  name: string;
  legalKind: 'ente_autonomo' | 'servicio_descentralizado';
  directorName: string;
  senateVeniaApproved: boolean;
  tariffIndex: number; // Base 100
  annualRevenueBillionsUYU: number;
  annualCostBillionsUYU: number;
  operatingBalanceBillionsUYU: number;
  investmentPlanBillionsUYU: number;
  serviceQualityScore: number; // 0-100
  ownDebtBillionsUSD: number;
}

export type SocialActorId = 'pit_cnt' | 'camaras_empresariales' | 'gremiales_agro' | 'congreso_intendentes';

export interface SocialActorState {
  id: SocialActorId;
  name: string;
  interests: string[];
  pressureCapacity: number; // 0-100
  resources: number; // 0-100
  organizationLevel: number; // 0-100
  politicalAffinity: number; // -100 a +100
  governmentTrust: number; // 0-100
  conflictLevel: number; // 0-100
  negotiationHistory: Array<{
    dateLabel: string;
    topic: string;
    agreed: boolean;
    fulfilled: boolean;
  }>;
}

export interface GovernmentAnnouncement {
  id: string;
  dateLabel: string;
  kind: 'conferencia' | 'anuncio_medida' | 'informe_gestion' | 'rendicion';
  title: string;
  summary: string;
  approvalEffect: number;
}

export interface DepartmentWorkOrder {
  id: string;
  departmentId: DepartmentId;
  title: string;
  authorityLevel: 'nacional' | 'intendencia' | 'municipio';
  costMillionsUYU: number;
  totalMonths: number;
  remainingMonths: number;
  status: 'en_ejecucion' | 'completada';
  effectSummary: string;
}

export interface PartyFinanceState {
  publicSubsidyUYU: number;
  membershipDuesUYU: number;
  privateDonationsUYU: number;
  transparencyScore: number; // 0-100
  lastCongressYear?: number;
  leadershipStability: number; // 0-100
}

export interface GovernmentArchiveRecord {
  cycleNumber: number;
  periodLabel: string;
  presidentName: string;
  partyId: string;
  partyName: string;
  coalitionPartyIds: string[];
  startGdpGrowthPct: number;
  endGdpGrowthPct: number;
  endInflationPct: number;
  endUnemploymentPct: number;
  endPovertyPct: number;
  endDeficitPctGdp: number;
  endApprovalPct: number;
  grade: string;
  keyMilestones: string[];
}

export interface PlayerMetaStats {
  gamesPlayed: number;
  governedDepartments: DepartmentId[];
  unlockedAchievements: string[];
  completedRuns: Array<{
    id: string;
    playerName: string;
    partyName: string;
    scenarioTitle: string;
    outcomeLabel: string;
    dateSaved: string;
  }>;
}
