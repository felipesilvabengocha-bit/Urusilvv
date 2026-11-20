import { ECONOMIC_CALIBRATION } from '../data/economicCalibration';
import {
  DEFAULT_FINANCING_MIX,
  NATIONAL_BUDGET_META,
  createInitialDebtProfile,
  createInitialRevenueItems,
} from '../data/uruguayData';
import {
  ActivePublicPolicy,
  BudgetAllocation,
  DebtProfile,
  DeficitFinancingMix,
  DelayedEffectPipelineItem,
  DepartamentalBudgetItem,
  FiscalLedgerSummary,
  GameState,
  IndicatorChangeReason,
  MacroSnapshot,
  NationalBudgetCategory,
  RevenueLineItem,
} from '../types/game';

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function round1(val: number): number {
  return Number(val.toFixed(1));
}

function round2(val: number): number {
  return Number(val.toFixed(2));
}

/**
 * Presupuesto Nacional Libre (Sin tope artificial del 100% ni auto-rebalanceo).
 * Modificar un área NO resta recursos de ninguna otra cartera.
 */
export function updateFreeBudgetAllocation(
  budget: BudgetAllocation[],
  changedCategory: NationalBudgetCategory,
  newAnnualBillionsUYU: number,
  nominalGdpBillionsUYU: number
): BudgetAllocation[] {
  const safeNominal = Math.max(100, nominalGdpBillionsUYU);
  const updatedBase = budget.map((item) => {
    if (item.category !== changedCategory) return item;
    const clampedAnnual = round1(clamp(newAnnualBillionsUYU, 0.5, safeNominal * 0.22));
    const committedRatio = item.category === 'jubilaciones' || item.category === 'intereses_otros' ? 0.99 : 0.94;
    const committed = round1(clampedAnnual * committedRatio);
    const execRatio = clamp(item.executionEfficiency / 100 + 0.19, 0.55, 1.0);
    const executed = round1(committed * execRatio);
    return {
      ...item,
      annualBillionsUYU: clampedAnnual,
      committedBillionsUYU: committed,
      executedBillionsUYU: executed,
      pctOfGdp: round2((clampedAnnual / safeNominal) * 100),
      spendingNature: item.spendingNature ?? NATIONAL_BUDGET_META[item.category].spendingNature,
    };
  });

  const newTotal = Math.max(1, updatedBase.reduce((s, b) => s + b.annualBillionsUYU, 0));
  return updatedBase.map((item) => ({
    ...item,
    sharePct: round1((item.annualBillionsUYU / newTotal) * 100),
    pctOfGdp: round2((item.annualBillionsUYU / safeNominal) * 100),
  }));
}

export function rebalanceDepartamentalBudget(
  budget: DepartamentalBudgetItem[],
  changedCategory: DepartamentalBudgetItem['category'],
  newSharePct: number,
  totalAnnualMillionsUYU: number
): DepartamentalBudgetItem[] {
  const clamped = clamp(Math.round(newSharePct), 2, 45);
  const others = budget.filter((b) => b.category !== changedCategory);
  const targetRemaining = 100 - clamped;
  const currentOthersSum = others.reduce((s, b) => s + b.sharePct, 0);

  let runningSum = clamped;
  const updated = budget.map((item, idx) => {
    let share = item.sharePct;
    if (item.category === changedCategory) {
      share = clamped;
    } else if (idx === budget.length - 1 && budget[budget.length - 1].category !== changedCategory) {
      share = Math.max(2, 100 - runningSum);
    } else {
      share = Math.max(2, Math.round((item.sharePct / Math.max(1, currentOthersSum)) * targetRemaining));
      runningSum += share;
    }
    return {
      ...item,
      sharePct: share,
      annualMillionsUYU: Math.round((share / 100) * totalAnnualMillionsUYU),
    };
  });

  const sum = updated.reduce((s, b) => s + b.sharePct, 0);
  if (sum !== 100) {
    const adjTarget = updated.find((b) => b.category !== changedCategory);
    if (adjTarget) {
      adjTarget.sharePct = Math.max(2, adjTarget.sharePct + (100 - sum));
      adjTarget.annualMillionsUYU = Math.round((adjTarget.sharePct / 100) * totalAnnualMillionsUYU);
    }
  }
  return updated;
}

export function updateDeficitFinancingMix(
  mix: DeficitFinancingMix,
  changedKey: keyof DeficitFinancingMix,
  newValue: number
): DeficitFinancingMix {
  const keys: Array<keyof DeficitFinancingMix> = [
    'internalDebtUiUyuPct',
    'externalDebtMultilateralPct',
    'treasuryAssetsDrawPct',
    'enterpriseDividendsPct',
  ];
  const clamped = clamp(Math.round(newValue), 0, changedKey === 'treasuryAssetsDrawPct' ? 40 : changedKey === 'enterpriseDividendsPct' ? 25 : 95);
  const others = keys.filter((k) => k !== changedKey);
  const remaining = 100 - clamped;
  const othersSum = others.reduce((s, k) => s + mix[k], 0);

  const next = { ...mix, [changedKey]: clamped };
  let acc = clamped;
  others.forEach((k, idx) => {
    if (idx === others.length - 1) {
      next[k] = Math.max(0, 100 - acc);
    } else {
      const part =
        othersSum > 0
          ? Math.round((mix[k] / othersSum) * remaining)
          : Math.round(remaining / others.length);
      next[k] = Math.max(0, part);
      acc += next[k];
    }
  });
  return next;
}

export function enqueueDelayedEffects(
  pipeline: DelayedEffectPipelineItem[] | undefined,
  newItems: DelayedEffectPipelineItem[]
): DelayedEffectPipelineItem[] {
  const current = Array.isArray(pipeline) ? pipeline : [];
  return [...current, ...newItems];
}

function computeRevenueLinesFromState(state: GameState, macro: MacroSnapshot): RevenueLineItem[] {
  const cal = ECONOMIC_CALIBRATION.revenue;
  const levers = state.fiscalLevers;
  const nominalGdpUYU = Math.max(100, macro.gdpBillionsUSD * macro.exchangeRateUYU);
  const activityMult = 1 + (macro.gdpGrowthPct - 2.2) * 0.014;
  const lawRevBoost = state.enactedLawModifiers?.revenueTargetDelta ?? 0;

  // Dividendos reales de empresas públicas (solo si tienen superávit neto tras plan mínimo de inversión)
  const enterprises = state.publicEnterprises ?? [];
  const realEnterpriseSurplusUYU = enterprises.reduce((sum, ent) => {
    const distributable = Math.max(0, ent.operatingBalanceBillionsUYU - ent.investmentPlanBillionsUYU * 0.55);
    return sum + distributable * 0.35;
  }, 0);
  const enterpriseRevPct = clamp((realEnterpriseSurplusUYU / nominalGdpUYU) * 100, 0, 1.8);

  const ivaPct = clamp(
    cal.vatBasePctGdp * (levers.vatRate / 22) * (1 + (macro.consumptionGrowthPct - 2.0) * 0.015),
    4.5,
    13.5
  );
  const irpfPct = clamp(
    cal.irpfBasePctGdp * (levers.incomeTaxRate / 22) * (1 + (macro.realWageGrowthPct - 1.5) * 0.015),
    2.0,
    7.5
  );
  const iraePct = clamp(
    cal.iraeBasePctGdp * (0.65 + (levers.incomeTaxRate / 22) * 0.35) * activityMult -
      (levers.productiveIncentives - 50) * 0.008,
    1.2,
    6.0
  );
  const patPct = clamp(cal.patrimonioBasePctGdp * (0.85 + (levers.incomeTaxRate - 22) * 0.015), 0.5, 2.5);
  const otrosTribPct = clamp(
    cal.otrosTributariosBasePctGdp * (1 + (55 - levers.tradeOpenness) * 0.005) * activityMult + lawRevBoost * 0.4,
    1.2,
    4.8
  );
  const bpsPct = clamp(
    cal.bpsBasePctGdp * (1 + ((macro.employmentRatePct ?? 58.9) - 58.9) * 0.012 + (macro.realWageGrowthPct - 1.5) * 0.008),
    3.5,
    9.5
  );
  const otrosNoTribPct = clamp(cal.otrosIngresosBasePctGdp + lawRevBoost * 0.2, 0.4, 2.5);

  const prevItems = state.revenueItems ?? createInitialRevenueItems(macro);
  const mapPct: Record<RevenueLineItem['id'], { pct: number; rate: number }> = {
    iva: { pct: ivaPct, rate: levers.vatRate },
    irpf: { pct: irpfPct, rate: round1(16.5 + (levers.incomeTaxRate - 22) * 0.65) },
    irae: { pct: iraePct, rate: round1(25 - (levers.productiveIncentives - 50) * 0.08) },
    patrimonio: { pct: patPct, rate: 1.5 },
    otros_tributarios: { pct: otrosTribPct, rate: round1(8.2 + (55 - levers.tradeOpenness) * 0.08) },
    empresas_publicas: { pct: enterpriseRevPct, rate: round1((enterpriseRevPct / Math.max(0.2, 1.0)) * 1) },
    tasas_contribuciones: { pct: bpsPct, rate: 22.5 },
    otros_ingresos: { pct: otrosNoTribPct, rate: 1.2 },
  };

  return prevItems.map((item) => {
    const target = mapPct[item.id] ?? { pct: item.pctOfGdp, rate: item.effectiveRatePct };
    const collected = round1((target.pct / 100) * nominalGdpUYU);
    return {
      ...item,
      projectedBillionsUYU: item.projectedBillionsUYU || collected,
      collectedBillionsUYU: collected,
      pctOfGdp: round2(target.pct),
      effectiveRatePct: target.rate,
    };
  });
}

function buildFiscalLedger(
  macro: MacroSnapshot,
  budget: BudgetAllocation[],
  revenues: RevenueLineItem[],
  debtProfile: DebtProfile,
  mix: DeficitFinancingMix,
  extraPolicyNetCostPct = 0
): FiscalLedgerSummary {
  const nominalGdpUYU = Math.max(100, macro.gdpBillionsUSD * macro.exchangeRateUYU);
  const approvedTotalUYU = budget.reduce((s, b) => s + (b.approvedBillionsUYU ?? b.annualBillionsUYU), 0);
  const currentTotalUYU = budget.reduce((s, b) => s + b.annualBillionsUYU, 0);
  const committedTotalUYU = budget.reduce((s, b) => s + (b.committedBillionsUYU ?? b.annualBillionsUYU * 0.95), 0);
  const executedTotalUYU = budget.reduce((s, b) => s + (b.executedBillionsUYU ?? b.annualBillionsUYU * 0.91), 0);

  const interestItem = budget.find((b) => b.category === 'intereses_otros');
  const debtInterestPctGdp = round2(
    ((interestItem?.executedBillionsUYU ?? interestItem?.annualBillionsUYU ?? nominalGdpUYU * 0.025) / nominalGdpUYU) * 100
  );

  const projectedRevenuePctGdp = round2((revenues.reduce((s, r) => s + r.projectedBillionsUYU, 0) / nominalGdpUYU) * 100);
  const collectedRevenuePctGdp = round2((revenues.reduce((s, r) => s + r.collectedBillionsUYU, 0) / nominalGdpUYU) * 100);
  const executedSpendingPctGdp = round2((executedTotalUYU / nominalGdpUYU) * 100 + Math.max(0, extraPolicyNetCostPct));
  const primarySpendingPct = Math.max(0, executedSpendingPctGdp - debtInterestPctGdp);
  const primaryBalancePctGdp = round2(collectedRevenuePctGdp - primarySpendingPct);
  const globalBalancePctGdp = round2(primaryBalancePctGdp - debtInterestPctGdp);

  const taxBurdenPctGdp = round2(
    revenues
      .filter((r) => r.id !== 'empresas_publicas' && r.id !== 'otros_ingresos')
      .reduce((s, r) => s + r.pctOfGdp, 0)
  );

  const avgFinancingCostPct = round2(
    debtProfile.weightedAvgRatePct * ((mix.internalDebtUiUyuPct + mix.externalDebtMultilateralPct) / 100) +
      2.1 * (mix.treasuryAssetsDrawPct / 100) +
      1.2 * (mix.enterpriseDividendsPct / 100)
  );

  const sustainabilityIndex = Math.round(
    clamp(
      85 -
        Math.max(0, -globalBalancePctGdp - 2.0) * 6.5 -
        Math.max(0, macro.grossDebtPctGdp - 60) * 0.6 -
        macro.countryRiskBps / 24,
      12,
      98
    )
  );

  return {
    projectedRevenuePctGdp,
    collectedRevenuePctGdp,
    approvedSpendingPctGdp: round2((approvedTotalUYU / nominalGdpUYU) * 100),
    currentSpendingPctGdp: round2((currentTotalUYU / nominalGdpUYU) * 100),
    committedSpendingPctGdp: round2((committedTotalUYU / nominalGdpUYU) * 100),
    executedSpendingPctGdp,
    primaryBalancePctGdp,
    debtInterestPctGdp,
    globalBalancePctGdp,
    taxBurdenPctGdp,
    avgFinancingCostPct,
    sustainabilityIndex,
  };
}

/**
 * Recalcula de inmediato cuentas fiscales, ingresos y déficit proyectado cuando
 * el jugador modifica el presupuesto libre, las alícuotas o el mix de financiamiento en la UI.
 */
export function recomputeFiscalSnapshot(state: GameState): GameState {
  const m = state.macro;
  const nominalGdpUYU = Math.max(100, m.gdpBillionsUSD * m.exchangeRateUYU);
  const debtProfile = state.debtProfile ?? createInitialDebtProfile(m);
  const mix = state.deficitFinancingMix ?? { ...DEFAULT_FINANCING_MIX };

  const budgetTotal = Math.max(1, state.nationalBudget.reduce((s, b) => s + b.annualBillionsUYU, 0));
  const nextBudget = state.nationalBudget.map((item) => {
    const annual = round1(item.annualBillionsUYU);
    const committed = item.committedBillionsUYU ?? round1(annual * 0.95);
    const executed = item.executedBillionsUYU ?? round1(committed * clamp(item.executionEfficiency / 100 + 0.19, 0.55, 1));
    return {
      ...item,
      sharePct: round1((annual / budgetTotal) * 100),
      committedBillionsUYU: committed,
      executedBillionsUYU: executed,
      pctOfGdp: round2((annual / nominalGdpUYU) * 100),
    };
  });

  const revenues = computeRevenueLinesFromState(state, m);
  const ledger = buildFiscalLedger(m, nextBudget, revenues, debtProfile, mix);
  const deficitPct = round2(-ledger.globalBalancePctGdp);

  return {
    ...state,
    nationalBudget: nextBudget,
    revenueItems: revenues,
    debtProfile,
    deficitFinancingMix: mix,
    fiscalLedger: ledger,
    macro: {
      ...m,
      revenuePctGdp: ledger.collectedRevenuePctGdp,
      spendingPctGdp: ledger.executedSpendingPctGdp,
      debtInterestPctGdp: ledger.debtInterestPctGdp,
      fiscalDeficitPctGdp: deficitPct,
    },
  };
}

function evaluatePoliciesMonthlyContribution(
  state: GameState,
  vacantMinistryCodes: Set<string>
): {
  gdpImpulse: number;
  inflationImpulse: number;
  unemploymentImpulse: number;
  povertyImpulse: number;
  indigenceImpulse: number;
  giniImpulse: number;
  publicInvImpulse: number;
  privateInvImpulse: number;
  productionImpulse: number;
  fiscalCostPctGdp: number;
  fiscalRevenuePctGdp: number;
  approvalDelta: number;
  nextActivePolicies: ActivePublicPolicy[];
  activeNotes: string[];
} {
  const policies = state.activePolicies ?? [];
  let gdpImpulse = 0;
  let inflationImpulse = 0;
  let unemploymentImpulse = 0;
  let povertyImpulse = 0;
  let indigenceImpulse = 0;
  let giniImpulse = 0;
  let publicInvImpulse = 0;
  let privateInvImpulse = 0;
  let productionImpulse = 0;
  let fiscalCostPctGdp = 0;
  let fiscalRevenuePctGdp = 0;
  let approvalDelta = 0;
  const activeNotes: string[] = [];

  const running = policies.filter((p) => p.status === 'en_implementacion' || p.status === 'vigente');
  const tagCounts: Record<string, number> = {};
  for (const p of running) {
    for (const tag of p.synergyTags ?? []) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    }
  }

  const highInflationDrag = state.macro.inflationPct > 7.5 ? 0.78 : 1.0;
  const fiscalStress = state.macro.fiscalDeficitPctGdp > 4.5 ? 1.2 : 1.0;

  const nextActivePolicies = policies.map((pol) => {
    if (
      pol.status === 'finalizada' ||
      pol.status === 'derogada' ||
      pol.status === 'en_tramite_parlamentario' ||
      pol.status === 'bloqueada'
    ) {
      return pol;
    }

    const nextMonths = pol.activeMonths + 1;
    const isDelayedPhase = nextMonths >= Math.max(3, Math.floor(pol.timelineMonths * 0.45));
    const isFinished = nextMonths >= pol.timelineMonths;

    const hasSynergy = (pol.synergyTags ?? []).some((t) => (tagCounts[t] ?? 0) >= 2);
    const synergyMult = hasSynergy ? 1.15 : 1.0;

    const linkedMin = state.cabinet.find((c) => c.specialization === pol.ministryArea);
    const isLinkedVacant = linkedMin ? Boolean(linkedMin.isVacant) || vacantMinistryCodes.has(linkedMin.ministryCode) : false;
    const execQualityMult = isLinkedVacant
      ? 0.45
      : linkedMin
      ? clamp(0.75 + (linkedMin.management - 60) * 0.008, 0.6, 1.2)
      : 0.95;

    const eff = isDelayedPhase ? pol.delayedEffects : pol.estimatedEffects;
    const scale = (1 / 12) * synergyMult * execQualityMult;

    const gdpM = (eff.gdpDelta ?? 0) * scale * highInflationDrag;
    const infM = (eff.inflationDelta ?? 0) * scale * (state.macro.fiscalDeficitPctGdp > 4 ? 1.2 : 1.0);
    const unempM = (eff.unemploymentDelta ?? 0) * scale;
    const povM = (eff.povertyDelta ?? 0) * scale;
    const indM = (eff.indigenceDelta ?? (eff.povertyDelta ?? 0) * 0.14) * scale;
    const giniM = (eff.giniDelta ?? 0) * scale;
    const pubInvM = (eff.publicInvestmentDelta ?? 0) * scale;
    const privInvM = (eff.privateInvestmentDelta ?? 0) * scale;
    const prodM = (eff.productionDelta ?? 0) * scale;
    const fCost = (pol.estimatedEffects.fiscalCostPctGdp ?? 0) * fiscalStress;
    const fRev = (eff.expectedRevenuePctGdp ?? pol.estimatedEffects.expectedRevenuePctGdp ?? 0) * execQualityMult;
    const appM = ((eff.approvalDelta ?? 0) / Math.max(4, pol.timelineMonths / 2)) * (isLinkedVacant ? 0.5 : 1);

    gdpImpulse += gdpM;
    inflationImpulse += infM;
    unemploymentImpulse += unempM;
    povertyImpulse += povM;
    indigenceImpulse += indM;
    giniImpulse += giniM;
    publicInvImpulse += pubInvM;
    privateInvImpulse += privInvM;
    productionImpulse += prodM;
    fiscalCostPctGdp += fCost;
    fiscalRevenuePctGdp += fRev;
    approvalDelta += appM;

    if (isLinkedVacant) {
      activeNotes.push(`«${pol.title}» pierde eficacia por ministerio vacante.`);
    }

    const nextStatus: ActivePublicPolicy['status'] = isFinished
      ? 'finalizada'
      : nextMonths >= 2
      ? 'vigente'
      : 'en_implementacion';

    return {
      ...pol,
      activeMonths: nextMonths,
      status: nextStatus,
      synergies: hasSynergy ? Array.from(new Set([...pol.synergies, 'Sinergia intersectorial (+15% eficacia)'])) : pol.synergies,
      conflicts: isLinkedVacant
        ? Array.from(new Set([...pol.conflicts, 'Ejecución frenada por cartera vacante']))
        : pol.conflicts,
      observedEffects: {
        gdpImpactAcc: Number((pol.observedEffects.gdpImpactAcc + gdpM * 12).toFixed(3)),
        inflationImpactAcc: Number((pol.observedEffects.inflationImpactAcc + infM * 12).toFixed(3)),
        employmentImpactAcc: Number((pol.observedEffects.employmentImpactAcc - unempM * 12).toFixed(3)),
        povertyImpactAcc: Number((pol.observedEffects.povertyImpactAcc + povM * 12).toFixed(3)),
        fiscalNetAcc: Number((pol.observedEffects.fiscalNetAcc + (fRev - fCost) / 12).toFixed(3)),
        approvalImpactAcc: Number((pol.observedEffects.approvalImpactAcc + appM).toFixed(2)),
      },
    };
  });

  return {
    gdpImpulse,
    inflationImpulse,
    unemploymentImpulse,
    povertyImpulse,
    indigenceImpulse,
    giniImpulse,
    publicInvImpulse,
    privateInvImpulse,
    productionImpulse,
    fiscalCostPctGdp,
    fiscalRevenuePctGdp,
    approvalDelta,
    nextActivePolicies,
    activeNotes,
  };
}

/**
 * Proyección fiscal multianual (3 a 5 años) basada en cuentas vigentes y perfil de deuda.
 */
export function projectMultiYearFiscalOutlook(state: GameState, years = 3): Array<{
  year: number;
  revenuePctGdp: number;
  spendingPctGdp: number;
  interestPctGdp: number;
  deficitPctGdp: number;
  grossDebtPctGdp: number;
}> {
  const m = state.macro;
  const ledger = state.fiscalLedger;
  const activePolicies = (state.activePolicies ?? []).filter(
    (p) => p.status === 'en_implementacion' || p.status === 'vigente'
  );
  const polNetCost = activePolicies.reduce(
    (s, p) => s + ((p.estimatedEffects.fiscalCostPctGdp ?? 0) - (p.estimatedEffects.expectedRevenuePctGdp ?? 0)),
    0
  );

  let debt = m.grossDebtPctGdp;
  let risk = m.countryRiskBps;
  const baseRev = ledger?.collectedRevenuePctGdp ?? m.revenuePctGdp;
  const baseInterest = ledger?.debtInterestPctGdp ?? m.debtInterestPctGdp ?? 2.5;
  const basePrimarySpend = Math.max(14, (ledger?.executedSpendingPctGdp ?? m.spendingPctGdp) - baseInterest);
  const rows = [];

  for (let i = 1; i <= years; i++) {
    const rev = round2(clamp(baseRev + (m.gdpGrowthPct - 2.0) * 0.14 * i, 18, 42));
    const interest = round2(clamp((debt * (2.5 + risk / 115)) / 100, 1.0, 9.5));
    const totalSpend = round2(clamp(basePrimarySpend + interest + polNetCost * (i === 1 ? 0.5 : 0.35), 18, 52));
    const deficit = round2(totalSpend - rev);
    debt = round2(clamp(debt + deficit - m.gdpGrowthPct * 0.45, 20, 145));
    risk = Math.round(clamp(risk + (deficit - 2.8) * 14, 45, 750));
    rows.push({
      year: state.currentYear + i,
      revenuePctGdp: rev,
      spendingPctGdp: totalSpend,
      interestPctGdp: interest,
      deficitPctGdp: deficit,
      grossDebtPctGdp: debt,
    });
  }
  return rows;
}

/**
 * Motor económico mensual causal con rezagos en 4 horizontes, presupuesto libre de 16 áreas,
 * BCU autónomo (Art. 196) y efecto real de la inflación sobre cuentas fiscales y deuda.
 */
export function stepMonthlyEconomy(state: GameState): {
  nextMacro: MacroSnapshot;
  reasons: IndicatorChangeReason[];
  nextNationalBudget: BudgetAllocation[];
  nextDepartments: GameState['departments'];
  nextActivePolicies: ActivePublicPolicy[];
  policyApprovalDelta: number;
  nextRevenueItems: RevenueLineItem[];
  nextDebtProfile: DebtProfile;
  nextFiscalLedger: FiscalLedgerSummary;
  nextBcuPolicyRatePct: number;
  nextEffectPipeline: DelayedEffectPipelineItem[];
} {
  const cal = ECONOMIC_CALIBRATION;
  const m = state.macro;
  const levers = state.fiscalLevers;
  const reasons: IndicatorChangeReason[] = [];

  const vacantCodes = new Set(state.cabinet.filter((c) => c.isVacant).map((c) => c.ministryCode));
  const vacancyCount = vacantCodes.size;

  const mef = state.cabinet.find((c) => c.ministryCode === 'MEF');
  const mtop = state.cabinet.find((c) => c.ministryCode === 'MTOP');
  const effectiveMefMgmt = mef && !mef.isVacant ? mef.management : 42;
  const effectiveMtopMgmt = mtop && !mtop.isVacant ? mtop.management : 45;

  const cabinetMgmtAvg =
    state.cabinet.reduce((s, c) => s + (c.isVacant ? 38 : c.management), 0) /
    Math.max(1, state.cabinet.length);

  // 1. Procesar cola de rezagos de 4 horizontes (effectPipeline)
  let pipeGdp = 0;
  let pipeInf = 0;
  let pipeUnemp = 0;
  let pipePov = 0;
  let pipeGini = 0;
  let pipeProd = 0;
  let pipeApp = 0;
  const maturedLabels: string[] = [];
  const nextEffectPipeline: DelayedEffectPipelineItem[] = [];

  for (const item of state.effectPipeline ?? []) {
    if (item.applied) continue;
    if (item.remainingMonths <= 1) {
      pipeGdp += item.gdpDelta ?? 0;
      pipeInf += item.inflationDelta ?? 0;
      pipeUnemp += item.unemploymentDelta ?? 0;
      pipePov += item.povertyDelta ?? 0;
      pipeGini += item.giniDelta ?? 0;
      pipeProd += item.productivityDelta ?? 0;
      pipeApp += item.approvalDelta ?? 0;
      maturedLabels.push(item.label);
    } else {
      nextEffectPipeline.push({ ...item, remainingMonths: item.remainingMonths - 1 });
    }
  }

  // 2. Políticas activas (en implementación / vigentes)
  const polImpact = evaluatePoliciesMonthlyContribution(state, vacantCodes);

  // 3. Presupuesto libre (% PIB real por área, sin tope 100%)
  const nominalGdpPre = Math.max(100, m.gdpBillionsUSD * m.exchangeRateUYU);
  const getCatPctGdp = (cat: NationalBudgetCategory): number => {
    const item = state.nationalBudget.find((b) => b.category === cat);
    if (!item) return cal.budgetBaselinePctGdp[cat];
    return ((item.executedBillionsUYU ?? item.annualBillionsUYU) / nominalGdpPre) * 100;
  };

  const eduPct = getCatPctGdp('educacion');
  const sciPct = getCatPctGdp('ciencia_tecnologia');
  const infraPct = getCatPctGdp('infraestructura') + getCatPctGdp('transporte');
  const prodDevPct = getCatPctGdp('desarrollo_productivo');
  const socialPct = getCatPctGdp('desarrollo_social') + getCatPctGdp('vivienda');

  // Encolar rezago de largo plazo si Educación o CyT superan o caen fuertemente respecto a línea base
  const eduGap = eduPct - cal.budgetBaselinePctGdp.educacion;
  const sciGap = sciPct - cal.budgetBaselinePctGdp.ciencia_tecnologia;
  if (Math.abs(eduGap) >= 0.45 && (state.currentMonth === 3 || state.currentMonth === 9)) {
    nextEffectPipeline.push({
      id: `edu_lag_${state.currentYear}_${state.currentMonth}`,
      sourceType: 'presupuesto',
      sourceId: 'educacion',
      label: eduGap > 0 ? 'Maduración de inversión en capital humano (ANEP/UTEC)' : 'Erosión de capital humano por subfinanciamiento educativo',
      horizon: 'largo',
      remainingMonths: 18,
      totalMonths: 18,
      productivityDelta: round2(eduGap * 0.45),
      povertyDelta: round2(-eduGap * 0.12),
    });
  }

  // 4. Comercio exterior, tarifas de entes y tipo de cambio
  const avgPartnerRel = state.diplomacy.reduce((s, d) => s + d.relationScore * (d.exportSharePct / 100), 0);
  const avgTariffIdx =
    (state.publicEnterprises ?? []).reduce((s, e) => s + e.tariffIndex, 0) /
    Math.max(1, (state.publicEnterprises ?? []).length || 1);
  const tariffDeltaFromNeutral = avgTariffIdx - 100;

  const exportImpulse =
    (avgPartnerRel - 70) * 0.015 +
    (levers.tradeOpenness - 55) * 0.008 +
    (m.exchangeRateUYU - 42) * 0.022 +
    (prodDevPct - cal.budgetBaselinePctGdp.desarrollo_productivo) * 0.05;
  const nextExports = round2(clamp(m.exportsBillionsUSD * (1 + exportImpulse / 100), 1.5, 52));
  const importImpulse = (m.consumptionGrowthPct - 1.5) * 0.12 + (levers.tradeOpenness - 55) * 0.01;
  const nextImports = round2(clamp(m.importsBillionsUSD * (1 + importImpulse / 100), 1.5, 48));

  const lawMods = state.enactedLawModifiers ?? {};

  // 5. Productividad y Producción Nacional
  const prodDelta =
    (eduPct - cal.budgetBaselinePctGdp.educacion) * 0.018 +
    (sciGap) * 0.12 +
    (infraPct - (cal.budgetBaselinePctGdp.infraestructura + cal.budgetBaselinePctGdp.transporte)) * 0.045 +
    (cabinetMgmtAvg - 72) * 0.012 +
    (lawMods.productivityDriftDelta ?? 0) * 0.05 -
    vacancyCount * 0.07 +
    pipeProd;
  const nextProductivity = round2(clamp(m.productivityIndex + prodDelta, 70, 155));

  const prevProdIdx = m.productionIndex ?? 102;
  const nextProductionIndex = round1(
    clamp(
      prevProdIdx + (m.gdpGrowthPct - 1.8) * 0.08 + prodDelta * 0.75 + polImpact.productionImpulse,
      70,
      160
    )
  );

  // 6. Autonomía del BCU (Art. 196): Regla de Taylor simplificada
  const prevBcuRate = state.bcuPolicyRatePct ?? cal.bcu.neutralNominalRatePct;
  const inflationGap = m.inflationPct - cal.bcu.inflationTargetCenterPct;
  const outputGap = m.gdpGrowthPct - cal.growth.potentialGrowthBasePct;
  const mix = state.deficitFinancingMix ?? { ...DEFAULT_FINANCING_MIX };
  const debtProfilePrev = state.debtProfile ?? createInitialDebtProfile(m);
  const treasuryTight = debtProfilePrev.treasuryLiquidAssetsBillionsUSD < 0.7 && mix.treasuryAssetsDrawPct > 15 ? 0.6 : 0;

  const taylorRate =
    cal.bcu.neutralNominalRatePct +
    inflationGap * cal.bcu.taylorInflationWeight +
    outputGap * cal.growth.interestRateDragSensitivity +
    treasuryTight;
  const nextBcuPolicyRatePct = round2(
    clamp(prevBcuRate * 0.78 + taylorRate * 0.22, cal.bcu.minRatePct, cal.bcu.maxRatePct)
  );

  // 7. Recaudación (8 fuentes), Presupuesto Libre (16 partidas), Deuda y Riesgo País
  const prevInterestPct = m.debtInterestPctGdp ?? 2.5;
  const nextRiskTarget =
    cal.debtAndMarkets.baseCountryRiskBps +
    Math.max(0, m.fiscalDeficitPctGdp - 2.6) * cal.debtAndMarkets.deficitRiskSensitivityBps +
    Math.max(0, m.grossDebtPctGdp - 60) * cal.debtAndMarkets.debtRiskSensitivityBps -
    (effectiveMefMgmt - 70) * cal.debtAndMarkets.mefManagementRiskOffset -
    (state.politicalIndicators.coalitionStability - 70) * 0.35 +
    vacancyCount * 4;
  const nextRisk = Math.round(clamp(m.countryRiskBps * 0.8 + nextRiskTarget * 0.2, 45, 780));

  // Tipo de cambio (flotación administrada influida por balanza, tasa BCU y riesgo país)
  const fxPressure =
    (m.inflationPct - cal.bcu.inflationTargetCenterPct) * 0.075 +
    (nextRisk - 90) * 0.0055 -
    (nextExports - nextImports) * 0.035 -
    (nextBcuPolicyRatePct - cal.bcu.neutralNominalRatePct) * 0.04;
  const nextFx = round2(clamp(m.exchangeRateUYU * (1 + fxPressure / 100), 10, 105));

  // Inflación NO mecánica: brecha demanda + costos (tarifas + FX + salarios) + expectativas - ancla BCU
  const wageCostPush = Math.max(-1.0, levers.publicWageAdjustment - (nextProductivity - 100) * 0.06);
  const demandPressure = Math.max(-1.2, (m.gdpGrowthPct - cal.growth.potentialGrowthBasePct) * cal.inflation.demandGapWeight);
  const fiscalExpectations = Math.max(0, m.fiscalDeficitPctGdp - 3.6) * cal.inflation.fiscalDominanceExpectationWeight;
  const bcuAnchor = (nextBcuPolicyRatePct - cal.bcu.neutralNominalRatePct) * cal.inflation.bcuRateDampening;

  const inflationTarget =
    cal.bcu.inflationTargetCenterPct +
    demandPressure +
    wageCostPush * cal.inflation.wageCostPassThrough +
    tariffDeltaFromNeutral * cal.inflation.tariffCostPassThrough +
    fxPressure * cal.inflation.fxPassThrough +
    (levers.vatRate - 22) * cal.inflation.vatPassThrough +
    fiscalExpectations -
    bcuAnchor +
    (lawMods.inflationTargetDelta ?? 0) +
    polImpact.inflationImpulse * 2.2 +
    pipeInf;
  const nextInflation = round2(clamp(m.inflationPct * 0.85 + inflationTarget * 0.15, 1.5, 30));

  // Inversión Pública y Privada + Crecimiento Real del PIB
  const prevPubInv = m.publicInvestmentPctGdp ?? 2.9;
  const prevPrivInv = m.privateInvestmentPctGdp ?? 14.3;

  const pubInvTarget =
    2.9 +
    (infraPct - (cal.budgetBaselinePctGdp.infraestructura + cal.budgetBaselinePctGdp.transporte)) * 0.45 +
    polImpact.publicInvImpulse * 1.5;
  const nextPubInv = round2(clamp(prevPubInv * 0.84 + pubInvTarget * 0.16, 1.2, 8.2));

  const realTpmDiff = nextBcuPolicyRatePct - nextInflation - 3.8;
  const privInvTarget =
    14.3 +
    (levers.productiveIncentives - 50) * 0.045 +
    (state.politicalIndicators.businessConfidence - 60) * 0.045 -
    (nextRisk - 90) * 0.017 -
    Math.max(0, levers.incomeTaxRate - 23) * 0.12 -
    realTpmDiff * 0.25 -
    tariffDeltaFromNeutral * 0.05 +
    polImpact.privateInvImpulse * 1.5;
  const nextPrivInv = round2(clamp(prevPrivInv * 0.84 + privInvTarget * 0.16, 7.5, 23.0));
  const nextInv = round2(nextPubInv + nextPrivInv);

  const consumptionTarget =
    m.realWageGrowthPct * 0.62 -
    (levers.vatRate - 22) * 0.42 +
    (socialPct - (cal.budgetBaselinePctGdp.desarrollo_social + cal.budgetBaselinePctGdp.vivienda)) * 0.22 -
    Math.max(0, realTpmDiff) * 0.18;
  const nextConsumption = round2(clamp(m.consumptionGrowthPct * 0.8 + consumptionTarget * 0.2, -5.5, 8.5));

  const growthTarget =
    cal.growth.potentialGrowthBasePct +
    (nextInv - 17.2) * cal.growth.investmentSensitivity +
    (nextExports - nextImports) * cal.growth.tradeBalanceSensitivity +
    (nextProductivity - 100) * cal.growth.productivitySensitivity +
    (nextConsumption - 2.0) * cal.growth.consumptionSensitivity -
    (levers.incomeTaxRate - 22) * 0.07 -
    realTpmDiff * cal.growth.interestRateDragSensitivity +
    (lawMods.gdpTargetDelta ?? 0) +
    polImpact.gdpImpulse * 2.8 +
    pipeGdp -
    vacancyCount * 0.06;
  const nextGdpGrowth = round2(clamp(m.gdpGrowthPct * 0.84 + growthTarget * 0.16, -6.5, 8.8));
  const nextGdpBillions = round2(m.gdpBillionsUSD * (1 + nextGdpGrowth / 1200));
  const nextNominalGdpUYU = Math.max(100, nextGdpBillions * nextFx);

  // Actualizar las 16 partidas presupuestales libres con efecto real de inflación e indexación
  const monthlyInf = nextInflation / 1200;
  const nextInterestBillionsUYU = round1(
    Math.max(5, (debtProfilePrev.grossDebtBillionsUSD * nextFx * (debtProfilePrev.weightedAvgRatePct / 100)))
  );

  const rawUpdatedBudget = state.nationalBudget.map((b) => {
    const linkedMin = state.cabinet.find((c) => c.specialization === b.category);
    const minEffAdj = linkedMin
      ? linkedMin.isVacant
        ? Math.max(52, b.executionEfficiency - 1.5)
        : clamp(b.executionEfficiency + (linkedMin.management - 74) * 0.08, 58, 97)
      : b.executionEfficiency;

    let nextAnnual = b.annualBillionsUYU;
    if (b.category === 'intereses_otros') {
      nextAnnual = nextInterestBillionsUYU;
    } else if (b.category === 'jubilaciones') {
      // Art. 67 Constitución: pasividades indexadas al IMS + ajuste definido
      nextAnnual = round1(b.annualBillionsUYU * (1 + monthlyInf * 0.92 + (levers.pensionAdjustment / 1200)));
    } else if (b.spendingNature === 'corriente') {
      // Partidas con componente salarial público ajustan parcialmente por pauta salarial
      nextAnnual = round1(b.annualBillionsUYU * (1 + monthlyInf * 0.5 + (levers.publicWageAdjustment / 1200) * 0.45));
    }

    const committedRatio = b.category === 'jubilaciones' || b.category === 'intereses_otros' ? 0.99 : 0.94;
    const committed = round1(nextAnnual * committedRatio);
    const executed = round1(committed * clamp(minEffAdj / 100 + 0.19, 0.55, 1.0));
    return {
      ...b,
      annualBillionsUYU: nextAnnual,
      committedBillionsUYU: committed,
      executedBillionsUYU: executed,
      executionEfficiency: Math.round(minEffAdj),
      pctOfGdp: round2((nextAnnual / nextNominalGdpUYU) * 100),
    };
  });

  const budgetTotalUYU = Math.max(1, rawUpdatedBudget.reduce((s, b) => s + b.annualBillionsUYU, 0));
  const nextNationalBudget = rawUpdatedBudget.map((b) => ({
    ...b,
    sharePct: round1((b.annualBillionsUYU / budgetTotalUYU) * 100),
  }));

  // Calcular 8 fuentes de ingresos sobre actividad actualizada
  const nextMacroBaseForRev: MacroSnapshot = {
    ...m,
    gdpBillionsUSD: nextGdpBillions,
    gdpGrowthPct: nextGdpGrowth,
    inflationPct: nextInflation,
    consumptionGrowthPct: nextConsumption,
    exchangeRateUYU: nextFx,
    countryRiskBps: nextRisk,
  };
  const nextRevenueItems = computeRevenueLinesFromState(state, nextMacroBaseForRev);

  // Actualizar Stock y Perfil de Deuda (incorporando déficit mensual, mix e indexación UI/USD/UYU)
  const preLedger = buildFiscalLedger(
    nextMacroBaseForRev,
    nextNationalBudget,
    nextRevenueItems,
    debtProfilePrev,
    mix,
    polImpact.fiscalCostPctGdp
  );
  const nextDeficitPct = round2(-preLedger.globalBalancePctGdp);
  const monthlyDeficitUSD = ((nextDeficitPct / 100) * nextGdpBillions) / 12;

  // Límites institucionales al uso de liquidez del Tesoro y dividendos de Entes
  let effectiveTreasuryDrawUSD = Math.max(0, monthlyDeficitUSD * (mix.treasuryAssetsDrawPct / 100));
  if (effectiveTreasuryDrawUSD > debtProfilePrev.treasuryLiquidAssetsBillionsUSD * 0.25) {
    effectiveTreasuryDrawUSD = debtProfilePrev.treasuryLiquidAssetsBillionsUSD * 0.25;
  }
  const nextTreasuryLiquidUSD = round2(
    clamp(
      debtProfilePrev.treasuryLiquidAssetsBillionsUSD -
        effectiveTreasuryDrawUSD +
        Math.max(0, -monthlyDeficitUSD * 0.4),
      0.2,
      nextGdpBillions * 0.14
    )
  );

  // Efecto real de la inflación y FX sobre el stock de deuda en USD/UI/UYU
  const uiRealization = debtProfilePrev.grossDebtBillionsUSD * (debtProfilePrev.uiSharePct / 100) * monthlyInf;
  const uyuNominalErosion =
    debtProfilePrev.grossDebtBillionsUSD * (debtProfilePrev.uyuSharePct / 100) * (fxPressure / 100);
  const netBorrowingUSD = Math.max(-0.5, monthlyDeficitUSD - effectiveTreasuryDrawUSD);
  const nextGrossDebtUSD = round2(
    Math.max(1, debtProfilePrev.grossDebtBillionsUSD + netBorrowingUSD + uiRealization * 0.35 - uyuNominalErosion * 0.4)
  );
  const nextDebtPctGdp = round2(clamp((nextGrossDebtUSD / Math.max(1, nextGdpBillions)) * 100, 18, 145));
  const nextWeightedRate = round2(
    clamp(
      4.0 + nextRisk / 115 + (nextBcuPolicyRatePct - 8.5) * 0.14 * (debtProfilePrev.uyuSharePct / 100),
      2.2,
      14.0
    )
  );

  const nextDebtProfile: DebtProfile = {
    ...debtProfilePrev,
    grossDebtBillionsUSD: nextGrossDebtUSD,
    netDebtBillionsUSD: round2(Math.max(0, nextGrossDebtUSD - nextTreasuryLiquidUSD)),
    weightedAvgRatePct: nextWeightedRate,
    annualMaturitiesBillionsUSD: round2(nextGrossDebtUSD * cal.debtAndMarkets.maturitiesShareOfDebt),
    treasuryLiquidAssetsBillionsUSD: nextTreasuryLiquidUSD,
  };

  const nextFiscalLedger = buildFiscalLedger(
    { ...nextMacroBaseForRev, grossDebtPctGdp: nextDebtPctGdp },
    nextNationalBudget,
    nextRevenueItems,
    nextDebtProfile,
    mix,
    polImpact.fiscalCostPctGdp
  );

  // 8. Salario Real, Empleo, Pobreza, Indigencia y Gini
  const realWageTarget =
    levers.publicWageAdjustment + (nextProductivity - 100) * 0.08 - Math.max(0, nextInflation - 6.0) * 0.36;
  const nextRealWage = round2(clamp(m.realWageGrowthPct * 0.8 + realWageTarget * 0.2, -6.5, 7.5));

  const prevPurchasing = m.purchasingPowerIndex ?? 103.1;
  const nextPurchasingPower = round1(clamp(prevPurchasing * (1 + nextRealWage / 1200), 70, 150));

  const unempTarget =
    8.2 -
    (nextGdpGrowth - 2.2) * 0.54 -
    (effectiveMtopMgmt - 70) * 0.02 +
    Math.max(0, nextRealWage - 3.5) * 0.24 +
    (lawMods.unemploymentTargetDelta ?? 0) +
    polImpact.unemploymentImpulse * 2.6 +
    pipeUnemp;
  const nextUnemployment = round2(clamp(m.unemploymentPct * 0.85 + unempTarget * 0.15, 4.0, 19.0));
  const nextEmploymentRate = round1(clamp(64.1 - nextUnemployment * 0.63, 46, 66));

  const povertyTarget =
    17.3 -
    (nextRealWage - 1.5) * 0.45 +
    (nextUnemployment - 8.2) * 0.85 -
    (socialPct - (cal.budgetBaselinePctGdp.desarrollo_social + cal.budgetBaselinePctGdp.vivienda)) * 0.72 +
    Math.max(0, nextInflation - 6.5) * 0.35 +
    (lawMods.povertyTargetDelta ?? 0) +
    polImpact.povertyImpulse * 2.5 +
    pipePov;
  const nextPoverty = round2(clamp(m.povertyPct * 0.88 + povertyTarget * 0.12, 4.2, 39));

  const prevIndigence = m.indigencePct ?? 1.5;
  const indigenceTarget = Math.max(
    0.2,
    nextPoverty * 0.085 - (socialPct - 3.46) * 0.12 + polImpact.indigenceImpulse
  );
  const nextIndigence = round2(clamp(prevIndigence * 0.85 + indigenceTarget * 0.15, 0.2, 8.5));

  const prevGini = m.giniIndex ?? 0.39;
  const giniTarget =
    0.39 -
    (socialPct - 3.46) * 0.008 -
    (levers.incomeTaxRate - 22) * 0.0008 +
    (levers.vatRate - 22) * 0.001 +
    (nextUnemployment - 8.2) * 0.002 +
    polImpact.giniImpulse +
    pipeGini;
  const nextGini = Number(clamp(prevGini * 0.9 + giniTarget * 0.1, 0.31, 0.52).toFixed(3));

  // 9. Causas transparentes
  const gdpDiff = round2(nextGdpGrowth - m.gdpGrowthPct);
  reasons.push({
    indicator: 'Crecimiento del PIB',
    deltaLabel: `${gdpDiff >= 0 ? '+' : ''}${gdpDiff}%`,
    direction: gdpDiff > 0.02 ? 'up' : gdpDiff < -0.02 ? 'down' : 'flat',
    causes: [
      `Inversión pública ${nextPubInv}% y privada ${nextPrivInv}% (total ${nextInv}% PIB · TPM BCU ${nextBcuPolicyRatePct}%).`,
      `Saldo comercial USD ${(nextExports - nextImports).toFixed(2)}B y producción ${nextProductionIndex} pts.`,
      maturedLabels[0] ?? polImpact.activeNotes[0] ?? (vacancyCount > 0 ? `${vacancyCount} cartera(s) vacante(s) restan tracción ejecutiva.` : 'Gabinete operativo completo.'),
    ],
  });

  const infDiff = round2(nextInflation - m.inflationPct);
  reasons.push({
    indicator: 'Inflación y BCU (Art. 196)',
    deltaLabel: `${infDiff >= 0 ? '+' : ''}${infDiff}%`,
    direction: infDiff > 0.02 ? 'up' : infDiff < -0.02 ? 'down' : 'flat',
    causes: [
      `TPM autónoma BCU en ${nextBcuPolicyRatePct}% (meta 3%–6%, centro 4.5%).`,
      `Tarifas públicas promedio ${avgTariffIdx.toFixed(0)} pts · Dólar $${nextFx} UYU · Poder adquisitivo ${nextPurchasingPower} pts.`,
    ],
  });

  const unempDiff = round2(nextUnemployment - m.unemploymentPct);
  reasons.push({
    indicator: 'Empleo y Desempleo',
    deltaLabel: `${unempDiff >= 0 ? '+' : ''}${unempDiff}%`,
    direction: unempDiff > 0.02 ? 'up' : unempDiff < -0.02 ? 'down' : 'flat',
    causes: [
      `Tasa de empleo ${nextEmploymentRate}% · Desocupación ${nextUnemployment}%.`,
      `Confianza empresarial ${Math.round(state.politicalIndicators.businessConfidence)} pts.`,
    ],
  });

  const defDiff = round2(nextDeficitPct - m.fiscalDeficitPctGdp);
  reasons.push({
    indicator: 'Cuentas Fiscales y Deuda',
    deltaLabel: `${defDiff >= 0 ? '+' : ''}${defDiff}% PIB`,
    direction: defDiff > 0.02 ? 'up' : defDiff < -0.02 ? 'down' : 'flat',
    causes: [
      `Recaudado ${nextFiscalLedger.collectedRevenuePctGdp}% PIB vs. Ejecutado ${nextFiscalLedger.executedSpendingPctGdp}% PIB (Primario ${nextFiscalLedger.primaryBalancePctGdp >= 0 ? '+' : ''}${nextFiscalLedger.primaryBalancePctGdp}% PIB).`,
      `Intereses ${nextFiscalLedger.debtInterestPctGdp}% PIB · Deuda bruta ${nextDebtPctGdp}% PIB (Sostenibilidad ${nextFiscalLedger.sustainabilityIndex}/100).`,
    ],
  });

  const nextDepartments = state.departments.map((d) => {
    const deptUnemp = round1(clamp(d.unemploymentRate + (nextUnemployment - m.unemploymentPct) * 0.9, 3.8, 20));
    const deptPov = round1(clamp(d.povertyRate + (nextPoverty - m.povertyPct) * 0.7, 3.5, 32));
    return {
      ...d,
      unemploymentRate: deptUnemp,
      povertyRate: deptPov,
      employmentRate: round1(clamp(63.8 - deptUnemp * 0.65, 45, 67)),
    };
  });

  return {
    nextMacro: {
      ...m,
      isSimulated: true,
      sourceLabel: 'Motor Económico Causal v3 (BCU/MEF/INE)',
      gdpBillionsUSD: nextGdpBillions,
      gdpGrowthPct: nextGdpGrowth,
      inflationPct: nextInflation,
      unemploymentPct: nextUnemployment,
      employmentRatePct: nextEmploymentRate,
      povertyPct: nextPoverty,
      indigencePct: nextIndigence,
      giniIndex: nextGini,
      realWageGrowthPct: nextRealWage,
      purchasingPowerIndex: nextPurchasingPower,
      fiscalDeficitPctGdp: nextDeficitPct,
      grossDebtPctGdp: nextDebtPctGdp,
      debtInterestPctGdp: nextFiscalLedger.debtInterestPctGdp ?? prevInterestPct,
      revenuePctGdp: nextFiscalLedger.collectedRevenuePctGdp,
      spendingPctGdp: nextFiscalLedger.executedSpendingPctGdp,
      investmentPctGdp: nextInv,
      publicInvestmentPctGdp: nextPubInv,
      privateInvestmentPctGdp: nextPrivInv,
      productionIndex: nextProductionIndex,
      exportsBillionsUSD: nextExports,
      importsBillionsUSD: nextImports,
      exchangeRateUYU: nextFx,
      countryRiskBps: nextRisk,
      consumptionGrowthPct: nextConsumption,
      productivityIndex: nextProductivity,
    },
    reasons,
    nextNationalBudget,
    nextDepartments,
    nextActivePolicies: polImpact.nextActivePolicies,
    policyApprovalDelta: polImpact.approvalDelta + pipeApp,
    nextRevenueItems,
    nextDebtProfile,
    nextFiscalLedger,
    nextBcuPolicyRatePct,
    nextEffectPipeline,
  };
}
