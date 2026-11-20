import { MONTH_NAMES } from '../data/uruguayData';
import {
  ActivePublicPolicy,
  BillProposal,
  DelayedEffectPipelineItem,
  GameState,
  LegalInstrumentType,
  NationalBudgetCategory,
  PublicPolicyDraft,
} from '../types/game';
import { getPlayerCapabilities } from './capabilitiesEngine';
import { enqueueDelayedEffects } from './economyEngine';

function getDateLabel(state: GameState): string {
  return `${MONTH_NAMES[(state.currentMonth - 1 + 12) % 12] ?? 'Marzo'} ${state.currentYear}`;
}

function mapAreaToBillCategory(area: NationalBudgetCategory): BillProposal['category'] {
  switch (area) {
    case 'desarrollo_social':
    case 'salud':
    case 'educacion':
    case 'vivienda':
    case 'cultura':
      return 'social';
    case 'seguridad':
    case 'defensa':
      return 'seguridad';
    case 'jubilaciones':
      return 'laboral';
    case 'administracion':
    case 'intereses_otros':
      return 'presupuestal';
    case 'relaciones_exteriores':
      return 'institucional';
    default:
      return 'economica';
  }
}

function mapAreaToCommittee(area: NationalBudgetCategory): string {
  switch (area) {
    case 'administracion':
    case 'intereses_otros':
      return 'Comisión de Hacienda y Presupuestos';
    case 'desarrollo_productivo':
    case 'infraestructura':
    case 'transporte':
    case 'ciencia_tecnologia':
    case 'medioambiente':
      return 'Comisión de Industria, Energía, Ambiente y Obras';
    case 'jubilaciones':
      return 'Comisión de Legislación del Trabajo y Seguridad Social';
    case 'salud':
    case 'desarrollo_social':
    case 'vivienda':
      return 'Comisión de Salud Pública, Población y Desarrollo Social';
    case 'educacion':
    case 'cultura':
      return 'Comisión de Educación y Cultura';
    case 'seguridad':
    case 'defensa':
      return 'Comisión de Seguridad, Defensa y Constitución';
    case 'relaciones_exteriores':
      return 'Comisión de Asuntos Internacionales';
    default:
      return 'Comisión de Constitución y Legislación';
  }
}

export function isLegislativeInstrument(instrument?: LegalInstrumentType): boolean {
  return instrument === 'proyecto_ley' || instrument === 'ley_presupuestal';
}

export function validatePolicyEligibility(
  state: GameState,
  draft: PublicPolicyDraft
): { eligible: boolean; reason?: string } {
  const caps = getPlayerCapabilities(state);
  const instrument: LegalInstrumentType = draft.legalInstrument ?? 'decreto_pe';

  if (instrument === 'ley_presupuestal') {
    if (!caps.canEditNationalBudgetAndFiscal) {
      return {
        eligible: false,
        reason: `${caps.lockReasons.nationalBudget} Las leyes presupuestales o tributarias son de iniciativa privativa del Poder Ejecutivo (Arts. 86 y 214).`,
      };
    }
  } else if (instrument === 'proyecto_ley') {
    if (!caps.canIntroduceNationalBills) {
      return {
        eligible: false,
        reason: caps.lockReasons.parliamentActions,
      };
    }
  } else {
    if (!caps.canSignPresidentialDecrees) {
      return {
        eligible: false,
        reason: caps.lockReasons.executiveNational,
      };
    }
  }

  const activeList = state.activePolicies ?? [];
  const duplicate = activeList.find(
    (p) =>
      (p.status === 'en_tramite_parlamentario' || p.status === 'en_implementacion' || p.status === 'vigente') &&
      ((draft.code && p.code === draft.code) || p.title.trim().toLowerCase() === draft.title.trim().toLowerCase())
  );
  if (duplicate) {
    return {
      eligible: false,
      reason: `La política «${draft.title}» ya se encuentra ${
        duplicate.status === 'en_tramite_parlamentario' ? 'en trámite parlamentario' : 'vigente o en ejecución'
      }.`,
    };
  }

  if (state.player.politicalCapital < draft.politicalCapitalCost) {
    return {
      eligible: false,
      reason: `Capital político insuficiente (${draft.politicalCapitalCost} CP requeridos; tenés ${Math.round(
        state.player.politicalCapital
      )} CP).`,
    };
  }

  if (state.player.campaignFundsUYU < draft.moneyCostUYU) {
    return {
      eligible: false,
      reason: `Fondos operativos insuficientes ($${Math.round(draft.moneyCostUYU / 1000).toLocaleString(
        'es-UY'
      )} mil UYU requeridos).`,
    };
  }

  return { eligible: true };
}

export function enactPublicPolicy(
  state: GameState,
  draft: PublicPolicyDraft
): { nextState: GameState; ok: boolean; routedToParliament: boolean; message: string } {
  const check = validatePolicyEligibility(state, draft);
  if (!check.eligible) {
    return {
      nextState: state,
      ok: false,
      routedToParliament: false,
      message: check.reason ?? 'Acción no habilitada para tu cargo o recursos actuales.',
    };
  }

  const dateLabel = getDateLabel(state);
  const instrument: LegalInstrumentType = draft.legalInstrument ?? 'decreto_pe';
  const routedToParliament = isLegislativeInstrument(instrument);
  const policyId = `pol_${(draft.code ?? 'lab').toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now()}`;
  const activePolicies = state.activePolicies ?? [];

  const prevStats = state.progression.careerStats ?? {
    lawsPassed: state.player.legislativeWins,
    policiesEnacted: activePolicies.length,
    electionsWon: 0,
    electionsLost: 0,
    coalitionsFormed: state.electoralAlliances?.length ?? 0,
    partiesMerged: state.partyMergers?.length ?? 0,
    ministersAppointed: 0,
    controlsExecuted: state.opposition.parliamentaryControlsExecuted,
  };

  // Fricción institucional inicial con actores sociales según resistencia declarada
  const resistJoined = (draft.socialResistance ?? []).join(' ').toLowerCase();
  const nextSocialActors = (state.socialActors ?? []).map((actor) => {
    let deltaTrust = 0;
    let deltaConflict = 0;
    if (
      actor.id === 'pit_cnt' &&
      (resistJoined.includes('pit-cnt') || resistJoined.includes('sindicat') || resistJoined.includes('gremios'))
    ) {
      deltaTrust = -3;
      deltaConflict = 4;
    } else if (
      actor.id === 'camaras_empresariales' &&
      (resistJoined.includes('cámaras') || resistJoined.includes('camaras') || resistJoined.includes('grandes') || resistJoined.includes('banca'))
    ) {
      deltaTrust = -3;
      deltaConflict = 3;
    } else if (
      actor.id === 'gremiales_agro' &&
      (resistJoined.includes('agro') || resistJoined.includes('rural') || resistJoined.includes('exportador'))
    ) {
      deltaTrust = -3;
      deltaConflict = 4;
    } else if (
      actor.id === 'congreso_intendentes' &&
      (resistJoined.includes('intendenc') || resistJoined.includes('juntas'))
    ) {
      deltaTrust = -2;
      deltaConflict = 3;
    }
    if (deltaTrust === 0 && deltaConflict === 0) return actor;
    return {
      ...actor,
      governmentTrust: Math.max(8, Math.min(96, actor.governmentTrust + deltaTrust)),
      conflictLevel: Math.max(5, Math.min(96, actor.conflictLevel + deltaConflict)),
    };
  });

  if (routedToParliament) {
    const billId = `bill_${policyId}`;
    const isBudgetLaw = instrument === 'ley_presupuestal';
    const est = draft.estimatedEffects;
    const del = draft.delayedEffects;

    const newBill: BillProposal = {
      id: billId,
      title: `${draft.code ? `[${draft.code}] ` : ''}${draft.title}`,
      category: mapAreaToBillCategory(draft.ministryArea),
      summary: `${draft.summary} Instrumento: ${
        isBudgetLaw ? 'Ley Presupuestal / Rendición (Arts. 214–217)' : 'Proyecto de Ley ordinaria (Art. 133)'
      }. Financiamiento: ${draft.financingSource}.`,
      sponsorPartyId: state.player.partyId,
      origin: state.nationalPresidentPartyId === state.player.partyId ? 'oficialismo' : 'propio',
      playerBenchPosition: 'a_favor',
      effectsDescription: `PIB est. ${(del.gdpDelta ?? est.gdpDelta ?? 0) >= 0 ? '+' : ''}${(
        del.gdpDelta ??
        est.gdpDelta ??
        0
      ).toFixed(2)}% · Costo fiscal ${(est.fiscalCostPctGdp ?? 0).toFixed(2)}% PIB · Retorno ${(
        est.expectedRevenuePctGdp ?? 0
      ).toFixed(2)}% PIB.`,
      politicalCapitalCost: 0,
      chamber: 'ambas',
      originChamber: 'diputados',
      legislativeStage: 'camara_origen_comision',
      deadlineDaysRemaining: isBudgetLaw ? 45 : undefined,
      isConstitutionalBudgetBill: isBudgetLaw,
      committeeName: mapAreaToCommittee(draft.ministryArea),
      executiveVetoKind: 'ninguno',
      linkedPolicyId: policyId,
      status: 'en_negociacion',
      concessionsApplied: [],
      negotiatedPartySupport: {
        [state.player.partyId]: 16,
      },
      payload: {
        gdpDelta: Number(((est.gdpDelta ?? 0) + (del.gdpDelta ?? 0)).toFixed(2)),
        inflationDelta: Number(((est.inflationDelta ?? 0) + (del.inflationDelta ?? 0)).toFixed(2)),
        unemploymentDelta: Number(((est.unemploymentDelta ?? 0) + (del.unemploymentDelta ?? 0)).toFixed(2)),
        povertyDelta: Number(((est.povertyDelta ?? 0) + (del.povertyDelta ?? 0)).toFixed(2)),
        deficitDelta: Number(((est.fiscalCostPctGdp ?? 0) - (est.expectedRevenuePctGdp ?? 0)).toFixed(2)),
        revenueDelta: est.expectedRevenuePctGdp ?? 0,
        productivityDelta: del.productionDelta ?? est.productionDelta ?? 0,
        approvalDelta: est.approvalDelta ?? 1.0,
      },
    };

    const pendingPolicy: ActivePublicPolicy = {
      ...draft,
      id: policyId,
      enactedDateLabel: dateLabel,
      activeMonths: 0,
      status: 'en_tramite_parlamentario',
      linkedBillId: billId,
      sponsorPartyId: state.player.partyId,
      synergies: [],
      conflicts: [],
      observedEffects: {
        gdpImpactAcc: 0,
        inflationImpactAcc: 0,
        employmentImpactAcc: 0,
        povertyImpactAcc: 0,
        fiscalNetAcc: 0,
        approvalImpactAcc: 0,
      },
    };

    const msg = `Proyecto de ley «${draft.title}» remitido al Parlamento (Comisión de Diputados). Entrará en vigencia al sancionarse y promulgarse.`;
    return {
      ok: true,
      routedToParliament: true,
      message: msg,
      nextState: {
        ...state,
        bills: [newBill, ...state.bills],
        activePolicies: [pendingPolicy, ...activePolicies],
        socialActors: nextSocialActors,
        player: {
          ...state.player,
          politicalCapital: state.player.politicalCapital - draft.politicalCapitalCost,
          campaignFundsUYU: state.player.campaignFundsUYU - draft.moneyCostUYU,
        },
        history: [
          {
            id: `pol_bill_${Date.now()}`,
            dateLabel,
            category: 'parlamento',
            title: `Iniciativa legislativa enviada: ${draft.title}`,
            detail: `${msg} Responsable: ${draft.responsibleBody ?? draft.ministryArea}.`,
          },
          ...state.history,
        ],
      },
    };
  }

  // Instrumento ejecutivo, convenio o directiva de ente: activación inmediata + cola de rezagos en 4 horizontes
  const enactedPolicy: ActivePublicPolicy = {
    ...draft,
    id: policyId,
    enactedDateLabel: dateLabel,
    activeMonths: 0,
    status: 'en_implementacion',
    sponsorPartyId: state.player.partyId,
    synergies: [],
    conflicts: [],
    observedEffects: {
      gdpImpactAcc: 0,
      inflationImpactAcc: 0,
      employmentImpactAcc: 0,
      povertyImpactAcc: 0,
      fiscalNetAcc: 0,
      approvalImpactAcc: 0,
    },
  };

  const est = draft.estimatedEffects;
  const del = draft.delayedEffects;
  const totalMonths = Math.max(6, draft.timelineMonths || 12);
  const shortMonths = Math.min(4, Math.max(2, Math.round(totalMonths * 0.2)));
  const medMonths = Math.min(18, Math.max(5, Math.round(totalMonths * 0.55)));
  const longMonths = Math.min(36, Math.max(medMonths + 3, Math.round(totalMonths * 0.85)));

  const pipelineItems: DelayedEffectPipelineItem[] = [
    {
      id: `pol_imm_${policyId}`,
      sourceType: 'politica',
      sourceId: policyId,
      label: `${draft.title} (Impacto inicial)`,
      horizon: 'inmediato',
      remainingMonths: 1,
      totalMonths: 1,
      gdpDelta: est.gdpDelta ? Number((est.gdpDelta * 0.4).toFixed(2)) : undefined,
      inflationDelta: est.inflationDelta ? Number((est.inflationDelta * 0.45).toFixed(2)) : undefined,
      unemploymentDelta: est.unemploymentDelta ? Number((est.unemploymentDelta * 0.4).toFixed(2)) : undefined,
      povertyDelta: est.povertyDelta ? Number((est.povertyDelta * 0.35).toFixed(2)) : undefined,
      approvalDelta: est.approvalDelta ? Number((est.approvalDelta * 0.45).toFixed(1)) : undefined,
    },
    {
      id: `pol_sh_${policyId}`,
      sourceType: 'politica',
      sourceId: policyId,
      label: `${draft.title} (Despliegue operativo)`,
      horizon: 'corto',
      remainingMonths: shortMonths,
      totalMonths: shortMonths,
      gdpDelta: est.gdpDelta ? Number((est.gdpDelta * 0.55).toFixed(2)) : undefined,
      unemploymentDelta: est.unemploymentDelta ? Number((est.unemploymentDelta * 0.55).toFixed(2)) : undefined,
      povertyDelta: est.povertyDelta ? Number((est.povertyDelta * 0.5).toFixed(2)) : undefined,
      giniDelta: est.giniDelta ? Number((est.giniDelta * 0.45).toFixed(3)) : undefined,
    },
    {
      id: `pol_med_${policyId}`,
      sourceType: 'politica',
      sourceId: policyId,
      label: `${draft.title} (Maduración sectorial)`,
      horizon: 'mediano',
      remainingMonths: medMonths,
      totalMonths: medMonths,
      gdpDelta: del.gdpDelta ? Number((del.gdpDelta * 0.65).toFixed(2)) : undefined,
      inflationDelta: del.inflationDelta ? Number((del.inflationDelta * 0.6).toFixed(2)) : undefined,
      unemploymentDelta: del.unemploymentDelta ? Number((del.unemploymentDelta * 0.65).toFixed(2)) : undefined,
      povertyDelta: del.povertyDelta ? Number((del.povertyDelta * 0.65).toFixed(2)) : undefined,
      productivityDelta: del.productionDelta ? Number((del.productionDelta * 0.45).toFixed(2)) : undefined,
    },
    {
      id: `pol_lng_${policyId}`,
      sourceType: 'politica',
      sourceId: policyId,
      label: `${draft.title} (Efecto estructural acumulado)`,
      horizon: 'largo',
      remainingMonths: longMonths,
      totalMonths: longMonths,
      gdpDelta: del.gdpDelta ? Number((del.gdpDelta * 0.35).toFixed(2)) : undefined,
      povertyDelta: del.povertyDelta ? Number((del.povertyDelta * 0.35).toFixed(2)) : undefined,
      giniDelta: del.giniDelta ? Number((del.giniDelta * 0.55).toFixed(3)) : undefined,
      productivityDelta: del.productionDelta ? Number((del.productionDelta * 0.55).toFixed(2)) : undefined,
      approvalDelta: del.approvalDelta,
    },
  ];

  const immediateApprovalBump = Math.max(-2.5, Math.min(2.8, (est.approvalDelta ?? 0) * 0.3));
  const msg = `Política «${draft.title}» promulgada vía ${draft.responsibleBody ?? draft.ministryArea} y activa en el motor económico.`;

  return {
    ok: true,
    routedToParliament: false,
    message: msg,
    nextState: {
      ...state,
      activePolicies: [enactedPolicy, ...activePolicies],
      effectPipeline: enqueueDelayedEffects(state.effectPipeline, pipelineItems),
      socialActors: nextSocialActors,
      politicalIndicators: {
        ...state.politicalIndicators,
        governmentApproval: Number(
          Math.max(8, Math.min(94, state.politicalIndicators.governmentApproval + immediateApprovalBump)).toFixed(1)
        ),
      },
      player: {
        ...state.player,
        politicalCapital: state.player.politicalCapital - draft.politicalCapitalCost,
        campaignFundsUYU: state.player.campaignFundsUYU - draft.moneyCostUYU,
      },
      progression: {
        ...state.progression,
        careerStats: {
          ...prevStats,
          policiesEnacted: prevStats.policiesEnacted + 1,
        },
      },
      history: [
        {
          id: `pol_exec_${Date.now()}`,
          dateLabel,
          category: 'gobierno',
          title: `Política promulgada: ${draft.title}`,
          detail: `Financiamiento: ${draft.financingSource} · Plazo: ${draft.timelineMonths} meses · Costo fiscal est.: ${(
            draft.estimatedEffects.fiscalCostPctGdp ?? 0
          ).toFixed(2)}% PIB.`,
        },
        ...state.history,
      ],
    },
  };
}

export function repealPublicPolicy(
  state: GameState,
  policyId: string
): { nextState: GameState; ok: boolean; message: string } {
  const caps = getPlayerCapabilities(state);
  if (!caps.canEditNationalBudgetAndFiscal) {
    return {
      nextState: state,
      ok: false,
      message: caps.lockReasons.nationalBudget,
    };
  }
  const target = (state.activePolicies ?? []).find((p) => p.id === policyId);
  if (!target) {
    return { nextState: state, ok: false, message: 'No se encontró la política indicada.' };
  }

  const nextPolicies = (state.activePolicies ?? []).map((p) =>
    p.id === policyId ? { ...p, status: 'derogada' as const } : p
  );
  const nextPipeline = (state.effectPipeline ?? []).filter((item) => item.sourceId !== policyId || item.applied);

  return {
    ok: true,
    message: `Política «${target.title}» derogada. Se cancelaron sus efectos futuros pendientes.`,
    nextState: {
      ...state,
      activePolicies: nextPolicies,
      effectPipeline: nextPipeline,
      history: [
        {
          id: `pol_rep_${Date.now()}`,
          dateLabel: getDateLabel(state),
          category: 'gobierno',
          title: `Derogación de política: ${target.title}`,
          detail: 'Se suspendió su ejecución y se limpiaron los rezagos aún no devengados.',
        },
        ...state.history,
      ],
    },
  };
}
