import {
  DEFAULT_FINANCING_MIX,
  INITIAL_NATIONAL_BUDGET,
  INITIAL_PUBLIC_ENTERPRISES,
  INITIAL_SOCIAL_ACTORS,
  NATIONAL_BUDGET_META,
  createInitialDebtProfile,
  createInitialFiscalLedger,
  createInitialPartyFinances,
  createInitialRevenueItems,
  enrichDepartmentTerritorial,
  scaleNationalBudgetToMacro,
} from '../data/uruguayData';
import {
  BillProposal,
  BudgetAllocation,
  GameState,
  LegislativeStage,
  NationalBudgetCategory,
} from '../types/game';

export const CURRENT_SCHEMA_VERSION = 3;
export const BACKUP_SAVES_KEY = 'qqgu_saves_backup_pre_v3';

export function detectSaveVersion(raw: unknown): number {
  if (!raw || typeof raw !== 'object') return 0;
  const candidate = raw as Partial<GameState>;
  if (typeof candidate.version === 'number' && Number.isFinite(candidate.version)) {
    return candidate.version;
  }
  return 1;
}

export function backupRawSavesBeforeMigration(rawJson: string): void {
  try {
    if (typeof localStorage === 'undefined' || !rawJson) return;
    if (!localStorage.getItem(BACKUP_SAVES_KEY)) {
      localStorage.setItem(BACKUP_SAVES_KEY, rawJson);
    }
  } catch {
    // No interrumpir carga si el storage está al límite de cuota
  }
}

export function restorePreMigrationBackup(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(BACKUP_SAVES_KEY);
  } catch {
    return null;
  }
}

function migrateBudgetAllocations(
  oldBudget: BudgetAllocation[] | undefined,
  macro: GameState['macro']
): BudgetAllocation[] {
  if (!Array.isArray(oldBudget) || oldBudget.length === 0) {
    return scaleNationalBudgetToMacro(macro);
  }

  const nominalGdpUYU = Math.max(100, macro.gdpBillionsUSD * macro.exchangeRateUYU);
  const existingMap = new Map<NationalBudgetCategory, BudgetAllocation>();
  oldBudget.forEach((b) => {
    existingMap.set(b.category, b);
  });

  // Si ya posee las 16 categorías v3 completas, asegurar únicamente campos nuevos
  if (existingMap.size >= 16 && existingMap.has('jubilaciones') && existingMap.has('intereses_otros')) {
    const total = oldBudget.reduce((s, b) => s + Math.max(0.5, b.annualBillionsUYU), 0);
    return INITIAL_NATIONAL_BUDGET.map((baseItem) => {
      const prev = existingMap.get(baseItem.category) ?? baseItem;
      const annual = Number(Math.max(0.5, prev.annualBillionsUYU).toFixed(1));
      const committed = prev.committedBillionsUYU ?? Number((annual * 0.95).toFixed(1));
      const executed =
        prev.executedBillionsUYU ??
        Number((committed * Math.min(1, (prev.executionEfficiency || 75) / 100 + 0.18)).toFixed(1));
      return {
        ...prev,
        label: NATIONAL_BUDGET_META[baseItem.category].label,
        spendingNature: prev.spendingNature ?? NATIONAL_BUDGET_META[baseItem.category].spendingNature,
        approvedBillionsUYU: prev.approvedBillionsUYU ?? annual,
        committedBillionsUYU: committed,
        executedBillionsUYU: executed,
        pctOfGdp: Number(((annual / nominalGdpUYU) * 100).toFixed(2)),
        sharePct: Number(((annual / Math.max(1, total)) * 100).toFixed(1)),
      };
    });
  }

  // Migración v1/v2 (12 categorías) -> v3 (16 categorías) preservando prioridades relativas del jugador
  const scaledBase = scaleNationalBudgetToMacro(macro);
  const baseTotal = scaledBase.reduce((s, b) => s + b.annualBillionsUYU, 0);
  const oldTotal = Math.max(1, oldBudget.reduce((s, b) => s + Math.max(0.1, b.annualBillionsUYU), 0));

  const factorFor = (cat: NationalBudgetCategory): number => {
    const legacy = existingMap.get(cat);
    if (legacy) {
      const legacyShare = legacy.annualBillionsUYU / oldTotal;
      const std12Share = (INITIAL_NATIONAL_BUDGET.find((x) => x.category === cat)?.sharePct ?? 5) / 100;
      return Math.max(0.65, Math.min(1.6, legacyShare / Math.max(0.01, std12Share)));
    }
    if (cat === 'jubilaciones') return factorFor('desarrollo_social');
    if (cat === 'desarrollo_productivo') return factorFor('infraestructura');
    if (cat === 'relaciones_exteriores' || cat === 'intereses_otros') return 1;
    return 1;
  };

  const raw16 = scaledBase.map((baseItem) => {
    const legacy = existingMap.get(baseItem.category);
    const mult = factorFor(baseItem.category);
    const annual = Number(Math.max(1.0, baseItem.annualBillionsUYU * mult).toFixed(1));
    return {
      ...baseItem,
      annualBillionsUYU: annual,
      executionEfficiency: legacy?.executionEfficiency ?? baseItem.executionEfficiency,
    };
  });

  const rawTotal = Math.max(1, raw16.reduce((s, b) => s + b.annualBillionsUYU, 0));
  const normalizeScale = baseTotal / rawTotal;

  return raw16.map((item) => {
    const annual = Number(Math.max(1.0, item.annualBillionsUYU * normalizeScale).toFixed(1));
    const committed = Number((annual * 0.94).toFixed(1));
    const executed = Number((committed * Math.min(1, item.executionEfficiency / 100 + 0.18)).toFixed(1));
    return {
      ...item,
      annualBillionsUYU: annual,
      approvedBillionsUYU: annual,
      committedBillionsUYU: committed,
      executedBillionsUYU: executed,
      pctOfGdp: Number(((annual / nominalGdpUYU) * 100).toFixed(2)),
      sharePct: Number(((annual / baseTotal) * 100).toFixed(1)),
    };
  });
}

function migrateBills(bills: BillProposal[] | undefined): BillProposal[] {
  if (!Array.isArray(bills)) return [];
  return bills.map((bill) => {
    const originChamber: BillProposal['originChamber'] =
      bill.originChamber ??
      (bill.chamber === 'junta_departamental'
        ? 'junta_departamental'
        : bill.chamber === 'senado'
        ? 'senado'
        : 'diputados');

    const defaultStage: LegislativeStage =
      bill.status === 'aprobada'
        ? 'aprobada'
        : bill.status === 'rechazada'
        ? 'rechazada'
        : 'camara_origen_comision';

    const committeeByCat: Record<BillProposal['category'], string> = {
      presupuestal: 'Comisión de Presupuestos y Hacienda',
      economica: 'Comisión de Hacienda',
      social: 'Comisión de Población, Desarrollo e Inclusión',
      laboral: 'Comisión de Legislación del Trabajo y Seguridad Social',
      seguridad: 'Comisión de Constitución, Códigos y Seguridad',
      institucional: 'Comisión de Constitución y Legislación',
    };

    return {
      ...bill,
      originChamber,
      legislativeStage: bill.legislativeStage ?? defaultStage,
      committeeName: bill.committeeName ?? committeeByCat[bill.category] ?? 'Comisión Especial',
      executiveVetoKind: bill.executiveVetoKind ?? 'ninguno',
      isConstitutionalBudgetBill:
        bill.isConstitutionalBudgetBill ?? (bill.category === 'presupuestal' && bill.chamber !== 'junta_departamental'),
      deadlineDaysRemaining:
        bill.deadlineDaysRemaining ??
        (bill.category === 'presupuestal' && bill.chamber !== 'junta_departamental' && bill.status === 'en_negociacion' ? 45 : undefined),
    };
  });
}

export function migrateGameState(rawState: GameState): GameState {
  const version = detectSaveVersion(rawState);
  const macro = rawState.macro;

  const departments = (rawState.departments ?? []).map(enrichDepartmentTerritorial);
  const nationalBudget = migrateBudgetAllocations(rawState.nationalBudget, macro);
  const revenueItems =
    Array.isArray(rawState.revenueItems) && rawState.revenueItems.length >= 8
      ? rawState.revenueItems
      : createInitialRevenueItems(macro);
  const debtProfile = rawState.debtProfile ?? createInitialDebtProfile(macro);
  const deficitFinancingMix = rawState.deficitFinancingMix ?? { ...DEFAULT_FINANCING_MIX };
  const fiscalLedger =
    rawState.fiscalLedger ??
    createInitialFiscalLedger(macro, nationalBudget, revenueItems, debtProfile, deficitFinancingMix);

  const bcuPolicyRatePct =
    typeof rawState.bcuPolicyRatePct === 'number'
      ? rawState.bcuPolicyRatePct
      : Number(Math.max(4.5, Math.min(14.5, 4.0 + macro.inflationPct * 0.82)).toFixed(2));

  const publicEnterprises =
    Array.isArray(rawState.publicEnterprises) && rawState.publicEnterprises.length >= 5
      ? rawState.publicEnterprises
      : INITIAL_PUBLIC_ENTERPRISES.map((e) => ({ ...e }));

  const socialActors =
    Array.isArray(rawState.socialActors) && rawState.socialActors.length >= 4
      ? rawState.socialActors
      : INITIAL_SOCIAL_ACTORS.map((a) => ({ ...a, negotiationHistory: [...a.negotiationHistory] }));

  const partyFinances =
    rawState.partyFinances && Object.keys(rawState.partyFinances).length > 0
      ? rawState.partyFinances
      : createInitialPartyFinances(rawState.parties ?? []);

  const bills = migrateBills(rawState.bills);

  // Conservar compatibilidad con pendingDelayedEffects si hubiera elementos v2 sin migrar
  const existingPipeline = Array.isArray(rawState.effectPipeline) ? rawState.effectPipeline : [];
  const effectPipeline =
    existingPipeline.length > 0 || !Array.isArray(rawState.pendingDelayedEffects) || rawState.pendingDelayedEffects.length === 0
      ? existingPipeline
      : rawState.pendingDelayedEffects.map((p) => ({
          id: `mig_${p.id}`,
          sourceType: 'politica' as const,
          sourceId: p.id,
          label: p.label,
          horizon: (p.triggerInMonths <= 3 ? 'corto' : p.triggerInMonths <= 12 ? 'mediano' : 'largo') as
            | 'corto'
            | 'mediano'
            | 'largo',
          remainingMonths: Math.max(1, p.triggerInMonths),
          totalMonths: Math.max(1, p.triggerInMonths),
          gdpDelta: p.gdpDelta,
          inflationDelta: p.inflationDelta,
          unemploymentDelta: p.unemploymentDelta,
          povertyDelta: p.povertyDelta,
          productivityDelta: p.productivityDelta,
          approvalDelta: p.approvalDelta,
          applied: false,
        }));

  return {
    ...rawState,
    version: Math.max(CURRENT_SCHEMA_VERSION, version),
    departments,
    nationalBudget,
    bills,
    revenueItems,
    debtProfile,
    deficitFinancingMix,
    fiscalLedger,
    bcuPolicyRatePct,
    effectPipeline,
    pendingDelayedEffects: existingPipeline.length > 0 ? rawState.pendingDelayedEffects ?? [] : [],
    publicEnterprises,
    socialActors,
    governmentAnnouncements: rawState.governmentAnnouncements ?? [],
    publicWorksOrders: rawState.publicWorksOrders ?? [],
    partyFinances,
    governmentArchive: rawState.governmentArchive ?? [],
  };
}
