import type {
  DepartmentId,
  IdeologyAxis,
  PolicyMacroEffect,
} from './game';

/* ============================================================
   EXPANSIÓN INTEGRAL · ECOSISTEMA POLÍTICO URUGUAYO
   Tipos de los 14 subsistemas conectados al motor central.
   ============================================================ */

export type FactionPosture = 'apoyo' | 'neutral' | 'obstruccion';
export type FactionGoal = 'liderazgo' | 'cargos' | 'programa' | 'presupuesto' | 'territorio' | 'identidad';

export interface PartyFactionState {
  id: string;
  partyId: string;
  sectorId: string;
  name: string;
  shortName: string;
  leaderName: string;
  ideology: IdeologyAxis;
  influence: number; // 0-100
  loyalty: number; // 0-100 hacia el jugador
  mood: number; // 0-100
  goal: FactionGoal;
  demand: string;
  posture: FactionPosture;
  demandsMet: number;
  lastActionDateLabel?: string;
}

export interface FactionChallengeState {
  id: string;
  partyId: string;
  factionId: string;
  factionName: string;
  challengerName: string;
  dateLabel: string;
  internalSupportPct: number;
  monthsOpen: number;
  status: 'abierta' | 'resuelta' | 'derrotada';
  resolutionNote?: string;
}

export type AdvisorRole = 'comunicacion' | 'negociacion' | 'economia' | 'territorio' | 'legal' | 'campana';
export type AdvisorStatus = 'disponible' | 'contratado' | 'renuncio' | 'despedido';

export interface AdvisorState {
  id: string;
  name: string;
  role: AdvisorRole;
  roleLabel: string;
  experience: number;
  capacity: number;
  loyalty: number;
  reputation: number;
  salaryMonthlyUYU: number;
  signingCostUYU: number;
  status: AdvisorStatus;
  specialty: string;
  effectSummary: string;
  hiredDateLabel?: string;
}

export type MediaKind = 'tv' | 'radio' | 'diario' | 'digital';
export type NewsTone = 'positiva' | 'neutra' | 'negativa';

export interface MediaOutletState {
  id: string;
  name: string;
  kind: MediaKind;
  audiencePct: number;
  credibility: number;
  editorialLine: number; // -100 progresista / +100 liberal-conservador
  affinity: number; // 0-100 con el jugador
  lastCoverageDateLabel?: string;
}

export interface MediaNewsState {
  id: string;
  dateLabel: string;
  outletId: string;
  outletName: string;
  headline: string;
  tone: NewsTone;
  impact: number;
  topic: string;
}

export interface DebateAnswerOption {
  id: string;
  text: string;
  economic: number;
  social: number;
  argument: number;
  proposal: number;
}

export interface DebateQuestion {
  id: string;
  topic: string;
  prompt: string;
  options: DebateAnswerOption[];
}

export interface DebateAnswerRecord {
  questionId: string;
  optionId: string;
  score: number;
  note: string;
}

export type DebateKind = 'presidencial' | 'parlamentario' | 'departamental';

export interface DebateSessionState {
  id: string;
  dateLabel: string;
  kind: DebateKind;
  status: 'programado' | 'en_curso' | 'finalizado';
  scheduledYear: number;
  scheduledMonth: number;
  opponentNames: string[];
  currentQuestionIndex: number;
  answers: DebateAnswerRecord[];
  score: number;
  pollImpact: number;
  approvalImpact: number;
  reputationImpact: number;
  summary?: string;
}

export type OpinionSegmentId =
  | 'juventud'
  | 'adultos'
  | 'mayores'
  | 'trabajadores_formales'
  | 'trabajadores_informales'
  | 'clase_media'
  | 'empresarios'
  | 'rural';

export interface OpinionSegmentState {
  id: OpinionSegmentId;
  name: string;
  populationPct: number;
  priorities: string[];
  governmentApproval: number;
  playerAffinity: number;
  economicSensitivity: number;
  socialSensitivity: number;
  territorialBias: number; // -1 Montevideo / +1 Interior
}

export interface SegmentPollState {
  dateLabel: string;
  segments: Array<{
    segmentId: OpinionSegmentId;
    approval: number;
    playerPartyPct: number;
    leadingPartyId: string;
  }>;
}

export interface DepartmentPollState {
  dateLabel: string;
  departments: Array<{
    departmentId: DepartmentId;
    approval: number;
    playerPartyPct: number;
    leadingPartyId: string;
  }>;
}

export type CabinetCrisisKind = 'renuncia' | 'conflicto' | 'error_gestion' | 'escandalo';

export interface CabinetCrisisState {
  id: string;
  ministerId: string;
  ministerName: string;
  ministryCode: string;
  ministryName: string;
  kind: CabinetCrisisKind;
  severity: number;
  dateLabel: string;
  status: 'abierta' | 'resuelta';
  description: string;
  monthsOpen: number;
  resolutionNote?: string;
}

export type InstitutionalControlKind =
  | 'constitucionalidad'
  | 'competencia'
  | 'pedido_informe'
  | 'auditoria_legal';

export interface InstitutionalControlState {
  id: string;
  targetType: 'politica' | 'ley' | 'decreto' | 'presupuesto' | 'acto_admin';
  targetId: string;
  targetTitle: string;
  kind: InstitutionalControlKind;
  filedBy: 'oposicion' | 'organismo' | 'jugador';
  dateLabel: string;
  status: 'abierto' | 'resuelto';
  riskScore: number;
  description: string;
  monthsOpen: number;
  resolutionNote?: string;
}

export interface PolicyEvaluationState {
  id: string;
  policyId: string;
  policyTitle: string;
  kind: 'previa' | 'posterior';
  dateLabel: string;
  estimatedCostPctGdp: number;
  estimatedBeneficiaries: string;
  estimatedRisk: 'bajo' | 'medio' | 'alto';
  expectedEffects: PolicyMacroEffect;
  observedEffects?: PolicyMacroEffect;
  deviationScore?: number;
  verdict: string;
}

export type PlanHorizon = 5 | 10 | 20;

export interface NationalPlanGoalState {
  id: string;
  title: string;
  metric: string;
  currentValue: number;
  targetValue: number;
  unit: string;
}

export interface NationalPlanProjectState {
  id: string;
  title: string;
  sector: string;
  costBillionsUYU: number;
  totalMonths: number;
  remainingMonths: number;
  status: 'planificado' | 'en_ejecucion' | 'completado';
  effectSummary: string;
}

export interface NationalPlanState {
  id: string;
  name: string;
  horizonYears: PlanHorizon;
  startYear: number;
  endYear: number;
  status: 'vigente' | 'cumplido' | 'archivado';
  goals: NationalPlanGoalState[];
  projects: NationalPlanProjectState[];
  politicalCapitalInvested: number;
  continuityScore: number;
  lastProgressNote?: string;
}

export type TransparencyKind = 'auditoria' | 'investigacion' | 'denuncia' | 'pedido_informe';
export type TransparencyStatus = 'abierto' | 'en_curso' | 'respondido' | 'escalado' | 'cerrado';

export interface TransparencyCaseState {
  id: string;
  title: string;
  kind: TransparencyKind;
  area: string;
  dateLabel: string;
  severity: number;
  status: TransparencyStatus;
  credibilityImpact: number;
  trustImpact: number;
  description: string;
  monthsOpen: number;
  responseNote?: string;
}

export interface IntendencyRelationState {
  departmentId: DepartmentId;
  departmentName: string;
  intendenteName: string;
  partyId: string;
  relationScore: number; // -100 a +100
  conflictLevel: number;
  agreement?: {
    title: string;
    monthsRemaining: number;
    transferMillionsUYU: number;
    active: boolean;
  };
  lastContactDateLabel?: string;
}

export type ForeignNegotiationKind = 'comercial' | 'diplomatica' | 'mercosur' | 'cooperacion';

export interface ForeignNegotiationState {
  id: string;
  partnerId: string;
  partnerName: string;
  kind: ForeignNegotiationKind;
  title: string;
  dateLabel: string;
  monthsRemaining: number;
  totalMonths: number;
  status: 'en_curso' | 'firmado' | 'fracasado';
  expectedBenefit: string;
  approvalEffect: number;
  tradeDelta: number;
  relationDelta: number;
}

export type NegotiationKind = 'apoyo_parlamentario' | 'cargos' | 'programa';
export type NegotiationStatus = 'abierta' | 'aceptada' | 'rechazada' | 'rota' | 'cumplida';

export interface PoliticalNegotiationState {
  id: string;
  partyId: string;
  partyName: string;
  kind: NegotiationKind;
  dateLabel: string;
  status: NegotiationStatus;
  demandLabel: string;
  demandedMinistries: number;
  demandedPolicy: string;
  demandedFundsMillions: number;
  durationMonths: number;
  monthsRemaining: number;
  affinityAtOffer: number;
  compliance: number;
  acceptanceChance: number;
  benefitsSummary: string;
}

export interface PoliticalEcosystemState {
  version: number;
  factions: PartyFactionState[];
  challenges: FactionChallengeState[];
  advisors: AdvisorState[];
  mediaOutlets: MediaOutletState[];
  mediaNews: MediaNewsState[];
  debates: DebateSessionState[];
  opinionSegments: OpinionSegmentState[];
  segmentPolls: SegmentPollState[];
  departmentPolls: DepartmentPollState[];
  cabinetCrises: CabinetCrisisState[];
  institutionalControls: InstitutionalControlState[];
  policyEvaluations: PolicyEvaluationState[];
  nationalPlans: NationalPlanState[];
  transparencyCases: TransparencyCaseState[];
  intendencyRelations: IntendencyRelationState[];
  negotiations: PoliticalNegotiationState[];
  foreignNegotiations: ForeignNegotiationState[];
  mercosurIntegration: number;
  lastMonthlyNotes: string[];
}

export type EcosystemAction =
  | { type: 'court_faction'; factionId: string }
  | { type: 'grant_faction_post'; factionId: string }
  | { type: 'confront_faction'; factionId: string }
  | { type: 'hire_advisor'; advisorId: string }
  | { type: 'dismiss_advisor'; advisorId: string }
  | { type: 'media_interview'; outletId: string }
  | { type: 'media_press_conference'; outletId: string }
  | { type: 'start_negotiation'; partyId: string; kind: NegotiationKind }
  | { type: 'accept_negotiation'; negotiationId: string }
  | { type: 'reject_negotiation'; negotiationId: string }
  | { type: 'break_agreement'; negotiationId: string }
  | { type: 'start_debate'; debateId: string }
  | { type: 'answer_debate'; debateId: string; optionId: string }
  | { type: 'negotiate_social_actor'; actorId: string; offer: 'salarial' | 'programatico' | 'presupuesto' }
  | { type: 'resolve_cabinet_crisis'; crisisId: string; option: 'mediar' | 'reestructurar' | 'cesar' }
  | { type: 'file_institutional_control'; targetId: string; kind: InstitutionalControlKind }
  | { type: 'respond_institutional_control'; caseId: string; strategy: 'juridica' | 'politica' | 'tecnica' }
  | { type: 'evaluate_policy'; policyId: string }
  | { type: 'create_national_plan'; horizon: PlanHorizon; focus: string }
  | { type: 'fund_plan_project'; planId: string; projectId: string }
  | { type: 'launch_transparency_case'; kind: 'auditoria' | 'investigacion' | 'pedido_informe' }
  | { type: 'respond_transparency_case'; caseId: string; strategy: 'transparente' | 'reservada' | 'tecnica' }
  | { type: 'intendency_agreement'; departmentId: string }
  | { type: 'transfer_to_intendency'; departmentId: string; amountMillions: number }
  | { type: 'foreign_negotiation'; partnerId: string; kind: ForeignNegotiationKind }
  | { type: 'mercosur_summit' };

export interface EcosystemActionResult {
  ok: boolean;
  message: string;
  nextState: GameStateLike;
}

/** Evita un ciclo de importación en tiempo de compilación. */
export type GameStateLike = import('./game').GameState;
