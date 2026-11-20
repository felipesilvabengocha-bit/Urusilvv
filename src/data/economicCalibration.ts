import { NationalBudgetCategory } from '../types/game';

/**
 * Parametrización económica centralizada para la República Oriental del Uruguay.
 * Todas las elasticidades, metas del BCU y ponderadores fiscales se definen aquí
 * para evitar constantes dispersas o contradicciones entre módulos.
 */
export const ECONOMIC_CALIBRATION = {
  // Meta inflacionaria y regla de Taylor simplificada del BCU (Art. 196 autonomía técnica)
  bcu: {
    inflationTargetCenterPct: 4.5,
    inflationTargetFloorPct: 3.0,
    inflationTargetCeilingPct: 6.0,
    neutralNominalRatePct: 8.5,
    taylorInflationWeight: 1.25,
    taylorOutputGapWeight: 0.45,
    minRatePct: 4.0,
    maxRatePct: 18.0,
  },

  // Crecimiento tendencial y brecha de producto
  growth: {
    potentialGrowthBasePct: 2.2,
    investmentSensitivity: 0.28,
    tradeBalanceSensitivity: 0.16,
    productivitySensitivity: 0.055,
    consumptionSensitivity: 0.24,
    interestRateDragSensitivity: 0.18, // Impacto de suba de TPM real por encima de neutral
  },

  // Inflación multicausal (demanda + costos + expectativas/cambiario - ancla monetaria)
  inflation: {
    demandGapWeight: 0.34,
    wageCostPassThrough: 0.36,
    tariffCostPassThrough: 0.14,
    fxPassThrough: 0.26,
    fiscalDominanceExpectationWeight: 0.42,
    bcuRateDampening: 0.28,
    vatPassThrough: 0.28,
  },

  // Elasticidades tributarias y bases imponibles (8 fuentes de ingresos)
  revenue: {
    vatBasePctGdp: 8.35, // Base recaudatoria al 22%
    irpfBasePctGdp: 3.97,
    iraeBasePctGdp: 3.07,
    patrimonioBasePctGdp: 1.20,
    otrosTributariosBasePctGdp: 2.68,
    bpsBasePctGdp: 6.35,
    otrosIngresosBasePctGdp: 1.04,
  },

  // Deuda, riesgo país y tipo de cambio
  debtAndMarkets: {
    baseCountryRiskBps: 76,
    deficitRiskSensitivityBps: 18,
    debtRiskSensitivityBps: 1.45,
    mefManagementRiskOffset: 1.1,
    maturitiesShareOfDebt: 0.115,
  },

  // Multiplicadores fiscales estructurales de las 16 partidas (sobre gasto ejecutado % PIB)
  // Referencias base (% del PIB esperado en escenario equilibrado)
  budgetBaselinePctGdp: {
    educacion: 4.49,
    salud: 4.07,
    seguridad: 1.82,
    jubilaciones: 7.72,
    desarrollo_social: 2.67,
    infraestructura: 1.91,
    transporte: 1.07,
    vivienda: 0.79,
    ciencia_tecnologia: 0.51,
    desarrollo_productivo: 0.67,
    cultura: 0.39,
    medioambiente: 0.45,
    defensa: 0.90,
    relaciones_exteriores: 0.25,
    administracion: 0.56,
    intereses_otros: 2.47,
  } as Record<NationalBudgetCategory, number>,
};
