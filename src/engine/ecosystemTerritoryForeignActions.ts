import { FOREIGN_NEGOTIATION_LABELS } from '../data/expansionData';
import type {
  EcosystemActionResult,
  ForeignNegotiationKind,
  ForeignNegotiationState,
} from '../types/expansion';
import type { GameState } from '../types/game';
import { getPlayerCapabilities } from './capabilitiesEngine';
import { createInitialEcosystemState } from './ecosystemFactory';
import {
  adjustStability,
  applyApproval,
  canSpend,
  clamp,
  ensureEcosystem,
  fail,
  getAdvisorCapacity,
  r1,
  r2,
  setExpansion,
  spend,
  success,
  withLog,
} from './ecosystemShared';

/* ============================================================
   13 · RELACIONES CON LAS 19 INTENDENCIAS
   14 · POLÍTICA EXTERIOR AMPLIADA Y MERCOSUR
   ============================================================ */

export function intendencyAgreement(
  state: GameState,
  departmentId: string
): EcosystemActionResult {
  const caps = getPlayerCapabilities(state);
  const allowed =
    caps.canDirectMinistriesAndStateAgencies ||
    (caps.canAdministerDepartamentalBudget && departmentId === state.player.targetDepartment);
  if (!allowed) {
    return fail(
      state,
      caps.canAdministerDepartamentalBudget
        ? 'Como Intendente solo podés firmar convenios con tu propio departamento.'
        : caps.lockReasons.executiveNational
    );
  }
  const eco = ensureEcosystem(state, createInitialEcosystemState);
  const relation = eco.intendencyRelations.find((r) => r.departmentId === departmentId);
  if (!relation) return fail(state, 'No encontré ese departamento.');
  if (relation.agreement?.active) return fail(state, 'Ya hay un convenio activo con esa intendencia.');
  if (relation.relationScore < 12) {
    return fail(state, 'La relación es demasiado baja para firmar un convenio.');
  }
  const costError = canSpend(state, 4, 1500000);
  if (costError) return fail(state, costError);

  const transferMillionsUYU = Math.round(30 + Math.max(0, relation.relationScore) * 0.4);
  const intendencyRelations = eco.intendencyRelations.map((r) =>
    r.departmentId === departmentId
      ? {
          ...r,
          relationScore: r1(clamp(r.relationScore + 6, -100, 100)),
          conflictLevel: r1(clamp(r.conflictLevel - 8, 0, 100)),
          agreement: {
            title: `Convenio de cooperación · ${r.departmentName}`,
            monthsRemaining: 8,
            transferMillionsUYU,
            active: true,
          },
          lastContactDateLabel: `${state.currentYear}-${state.currentMonth}`,
        }
      : r
  );
  let next = spend(state, 4, 1500000);
  next = adjustStability(next, 1);
  next = {
    ...next,
    departments: next.departments.map((d) =>
      d.id === departmentId
        ? {
            ...d,
            localServiceQuality: r1(clamp(d.localServiceQuality + 1.2, 0, 100)),
          }
        : d
    ),
  };
  next = setExpansion(next, { ...eco, intendencyRelations });
  return success(
    state,
    `Convenio con ${relation.departmentName}: $${transferMillionsUYU}M en 8 meses.`,
    withLog(
      state,
      next,
      `Convenio con la Intendencia de ${relation.departmentName}`,
      `Transferencia prevista de $${transferMillionsUYU} millones y mejora de servicios locales.`,
      'gobierno'
    )
  );
}

export function transferToIntendency(
  state: GameState,
  departmentId: string,
  amountMillions: number
): EcosystemActionResult {
  const caps = getPlayerCapabilities(state);
  if (!caps.canDirectMinistriesAndStateAgencies) {
    return fail(state, caps.lockReasons.executiveNational);
  }
  const eco = ensureEcosystem(state, createInitialEcosystemState);
  const relation = eco.intendencyRelations.find((r) => r.departmentId === departmentId);
  if (!relation) return fail(state, 'No encontré ese departamento.');
  const amount = Math.round(clamp(amountMillions, 10, 200));
  const costError = canSpend(state, 3, amount * 20000);
  if (costError) return fail(state, costError);

  const gain = amount / 12;
  const intendencyRelations = eco.intendencyRelations.map((r) =>
    r.departmentId === departmentId
      ? {
          ...r,
          relationScore: r1(clamp(r.relationScore + gain, -100, 100)),
          conflictLevel: r1(clamp(r.conflictLevel - amount / 15, 0, 100)),
          lastContactDateLabel: `${state.currentYear}-${state.currentMonth}`,
        }
      : r
  );
  let next = spend(state, 3, amount * 20000);
  next = {
    ...next,
    departments: next.departments.map((d) =>
      d.id === departmentId
        ? {
            ...d,
            localServiceQuality: r1(clamp(d.localServiceQuality + amount / 100, 0, 100)),
          }
        : d
    ),
  };
  next = applyApproval(next, amount / 500, amount / 800);
  next = setExpansion(next, { ...eco, intendencyRelations });
  return success(
    state,
    `Transferiste $${amount}M a ${relation.departmentName} (+${gain.toFixed(1)} relación).`,
    withLog(
      state,
      next,
      `Transferencia a ${relation.departmentName}`,
      `$${amount} millones para obras y servicios departamentales.`,
      'gobierno'
    )
  );
}

const FOREIGN_KIND_EFFECTS: Record<
  ForeignNegotiationKind,
  { approval: number; trade: number; relation: number; title: string }
> = {
  comercial: { approval: 0.6, trade: 4, relation: 6, title: 'Acuerdo comercial' },
  diplomatica: { approval: 0.4, trade: 0.5, relation: 8, title: 'Misión diplomática' },
  mercosur: { approval: 0.5, trade: 2.5, relation: 5, title: 'Agenda Mercosur' },
  cooperacion: { approval: 0.3, trade: 1, relation: 5, title: 'Cooperación técnica' },
};

export function startForeignNegotiation(
  state: GameState,
  partnerId: string,
  kind: ForeignNegotiationKind
): EcosystemActionResult {
  const caps = getPlayerCapabilities(state);
  if (!caps.canDirectForeignPolicyExecutive) {
    return fail(state, caps.lockReasons.foreignPolicy);
  }
  const eco = ensureEcosystem(state, createInitialEcosystemState);
  const partner = state.diplomacy.find((d) => d.id === partnerId);
  if (!partner) return fail(state, 'No encontré ese socio internacional.');
  if (
    eco.foreignNegotiations.some(
      (n) => n.partnerId === partnerId && n.status === 'en_curso'
    )
  ) {
    return fail(state, 'Ya hay una negociación en curso con ese país.');
  }
  const costError = canSpend(state, 5, 1000000);
  if (costError) return fail(state, costError);

  const labels = FOREIGN_NEGOTIATION_LABELS[kind];
  const effects = FOREIGN_KIND_EFFECTS[kind];
  const advisorBonus = getAdvisorCapacity(state, 'negociacion') > 0 ? 1 : 0;
  const totalMonths = Math.max(2, labels.months - advisorBonus);
  const negotiation: ForeignNegotiationState = {
    id: `fneg_${Date.now()}`,
    partnerId: partner.id,
    partnerName: partner.name,
    kind,
    title: `${effects.title} con ${partner.name}`,
    dateLabel: `${state.currentYear}-${state.currentMonth}`,
    monthsRemaining: totalMonths,
    totalMonths,
    status: 'en_curso',
    expectedBenefit: labels.benefit,
    approvalEffect: effects.approval,
    tradeDelta: effects.trade,
    relationDelta: effects.relation,
  };
  let next = spend(state, 5, 1000000);
  next = setExpansion(next, {
    ...eco,
    foreignNegotiations: [negotiation, ...eco.foreignNegotiations].slice(0, 20),
  });
  return success(
    state,
    `Negociación iniciada con ${partner.name}: ${effects.title} (${totalMonths} meses).`,
    withLog(
      state,
      next,
      `Negociación internacional: ${partner.name}`,
      `${effects.title}. ${labels.benefit}`,
      'diplomacia'
    )
  );
}

export function mercosurSummit(state: GameState): EcosystemActionResult {
  const caps = getPlayerCapabilities(state);
  if (!caps.canDirectForeignPolicyExecutive) {
    return fail(state, caps.lockReasons.foreignPolicy);
  }
  const eco = ensureEcosystem(state, createInitialEcosystemState);
  const costError = canSpend(state, 6, 2000000);
  if (costError) return fail(state, costError);

  const mercosur = state.diplomacy.filter((d) => d.bloc === 'Mercosur');
  const avgRelation =
    mercosur.reduce((sum, d) => sum + d.relationScore, 0) / Math.max(1, mercosur.length);
  const integrationGain = r1(
    clamp(3 + (avgRelation - 50) * 0.08 + getAdvisorCapacity(state, 'negociacion') * 0.02, 1, 9)
  );
  const diplomacy = state.diplomacy.map((d) =>
    d.bloc === 'Mercosur'
      ? {
          ...d,
          relationScore: r1(clamp(d.relationScore + 3, 0, 100)),
          tradeVolumeBillionsUSD: r2(d.tradeVolumeBillionsUSD * 1.004),
          activeAgreement:
            d.activeAgreement && d.activeAgreement !== 'Sin acuerdo'
              ? d.activeAgreement
              : 'Cumbre Mercosur',
        }
      : d
  );
  let next = spend(state, 6, 2000000);
  next = { ...next, diplomacy };
  next = applyApproval(next, 0.5, 0.3);
  next = {
    ...next,
    macro: {
      ...next.macro,
      exportsBillionsUSD: r2(next.macro.exportsBillionsUSD * 1.004),
    },
  };
  const mercosurIntegration = r1(clamp(eco.mercosurIntegration + integrationGain, 0, 100));
  next = setExpansion(next, { ...eco, mercosurIntegration });
  return success(
    state,
    `Cumbre Mercosur: integración ${Math.round(mercosurIntegration)}/100 (+${integrationGain}).`,
    withLog(
      state,
      next,
      'Cumbre del Mercosur',
      `Uruguay ejerció la presidencia pro tempore y cerró una declaración conjunta. Integración +${integrationGain}.`,
      'diplomacia'
    )
  );
}
