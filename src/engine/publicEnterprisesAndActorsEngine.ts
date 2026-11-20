import { MONTH_NAMES } from '../data/uruguayData';
import {
  DelayedEffectPipelineItem,
  GameState,
  GovernmentAnnouncement,
  MinisterProfile,
  PublicEnterpriseId,
  PublicEnterpriseState,
  SenateVeniaRequest,
  SocialActorId,
  SocialActorState,
} from '../types/game';
import { getPlayerCapabilities } from './capabilitiesEngine';
import { enqueueDelayedEffects, recomputeFiscalSnapshot } from './economyEngine';
import { seededRandom } from './electoralEngine';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function getDateLabel(state: GameState): string {
  return `${MONTH_NAMES[(state.currentMonth - 1 + 12) % 12] ?? 'Marzo'} ${state.currentYear}`;
}

export function adjustEnterpriseTariff(
  state: GameState,
  enterpriseId: PublicEnterpriseId,
  deltaPct: number
): { nextState: GameState; ok: boolean; message: string } {
  const caps = getPlayerCapabilities(state);
  if (!caps.canEditNationalBudgetAndFiscal) {
    return { nextState: state, ok: false, message: caps.lockReasons.nationalBudget };
  }
  if (state.player.politicalCapital < 3) {
    return { nextState: state, ok: false, message: 'Necesitás 3 CP para fijar pautas tarifarias de Entes.' };
  }

  const enterprises = state.publicEnterprises ?? [];
  const target = enterprises.find((e) => e.id === enterpriseId);
  if (!target) {
    return { nextState: state, ok: false, message: 'Empresa pública no encontrada.' };
  }

  const nextTariff = Math.round(clamp(target.tariffIndex + deltaPct, 75, 138));
  const actualDelta = nextTariff - target.tariffIndex;
  if (actualDelta === 0) {
    return { nextState: state, ok: false, message: 'La tarifa alcanzó su límite regulatorio.' };
  }

  const ratio = nextTariff / Math.max(1, target.tariffIndex);
  const nextRev = Number((target.annualRevenueBillionsUYU * ratio).toFixed(1));
  const nextBal = Number((nextRev - target.annualCostBillionsUYU).toFixed(1));

  const nextEnterprises: PublicEnterpriseState[] = enterprises.map((e) =>
    e.id === enterpriseId
      ? {
          ...e,
          tariffIndex: nextTariff,
          annualRevenueBillionsUYU: nextRev,
          operatingBalanceBillionsUYU: nextBal,
        }
      : e
  );

  // Impacto causal en actores sociales y cola de inflación/aprobación
  const isHike = actualDelta > 0;
  const nextActors = (state.socialActors ?? []).map((a) => {
    if (a.id === 'camaras_empresariales' || a.id === 'gremiales_agro') {
      return {
        ...a,
        governmentTrust: Math.round(clamp(a.governmentTrust + (isHike ? -3 : 3), 10, 95)),
        conflictLevel: Math.round(clamp(a.conflictLevel + (isHike ? 4 : -3), 5, 95)),
      };
    }
    if (a.id === 'pit_cnt') {
      return {
        ...a,
        governmentTrust: Math.round(clamp(a.governmentTrust + (isHike ? -2 : 2), 10, 95)),
        conflictLevel: Math.round(clamp(a.conflictLevel + (isHike ? 3 : -2), 5, 95)),
      };
    }
    return a;
  });

  const pipeItem: DelayedEffectPipelineItem = {
    id: `tar_${enterpriseId}_${Date.now()}`,
    sourceType: 'tarifa',
    sourceId: enterpriseId,
    label: `Ajuste tarifario ${target.id.toUpperCase()} (${actualDelta > 0 ? '+' : ''}${actualDelta}%)`,
    horizon: 'inmediato',
    remainingMonths: 1,
    totalMonths: 1,
    inflationDelta: Number((actualDelta * 0.035).toFixed(2)),
    approvalDelta: Number((isHike ? -0.6 : 0.5).toFixed(1)),
  };

  const updated = recomputeFiscalSnapshot({
    ...state,
    publicEnterprises: nextEnterprises,
    socialActors: nextActors,
    effectPipeline: enqueueDelayedEffects(state.effectPipeline, [pipeItem]),
    player: {
      ...state.player,
      politicalCapital: state.player.politicalCapital - 3,
    },
    history: [
      {
        id: `ente_tar_${Date.now()}`,
        dateLabel: getDateLabel(state),
        category: 'economia',
        title: `Tarifa ${target.id.toUpperCase()}: ${nextTariff} pts (${actualDelta > 0 ? '+' : ''}${actualDelta}%)`,
        detail: `Resultado operativo proyectado: ${nextBal >= 0 ? '+' : ''}${nextBal}B UYU.`,
      },
      ...state.history,
    ],
  });

  return {
    ok: true,
    nextState: updated,
    message: `Tarifa de ${target.id.toUpperCase()} ajustada a ${nextTariff} pts (resultado op. ${nextBal >= 0 ? '+' : ''}${nextBal}B UYU).`,
  };
}

export function adjustEnterpriseInvestment(
  state: GameState,
  enterpriseId: PublicEnterpriseId,
  deltaBillions: number
): { nextState: GameState; ok: boolean; message: string } {
  const caps = getPlayerCapabilities(state);
  if (!caps.canDirectMinistriesAndStateAgencies) {
    return { nextState: state, ok: false, message: caps.lockReasons.executiveNational };
  }
  if (state.player.politicalCapital < 3) {
    return { nextState: state, ok: false, message: 'Necesitás 3 CP para modificar el plan de inversiones de un Ente.' };
  }

  const enterprises = state.publicEnterprises ?? [];
  const target = enterprises.find((e) => e.id === enterpriseId);
  if (!target) return { nextState: state, ok: false, message: 'Ente no encontrado.' };

  const nextInv = Number(clamp(target.investmentPlanBillionsUYU + deltaBillions, 1.0, 22.0).toFixed(1));
  const actualDelta = Number((nextInv - target.investmentPlanBillionsUYU).toFixed(1));
  if (actualDelta === 0) {
    return { nextState: state, ok: false, message: 'El plan de inversiones alcanzó su límite.' };
  }

  const nextQuality = Math.round(clamp(target.serviceQualityScore + (actualDelta > 0 ? 2 : -2), 35, 99));
  const nextEnterprises = enterprises.map((e) =>
    e.id === enterpriseId
      ? {
          ...e,
          investmentPlanBillionsUYU: nextInv,
          serviceQualityScore: nextQuality,
          ownDebtBillionsUSD: Number(clamp(e.ownDebtBillionsUSD + actualDelta * 0.015, 0.05, 3.5).toFixed(2)),
        }
      : e
  );

  const pipeItem: DelayedEffectPipelineItem = {
    id: `ente_inv_${enterpriseId}_${Date.now()}`,
    sourceType: 'politica',
    sourceId: enterpriseId,
    label: `Plan de inversiones ${target.id.toUpperCase()} (${actualDelta > 0 ? '+' : ''}${actualDelta}B UYU)`,
    horizon: 'mediano',
    remainingMonths: 5,
    totalMonths: 5,
    gdpDelta: Number((actualDelta * 0.04).toFixed(2)),
    productivityDelta: Number((actualDelta * 0.15).toFixed(2)),
  };

  const updated = recomputeFiscalSnapshot({
    ...state,
    publicEnterprises: nextEnterprises,
    effectPipeline: enqueueDelayedEffects(state.effectPipeline, [pipeItem]),
    player: {
      ...state.player,
      politicalCapital: state.player.politicalCapital - 3,
    },
    history: [
      {
        id: `ente_inv_${Date.now()}`,
        dateLabel: getDateLabel(state),
        category: 'gobierno',
        title: `Inversión en ${target.id.toUpperCase()}: $${nextInv}B UYU`,
        detail: `Calidad de servicio: ${nextQuality}/100. Impacto en infraestructura/productividad programado a 5 meses.`,
      },
      ...state.history,
    ],
  });

  return {
    ok: true,
    nextState: updated,
    message: `Inversión de ${target.id.toUpperCase()} fijada en $${nextInv}B UYU (calidad ${nextQuality}/100).`,
  };
}

export function nominateEnterpriseDirector(
  state: GameState,
  enterpriseId: PublicEnterpriseId,
  nomineeName: string,
  nomineePartyId?: string
): { nextState: GameState; ok: boolean; message: string } {
  const caps = getPlayerCapabilities(state);
  if (!caps.canDirectMinistriesAndStateAgencies) {
    return { nextState: state, ok: false, message: caps.lockReasons.executiveNational };
  }
  if (state.player.politicalCapital < 4) {
    return { nextState: state, ok: false, message: 'Necesitás 4 CP para enviar solicitud de venia al Senado (Art. 187).' };
  }
  const cleanName = nomineeName.trim();
  if (!cleanName) {
    return { nextState: state, ok: false, message: 'Indicá el nombre del/la candidato/a al Directorio.' };
  }

  const target = (state.publicEnterprises ?? []).find((e) => e.id === enterpriseId);
  if (!target) return { nextState: state, ok: false, message: 'Empresa pública no encontrada.' };

  const req: SenateVeniaRequest = {
    id: `venia_${enterpriseId}_${Date.now()}`,
    enterpriseId,
    enterpriseName: target.name,
    nomineeName: cleanName,
    nomineePartyId: nomineePartyId || state.player.partyId,
    daysElapsed: 0,
    status: 'pendiente',
    createdDateLabel: getDateLabel(state),
  };

  const nextEnterprises = (state.publicEnterprises ?? []).map((e) =>
    e.id === enterpriseId ? { ...e, senateVeniaApproved: false } : e
  );

  const msg = `Solicitud de venia Art. 187 enviada al Senado para designar a ${cleanName} en ${target.id.toUpperCase()} (requiere 3/5 dentro de 60 días o mayoría simple después).`;

  return {
    ok: true,
    message: msg,
    nextState: {
      ...state,
      publicEnterprises: nextEnterprises,
      pendingVenias: [req, ...(state.pendingVenias ?? [])],
      player: {
        ...state.player,
        politicalCapital: state.player.politicalCapital - 4,
      },
      history: [
        {
          id: `ven_send_${Date.now()}`,
          dateLabel: getDateLabel(state),
          category: 'parlamento',
          title: `Venia Art. 187 enviada: ${target.id.toUpperCase()}`,
          detail: msg,
        },
        ...state.history,
      ],
    },
  };
}

export function issueArticle197Observation(
  state: GameState,
  enterpriseId: PublicEnterpriseId
): { nextState: GameState; ok: boolean; message: string } {
  const caps = getPlayerCapabilities(state);
  if (!caps.canDirectMinistriesAndStateAgencies) {
    return { nextState: state, ok: false, message: caps.lockReasons.executiveNational };
  }
  if (state.player.politicalCapital < 4) {
    return { nextState: state, ok: false, message: 'Necesitás 4 CP para ejercer contralor Art. 197.' };
  }
  const target = (state.publicEnterprises ?? []).find((e) => e.id === enterpriseId);
  if (!target) return { nextState: state, ok: false, message: 'Ente no encontrado.' };

  const nextEnterprises = (state.publicEnterprises ?? []).map((e) =>
    e.id === enterpriseId
      ? {
          ...e,
          serviceQualityScore: Math.min(98, e.serviceQualityScore + 4),
          annualCostBillionsUYU: Number((e.annualCostBillionsUYU * 0.985).toFixed(1)),
          operatingBalanceBillionsUYU: Number((e.annualRevenueBillionsUYU - e.annualCostBillionsUYU * 0.985).toFixed(1)),
        }
      : e
  );

  const msg = `Observación Art. 197 aplicada al directorio de ${target.id.toUpperCase()}: recorte de ineficiencias (-1.5% costo operativo) y mejora de servicio (+4 pts).`;

  return {
    ok: true,
    message: msg,
    nextState: recomputeFiscalSnapshot({
      ...state,
      publicEnterprises: nextEnterprises,
      player: {
        ...state.player,
        politicalCapital: state.player.politicalCapital - 4,
      },
      history: [
        {
          id: `art197_${Date.now()}`,
          dateLabel: getDateLabel(state),
          category: 'gobierno',
          title: `Contralor Art. 197 sobre ${target.id.toUpperCase()}`,
          detail: msg,
        },
        ...state.history,
      ],
    }),
  };
}

export function negotiateWithSocialActor(
  state: GameState,
  actorId: SocialActorId,
  agreementKind: 'consenso' | 'concesion'
): { nextState: GameState; ok: boolean; message: string } {
  const caps = getPlayerCapabilities(state);
  const canConvene =
    caps.canDirectMinistriesAndStateAgencies ||
    (actorId === 'congreso_intendentes' && caps.canAdministerDepartamentalBudget);

  if (!canConvene) {
    return {
      nextState: state,
      ok: false,
      message: 'Convocar rondas formales tripartitas o acuerdos nacionales requiere ejercer el Poder Ejecutivo (o Intendencia para el Congreso de Intendentes).',
    };
  }

  const cpCost = agreementKind === 'consenso' ? 4 : 5;
  const moneyCost = agreementKind === 'consenso' ? 250000 : 450000;
  if (state.player.politicalCapital < cpCost) {
    return { nextState: state, ok: false, message: `Necesitás ${cpCost} CP para esta instancia de negociación.` };
  }
  if (state.player.campaignFundsUYU < moneyCost) {
    return { nextState: state, ok: false, message: `Fondos insuficientes ($${(moneyCost / 1000).toLocaleString('es-UY')}k UYU).` };
  }

  const dateLabel = getDateLabel(state);
  const actor = (state.socialActors ?? []).find((a) => a.id === actorId);
  if (!actor) return { nextState: state, ok: false, message: 'Actor social no encontrado.' };

  const trustGain = agreementKind === 'concesion' ? 8 : 5;
  const conflictDrop = agreementKind === 'concesion' ? 9 : 5;
  const topicLabel =
    actorId === 'pit_cnt'
      ? agreementKind === 'concesion'
        ? 'Acuerdo salarial puente en Consejos de Salarios'
        : 'Mesa tripartita de empleo y formación'
      : actorId === 'camaras_empresariales'
      ? agreementKind === 'concesion'
        ? 'Pacto de competitividad e incentivos productivos'
        : 'Mesa de diálogo sobre simplificación regulatoria'
      : actorId === 'gremiales_agro'
      ? agreementKind === 'concesion'
        ? 'Mesa de riego, gasoil productivo y caminería rural'
        : 'Ronda de inserción externa y trazabilidad agro'
      : agreementKind === 'concesion'
      ? 'Convenio Fondo de Desarrollo del Interior (Art. 214)'
      : 'Acuerdo operativo SUCIVE y coordinación municipal';

  const nextActors: SocialActorState[] = (state.socialActors ?? []).map((a) =>
    a.id === actorId
      ? {
          ...a,
          governmentTrust: Math.round(clamp(a.governmentTrust + trustGain, 8, 98)),
          conflictLevel: Math.round(clamp(a.conflictLevel - conflictDrop, 4, 96)),
          negotiationHistory: [
            {
              dateLabel,
              topic: topicLabel,
              agreed: true,
              fulfilled: true,
            },
            ...a.negotiationHistory,
          ].slice(0, 12),
        }
      : a
  );

  const nextInd = { ...state.politicalIndicators };
  if (actorId === 'pit_cnt') {
    nextInd.unionConfidence = Math.round(clamp(nextInd.unionConfidence + trustGain, 10, 96));
  } else if (actorId === 'camaras_empresariales' || actorId === 'gremiales_agro') {
    nextInd.businessConfidence = Math.round(clamp(nextInd.businessConfidence + trustGain, 10, 96));
  }
  nextInd.governmentApproval = Number(clamp(nextInd.governmentApproval + 0.8, 12, 92).toFixed(1));

  // Si es concesión en agro/cámaras/PIT-CNT, refleja pequeño costo fiscal o impulso productivo en pipeline
  const pipelineBonus: DelayedEffectPipelineItem[] = [];
  if (actorId === 'gremiales_agro' && agreementKind === 'concesion') {
    pipelineBonus.push({
      id: `act_agro_${Date.now()}`,
      sourceType: 'politica',
      sourceId: 'gremiales_agro',
      label: topicLabel,
      horizon: 'corto',
      remainingMonths: 2,
      totalMonths: 2,
      gdpDelta: 0.14,
      productivityDelta: 0.35,
    });
  } else if (actorId === 'pit_cnt' && agreementKind === 'concesion') {
    pipelineBonus.push({
      id: `act_pit_${Date.now()}`,
      sourceType: 'politica',
      sourceId: 'pit_cnt',
      label: topicLabel,
      horizon: 'inmediato',
      remainingMonths: 1,
      totalMonths: 1,
      inflationDelta: 0.15,
      approvalDelta: 0.7,
    });
  }

  const msg = `${topicLabel} cerrado con ${actor.name}: +${trustGain} confianza y -${conflictDrop} conflictividad.`;

  return {
    ok: true,
    message: msg,
    nextState: {
      ...state,
      socialActors: nextActors,
      politicalIndicators: nextInd,
      effectPipeline: enqueueDelayedEffects(state.effectPipeline, pipelineBonus),
      player: {
        ...state.player,
        politicalCapital: state.player.politicalCapital - cpCost,
        campaignFundsUYU: state.player.campaignFundsUYU - moneyCost,
      },
      history: [
        {
          id: `soc_${actorId}_${Date.now()}`,
          dateLabel,
          category: 'gobierno',
          title: `Acuerdo social: ${topicLabel}`,
          detail: msg,
        },
        ...state.history,
      ],
    },
  };
}

export function emitGovernmentAnnouncement(
  state: GameState,
  kind: GovernmentAnnouncement['kind'],
  title: string,
  summary: string
): { nextState: GameState; ok: boolean; message: string } {
  const caps = getPlayerCapabilities(state);
  if (!caps.canDirectCabinetCouncil) {
    return { nextState: state, ok: false, message: caps.lockReasons.executiveNational };
  }
  if (state.player.politicalCapital < 4) {
    return { nextState: state, ok: false, message: 'Necesitás 4 CP para convocar conferencia oficial en Torre Ejecutiva.' };
  }
  const cleanTitle = title.trim();
  const cleanSummary = summary.trim();
  if (!cleanTitle || !cleanSummary) {
    return { nextState: state, ok: false, message: 'Completá título y mensaje del anuncio oficial.' };
  }

  const dateLabel = getDateLabel(state);
  // Impacto depende del desempeño real (no magia sin respaldo)
  const macroHealth =
    (state.macro.gdpGrowthPct - 1.5) * 0.4 -
    Math.max(0, state.macro.inflationPct - 6.5) * 0.35 -
    Math.max(0, state.macro.unemploymentPct - 8.5) * 0.3;
  const recentSameMonth = (state.governmentAnnouncements ?? []).filter((a) => a.dateLabel === dateLabel).length;
  const diminishing = recentSameMonth > 0 ? 0.35 : 1.0;
  const approvalEffect = Number(clamp((1.1 + macroHealth * 0.5) * diminishing, -0.5, 2.4).toFixed(1));

  const item: GovernmentAnnouncement = {
    id: `ann_${Date.now()}`,
    dateLabel,
    kind,
    title: cleanTitle,
    summary: cleanSummary,
    approvalEffect,
  };

  const nextApproval = Number(clamp(state.politicalIndicators.governmentApproval + approvalEffect, 12, 92).toFixed(1));
  const msg = `Anuncio oficial «${cleanTitle}» emitido desde Torre Ejecutiva (${approvalEffect >= 0 ? '+' : ''}${approvalEffect}% aprobación).`;

  return {
    ok: true,
    message: msg,
    nextState: {
      ...state,
      governmentAnnouncements: [item, ...(state.governmentAnnouncements ?? [])].slice(0, 20),
      politicalIndicators: {
        ...state.politicalIndicators,
        governmentApproval: nextApproval,
      },
      player: {
        ...state.player,
        politicalCapital: state.player.politicalCapital - 4,
        attributes: {
          ...state.player.attributes,
          popularity: Number(clamp(state.player.attributes.popularity + approvalEffect * 0.6, 15, 96).toFixed(1)),
        },
      },
      history: [
        {
          id: `annlog_${Date.now()}`,
          dateLabel,
          category: 'gobierno',
          title: `Cadena / Conferencia: ${cleanTitle}`,
          detail: `${cleanSummary} (Impacto aprobación: ${approvalEffect >= 0 ? '+' : ''}${approvalEffect}%)`,
        },
        ...state.history,
      ],
    },
  };
}

/**
 * Evolución mensual automática del Gabinete (riesgo de renuncias/crisis),
 * 5 Empresas Públicas y 4 Actores Sociales.
 */
export function stepMonthlyCabinetEnterprisesAndActors(
  state: GameState,
  dateLabel: string
): {
  nextCabinet: MinisterProfile[];
  nextPublicEnterprises: PublicEnterpriseState[];
  nextSocialActors: SocialActorState[];
  nextBusinessConfidence: number;
  nextUnionConfidence: number;
  stabilityDelta: number;
  cabinetLogs: GameState['history'];
} {
  const rng = seededRandom(`cab_ent_soc_${state.currentYear}_${state.currentMonth}_${state.id}`);
  const cabinetLogs: GameState['history'] = [];
  let stabilityDelta = 0;

  // 1. Empresas Públicas (costos sensibles a inflación/FX; calidad sensible a plan de inversión)
  const fxFactor = Math.max(0.85, state.macro.exchangeRateUYU / 44.07);
  const demandFactor = 1 + (state.macro.gdpGrowthPct - 2.0) * 0.004;
  const nextPublicEnterprises: PublicEnterpriseState[] = (state.publicEnterprises ?? []).map((ent) => {
    const rev = Number((ent.annualRevenueBillionsUYU * demandFactor).toFixed(1));
    const fxWeight = ent.id === 'ancap' ? 0.35 : ent.id === 'ute' ? 0.15 : 0.08;
    const costDrift = 1 + (state.macro.inflationPct / 1200) * 0.65 + (fxFactor - 1) * fxWeight * 0.05;
    const cost = Number(clamp(ent.annualCostBillionsUYU * costDrift, 8, 160).toFixed(1));
    const bal = Number((rev - cost).toFixed(1));
    const invRatio = ent.investmentPlanBillionsUYU / Math.max(2, rev * 0.1);
    const qualDelta = invRatio >= 1.0 ? 0.25 : -0.35;
    return {
      ...ent,
      annualRevenueBillionsUYU: rev,
      annualCostBillionsUYU: cost,
      operatingBalanceBillionsUYU: bal,
      serviceQualityScore: Math.round(clamp(ent.serviceQualityScore + qualDelta, 38, 98)),
    };
  });

  // 2. Actores Sociales
  const infPressure = Math.max(0, state.macro.inflationPct - 6.0);
  const unempPressure = Math.max(0, state.macro.unemploymentPct - 8.2);
  const deficitPressure = Math.max(0, state.macro.fiscalDeficitPctGdp - 3.6);
  const avgTariff =
    nextPublicEnterprises.reduce((s, e) => s + e.tariffIndex, 0) / Math.max(1, nextPublicEnterprises.length);

  const nextSocialActors: SocialActorState[] = (state.socialActors ?? []).map((actor) => {
    let trustDelta = 0;
    let conflictDelta = 0;

    if (actor.id === 'pit_cnt') {
      trustDelta = state.macro.realWageGrowthPct * 0.25 - infPressure * 0.4 - unempPressure * 0.45;
      conflictDelta = infPressure * 0.5 + unempPressure * 0.55 - state.macro.realWageGrowthPct * 0.3;
    } else if (actor.id === 'camaras_empresariales') {
      trustDelta = (state.macro.gdpGrowthPct - 2.0) * 0.35 - deficitPressure * 0.5 - (avgTariff - 100) * 0.08 - (state.fiscalLevers.incomeTaxRate - 22) * 0.12;
      conflictDelta = deficitPressure * 0.4 + Math.max(0, avgTariff - 103) * 0.15 - (state.macro.gdpGrowthPct - 2.0) * 0.25;
    } else if (actor.id === 'gremiales_agro') {
      const fxHelp = (state.macro.exchangeRateUYU - 43) * 0.15;
      trustDelta = fxHelp + (state.fiscalLevers.tradeOpenness - 55) * 0.04 - (avgTariff - 100) * 0.1;
      conflictDelta = Math.max(0, avgTariff - 102) * 0.18 - fxHelp * 0.6;
    } else {
      trustDelta = (state.macro.gdpGrowthPct - 1.8) * 0.2 - deficitPressure * 0.35;
      conflictDelta = deficitPressure * 0.3;
    }

    return {
      ...actor,
      governmentTrust: Math.round(clamp(actor.governmentTrust + trustDelta * 0.35, 8, 96)),
      conflictLevel: Math.round(clamp(actor.conflictLevel + conflictDelta * 0.35, 4, 96)),
    };
  });

  const pit = nextSocialActors.find((a) => a.id === 'pit_cnt');
  const camaras = nextSocialActors.find((a) => a.id === 'camaras_empresariales');
  const agro = nextSocialActors.find((a) => a.id === 'gremiales_agro');
  const nextBusinessConfidence = Math.round(
    clamp(
      state.politicalIndicators.businessConfidence * 0.78 +
        (((camaras?.governmentTrust ?? 58) * 0.6 + (agro?.governmentTrust ?? 55) * 0.4)) * 0.22,
      12,
      96
    )
  );
  const nextUnionConfidence = Math.round(
    clamp(state.politicalIndicators.unionConfidence * 0.78 + (pit?.governmentTrust ?? 54) * 0.22, 12, 96)
  );

  // 3. Desgaste y riesgo de crisis/renuncia en Gabinete Nacional
  const nextCabinet: MinisterProfile[] = state.cabinet.map((m) => {
    if (m.isVacant) return m;
    const isPartner = m.partyId !== state.nationalPresidentPartyId;
    const coalDrift = isPartner && state.politicalIndicators.coalitionStability < 46 ? -2.2 : 0;
    const popDrift = state.macro.governmentApprovalPct < 36 ? -1.4 : state.macro.governmentApprovalPct > 55 ? 0.6 : -0.2;

    const nextLoyalty = Math.round(clamp(m.loyalty + coalDrift + (rng() - 0.48) * 2.4, 14, 98));
    const nextPop = Math.round(clamp(m.popularity + popDrift + (rng() - 0.48) * 2.2, 15, 96));

    const resignRisk =
      nextLoyalty < 28 ||
      (isPartner && state.politicalIndicators.coalitionStability < 34 && nextLoyalty < 44) ||
      nextPop < 24;

    if (resignRisk && rng() < 0.32) {
      stabilityDelta -= 4;
      cabinetLogs.push({
        id: `cab_resign_${m.ministryCode}_${Date.now()}`,
        dateLabel,
        category: 'gobierno',
        title: `Renuncia ministerial en ${m.ministryCode}: ${m.holderName}`,
        detail: `Por desgaste político y tensión en la coalición (lealtad ${nextLoyalty}/100), ${m.holderName} presentó renuncia indeclinable. La cartera queda vacante.`,
      });
      return {
        ...m,
        holderName: 'Cartera Vacante',
        partyId: 'ind',
        sectorName: 'Sin titular designado',
        management: 38,
        loyalty: 40,
        popularity: 35,
        isVacant: true,
        trajectory: 'Acefalía tras renuncia del titular; requiere nueva designación.',
        strengths: [],
        weaknesses: ['Acefalía ejecutiva frena políticas y ejecución presupuestal del área'],
      };
    }

    return {
      ...m,
      loyalty: nextLoyalty,
      popularity: nextPop,
    };
  });

  return {
    nextCabinet,
    nextPublicEnterprises,
    nextSocialActors,
    nextBusinessConfidence,
    nextUnionConfidence,
    stabilityDelta,
    cabinetLogs,
  };
}
