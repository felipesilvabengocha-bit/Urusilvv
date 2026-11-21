import type { EcosystemAction, EcosystemActionResult } from '../types/expansion';
import type { GameState } from '../types/game';
import {
  answerDebate,
  confrontFaction,
  courtFaction,
  dismissAdvisor,
  grantFactionPost,
  hireAdvisor,
  mediaInterview,
  mediaPressConference,
  startDebate,
} from './ecosystemInternalActions';
import {
  acceptNegotiation,
  breakAgreement,
  fileInstitutionalControl,
  negotiateSocialActor,
  rejectNegotiation,
  resolveCabinetCrisis,
  respondInstitutionalControl,
  startNegotiation,
} from './ecosystemNegotiationActions';
import {
  createNationalPlan,
  evaluatePolicy,
  fundPlanProject,
  launchTransparencyCase,
  respondTransparencyCase,
} from './ecosystemPlanActions';
import {
  intendencyAgreement,
  mercosurSummit,
  startForeignNegotiation,
  transferToIntendency,
} from './ecosystemTerritoryForeignActions';

export * from './ecosystemFactory';
export * from './ecosystemInternalActions';
export * from './ecosystemMonthlyEngine';
export * from './ecosystemNegotiationActions';
export * from './ecosystemPlanActions';
export * from './ecosystemShared';
export * from './ecosystemTerritoryForeignActions';

/**
 * Punto único de entrada para las acciones del ecosistema.
 * Toda acción devuelve un resultado con mensaje y estado nuevo (inmutable).
 */
export function dispatchEcosystemAction(
  state: GameState,
  action: EcosystemAction
): EcosystemActionResult {
  switch (action.type) {
    case 'court_faction':
      return courtFaction(state, action.factionId);
    case 'grant_faction_post':
      return grantFactionPost(state, action.factionId);
    case 'confront_faction':
      return confrontFaction(state, action.factionId);
    case 'hire_advisor':
      return hireAdvisor(state, action.advisorId);
    case 'dismiss_advisor':
      return dismissAdvisor(state, action.advisorId);
    case 'media_interview':
      return mediaInterview(state, action.outletId);
    case 'media_press_conference':
      return mediaPressConference(state, action.outletId);
    case 'start_negotiation':
      return startNegotiation(state, action.partyId, action.kind);
    case 'accept_negotiation':
      return acceptNegotiation(state, action.negotiationId);
    case 'reject_negotiation':
      return rejectNegotiation(state, action.negotiationId);
    case 'break_agreement':
      return breakAgreement(state, action.negotiationId);
    case 'start_debate':
      return startDebate(state, action.debateId);
    case 'answer_debate':
      return answerDebate(state, action.debateId, action.optionId);
    case 'negotiate_social_actor':
      return negotiateSocialActor(state, action.actorId, action.offer);
    case 'resolve_cabinet_crisis':
      return resolveCabinetCrisis(state, action.crisisId, action.option);
    case 'file_institutional_control':
      return fileInstitutionalControl(state, action.targetId, action.kind);
    case 'respond_institutional_control':
      return respondInstitutionalControl(state, action.caseId, action.strategy);
    case 'evaluate_policy':
      return evaluatePolicy(state, action.policyId);
    case 'create_national_plan':
      return createNationalPlan(state, action.horizon, action.focus);
    case 'fund_plan_project':
      return fundPlanProject(state, action.planId, action.projectId);
    case 'launch_transparency_case':
      return launchTransparencyCase(state, action.kind);
    case 'respond_transparency_case':
      return respondTransparencyCase(state, action.caseId, action.strategy);
    case 'intendency_agreement':
      return intendencyAgreement(state, action.departmentId);
    case 'transfer_to_intendency':
      return transferToIntendency(state, action.departmentId, action.amountMillions);
    case 'foreign_negotiation':
      return startForeignNegotiation(state, action.partnerId, action.kind);
    case 'mercosur_summit':
      return mercosurSummit(state);
    default:
      return { ok: false, message: 'Acción no reconocida.', nextState: state };
  }
}
