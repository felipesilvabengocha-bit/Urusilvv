import { OFFICES } from '../data/uruguayData';
import { GameState, OfficeId } from '../types/game';

export interface PlayerCapabilities {
  currentOffice: OfficeId | null;
  targetOffice: OfficeId;
  isCampaigning: boolean;
  isIncumbentPresident: boolean;
  isSittingOtherOffice: boolean;
  isInNationalOpposition: boolean;
  currentOfficeTitle: string;
  targetOfficeTitle: string;
  roleSummaryLabel: string;

  // Campaña, Partido y Programa (Candidato / Dirigente Partidario)
  canCampaign: boolean;
  canBuildProgram: boolean;
  canManagePartyAndSectors: boolean;
  canNegotiateAlliances: boolean;
  canSeekParliamentarySupport: boolean;
  canCoordinatePartyStrategy: boolean;
  canNegotiateCandidacies: boolean;

  // Poder Ejecutivo Nacional (Exclusivo Presidente en ejercicio)
  canAppointNationalMinisters: boolean;
  canDirectCabinetCouncil: boolean;
  canEditNationalBudgetAndFiscal: boolean;
  canSignPresidentialDecrees: boolean;
  canDirectMinistriesAndStateAgencies: boolean;
  canDirectForeignPolicyExecutive: boolean;
  canResolveNationalEventsAsExecutive: boolean;

  // Poder Legislativo Nacional (Presidente envía leyes y promulga/veta; Legisladores y VP redactan, debaten, votan y controlan)
  canIntroduceNationalBills: boolean;
  canVoteOrSubmitInParliament: boolean;
  canCastLegislativeVote: boolean;
  canVoteInSenate: boolean;
  canVoteInDeputies: boolean;
  canVoteInAsambleaGeneral: boolean;
  canVoteVeniaInSenate: boolean;
  canPromulgateOrVetoBills: boolean;
  canTriggerCensura: boolean;
  canParticipateInCommittees: boolean;
  canNegotiateVotesInParliament: boolean;
  canOversightGovernment: boolean;

  // Gobierno Departamental y Municipal (Intendente / Edil / Alcalde)
  canAdministerDepartamentalBudget: boolean;
  canAppointDepartamentalTeam: boolean;
  canExecuteDepartamentalWorks: boolean;
  canCoordinateMunicipalities: boolean;
  canSubmitToJunta: boolean;
  canVoteInJunta: boolean;
  canControlIntendente: boolean;

  // Explicaciones contextuales claras cuando una acción está bloqueada
  lockReasons: {
    executiveNational: string;
    nationalBudget: string;
    foreignPolicy: string;
    nationalEvents: string;
    parliamentActions: string;
    departamentalExecutive: string;
    juntaActions: string;
    campaignActions: string;
  };
}

function getOfficeName(id: OfficeId | null): string {
  if (!id) return 'Sin cargo público electivo';
  return OFFICES.find((o) => o.id === id)?.name ?? id;
}

/**
 * REGLA FUNDAMENTAL:
 * El poder institucional del jugador depende estrictamente de `currentOffice`
 * (el cargo que ejerce hoy), nunca de `targetOffice` (el cargo al que aspira).
 */
export function getPlayerCapabilities(state: GameState): PlayerCapabilities {
  const current = state.player.currentOffice;
  const target = state.player.targetOffice;
  const isCampaigning = state.careerPhase === 'campana';
  const targetDept = state.departments.find((d) => d.id === state.player.targetDepartment);
  const deptName = targetDept?.name ?? 'tu departamento';

  const currentOfficeTitle = getOfficeName(current);
  const targetOfficeTitle = getOfficeName(target);

  const isPresident = current === 'presidente';
  const isVicePresident = current === 'vicepresidente';
  const isSenatorOrDeputy = current === 'senador' || current === 'diputado';
  const isIntendente = current === 'intendente';
  const isEdil = current === 'edil';
  const isAlcalde = current === 'alcalde';
  const isPartyLeader = current === 'dirigente_partidario';

  const isIncumbentPresident = isPresident && isCampaigning;
  const isSittingOtherOffice = current !== null && !isPresident && isCampaigning;
  const isInNationalOpposition =
    state.nationalPresidentPartyId !== state.player.partyId &&
    !state.coalitionPartyIds.includes(state.player.partyId);

  let roleSummaryLabel = currentOfficeTitle;
  if (!current && isCampaigning) {
    roleSummaryLabel = `Candidato a ${targetOfficeTitle} (sin cargo público)`;
  } else if (isIncumbentPresident) {
    roleSummaryLabel = `Presidente en ejercicio · En campaña (${targetOfficeTitle})`;
  } else if (isSittingOtherOffice) {
    roleSummaryLabel = `${currentOfficeTitle} en ejercicio · Postulado a ${targetOfficeTitle}`;
  } else if (!current && !isCampaigning) {
    roleSummaryLabel = 'Dirigente de oposición (sin cargo público)';
  } else if (isInNationalOpposition && current) {
    roleSummaryLabel = `${currentOfficeTitle} (Oposición)`;
  }

  // Poder Ejecutivo Nacional: exclusivo de quien ejerce la Presidencia (Art. 149-168)
  const canAppointNationalMinisters = isPresident;
  const canDirectCabinetCouncil = isPresident;
  const canEditNationalBudgetAndFiscal = isPresident;
  const canSignPresidentialDecrees = isPresident;
  const canDirectMinistriesAndStateAgencies = isPresident;
  const canDirectForeignPolicyExecutive = isPresident;
  const canResolveNationalEventsAsExecutive = isPresident;

  // Poder Legislativo Nacional:
  // - Art. 94 Constitución: La Cámara de Senadores se compone de 30 miembros electos + 1 Vicepresidente de la República con voz y voto ordinario (31 votos).
  // - En Asamblea General votan 99 Diputados + 30 Senadores + 1 Vicepresidente (130 miembros).
  // - El Presidente puede introducir proyectos del Ejecutivo (iniciativa privativa Art. 86/214) y promulgar o vetar leyes sancionadas (Art. 137).
  // - Un candidato sin cargo público NO puede presentar formalmente proyectos ni votar en el Palacio Legislativo.
  const canCastLegislativeVote = isSenatorOrDeputy || isVicePresident;
  const canVoteInSenate = current === 'senador' || isVicePresident;
  const canVoteInDeputies = current === 'diputado';
  const canVoteInAsambleaGeneral = isSenatorOrDeputy || isVicePresident;
  const canVoteVeniaInSenate = current === 'senador' || isVicePresident;
  const canPromulgateOrVetoBills = isPresident;
  const canTriggerCensura = isSenatorOrDeputy || isVicePresident;
  const canIntroduceNationalBills = isPresident || isVicePresident || isSenatorOrDeputy;
  const canVoteOrSubmitInParliament = isPresident || isVicePresident || isSenatorOrDeputy;
  const canParticipateInCommittees = isSenatorOrDeputy || isVicePresident;
  const canNegotiateVotesInParliament = isPresident || isVicePresident || isSenatorOrDeputy;
  const canOversightGovernment = isSenatorOrDeputy || isVicePresident;

  // Gobierno Departamental y Municipal:
  // - Intendente: administra presupuesto departamental, nombra su equipo de directores, ejecuta obras, eleva iniciativas a la Junta y coordina municipios.
  // - Edil: presenta iniciativas y vota en la Junta Departamental, controla al Intendente.
  // - Alcalde: ejecuta obras vecinales y coordina servicios municipales.
  const canAdministerDepartamentalBudget = isIntendente;
  const canAppointDepartamentalTeam = isIntendente;
  const canExecuteDepartamentalWorks = isIntendente || isAlcalde;
  const canCoordinateMunicipalities = isIntendente || isAlcalde;
  const canSubmitToJunta = isIntendente || isEdil;
  const canVoteInJunta = isEdil;
  const canControlIntendente = isEdil;

  // Campaña, Partido y Estrategia:
  const canCampaign = isCampaigning;
  const canBuildProgram = isCampaigning || isPartyLeader || current === null;
  const canManagePartyAndSectors = true;
  const canNegotiateAlliances = true;
  const canSeekParliamentarySupport = isCampaigning || isPartyLeader || current !== null;
  const canCoordinatePartyStrategy = isCampaigning || isPartyLeader || current === null;
  const canNegotiateCandidacies = isCampaigning || isPartyLeader;

  // Mensajes de bloqueo contextualizados según el cargo real
  const baseWhoAmI = current
    ? `Actualmente ejercés como ${currentOfficeTitle}`
    : isCampaigning
    ? `Actualmente sos candidato a ${targetOfficeTitle} y aún no ganaste ni asumiste el cargo`
    : 'Actualmente no ocupás ningún cargo público electivo';

  const lockReasons = {
    executiveNational: `${baseWhoAmI}. Nombrar ministros, firmar decretos presidenciales o dirigir el Consejo de Ministros son atribuciones exclusivas del Presidente de la República en ejercicio (Art. 168 de la Constitución).`,
    nationalBudget: `${baseWhoAmI}. La iniciativa privativa de modificar el Presupuesto Nacional, tributos y pautas macroeconómicas corresponde exclusivamente al Poder Ejecutivo (Presidente y MEF, Art. 86 y 214).`,
    foreignPolicy: `${baseWhoAmI}. Conducir las relaciones exteriores oficiales, firmar acuerdos comerciales o encabezar misiones diplomáticas del Estado compete al Presidente y la Cancillería (Art. 168 num. 16).`,
    nationalEvents: `${baseWhoAmI}. No podés firmar decretos nacionales ni impartir órdenes a organismos estatales (BCU, MEF, ministerios). Podés fijar posicionamiento público o, si sos legislador, ejercer control político.`,
    parliamentActions: `${baseWhoAmI}. Solo los legisladores electos (Senadores, Diputados, Vicepresidente) o el Poder Ejecutivo en ejercicio pueden presentar y someter a votación proyectos formales en el Parlamento. Como candidato podés buscar apoyos políticos informales.`,
    departamentalExecutive: `${baseWhoAmI}. Administrar el presupuesto de ${deptName}, designar directores departamentales y ejecutar obras comunales corresponde al Intendente Departamental electo en mayo (Art. 262 y 275).`,
    juntaActions: `${baseWhoAmI}. Sancionar decretos y votar en la Junta Departamental de ${deptName} es atribución exclusiva de los Ediles electos (y del Intendente para elevar iniciativas).`,
    campaignActions:
      'Las acciones de campaña electoral se habilitan únicamente durante el ciclo electoral abierto (de marzo a mayo del ciclo siguiente) o al iniciar un nuevo período electoral.',
  };

  return {
    currentOffice: current,
    targetOffice: target,
    isCampaigning,
    isIncumbentPresident,
    isSittingOtherOffice,
    isInNationalOpposition,
    currentOfficeTitle,
    targetOfficeTitle,
    roleSummaryLabel,

    canCampaign,
    canBuildProgram,
    canManagePartyAndSectors,
    canNegotiateAlliances,
    canSeekParliamentarySupport,
    canCoordinatePartyStrategy,
    canNegotiateCandidacies,

    canAppointNationalMinisters,
    canDirectCabinetCouncil,
    canEditNationalBudgetAndFiscal,
    canSignPresidentialDecrees,
    canDirectMinistriesAndStateAgencies,
    canDirectForeignPolicyExecutive,
    canResolveNationalEventsAsExecutive,

    canIntroduceNationalBills,
    canVoteOrSubmitInParliament,
    canCastLegislativeVote,
    canVoteInSenate,
    canVoteInDeputies,
    canVoteInAsambleaGeneral,
    canVoteVeniaInSenate,
    canPromulgateOrVetoBills,
    canTriggerCensura,
    canParticipateInCommittees,
    canNegotiateVotesInParliament,
    canOversightGovernment,

    canAdministerDepartamentalBudget,
    canAppointDepartamentalTeam,
    canExecuteDepartamentalWorks,
    canCoordinateMunicipalities,
    canSubmitToJunta,
    canVoteInJunta,
    canControlIntendente,

    lockReasons,
  };
}

/**
 * Reglas constitucionales estrictas de elegibilidad por cargo (Art. 152, 266 y calendario electoral).
 */
export function getCandidacyEligibility(
  state: GameState,
  officeId: OfficeId
): { allowed: boolean; reason?: string } {
  const current = state.player.currentOffice;

  // Art. 152: Presidente y Vicepresidente no tienen reelección inmediata
  if (
    (current === 'presidente' || current === 'vicepresidente') &&
    (officeId === 'presidente' || officeId === 'vicepresidente')
  ) {
    return {
      allowed: false,
      reason:
        'Constitución Art. 152: quien ejerció la Presidencia o Vicepresidencia no puede ser reelecto en el período inmediato.',
    };
  }

  // Art. 266: Intendente solo admite 1 reelección consecutiva (máximo 2 mandatos seguidos)
  if (
    current === 'intendente' &&
    state.player.termsServedInCurrentOffice >= 2 &&
    officeId === 'intendente'
  ) {
    return {
      allowed: false,
      reason:
        'Constitución Art. 266: ya cumpliste dos períodos consecutivos como Intendente; no podés volver a postularte de inmediato.',
    };
  }

  if (state.electoralStage === 'internas_completadas') {
    if (
      (officeId === 'presidente' || officeId === 'vicepresidente') &&
      !state.internalResult?.playerWonPrimary
    ) {
      return {
        allowed: false,
        reason: 'Perdiste la interna de junio; elegí Senado, Diputados o un cargo departamental.',
      };
    }
  }

  if (state.electoralStage === 'balotaje_completado') {
    if (
      officeId === 'presidente' ||
      officeId === 'vicepresidente' ||
      officeId === 'senador' ||
      officeId === 'diputado'
    ) {
      return {
        allowed: false,
        reason: 'La elección nacional ya cerró; ahora podés postularte a Intendente, Edil o Alcalde.',
      };
    }
  }

  if (
    state.electoralStage === 'departamentales_completadas' ||
    state.careerPhase === 'fin_mandato'
  ) {
    return {
      allowed: false,
      reason: 'Ciclo electoral cerrado hasta la apertura de la siguiente elección.',
    };
  }

  return { allowed: true };
}

