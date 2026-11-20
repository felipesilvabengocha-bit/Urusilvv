import React, { useState } from 'react';
import {
  Activity,
  Banknote,
  Clock,
  DollarSign,
  Landmark,
  Lock,
  PieChart,
  ShieldAlert,
  Sliders,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  DEFAULT_FINANCING_MIX,
  createInitialDebtProfile,
  createInitialFiscalLedger,
  createInitialRevenueItems,
} from '../../data/uruguayData';
import { getPlayerCapabilities } from '../../engine/capabilitiesEngine';
import {
  projectMultiYearFiscalOutlook,
  recomputeFiscalSnapshot,
  updateDeficitFinancingMix,
  updateFreeBudgetAllocation,
} from '../../engine/economyEngine';
import {
  DeficitFinancingMix,
  FiscalPolicyLevers,
  GameState,
  NationalBudgetCategory,
  SpendingNature,
} from '../../types/game';
import { MacroTrendChart } from '../Charts';

interface EconomyViewProps {
  gameState: GameState;
  onUpdateState: (next: GameState) => void;
  onOpenPolicyLab?: () => void;
}

type EconomySubTab = 'macro' | 'presupuesto' | 'ingresos_deuda' | 'rezagos';

const NATURE_BADGE: Record<SpendingNature, { label: string; cls: string }> = {
  inversion_estructural: {
    label: 'Inversión estructural',
    cls: 'border-[#557568]/50 bg-[#557568]/20 text-[#ACCEBF]',
  },
  gasto_social: {
    label: 'Gasto social',
    cls: 'border-[#E87532]/45 bg-[#E87532]/15 text-[#FFB691]',
  },
  corriente: {
    label: 'Funcionamiento / Corriente',
    cls: 'border-[#574239]/55 bg-[#262B2C] text-[#CDC6B8]',
  },
  financiero: {
    label: 'Financiero / Deuda',
    cls: 'border-amber-500/45 bg-amber-950/35 text-amber-200',
  },
};

export const EconomyAndBudgetView: React.FC<EconomyViewProps> = ({
  gameState,
  onUpdateState,
  onOpenPolicyLab,
}) => {
  const [subTab, setSubTab] = useState<EconomySubTab>('macro');

  const m = gameState.macro;
  const levers = gameState.fiscalLevers;
  const caps = getPlayerCapabilities(gameState);
  const canEditNational = caps.canEditNationalBudgetAndFiscal;

  const nominalGdpUYU = Math.max(100, m.gdpBillionsUSD * m.exchangeRateUYU);
  const revenues = gameState.revenueItems ?? createInitialRevenueItems(m);
  const debtProfile = gameState.debtProfile ?? createInitialDebtProfile(m);
  const financingMix = gameState.deficitFinancingMix ?? DEFAULT_FINANCING_MIX;
  const ledger =
    gameState.fiscalLedger ??
    createInitialFiscalLedger(m, gameState.nationalBudget, revenues, debtProfile, financingMix);
  const bcuRate = gameState.bcuPolicyRatePct ?? Number((4.0 + m.inflationPct * 0.82).toFixed(2));
  const effectPipeline = gameState.effectPipeline ?? [];

  const activePolicies = (gameState.activePolicies ?? []).filter(
    (p) => p.status === 'en_implementacion' || p.status === 'vigente'
  );
  const outlookRows = projectMultiYearFiscalOutlook(gameState, 3);

  const totalBudgetBillionsUYU = gameState.nationalBudget.reduce((s, b) => s + b.annualBillionsUYU, 0);
  const totalExecutedBillionsUYU = gameState.nationalBudget.reduce(
    (s, b) => s + (b.executedBillionsUYU ?? b.annualBillionsUYU),
    0
  );

  const updateLever = (key: keyof FiscalPolicyLevers, val: number) => {
    if (!canEditNational) return;
    const updated = recomputeFiscalSnapshot({
      ...gameState,
      fiscalLevers: {
        ...gameState.fiscalLevers,
        [key]: val,
      },
    });
    onUpdateState(updated);
  };

  const updateFreeBudget = (category: NationalBudgetCategory, nextBillionsUYU: number) => {
    if (!canEditNational) return;
    const nextBudget = updateFreeBudgetAllocation(
      gameState.nationalBudget,
      category,
      nextBillionsUYU,
      nominalGdpUYU
    );
    const updated = recomputeFiscalSnapshot({
      ...gameState,
      nationalBudget: nextBudget,
    });
    onUpdateState(updated);
  };

  const updateFinancingMixHandler = (key: keyof DeficitFinancingMix, val: number) => {
    if (!canEditNational) return;
    const nextMix = updateDeficitFinancingMix(financingMix, key, val);
    const updated = recomputeFiscalSnapshot({
      ...gameState,
      deficitFinancingMix: nextMix,
    });
    onUpdateState(updated);
  };

  return (
    <div className="space-y-5">
      {/* Encabezado Ejecutivo Fiscal + Subnavegación */}
      <section className="warroom-surface rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 font-display text-xl font-bold text-[#DFE3E4]">
              <DollarSign className="h-5 w-5 text-[#E87532]" />
              Economía, Hacienda y Presupuesto Libre (MEF / BCU)
            </h2>
            <p className="text-xs text-[#CDC6B8]">{m.sourceLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg border border-[#574239]/50 bg-[#0A0F10] px-2.5 py-1 font-mono-data text-xs font-bold text-[#ACCEBF]">
              TPM BCU (Art. 196): {bcuRate.toFixed(2)}%
            </span>
            <span className="rounded-lg border border-[#574239]/50 bg-[#0A0F10] px-2.5 py-1 font-mono-data text-xs font-bold text-[#FFB691]">
              Riesgo: {m.countryRiskBps} pb · USD: ${m.exchangeRateUYU.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Subtabs claros */}
        <div className="mt-4 flex flex-wrap gap-1.5 rounded-xl border border-[#574239]/50 bg-[#0A0F10] p-1.5">
          {[
            { id: 'macro', label: 'Macroeconomía y BCU', icon: Activity },
            { id: 'presupuesto', label: 'Presupuesto Libre (16 Áreas)', icon: PieChart },
            { id: 'ingresos_deuda', label: '8 Ingresos, Deuda y Déficit', icon: Landmark },
            { id: 'rezagos', label: `Cola de Rezagos (${effectPipeline.length})`, icon: Clock },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = subTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id as EconomySubTab)}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono-data text-xs font-bold transition ${
                  active ? 'bg-[#E87532] text-[#511E00]' : 'text-[#DEC1B4] hover:bg-[#1B2021] hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
          {onOpenPolicyLab && (
            <button
              onClick={onOpenPolicyLab}
              className="ml-auto inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#E87532]/50 bg-[#E87532]/15 px-3 py-1.5 font-mono-data text-xs font-bold text-[#FFB691] transition hover:bg-[#E87532] hover:text-[#511E00]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Gobierno · POLÍTICAS ({activePolicies.length})
            </button>
          )}
        </div>

        {!canEditNational && (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-[#E87532]/45 bg-[#E87532]/12 p-3.5 text-xs text-[#DFE3E4]">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#FFB691]" />
            <div>
              <strong className="text-[#FFB691]">Modo Solo Lectura Fiscal:</strong> {caps.lockReasons.nationalBudget}
            </div>
          </div>
        )}
      </section>

      {/* SUBTAB 1: MACROECONOMÍA, 9 KPIs FISCALES Y TENDENCIA */}
      {subTab === 'macro' && (
        <>
          <section className="warroom-surface rounded-xl p-5">
            <h3 className="font-display text-base font-bold text-[#DFE3E4]">
              Indicadores Macroeconómicos Nacionales
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                { label: 'PIB nominal (USD)', val: `USD ${m.gdpBillionsUSD.toFixed(2)}B` },
                { label: 'PIB nominal (UYU)', val: `$ ${Math.round(nominalGdpUYU).toLocaleString('es-UY')} mil M` },
                { label: 'Crecimiento PIB real', val: `${m.gdpGrowthPct >= 0 ? '+' : ''}${m.gdpGrowthPct.toFixed(1)}%` },
                { label: 'Inflación (Meta 3–6%)', val: `${m.inflationPct.toFixed(1)}%` },
                { label: 'Tasa de empleo', val: `${(m.employmentRatePct ?? 58.9).toFixed(1)}%` },
                { label: 'Desempleo', val: `${m.unemploymentPct.toFixed(1)}%` },
                { label: 'Pobreza / Indigencia', val: `${m.povertyPct.toFixed(1)}% / ${(m.indigencePct ?? 1.5).toFixed(2)}%` },
                { label: 'Desigualdad (Gini)', val: `${(m.giniIndex ?? 0.39).toFixed(3)}` },
                { label: 'Salario real (var.)', val: `${m.realWageGrowthPct >= 0 ? '+' : ''}${m.realWageGrowthPct.toFixed(1)}%` },
                { label: 'Poder adquisitivo', val: `${(m.purchasingPowerIndex ?? 103.1).toFixed(1)} pts` },
                { label: 'Inv. pública / privada', val: `${(m.publicInvestmentPctGdp ?? 2.9).toFixed(1)}% / ${(m.privateInvestmentPctGdp ?? 14.3).toFixed(1)}%` },
                { label: 'Productividad / Prod.', val: `${m.productivityIndex.toFixed(1)} / ${(m.productionIndex ?? 102).toFixed(1)} pts` },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-3">
                  <div className="text-[11px] text-[#CDC6B8]">{item.label}</div>
                  <div className="mt-0.5 font-mono-data text-sm font-bold text-[#DFE3E4]">{item.val}</div>
                </div>
              ))}
            </div>
          </section>

          {/* 9 Indicadores Fiscales + Contabilidad Pública */}
          <section className="warroom-surface rounded-xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#574239]/40 pb-3">
              <div>
                <h3 className="flex items-center gap-2 font-display text-base font-bold text-[#DFE3E4]">
                  <TrendingUp className="h-4 w-4 text-[#ACCEBF]" />
                  Tablero Fiscal (9 KPIs) y Contabilidad Pública
                </h3>
                <p className="text-xs text-[#CDC6B8]">
                  Aprobado vs. Vigente vs. Comprometido vs. Ejecutado · Resultado Primario vs. Global · Sostenibilidad de Deuda.
                </p>
              </div>
              <span className="rounded-lg border border-[#557568]/50 bg-[#557568]/20 px-3 py-1 font-mono-data text-xs font-bold text-[#ACCEBF]">
                Sostenibilidad Fiscal: {ledger.sustainabilityIndex} / 100
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { label: '1. Ingresos Recaudados', val: `${ledger.collectedRevenuePctGdp.toFixed(2)}% PIB`, sub: `Proy: ${ledger.projectedRevenuePctGdp.toFixed(2)}%` },
                { label: '2. Gasto Ejecutado', val: `${ledger.executedSpendingPctGdp.toFixed(2)}% PIB`, sub: `Vig: ${ledger.currentSpendingPctGdp.toFixed(2)}%` },
                { label: '3. Resultado Primario', val: `${ledger.primaryBalancePctGdp >= 0 ? '+' : ''}${ledger.primaryBalancePctGdp.toFixed(2)}% PIB`, sub: 'Sin intereses' },
                { label: '4. Intereses de Deuda', val: `${ledger.debtInterestPctGdp.toFixed(2)}% PIB`, sub: `Stock USD ${debtProfile.grossDebtBillionsUSD.toFixed(1)}B` },
                { label: '5. Resultado Global', val: `${ledger.globalBalancePctGdp >= 0 ? '+' : ''}${ledger.globalBalancePctGdp.toFixed(2)}% PIB`, sub: 'Déficit / Superávit' },
                { label: '6. Deuda Pública Bruta', val: `${m.grossDebtPctGdp.toFixed(1)}% PIB`, sub: `Neta USD ${debtProfile.netDebtBillionsUSD.toFixed(1)}B` },
                { label: '7. Costo Financiamiento', val: `${ledger.avgFinancingCostPct.toFixed(2)}%`, sub: `TPM BCU ${bcuRate.toFixed(2)}%` },
                { label: '8. Presión Tributaria', val: `${ledger.taxBurdenPctGdp.toFixed(2)}% PIB`, sub: 'Impuestos + BPS' },
                { label: '9. Comp. / Aprobado', val: `${ledger.committedSpendingPctGdp.toFixed(1)}% / ${ledger.approvedSpendingPctGdp.toFixed(1)}%`, sub: '% PIB presupuesto' },
                { label: 'Vencimientos Anuales', val: `USD ${debtProfile.annualMaturitiesBillionsUSD.toFixed(2)}B`, sub: `Caja Tesoro USD ${debtProfile.treasuryLiquidAssetsBillionsUSD.toFixed(2)}B` },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-3 text-xs">
                  <div className="text-[11px] text-[#CDC6B8]">{kpi.label}</div>
                  <div className="mt-0.5 font-mono-data text-sm font-bold text-[#DFE3E4]">{kpi.val}</div>
                  <div className="font-mono-data text-[10px] text-[#DEC1B4]">{kpi.sub}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#574239]/45 font-mono-data text-[10px] uppercase text-[#DEC1B4]">
                    <th className="py-2 pr-3">Proyección</th>
                    <th className="py-2 pr-3 text-right">Ingresos</th>
                    <th className="py-2 pr-3 text-right">Gasto Total</th>
                    <th className="py-2 pr-3 text-right">Intereses</th>
                    <th className="py-2 pr-3 text-right">Déficit Global</th>
                    <th className="py-2 text-right">Deuda Bruta</th>
                  </tr>
                </thead>
                <tbody>
                  {outlookRows.map((row) => (
                    <tr key={row.year} className="border-b border-[#574239]/25 font-mono-data">
                      <td className="py-2 pr-3 font-bold text-[#DFE3E4]">{row.year}</td>
                      <td className="py-2 pr-3 text-right text-[#ACCEBF]">{row.revenuePctGdp.toFixed(1)}%</td>
                      <td className="py-2 pr-3 text-right text-[#DFE3E4]">{row.spendingPctGdp.toFixed(1)}%</td>
                      <td className="py-2 pr-3 text-right text-[#DEC1B4]">{row.interestPctGdp.toFixed(1)}%</td>
                      <td className="py-2 pr-3 text-right font-bold text-[#FFB691]">{row.deficitPctGdp.toFixed(2)}%</td>
                      <td className="py-2 text-right font-bold text-[#DFE3E4]">{row.grossDebtPctGdp.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <MacroTrendChart history={gameState.macroHistory} />
        </>
      )}

      {/* SUBTAB 2: PRESUPUESTO NACIONAL LIBRE (16 ÁREAS SIN AUTO-REBALANCEO) */}
      {subTab === 'presupuesto' && (
        <section className="warroom-surface space-y-4 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#574239]/40 pb-3">
            <div>
              <h3 className="flex items-center gap-2 font-display text-lg font-bold text-[#DFE3E4]">
                <PieChart className="h-4 w-4 text-[#ACCEBF]" />
                Presupuesto Nacional Libre (16 Partidas en Miles de Millones UYU)
              </h3>
              <p className="text-xs text-[#CDC6B8]">
                Asignación independiente por ministerio y programa: aumentar Educación, Salud o Infraestructura no resta de ninguna otra cartera y recalcula el resultado fiscal al instante.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 font-mono-data text-xs">
              <span className="rounded-lg border border-[#574239]/50 bg-[#0A0F10] px-3 py-1.5 text-[#DFE3E4]">
                Vigente Total: <strong>$ {totalBudgetBillionsUYU.toFixed(1)}B UYU</strong> ({ledger.currentSpendingPctGdp.toFixed(1)}% PIB)
              </span>
              <span className="rounded-lg border border-[#574239]/50 bg-[#0A0F10] px-3 py-1.5 text-[#ACCEBF]">
                Ejecutado: <strong>$ {totalExecutedBillionsUYU.toFixed(1)}B UYU</strong>
              </span>
              <span className="rounded-lg border border-[#E87532]/50 bg-[#E87532]/15 px-3 py-1.5 text-[#FFB691]">
                Resultado Global: <strong>{ledger.globalBalancePctGdp >= 0 ? '+' : ''}{ledger.globalBalancePctGdp.toFixed(2)}% PIB</strong>
              </span>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {gameState.nationalBudget.map((item) => {
              const badge = NATURE_BADGE[item.spendingNature ?? 'corriente'];
              const isLockedDebt = item.category === 'intereses_otros';
              const minSlider = Math.max(2, Math.round((item.approvedBillionsUYU ?? item.annualBillionsUYU) * 0.45));
              const maxSlider = Math.max(30, Math.round((item.approvedBillionsUYU ?? item.annualBillionsUYU) * 1.9));
              return (
                <div key={item.category} className="rounded-xl border border-[#574239]/40 bg-[#1B2021] p-3.5 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-bold text-[#DFE3E4]">{item.label}</div>
                      <span className={`mt-1 inline-block rounded border px-1.5 py-0.5 font-mono-data text-[10px] ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="text-right font-mono-data">
                      <div className="text-sm font-bold text-[#FFB691]">
                        ${item.annualBillionsUYU.toFixed(1)}B UYU
                      </div>
                      <div className="text-[10px] text-[#ACCEBF]">
                        {(item.pctOfGdp ?? (item.annualBillionsUYU / nominalGdpUYU) * 100).toFixed(2)}% PIB · {item.sharePct}% del gasto
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center gap-2">
                    <input
                      type="range"
                      min={minSlider}
                      max={maxSlider}
                      step={0.5}
                      disabled={!canEditNational || isLockedDebt}
                      value={item.annualBillionsUYU}
                      onChange={(e) => updateFreeBudget(item.category, Number(e.target.value))}
                      className="flex-1 accent-[#E87532] disabled:opacity-45"
                    />
                    <input
                      type="number"
                      min={1}
                      max={Math.round(nominalGdpUYU * 0.22)}
                      step={1}
                      disabled={!canEditNational || isLockedDebt}
                      value={item.annualBillionsUYU}
                      onChange={(e) => updateFreeBudget(item.category, Number(e.target.value) || 1)}
                      className="w-20 rounded border border-[#574239]/60 bg-[#0A0F10] px-2 py-1 text-right font-mono-data text-xs text-[#DFE3E4] disabled:opacity-45"
                    />
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-1 border-t border-[#574239]/30 pt-2 font-mono-data text-[10px] text-[#DEC1B4]">
                    <span>Aprob: ${(item.approvedBillionsUYU ?? item.annualBillionsUYU).toFixed(1)}B</span>
                    <span>Comp: ${(item.committedBillionsUYU ?? item.annualBillionsUYU).toFixed(1)}B</span>
                    <span className="text-right text-[#ACCEBF]">
                      Ejec: ${(item.executedBillionsUYU ?? item.annualBillionsUYU).toFixed(1)}B ({item.executionEfficiency}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* SUBTAB 3: 8 FUENTES DE INGRESOS, PALANCAS Y FINANCIAMIENTO DEL DÉFICIT */}
      {subTab === 'ingresos_deuda' && (
        <div className="grid gap-5 lg:grid-cols-12">
          {/* 8 Fuentes de Ingresos + Alícuotas */}
          <section className="warroom-surface space-y-4 rounded-xl p-5 lg:col-span-7">
            <h3 className="flex items-center gap-2 font-display text-base font-bold text-[#DFE3E4]">
              <Banknote className="h-4 w-4 text-[#ACCEBF]" />
              8 Fuentes de Ingresos Públicos (Recaudación Efectiva vs. Proyectada)
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#574239]/45 font-mono-data text-[10px] uppercase text-[#DEC1B4]">
                    <th className="py-2 pr-2">Fuente</th>
                    <th className="py-2 px-2 text-right">Alícuota</th>
                    <th className="py-2 px-2 text-right">Proyectado</th>
                    <th className="py-2 px-2 text-right">Recaudado</th>
                    <th className="py-2 pl-2 text-right">% PIB</th>
                  </tr>
                </thead>
                <tbody>
                  {revenues.map((rev) => (
                    <tr key={rev.id} className="border-b border-[#574239]/25">
                      <td className="py-2 pr-2 font-medium text-[#DFE3E4]">{rev.label}</td>
                      <td className="py-2 px-2 text-right font-mono-data text-[#DEC1B4]">{rev.effectiveRatePct}%</td>
                      <td className="py-2 px-2 text-right font-mono-data text-[#CDC6B8]">${rev.projectedBillionsUYU.toFixed(1)}B</td>
                      <td className="py-2 px-2 text-right font-mono-data font-bold text-[#ACCEBF]">${rev.collectedBillionsUYU.toFixed(1)}B</td>
                      <td className="py-2 pl-2 text-right font-mono-data font-bold text-[#FFB691]">{rev.pctOfGdp.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-[#574239]/40 pt-4">
              <h4 className="flex items-center gap-2 font-display text-sm font-bold text-[#DFE3E4]">
                <Sliders className="h-4 w-4 text-[#E87532]" />
                Alícuotas Tributarias, Salariales y Apertura Exterior
              </h4>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 text-xs">
                {[
                  { key: 'incomeTaxRate', label: 'Impuestos directos (IRPF / IRAE)', min: 14, max: 32, step: 1, suffix: '%' },
                  { key: 'vatRate', label: 'IVA efectivo', min: 18, max: 24, step: 0.5, suffix: '%' },
                  { key: 'publicWageAdjustment', label: 'Pauta salarial pública real', min: -2, max: 5, step: 0.5, suffix: '%' },
                  { key: 'pensionAdjustment', label: 'Ajuste pasividades (sobre IMS)', min: -1, max: 4, step: 0.5, suffix: '%' },
                  { key: 'tradeOpenness', label: 'Apertura comercial exterior', min: 25, max: 90, step: 5, suffix: ' pts' },
                  { key: 'productiveIncentives', label: 'Incentivos COMAP e inversión', min: 10, max: 95, step: 5, suffix: ' pts' },
                ].map((ctl) => {
                  const val = levers[ctl.key as keyof FiscalPolicyLevers];
                  return (
                    <div key={ctl.key} className="rounded-lg border border-[#574239]/35 bg-[#1B2021] p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#DFE3E4]">{ctl.label}</span>
                        <span className="font-mono-data font-bold text-[#FFB691]">
                          {val}
                          {ctl.suffix}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={ctl.min}
                        max={ctl.max}
                        step={ctl.step}
                        disabled={!canEditNational}
                        value={val}
                        onChange={(e) => updateLever(ctl.key as keyof FiscalPolicyLevers, Number(e.target.value))}
                        className="mt-1.5 w-full accent-[#E87532] disabled:opacity-45"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Perfil de Deuda y Mix de Financiamiento del Déficit */}
          <section className="warroom-surface space-y-4 rounded-xl p-5 lg:col-span-5">
            <h3 className="flex items-center gap-2 font-display text-base font-bold text-[#DFE3E4]">
              <Landmark className="h-4 w-4 text-[#E87532]" />
              Perfil de Deuda y Financiamiento del Déficit
            </h3>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-2.5">
                <div className="text-[#CDC6B8]">Composición por Moneda</div>
                <div className="mt-1 font-mono-data font-bold text-[#DFE3E4]">
                  {debtProfile.usdSharePct}% USD · {debtProfile.uiSharePct}% UI · {debtProfile.uyuSharePct}% UYU
                </div>
              </div>
              <div className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-2.5">
                <div className="text-[#CDC6B8]">Tasa Media / Liquidez Tesoro</div>
                <div className="mt-1 font-mono-data font-bold text-[#ACCEBF]">
                  {debtProfile.weightedAvgRatePct}% · USD {debtProfile.treasuryLiquidAssetsBillionsUSD.toFixed(2)}B
                </div>
              </div>
            </div>

            <div className="space-y-3 border-t border-[#574239]/40 pt-3 text-xs">
              <div className="font-mono-data text-[10px] font-bold uppercase tracking-wider text-[#FFB691]">
                Mix de Financiamiento del Resultado Fiscal (Suma 100%)
              </div>
              {[
                { key: 'internalDebtUiUyuPct', label: 'Deuda Interna (Bonos en UI / Letras UYU)', max: 95 },
                { key: 'externalDebtMultilateralPct', label: 'Deuda Externa (Bonos USD / BID / CAF / BM)', max: 95 },
                { key: 'treasuryAssetsDrawPct', label: 'Uso de Liquidez del Tesoro (tope caja disponible)', max: 40 },
                { key: 'enterpriseDividendsPct', label: 'Dividendos reales de Empresas Públicas (con superávit)', max: 25 },
              ].map((item) => {
                const v = financingMix[item.key as keyof DeficitFinancingMix];
                return (
                  <div key={item.key} className="rounded-lg border border-[#574239]/35 bg-[#1B2021] p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#DFE3E4]">{item.label}</span>
                      <span className="font-mono-data font-bold text-[#FFB691]">{v}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={item.max}
                      disabled={!canEditNational}
                      value={v}
                      onChange={(e) =>
                        updateFinancingMixHandler(item.key as keyof DeficitFinancingMix, Number(e.target.value))
                      }
                      className="mt-1.5 w-full accent-[#557568] disabled:opacity-45"
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-[#574239]/55 bg-[#0A0F10] p-3 text-[11px] text-[#CDC6B8]">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#FFB691]" />
              <div>
                <strong className="text-[#DFE3E4]">Autonomía del BCU (Art. 196):</strong> El Poder Ejecutivo no puede emitir moneda ni utilizar reservas internacionales del BCU para gasto corriente. La tasa de política monetaria ({bcuRate.toFixed(2)}%) se ajusta de forma técnica ante desvíos inflacionarios.
              </div>
            </div>
          </section>
        </div>
      )}

      {/* SUBTAB 4: COLA DE REZAGOS TEMPORALES EN 4 HORIZONTES */}
      {subTab === 'rezagos' && (
        <section className="warroom-surface space-y-4 rounded-xl p-5">
          <div>
            <h3 className="flex items-center gap-2 font-display text-base font-bold text-[#DFE3E4]">
              <Clock className="h-4 w-4 text-[#E87532]" />
              Cola de Rezagos Temporales (Inmediato · Corto · Mediano · Largo Plazo)
            </h3>
            <p className="text-xs text-[#CDC6B8]">
              Las inversiones en educación, infraestructura, políticas públicas y shocks sectoriales maduran en horizontes realistas de 1 a 60 meses en lugar de alterar mágicamente la productividad en el día.
            </p>
          </div>

          {effectPipeline.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#574239]/50 bg-[#1B2021]/60 p-6 text-center text-xs text-[#CDC6B8]">
              No hay efectos diferidos pendientes en la cola económica actualmente. Al aprobar reformas, obras o ajustes fuertes de inversión estructural, aparecerán aquí con su horizonte de maduración.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {effectPipeline.map((item) => (
                <div key={item.id} className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono-data text-[10px] font-bold uppercase text-[#FFB691]">
                      {item.sourceType} · Horizonte {item.horizon}
                    </span>
                    <span className="font-mono-data text-[11px] font-bold text-[#ACCEBF]">
                      Faltan {item.remainingMonths} mes(es)
                    </span>
                  </div>
                  <div className="mt-1 font-semibold text-[#DFE3E4]">{item.label}</div>
                  <div className="mt-1.5 flex flex-wrap gap-2 font-mono-data text-[10px] text-[#DEC1B4]">
                    {item.gdpDelta ? <span>PIB {item.gdpDelta > 0 ? '+' : ''}{item.gdpDelta}%</span> : null}
                    {item.inflationDelta ? <span>IPC {item.inflationDelta > 0 ? '+' : ''}{item.inflationDelta}%</span> : null}
                    {item.unemploymentDelta ? <span>Desemp {item.unemploymentDelta > 0 ? '+' : ''}{item.unemploymentDelta}%</span> : null}
                    {item.productivityDelta ? <span>Prod {item.productivityDelta > 0 ? '+' : ''}{item.productivityDelta} pts</span> : null}
                    {item.povertyDelta ? <span>Pobreza {item.povertyDelta > 0 ? '+' : ''}{item.povertyDelta}%</span> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
