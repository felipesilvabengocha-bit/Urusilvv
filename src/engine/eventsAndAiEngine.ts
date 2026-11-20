import { MONTH_NAMES } from '../data/uruguayData';
import {
  DepartmentId,
  DifficultyConfig,
  DiplomaticPartner,
  GameEvent,
  GameEventOption,
  GameState,
} from '../types/game';
import { seededRandom } from './electoralEngine';

export interface CampaignActionDef {
  id: string;
  label: string;
  description: string;
  moneyCostUYU: number;
  politicalCapitalCost: number;
  riskPct: number;
  popularityDelta: number;
  momentumDelta: number;
  partyStrengthDelta: number;
}

export const CAMPAIGN_ACTIONS: CampaignActionDef[] = [
  {
    id: 'acto_masivo',
    label: 'Organizar acto central',
    description: 'Convocatoria abierta con militancia, referentes sectoriales y cobertura de prensa nacional.',
    moneyCostUYU: 950000,
    politicalCapitalCost: 4,
    riskPct: 18,
    popularityDelta: 2.2,
    momentumDelta: 1.6,
    partyStrengthDelta: 1.5,
  },
  {
    id: 'gira_interior',
    label: 'Recorrida por departamentos',
    description: 'Visita territorial a capitales departamentales, municipios rurales y medios locales.',
    moneyCostUYU: 700000,
    politicalCapitalCost: 3,
    riskPct: 10,
    popularityDelta: 1.8,
    momentumDelta: 1.4,
    partyStrengthDelta: 2.0,
  },
  {
    id: 'entrevista_central',
    label: 'Entrevista en horario central',
    description: 'Exposición televisiva y radial de propuestas económicas e institucionales.',
    moneyCostUYU: 250000,
    politicalCapitalCost: 2,
    riskPct: 24,
    popularityDelta: 2.0,
    momentumDelta: 1.5,
    partyStrengthDelta: 0.5,
  },
  {
    id: 'debate_nacional',
    label: 'Participar en debate público',
    description: 'Confrontación directa de programas con adversarios. Alto impacto si tu carisma es sólido.',
    moneyCostUYU: 150000,
    politicalCapitalCost: 5,
    riskPct: 30,
    popularityDelta: 3.4,
    momentumDelta: 2.5,
    partyStrengthDelta: 1.0,
  },
  {
    id: 'campana_medios',
    label: 'Pauta publicitaria y redes',
    description: 'Despliegue audiovisual en TV abierta, vía pública y segmentación digital.',
    moneyCostUYU: 1450000,
    politicalCapitalCost: 1,
    riskPct: 8,
    popularityDelta: 2.4,
    momentumDelta: 2.0,
    partyStrengthDelta: 0.8,
  },
  {
    id: 'reunion_sectores',
    label: 'Reunión con cámaras y sindicatos',
    description: 'Mesas programáticas con cámaras empresariales, cooperativas y PIT-CNT.',
    moneyCostUYU: 200000,
    politicalCapitalCost: 4,
    riskPct: 14,
    popularityDelta: 1.2,
    momentumDelta: 1.1,
    partyStrengthDelta: 1.8,
  },
  {
    id: 'estructura_territorial',
    label: 'Fortalecer comités y listas',
    description: 'Organización de delegados de mesa, clubes locales y coordinación de sublemas.',
    moneyCostUYU: 600000,
    politicalCapitalCost: 3,
    riskPct: 6,
    popularityDelta: 0.8,
    momentumDelta: 1.2,
    partyStrengthDelta: 3.5,
  },
  {
    id: 'acuerdo_electoral',
    label: 'Negociar acuerdo / sublema',
    description: 'Pacto electoral permitido por la Corte Electoral con sectores afines o socios de coalición.',
    moneyCostUYU: 300000,
    politicalCapitalCost: 8,
    riskPct: 22,
    popularityDelta: 1.5,
    momentumDelta: 2.4,
    partyStrengthDelta: 2.2,
  },
];

export interface PoliticalOperationDef {
  id: string;
  label: string;
  description: string;
  moneyCostUYU: number;
  politicalCapitalCost: number;
  baseSuccessPct: number;
  effectSummary: string;
}

export const POLITICAL_OPERATIONS: PoliticalOperationDef[] = [
  {
    id: 'op_negociar_dirigentes',
    label: 'Cumbre con dirigentes partidarios',
    description: 'Acercamiento reservado para recomponer afinidad política y estabilidad de bancadas.',
    moneyCostUYU: 150000,
    politicalCapitalCost: 6,
    baseSuccessPct: 72,
    effectSummary: '+8 afinidad con líderes afines y +5 estabilidad de coalición.',
  },
  {
    id: 'op_conferencia',
    label: 'Conferencia de prensa en Torre Ejecutiva / Palacio',
    description: 'Fija posición oficial sobre la agenda económica o social de la semana.',
    moneyCostUYU: 80000,
    politicalCapitalCost: 4,
    baseSuccessPct: 76,
    effectSummary: '+2.5 popularidad y +2 aprobación si logra buena recepción.',
  },
  {
    id: 'op_auditoria',
    label: 'Auditoría institucional transparente',
    description: 'Revisión técnica de compras públicas y organismos autónomos con informe público.',
    moneyCostUYU: 350000,
    politicalCapitalCost: 7,
    baseSuccessPct: 70,
    effectSummary: '+4 aprobación ciudadana, +3 confianza empresarial, posible fricción interna.',
  },
  {
    id: 'op_comision_inv',
    label: 'Comisión investigadora parlamentaria',
    description: 'Impulsa control democrático sobre gestión de entes o irregularidades administrativas.',
    moneyCostUYU: 120000,
    politicalCapitalCost: 9,
    baseSuccessPct: 64,
    effectSummary: '+3 capital político y desgaste del adversario cuestionado.',
  },
  {
    id: 'op_congreso_intendentes',
    label: 'Acuerdo en el Congreso de Intendentes',
    description: 'Coordina partidas del Art. 214, caminería rural y SUCIVE con los 19 gobiernos departamentales.',
    moneyCostUYU: 400000,
    politicalCapitalCost: 8,
    baseSuccessPct: 75,
    effectSummary: '+4 calidad de servicios departamentales y mejora territorial en todo el país.',
  },
  {
    id: 'op_mediacion_social',
    label: 'Mesa de mediación laboral y productiva',
    description: 'Instancia tripartita en el MTSS para encauzar conflictos sindicales o empresariales.',
    moneyCostUYU: 200000,
    politicalCapitalCost: 7,
    baseSuccessPct: 71,
    effectSummary: '+5 confianza sindical y +4 confianza empresarial.',
  },
];

/**
 * Genera acontecimientos contextuales reales conectados con el estado actual del país
 */
export function maybeGenerateContextualEvent(
  state: GameState,
  difficulty: DifficultyConfig
): GameEvent | null {
  const unresolvedCount = state.events.filter((e) => !e.resolved).length;
  if (unresolvedCount >= 2) return null;

  const rng = seededRandom(`${state.id}-evt-${state.currentYear}-${state.currentMonth}`);
  const roll = rng();
  if (roll > 0.58 * difficulty.crisisFrequency) return null;

  const dateLabel = `${MONTH_NAMES[state.currentMonth - 1]} ${state.currentYear}`;
  const m = state.macro;
  const ind = state.politicalIndicators;

  // Pool ponderado por condiciones reales del país
  const candidates: GameEvent[] = [];

  if (m.inflationPct > 6.5) {
    candidates.push({
      id: `evt_inf_${state.currentYear}_${state.currentMonth}`,
      domain: 'economia',
      title: 'Presión inflacionaria sobre la canasta básica y tarifas',
      description: `La inflación interanual escaló a ${m.inflationPct.toFixed(1)}%, superando el techo del rango meta del BCU (3%–6%).`,
      context: 'Sindicatos reclaman correctivos salariales adelantados y cámaras comerciales advierten pérdida de poder de compra.',
      dateLabel,
      resolved: false,
      options: [
        {
          id: 'opt_bcu',
          label: 'Respaldar suba de tasa de interés del BCU y moderar gasto',
          description: 'Señal ortodoxa de contención monetaria y disciplina fiscal.',
          moneyCostUYU: 0,
          politicalCapitalCost: 6,
          successProbability: 82,
          expectedImpactSummary: '-0.8% inflación, -0.3% PIB corto plazo, +5 confianza empresarial.',
          onSuccess: {
            inflationDelta: -0.8,
            gdpDelta: -0.25,
            businessTrust: 5,
            unionTrust: -3,
            riskDelta: -8,
            note: 'El mercado financiero valoró el ancla antiinflacionaria y bajó el riesgo país.',
          },
          onFailure: {
            approval: -3,
            coalitionStability: -4,
            note: 'El enfriamiento económico generó críticas desde sectores productivos.',
          },
        },
        {
          id: 'opt_acuerdo_precios',
          label: 'Acuerdo voluntario de precios y rebaja focalizada de IVA',
          description: 'Mantiene consumo popular con impacto fiscal moderado.',
          moneyCostUYU: 450000,
          politicalCapitalCost: 5,
          successProbability: 68,
          expectedImpactSummary: '-0.5% inflación, +3 aprobación, +0.3% déficit fiscal.',
          onSuccess: {
            inflationDelta: -0.5,
            approval: 3,
            deficitDelta: 0.3,
            unionTrust: 4,
            note: 'La medida alivió la canasta básica aunque presionó las cuentas públicas.',
          },
          onFailure: {
            approval: -2,
            riskDelta: 6,
            note: 'El acuerdo tuvo acatamiento parcial y no frenó la inercia de precios.',
          },
        },
      ],
    });
  }

  if (m.fiscalDeficitPctGdp > 3.6 || m.countryRiskBps > 125) {
    candidates.push({
      id: `evt_fiscal_${state.currentYear}_${state.currentMonth}`,
      domain: 'economia',
      title: 'Advertencia de calificadoras por déficit y financiamiento',
      description: `Con un déficit de ${m.fiscalDeficitPctGdp.toFixed(1)}% del PIB y riesgo país en ${m.countryRiskBps} pb, crecen los costos de emisión soberana.`,
      context: 'El MEF advierte menor margen para nuevas partidas presupuestales sin respaldo de ingresos.',
      dateLabel,
      resolved: false,
      options: [
        {
          id: 'opt_ajuste',
          label: 'Aplicar tope de ejecución del 4% en gastos no prioritarios',
          description: 'Preserva grado inversor pero tensiona ministerios y sindicatos estatales.',
          moneyCostUYU: 0,
          politicalCapitalCost: 8,
          successProbability: 78,
          expectedImpactSummary: '-0.5% déficit, -12 pb riesgo país, -3 confianza sindical.',
          onSuccess: {
            deficitDelta: -0.5,
            riskDelta: -12,
            businessTrust: 6,
            unionTrust: -4,
            approval: -2,
            note: 'Las calificadoras mantuvieron la perspectiva estable sobre la deuda uruguaya.',
          },
          onFailure: {
            coalitionStability: -5,
            approval: -4,
            note: 'Recortes operativos provocaron conflicto en organismos públicos.',
          },
        },
        {
          id: 'opt_multilateral',
          label: 'Negociar líneas contingentes con BID/CAF y defender inversión',
          description: 'Sostiene obra pública mientras se busca acelerar crecimiento.',
          moneyCostUYU: 200000,
          politicalCapitalCost: 5,
          successProbability: 65,
          expectedImpactSummary: '+0.2% PIB, -5 pb riesgo país, +2 aprobación.',
          onSuccess: {
            gdpDelta: 0.2,
            riskDelta: -5,
            approval: 2,
            note: 'El financiamiento multilateral dio oxígeno sin frenar la inversión.',
          },
          onFailure: {
            riskDelta: 10,
            businessTrust: -4,
            note: 'Los mercados interpretaron la medida como postergación del ajuste fiscal.',
          },
        },
      ],
    });
  }

  if (ind.unionConfidence < 55 || m.realWageGrowthPct < 0.8) {
    candidates.push({
      id: `evt_sindicatos_${state.currentYear}_${state.currentMonth}`,
      domain: 'sociedad',
      title: 'Movilización sindical y reclamos en Consejos de Salarios',
      description: 'Confederaciones sindicales convocan a paro parcial reclamando recuperación salarial y presupuesto educativo.',
      context: `Salario real en ${m.realWageGrowthPct.toFixed(1)}% anual y confianza sindical en ${Math.round(ind.unionConfidence)}/100.`,
      dateLabel,
      resolved: false,
      options: [
        {
          id: 'opt_mesa',
          label: 'Convocar mesa tripartita y ofrecer cláusula gatillo por inflación',
          description: 'Desactiva el conflicto gremial a cambio de mayor compromiso salarial.',
          moneyCostUYU: 300000,
          politicalCapitalCost: 6,
          successProbability: 78,
          expectedImpactSummary: '+9 confianza sindical, +2 aprobación, -2 confianza empresarial.',
          onSuccess: {
            unionTrust: 9,
            businessTrust: -2,
            approval: 2,
            inflationDelta: 0.25,
            note: 'Se alcanzó un convenio puente que normalizó la actividad.',
          },
          onFailure: {
            unionTrust: 2,
            approval: -3,
            note: 'Las bases sindicales consideraron insuficiente la propuesta.',
          },
        },
        {
          id: 'opt_firmeza',
          label: 'Mantener pautas salariales oficiales sin concesiones fiscales',
          description: 'Cuida la competitividad empresarial pero eleva la conflictividad.',
          moneyCostUYU: 0,
          politicalCapitalCost: 4,
          successProbability: 66,
          expectedImpactSummary: '+5 confianza empresarial, -6 confianza sindical.',
          onSuccess: {
            businessTrust: 5,
            unionTrust: -6,
            riskDelta: -4,
            note: 'Se sostuvieron las pautas macroeconómicas pese a paros sectoriales.',
          },
          onFailure: {
            approval: -4,
            unionTrust: -9,
            note: 'El conflicto se extendió a servicios esenciales y erosionó la imagen pública.',
          },
        },
      ],
    });
  }

  if (ind.coalitionStability < 62) {
    candidates.push({
      id: `evt_coal_${state.currentYear}_${state.currentMonth}`,
      domain: 'politica',
      title: 'Tensión en la interna partidaria y amenaza de disidencia parlamentaria',
      description: 'Sectores internos y socios legislativos cuestionan el rumbo de gestión y exigen cambios programáticos.',
      context: `Estabilidad de bloque en ${Math.round(ind.coalitionStability)}/100.`,
      dateLabel,
      resolved: false,
      options: [
        {
          id: 'opt_pacto_interno',
          label: 'Ceder espacio en la agenda parlamentaria y recomponer diálogo',
          description: 'Preserva la mayoría legislativa fortaleciendo la unidad política.',
          moneyCostUYU: 0,
          politicalCapitalCost: 9,
          successProbability: 80,
          expectedImpactSummary: '+12 estabilidad de bloque, +4 fortaleza partidaria.',
          onSuccess: {
            coalitionStability: 12,
            partyStrength: 4,
            note: 'Las bancadas reafirmaron el acuerdo programático común.',
          },
          onFailure: {
            coalitionStability: -4,
            popularity: -2,
            note: 'El acuerdo fue frágil y persistieron reproches públicos.',
          },
        },
        {
          id: 'opt_liderazgo',
          label: 'Reafirmar conducción ejecutiva sin concesiones sectoriales',
          description: 'Proyecta autoridad ante la opinión pública con riesgo de ruptura parlamentaria.',
          moneyCostUYU: 0,
          politicalCapitalCost: 4,
          successProbability: 58,
          expectedImpactSummary: '+3 popularidad si funciona; -10 estabilidad si fracasa.',
          onSuccess: {
            popularity: 3,
            coalitionStability: 4,
            note: 'Los sectores disidentes acataron la conducción ante el respaldo público.',
          },
          onFailure: {
            coalitionStability: -10,
            approval: -4,
            note: 'Un sector amenazó con votar junto a la oposición proyectos clave.',
          },
        },
      ],
    });
  }

  // Evento regional/internacional siempre disponible según contexto Mercosur
  candidates.push({
    id: `evt_mercosur_${state.currentYear}_${state.currentMonth}`,
    domain: 'internacional',
    title: 'Coyuntura regional en el Mercosur y precios de exportación',
    description: 'Cambios cambiarios en vecinos del Mercosur y demanda asiática alteran la competitividad de carne, lácteos, arroz y software.',
    context: `Exportaciones actuales en USD ${m.exportsBillionsUSD.toFixed(2)}B y dólar en $${m.exchangeRateUYU.toFixed(2)}.`,
    dateLabel,
    resolved: false,
    options: [
      {
        id: 'opt_mercosur_flex',
        label: 'Impulsar flexibilización comercial y acuerdos bilaterales extra-zona',
        description: 'Prioriza apertura con China, UE y Chile generando fricción táctica con socios Mercosur.',
        moneyCostUYU: 250000,
        politicalCapitalCost: 6,
        successProbability: 72,
        expectedImpactSummary: '+0.35% PIB, +6 relación con China/UE, -4 con Argentina/Brasil.',
        onSuccess: {
          gdpDelta: 0.35,
          businessTrust: 5,
          diplomaticDelta: { china: 6, ue: 5, argentina: -4, brasil: -3 },
          note: 'Nuevos protocolos sanitarios y cupos impulsaron exportaciones agroindustriales y de servicios.',
        },
        onFailure: {
          diplomaticDelta: { argentina: -6, brasil: -5 },
          approval: -2,
          note: 'Trabas burocráticas regionales demoraron el acceso a mercados.',
        },
      },
      {
        id: 'opt_integracion',
        label: 'Priorizar coordinación fronteriza y cadenas productivas del Mercosur',
        description: 'Consolida vínculos con Brasil y Argentina y reduce tensiones aduaneras.',
        moneyCostUYU: 200000,
        politicalCapitalCost: 4,
        successProbability: 82,
        expectedImpactSummary: '+7 relación con Brasil/Argentina, +0.2% PIB.',
        onSuccess: {
          gdpDelta: 0.2,
          diplomaticDelta: { brasil: 7, argentina: 7, paraguay: 5 },
          note: 'Se destrabaron pasos fronterizos e interconexión eléctrica regional.',
        },
        onFailure: {
          gdpDelta: -0.1,
          note: 'Asimetrías cambiarias limitaron el efecto comercial del acuerdo.',
        },
      },
    ],
  });

  // Evento social positivo o de gestión departamental
  candidates.push({
    id: `evt_infra_${state.currentYear}_${state.currentMonth}`,
    domain: 'sociedad',
    title: 'Demanda de inversión territorial y servicios en el interior',
    description: 'Intendentes, alcaldes y productores rurales solicitan acelerar caminería, saneamiento y conectividad hospitalaria.',
    context: 'El Congreso de Intendentes eleva una agenda de prioridades para los 19 departamentos.',
    dateLabel,
    resolved: false,
    options: [
      {
        id: 'opt_fondo_interior',
        label: 'Ampliar Fondo de Desarrollo del Interior y obras municipales',
        description: 'Mejora servicios y empleo regional con impacto fiscal moderado.',
        moneyCostUYU: 550000,
        politicalCapitalCost: 5,
        successProbability: 85,
        expectedImpactSummary: '+4 popularidad, -0.25% desempleo, +0.25% déficit.',
        onSuccess: {
          popularity: 4,
          approval: 3,
          unemploymentDelta: -0.25,
          deficitDelta: 0.25,
          note: 'Las obras departamentales dinamizaron empleo local y respaldo en el interior.',
        },
      },
      {
        id: 'opt_ppp',
        label: 'Fomentar participación público-privada (PPP) por etapas',
        description: 'Menor presión fiscal inmediata, aunque ejecución más gradual.',
        moneyCostUYU: 150000,
        politicalCapitalCost: 4,
        successProbability: 70,
        expectedImpactSummary: '+3 confianza empresarial, +0.2% PIB.',
        onSuccess: {
          businessTrust: 4,
          gdpDelta: 0.2,
          approval: 1,
          note: 'Consorcios privados presentaron ofertas competitivas para corredores viales.',
        },
        onFailure: {
          approval: -2,
          note: 'Demoras contractuales postergaron el inicio de obras.',
        },
      },
    ],
  });

  const idx = Math.floor(rng() * candidates.length);
  return candidates[idx] ?? null;
}

/**
 * Comportamiento autónomo de los partidos rivales controlados por IA cada mes.
 */
export function processAIPartiesTurn(
  state: GameState,
  difficulty: DifficultyConfig
): { updatedParties: GameState['parties']; aiLogNote: string | null } {
  const rng = seededRandom(`${state.id}-ai-${state.currentYear}-${state.currentMonth}`);
  let aiLogNote: string | null = null;

  const updatedParties = state.parties.map((party) => {
    if (party.id === state.player.partyId) {
      // Decaimiento gradual del momentum de campaña si no se sostiene
      return {
        ...party,
        campaignMomentum: Number((party.campaignMomentum * 0.88).toFixed(2)),
      };
    }

    let pollDelta = 0;
    let momentumDelta = party.campaignMomentum * 0.85;

    // Comportamiento diferenciado por personalidad
    if (party.aiPersonality === 'disruptivo') {
      // Crece cuando hay descontento con la economía o baja aprobación
      if (state.macro.governmentApprovalPct < 45 || state.macro.inflationPct > 6.5) {
        pollDelta += 0.25 * difficulty.aiAggressiveness;
      } else {
        pollDelta -= 0.1;
      }
    } else if (party.aiPersonality === 'pragmatico') {
      // Despliega campaña sostenida en meses electorales
      if (state.careerPhase === 'campana') {
        momentumDelta += (rng() * 0.8) * difficulty.aiAggressiveness;
        pollDelta += (rng() - 0.42) * 0.45 * difficulty.aiAggressiveness;
      }
    } else if (party.aiPersonality === 'reformista') {
      if (state.macro.povertyPct > 16 || state.macro.realWageGrowthPct < 1.2) {
        pollDelta += 0.22 * difficulty.aiAggressiveness;
      }
    } else if (party.aiPersonality === 'conservador') {
      if (state.macro.fiscalDeficitPctGdp > 3.5) {
        pollDelta += 0.18 * difficulty.aiAggressiveness;
      }
    }

    // Desgaste o premio al oficialismo nacional
    if (party.id === state.nationalPresidentPartyId) {
      pollDelta += (state.politicalIndicators.governmentApproval - 47) * 0.025;
    }

    const nextShare = Math.max(0.25, Math.min(58, Number((party.currentPollShare + pollDelta).toFixed(2))));
    return {
      ...party,
      currentPollShare: nextShare,
      campaignMomentum: Number(Math.max(-10, Math.min(12, momentumDelta)).toFixed(2)),
    };
  });

  if (state.careerPhase === 'campana' && rng() < 0.35) {
    const rivals = updatedParties.filter((p) => p.id !== state.player.partyId && p.baseNationalShare > 5);
    if (rivals.length > 0) {
      const picked = rivals[Math.floor(rng() * rivals.length)];
      aiLogNote = `${picked.name} desplegó gira nacional y pauta en el interior fortaleciendo sus listas departamentales.`;
    }
  }

  return { updatedParties, aiLogNote };
}

export function applyDiplomaticAction(
  state: GameState,
  partnerId: DiplomaticPartner['id'],
  actionType: 'cumbre' | 'comercio' | 'inversion'
): { nextState: GameState; message: string } {
  const partner = state.diplomacy.find((d) => d.id === partnerId);
  if (!partner) return { nextState: state, message: 'Socio diplomático no encontrado.' };

  const costMoney = actionType === 'cumbre' ? 250000 : actionType === 'comercio' ? 400000 : 350000;
  const costCap = actionType === 'cumbre' ? 4 : 6;
  if (state.player.campaignFundsUYU < costMoney) {
    return {
      nextState: state,
      message: `Fondos insuficientes ($${(costMoney / 1000).toFixed(0)} mil UYU requeridos para esta gestión diplomática).`,
    };
  }
  if (state.player.politicalCapital < costCap) {
    return { nextState: state, message: 'Capital político insuficiente para esta gestión diplomática.' };
  }

  let relDelta = 0;
  let invDelta = 0;
  let exportBoost = 0;
  let detail = '';

  if (actionType === 'cumbre') {
    relDelta = 6;
    detail = `Misión diplomática bilateral con ${partner.name} elevó el diálogo político (+6 relación).`;
  } else if (actionType === 'comercio') {
    relDelta = 4;
    exportBoost = 0.18;
    detail = `Acuerdo sanitario y arancelario con ${partner.name} impulsa exportaciones (+USD ${exportBoost}B).`;
  } else {
    relDelta = 3;
    invDelta = 5;
    detail = `Ronda de inversiones con ${partner.name} mejora flujo de IED (+5 atractivo inversor).`;
  }

  const nextDiplomacy = state.diplomacy.map((d) =>
    d.id === partnerId
      ? {
          ...d,
          relationScore: Math.min(100, d.relationScore + relDelta),
          investmentFlowScore: Math.min(100, d.investmentFlowScore + invDelta),
          tradeVolumeBillionsUSD: Number((d.tradeVolumeBillionsUSD + exportBoost).toFixed(2)),
        }
      : d
  );

  const nextState: GameState = {
    ...state,
    diplomacy: nextDiplomacy,
    macro: {
      ...state.macro,
      exportsBillionsUSD: Number((state.macro.exportsBillionsUSD + exportBoost).toFixed(2)),
    },
    player: {
      ...state.player,
      campaignFundsUYU: Math.max(0, state.player.campaignFundsUYU - costMoney),
      politicalCapital: Math.max(0, state.player.politicalCapital - costCap),
    },
    history: [
      {
        id: `dip_${Date.now()}`,
        dateLabel: `${MONTH_NAMES[state.currentMonth - 1]} ${state.currentYear}`,
        category: 'diplomacia',
        title: `Diplomacia con ${partner.name}`,
        detail,
      },
      ...state.history,
    ],
  };

  return { nextState, message: detail };
}

export function visitDepartmentInCampaign(
  state: GameState,
  deptId: DepartmentId
): { nextState: GameState; message: string } {
  const dept = state.departments.find((d) => d.id === deptId);
  if (!dept) return { nextState: state, message: 'Departamento inválido.' };
  const cost = 450000;
  if (state.player.campaignFundsUYU < cost) {
    return { nextState: state, message: 'Fondos insuficientes ($450.000 UYU requeridos).' };
  }

  const nextDepartments = state.departments.map((d) => {
    if (d.id !== deptId) return d;
    const prevMult = d.partyMultipliers[state.player.partyId] ?? 1.0;
    return {
      ...d,
      partyMultipliers: {
        ...d.partyMultipliers,
        [state.player.partyId]: Number(Math.min(1.9, prevMult + 0.04).toFixed(3)),
      },
    };
  });

  const nextParties = state.parties.map((p) =>
    p.id === state.player.partyId
      ? { ...p, campaignMomentum: Number(Math.min(15, p.campaignMomentum + 0.9).toFixed(2)) }
      : p
  );

  const msg = `Recorrida territorial en ${dept.name} (${dept.capital}): fortaleciste tus listas departamentales (+4% tracción local).`;

  return {
    nextState: {
      ...state,
      departments: nextDepartments,
      parties: nextParties,
      player: {
        ...state.player,
        campaignFundsUYU: state.player.campaignFundsUYU - cost,
        attributes: {
          ...state.player.attributes,
          popularity: Math.min(98, state.player.attributes.popularity + 1),
        },
      },
      history: [
        {
          id: `tour_${Date.now()}`,
          dateLabel: `${MONTH_NAMES[state.currentMonth - 1]} ${state.currentYear}`,
          category: 'campana',
          title: `Gira por ${dept.name}`,
          detail: msg,
        },
        ...state.history,
      ],
    },
    message: msg,
  };
}

export function resolveGameEvent(
  state: GameState,
  evt: GameEvent,
  opt: GameEventOption
): { nextState: GameState; outcomeText: string; succeeded: boolean } {
  const rng = seededRandom(`${state.id}-res-${evt.id}-${opt.id}`);
  const succeeded = rng() * 100 < opt.successProbability;
  const eff = succeeded ? opt.onSuccess : opt.onFailure;

  const nextMacro = { ...state.macro };
  const nextInd = { ...state.politicalIndicators };
  let nextDiplomacy = [...state.diplomacy];
  let nextParties = state.parties;
  let nextPop = state.player.attributes.popularity;

  if (eff) {
    if (eff.gdpDelta) nextMacro.gdpGrowthPct = Number((nextMacro.gdpGrowthPct + eff.gdpDelta).toFixed(2));
    if (eff.inflationDelta) nextMacro.inflationPct = Number(Math.max(1.5, nextMacro.inflationPct + eff.inflationDelta).toFixed(2));
    if (eff.unemploymentDelta) nextMacro.unemploymentPct = Number(Math.max(4, nextMacro.unemploymentPct + eff.unemploymentDelta).toFixed(2));
    if (eff.deficitDelta) nextMacro.fiscalDeficitPctGdp = Number((nextMacro.fiscalDeficitPctGdp + eff.deficitDelta).toFixed(2));
    if (eff.riskDelta) nextMacro.countryRiskBps = Math.max(45, nextMacro.countryRiskBps + eff.riskDelta);
    if (eff.approval) {
      nextInd.governmentApproval = Math.max(15, Math.min(85, Number((nextInd.governmentApproval + eff.approval).toFixed(1))));
      nextMacro.governmentApprovalPct = nextInd.governmentApproval;
    }
    if (eff.coalitionStability) nextInd.coalitionStability = Math.max(20, Math.min(98, Number((nextInd.coalitionStability + eff.coalitionStability).toFixed(1))));
    if (eff.businessTrust) nextInd.businessConfidence = Math.max(15, Math.min(95, Number((nextInd.businessConfidence + eff.businessTrust).toFixed(1))));
    if (eff.unionTrust) nextInd.unionConfidence = Math.max(15, Math.min(95, Number((nextInd.unionConfidence + eff.unionTrust).toFixed(1))));
    if (eff.partyStrength) {
      nextInd.partyStrength = Math.max(20, Math.min(100, Number((nextInd.partyStrength + eff.partyStrength).toFixed(1))));
      nextParties = state.parties.map((p) =>
        p.id === state.player.partyId
          ? { ...p, partyStrength: Math.max(20, Math.min(100, Number((p.partyStrength + eff.partyStrength!).toFixed(1)))) }
          : p
      );
    }
    if (eff.popularity) nextPop = Math.max(12, Math.min(98, Number((nextPop + eff.popularity).toFixed(1))));
    if (eff.diplomaticDelta) {
      const dMap = eff.diplomaticDelta;
      nextDiplomacy = nextDiplomacy.map((d) => ({
        ...d,
        relationScore: Math.max(10, Math.min(100, d.relationScore + (dMap[d.id] ?? 0))),
      }));
    }
  }

  const outcomeText = eff?.note ?? 'Decisión registrada y ejecutada por el Poder Ejecutivo.';
  const nextEvents = state.events.map((e) =>
    e.id === evt.id
      ? { ...e, resolved: true, chosenOptionId: opt.id, resolutionOutcome: outcomeText }
      : e
  );

  const nextState: GameState = {
    ...state,
    events: nextEvents,
    parties: nextParties,
    macro: nextMacro,
    politicalIndicators: nextInd,
    diplomacy: nextDiplomacy,
    player: {
      ...state.player,
      campaignFundsUYU: Math.max(0, state.player.campaignFundsUYU - opt.moneyCostUYU),
      politicalCapital: Math.max(0, state.player.politicalCapital - opt.politicalCapitalCost),
      attributes: { ...state.player.attributes, popularity: nextPop },
    },
    history: [
      {
        id: `evt_res_${Date.now()}`,
        dateLabel: `${MONTH_NAMES[state.currentMonth - 1]} ${state.currentYear}`,
        category: 'evento',
        title: `Decisión ejecutiva: ${evt.title}`,
        detail: `${opt.label} → ${outcomeText}`,
      },
      ...state.history,
    ],
  };

  return { nextState, outcomeText, succeeded };
}

