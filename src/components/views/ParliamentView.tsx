import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  Clock,
  FilePlus2,
  Gavel,
  Handshake,
  Landmark,
  Lock,
  MessageSquare,
  Scale,
  ShieldAlert,
  Users,
  XCircle,
} from 'lucide-react';
import { MONTH_NAMES } from '../../data/uruguayData';
import { VISUAL_ASSETS } from '../../data/visualAssets';
import { getPlayerCapabilities } from '../../engine/capabilitiesEngine';
import {
  STAGE_META,
  advanceBillConstitutionalStage,
  estimatePartyBillSupport,
  executeChamberInterpellation,
  executeInvestigativeCommission,
  executeMinisterialCensureMotion,
  getActiveChambers,
  resolveCensureAction,
  resolveExecutiveBillAction,
  voteSenateVenia,
} from '../../engine/parliamentEngine';
import { recordAchievementAndMeta } from '../../engine/storageEngine';
import { BillProposal, GameState, LegislativeStage } from '../../types/game';
import { ParliamentHemicycle } from '../Charts';

interface ParliamentViewProps {
  gameState: GameState;
  onUpdateState: (next: GameState) => void;
}

const STAGE_PROGRESS_ORDER: LegislativeStage[] = [
  'camara_origen_comision',
  'camara_origen_plenario',
  'camara_revisora',
  'promulgacion_ejecutivo',
  'aprobada',
];

export const ParliamentView: React.FC<ParliamentViewProps> = ({ gameState, onUpdateState }) => {
  const [parlFeedback, setParlFeedback] = useState<string | null>(null);
  const [chamberTab, setChamberTab] = useState<'senado' | 'diputados' | 'junta'>('senado');
  const [billFilter, setBillFilter] = useState<'todas' | 'oficialismo' | 'oposicion' | 'resueltas'>('todas');
  const [newTitle, setNewTitle] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [newCategory, setNewCategory] = useState<BillProposal['category']>('economica');
  const [newOriginChamber, setNewOriginChamber] = useState<'diputados' | 'senado' | 'junta_departamental'>('diputados');
  const [oversightChamber, setOversightChamber] = useState<'diputados' | 'senado'>('diputados');
  const [selectedMinisterId, setSelectedMinisterId] = useState<string>(
    gameState.cabinet.find((m) => !m.isVacant)?.id ?? gameState.cabinet[0]?.id ?? ''
  );
  const [invTopic, setInvTopic] = useState('Contrataciones y ejecución presupuestal');
  const [bannerImgOk, setBannerImgOk] = useState(true);

  const caps = getPlayerCapabilities(gameState);
  const chambers = getActiveChambers(gameState);

  const canInteractWithBill = (bill: BillProposal) =>
    bill.chamber === 'junta_departamental' ? caps.canSubmitToJunta : caps.canVoteOrSubmitInParliament;

  const depGovSeats = gameState.coalitionPartyIds.reduce(
    (sum, id) => sum + (chambers.deputiesByParty[id] ?? 0),
    0
  );
  const depOppSeats = Math.max(0, 99 - depGovSeats);
  const senGovSeats = gameState.coalitionPartyIds.reduce(
    (sum, id) => sum + (chambers.senateByParty[id] ?? 0),
    0
  );
  const senOppSeats = Math.max(0, 30 - senGovSeats);

  const handleSetBenchPosition = (
    billId: string,
    position: 'a_favor' | 'en_contra' | 'abstencion'
  ) => {
    const bill = gameState.bills.find((b) => b.id === billId);
    if (!bill) return;

    const credDelta =
      position === 'a_favor' && gameState.opposition?.stance === 'constructiva'
        ? 1.2
        : position === 'en_contra' && gameState.opposition?.stance === 'confrontativa'
        ? 0.8
        : 0.4;

    const posLabel =
      position === 'a_favor'
        ? 'A FAVOR (acompañar)'
        : position === 'en_contra'
        ? 'EN CONTRA (rechazar)'
        : 'ABSTENCIÓN';

    const msg = `Bancada de ${
      gameState.parties.find((p) => p.id === gameState.player.partyId)?.acronym ?? 'tu partido'
    } fijó postura ${posLabel} sobre «${bill.title}».`;
    setParlFeedback(msg);

    onUpdateState({
      ...gameState,
      bills: gameState.bills.map((b) =>
        b.id === billId ? { ...b, playerBenchPosition: position } : b
      ),
      opposition: {
        ...gameState.opposition,
        credibility: Math.min(98, Number((gameState.opposition.credibility + credDelta).toFixed(1))),
      },
      history: [
        {
          id: `bench_${Date.now()}`,
          dateLabel: `${MONTH_NAMES[gameState.currentMonth - 1]} ${gameState.currentYear}`,
          category: 'parlamento',
          title: `Postura de bancada: ${posLabel}`,
          detail: msg,
        },
        ...gameState.history,
      ],
    });
  };

  const handleNegotiateBill = (billId: string, partyId: string, type: 'concesion' | 'compromiso') => {
    const bill = gameState.bills.find((b) => b.id === billId);
    const party = gameState.parties.find((p) => p.id === partyId);
    if (!bill || !party) return;

    if (bill.chamber === 'junta_departamental' && !caps.canSubmitToJunta) {
      setParlFeedback(caps.lockReasons.juntaActions);
      return;
    }
    if (bill.chamber !== 'junta_departamental' && !caps.canNegotiateVotesInParliament) {
      setParlFeedback(caps.lockReasons.parliamentActions);
      return;
    }

    const costCap = type === 'concesion' ? 5 : 4;
    if (gameState.player.politicalCapital < costCap) {
      setParlFeedback('Capital político insuficiente para negociar en comisión.');
      return;
    }

    const boost = type === 'concesion' ? 0.24 : 0.16;
    const label =
      type === 'concesion'
        ? `Concesión programática acordada con ${party.acronym}`
        : `Acuerdo de bancada con ${party.acronym}`;

    const nextBills = gameState.bills.map((b) =>
      b.id === billId
        ? {
            ...b,
            concessionsApplied: [...b.concessionsApplied, label],
            negotiatedPartySupport: {
              ...b.negotiatedPartySupport,
              [partyId]: Math.min(0.45, (b.negotiatedPartySupport[partyId] ?? 0) + boost),
            },
          }
        : b
    );

    const nextRelations = gameState.player.relations.map((r) =>
      r.partyId === partyId ? { ...r, affinity: Math.min(100, r.affinity + 4) } : r
    );

    setParlFeedback(`Negociaste respaldo de ${party.name} para «${bill.title}».`);
    onUpdateState({
      ...gameState,
      bills: nextBills,
      player: {
        ...gameState.player,
        politicalCapital: gameState.player.politicalCapital - costCap,
        relations: nextRelations,
      },
    });
  };

  const handleSeekInformalSupport = (partyId: string) => {
    if (gameState.player.politicalCapital < 3) {
      setParlFeedback('Capital político insuficiente para reunirse con bancadas (3 requeridos).');
      return;
    }
    const target = gameState.parties.find((p) => p.id === partyId);
    if (!target) return;
    const nextRelations = gameState.player.relations.map((r) =>
      r.partyId === partyId ? { ...r, affinity: Math.min(100, r.affinity + 5) } : r
    );
    const msg = `Reunión política con la bancada de ${target.name}: +5 afinidad hacia futuros acuerdos parlamentarios.`;
    setParlFeedback(msg);
    onUpdateState({
      ...gameState,
      player: {
        ...gameState.player,
        politicalCapital: gameState.player.politicalCapital - 3,
        relations: nextRelations,
      },
      history: [
        {
          id: `seek_${Date.now()}`,
          dateLabel: `${MONTH_NAMES[gameState.currentMonth - 1]} ${gameState.currentYear}`,
          category: 'parlamento',
          title: `Búsqueda de apoyos con ${target.acronym}`,
          detail: msg,
        },
        ...gameState.history,
      ],
    });
  };

  const handleCommitteeDebate = (bill: BillProposal) => {
    if (!caps.canParticipateInCommittees && !(bill.chamber === 'junta_departamental' && caps.canVoteInJunta)) {
      setParlFeedback(caps.lockReasons.parliamentActions);
      return;
    }
    if (gameState.player.politicalCapital < 3) {
      setParlFeedback('Capital político insuficiente para intervenir en comisión (3 requeridos).');
      return;
    }
    const nextBills = gameState.bills.map((b) => {
      if (b.id !== bill.id) return b;
      const boosted = { ...b.negotiatedPartySupport };
      gameState.parties.forEach((p) => {
        if (p.id !== gameState.player.partyId) {
          boosted[p.id] = Math.min(0.45, (boosted[p.id] ?? 0) + 0.06);
        }
      });
      return {
        ...b,
        concessionsApplied: [...b.concessionsApplied, 'Debate e informe en Comisión parlamentaria'],
        negotiatedPartySupport: boosted,
      };
    });

    const msg = `Interviniste en ${bill.committeeName ?? 'Comisión'} sobre «${bill.title}» (+6% apoyo transversal y +1 popularidad).`;
    setParlFeedback(msg);
    onUpdateState({
      ...gameState,
      bills: nextBills,
      player: {
        ...gameState.player,
        politicalCapital: gameState.player.politicalCapital - 3,
        attributes: {
          ...gameState.player.attributes,
          popularity: Math.min(98, gameState.player.attributes.popularity + 1),
        },
      },
      history: [
        {
          id: `com_${Date.now()}`,
          dateLabel: `${MONTH_NAMES[gameState.currentMonth - 1]} ${gameState.currentYear}`,
          category: 'parlamento',
          title: `Trabajo en comisión: ${bill.title}`,
          detail: msg,
        },
        ...gameState.history,
      ],
    });
  };

  const handleAdvanceBillStage = (bill: BillProposal) => {
    if (bill.status !== 'en_negociacion') return;
    if (!canInteractWithBill(bill)) {
      setParlFeedback(
        bill.chamber === 'junta_departamental'
          ? caps.lockReasons.juntaActions
          : caps.lockReasons.parliamentActions
      );
      return;
    }

    const stage = bill.legislativeStage ?? 'camara_origen_comision';
    const stepCost = stage === 'camara_origen_plenario' ? Math.max(4, Math.round(bill.politicalCapitalCost * 0.5)) : stage === 'camara_origen_comision' ? 2 : 3;
    if (gameState.player.politicalCapital < stepCost) {
      setParlFeedback(`Necesitás ${stepCost} CP para impulsar esta instancia legislativa.`);
      return;
    }

    const res = advanceBillConstitutionalStage(
      {
        ...gameState,
        player: {
          ...gameState.player,
          politicalCapital: gameState.player.politicalCapital - stepCost,
        },
      },
      bill.id
    );

    if (res.outcome === 'approved') {
      recordAchievementAndMeta(res.nextState, ['ley_aprobada']);
    }
    setParlFeedback(res.message);
    onUpdateState(res.nextState);
  };

  const handleExecutiveAction = (bill: BillProposal, action: 'promulgar' | 'veto_parcial' | 'veto_total') => {
    if (!caps.canPromulgateOrVetoBills) {
      setParlFeedback(caps.lockReasons.executiveNational);
      return;
    }
    const res = resolveExecutiveBillAction(gameState, bill.id, action);
    if (res.outcome === 'approved') {
      recordAchievementAndMeta(res.nextState, ['ley_aprobada']);
    }
    setParlFeedback(res.message);
    onUpdateState(res.nextState);
  };

  const handleSubmitNewBill = (e: React.FormEvent) => {
    e.preventDefault();
    const isJunta = newOriginChamber === 'junta_departamental';
    if (isJunta && !caps.canSubmitToJunta) {
      setParlFeedback(caps.lockReasons.juntaActions);
      return;
    }
    if (!isJunta && !caps.canIntroduceNationalBills) {
      setParlFeedback(caps.lockReasons.parliamentActions);
      return;
    }
    if (!newTitle.trim() || !newSummary.trim()) {
      setParlFeedback('Completá el título y el objeto del proyecto.');
      return;
    }
    if (gameState.player.politicalCapital < 5) {
      setParlFeedback('Necesitás 5 de capital político para redactar e ingresar un nuevo proyecto.');
      return;
    }

    const payloadByCat: Record<BillProposal['category'], BillProposal['payload']> = {
      economica: { gdpDelta: 0.25, businessTrustDelta: 3, productivityDelta: 0.9 },
      social: { povertyDelta: -0.3, approvalDelta: 3, unionTrustDelta: 3, deficitDelta: 0.15 },
      institucional: { approvalDelta: 2, businessTrustDelta: 2 },
      presupuestal: { productivityDelta: 1.0, deficitDelta: 0.2, approvalDelta: 2 },
      laboral: { unemploymentDelta: -0.25, unionTrustDelta: 3, businessTrustDelta: 1 },
      seguridad: { approvalDelta: 3, deficitDelta: 0.1 },
    };

    const created: BillProposal = {
      id: `bill_user_${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory,
      summary: newSummary.trim(),
      sponsorPartyId: gameState.player.partyId,
      origin: caps.isInNationalOpposition ? 'oposicion' : 'propio',
      playerBenchPosition: 'a_favor',
      effectsDescription: 'Iniciativa parlamentaria ingresada en Cámara de Origen.',
      politicalCapitalCost: isJunta ? 8 : 11,
      chamber: isJunta ? 'junta_departamental' : 'ambas',
      originChamber: newOriginChamber,
      legislativeStage: 'camara_origen_comision',
      committeeName:
        newCategory === 'presupuestal'
          ? 'Comisión de Presupuestos y Hacienda'
          : newCategory === 'economica'
          ? 'Comisión de Hacienda'
          : 'Comisión de Constitución y Legislación',
      executiveVetoKind: 'ninguno',
      isConstitutionalBudgetBill: newCategory === 'presupuestal' && !isJunta,
      deadlineDaysRemaining: newCategory === 'presupuestal' && !isJunta ? 45 : undefined,
      status: 'en_negociacion',
      concessionsApplied: [],
      negotiatedPartySupport: {},
      payload: payloadByCat[newCategory],
    };

    setNewTitle('');
    setNewSummary('');
    setParlFeedback(`Ingresaste «${created.title}» a Comisión en ${isJunta ? 'Junta Departamental' : newOriginChamber === 'senado' ? 'Senadores' : 'Diputados'}.`);

    onUpdateState({
      ...gameState,
      bills: [created, ...gameState.bills],
      player: {
        ...gameState.player,
        politicalCapital: gameState.player.politicalCapital - 5,
      },
      history: [
        {
          id: `billnew_${Date.now()}`,
          dateLabel: `${MONTH_NAMES[gameState.currentMonth - 1]} ${gameState.currentYear}`,
          category: 'parlamento',
          title: `Proyecto ingresado: ${created.title}`,
          detail: created.summary,
        },
        ...gameState.history,
      ],
    });
  };

  const handleOversightAction = (kind: 'informe' | 'interpelacion' | 'investigadora' | 'censura' | 'edil_informe') => {
    if (kind === 'edil_informe') {
      if (!caps.canControlIntendente) {
        setParlFeedback(caps.lockReasons.juntaActions);
        return;
      }
      if (gameState.player.politicalCapital < 3) {
        setParlFeedback('Necesitás 3 CP para elevar un pedido de informes departamental.');
        return;
      }
      const msg = 'Pedido de informes elevado al Ejecutivo Departamental sobre obras y contrataciones (+1.5 pop.).';
      setParlFeedback(msg);
      onUpdateState({
        ...gameState,
        player: {
          ...gameState.player,
          politicalCapital: gameState.player.politicalCapital - 3,
          attributes: {
            ...gameState.player.attributes,
            popularity: Math.min(98, gameState.player.attributes.popularity + 1.5),
          },
        },
        history: [
          {
            id: `edil_ctrl_${Date.now()}`,
            dateLabel: `${MONTH_NAMES[gameState.currentMonth - 1]} ${gameState.currentYear}`,
            category: 'parlamento',
            title: 'Control de Junta Departamental',
            detail: msg,
          },
          ...gameState.history,
        ],
      });
      return;
    }

    if (!caps.canOversightGovernment) {
      setParlFeedback(caps.lockReasons.parliamentActions);
      return;
    }

    if (kind === 'interpelacion') {
      if (gameState.player.politicalCapital < 7) {
        setParlFeedback('Necesitás 7 CP para promover un llamado a sala (Art. 119).');
        return;
      }
      const res = executeChamberInterpellation(
        {
          ...gameState,
          player: { ...gameState.player, politicalCapital: gameState.player.politicalCapital - 7 },
        },
        oversightChamber,
        selectedMinisterId
      );
      setParlFeedback(res.message);
      onUpdateState(res.nextState);
      return;
    }

    if (kind === 'investigadora') {
      if (gameState.player.politicalCapital < 6) {
        setParlFeedback('Necesitás 6 CP para mocionar una Comisión Investigadora (Art. 120).');
        return;
      }
      const res = executeInvestigativeCommission(
        {
          ...gameState,
          player: { ...gameState.player, politicalCapital: gameState.player.politicalCapital - 6 },
        },
        oversightChamber,
        invTopic.trim() || 'Gestión ministerial'
      );
      setParlFeedback(res.message);
      onUpdateState(res.nextState);
      return;
    }

    if (kind === 'censura') {
      if (!caps.canTriggerCensura) {
        setParlFeedback(caps.lockReasons.parliamentActions);
        return;
      }
      if (gameState.player.politicalCapital < 9) {
        setParlFeedback('Necesitás 9 CP para promover una moción de censura en Asamblea General (Art. 147).');
        return;
      }
      const res = executeMinisterialCensureMotion(
        {
          ...gameState,
          player: { ...gameState.player, politicalCapital: gameState.player.politicalCapital - 9 },
        },
        selectedMinisterId,
        invTopic.trim() || 'Responsabilidad político-administrativa'
      );
      setParlFeedback(res.message);
      onUpdateState(res.nextState);
      return;
    }

    // Pedido de informes Art. 118
    if (gameState.player.politicalCapital < 4) {
      setParlFeedback('Necesitás 4 CP para elevar un Pedido de Informes (Art. 118).');
      return;
    }
    const govHit = gameState.nationalPresidentPartyId === gameState.player.partyId ? 0 : -1.0;
    const nextApproval = Math.max(15, gameState.politicalIndicators.governmentApproval + govHit);
    const nextControls = (gameState.opposition?.parliamentaryControlsExecuted ?? 0) + 1;
    const msg = 'Pedido de informes presentado al Poder Ejecutivo (Art. 118): +1.4 popularidad y transparencia institucional.';
    setParlFeedback(msg);
    onUpdateState({
      ...gameState,
      macro: { ...gameState.macro, governmentApprovalPct: nextApproval },
      politicalIndicators: { ...gameState.politicalIndicators, governmentApproval: nextApproval },
      opposition: { ...gameState.opposition, parliamentaryControlsExecuted: nextControls },
      player: {
        ...gameState.player,
        politicalCapital: gameState.player.politicalCapital - 4,
        attributes: { ...gameState.player.attributes, popularity: Math.min(98, gameState.player.attributes.popularity + 1.4) },
      },
      history: [
        {
          id: `ctrl_${Date.now()}`,
          dateLabel: `${MONTH_NAMES[gameState.currentMonth - 1]} ${gameState.currentYear}`,
          category: 'parlamento',
          title: 'Pedido de informes (Art. 118)',
          detail: msg,
        },
        ...gameState.history,
      ],
    });
  };

  const handleVoteVenia = (veniaId: string) => {
    if (!caps.canVoteVeniaInSenate && !caps.canVoteOrSubmitInParliament) {
      setParlFeedback(caps.lockReasons.parliamentActions);
      return;
    }
    const res = voteSenateVenia(gameState, veniaId);
    setParlFeedback(res.message);
    onUpdateState(res.nextState);
  };

  const filteredBills = gameState.bills.filter((b) => {
    if (billFilter === 'oficialismo') return b.origin === 'oficialismo' && b.status === 'en_negociacion';
    if (billFilter === 'oposicion') return b.origin !== 'oficialismo' && b.status === 'en_negociacion';
    if (billFilter === 'resueltas') return b.status !== 'en_negociacion';
    return true;
  });

  const featuredBill = gameState.bills.find((b) => b.status === 'en_negociacion');
  const featuredStage = featuredBill?.legislativeStage ?? 'camara_origen_comision';
  const featuredIsSenado =
    featuredStage === 'camara_revisora'
      ? featuredBill?.originChamber !== 'senado'
      : featuredBill?.originChamber === 'senado' || featuredBill?.chamber === 'senado';
  const featuredChamberTotal =
    featuredBill?.chamber === 'junta_departamental'
      ? 31
      : featuredStage === 'asamblea_general' || featuredStage === 'veto_parcial_o_total'
      ? 130
      : featuredIsSenado
      ? 31
      : 99;
  const featuredChamberMajority =
    featuredStage === 'asamblea_general'
      ? 87
      : featuredStage === 'veto_parcial_o_total'
      ? 79
      : Math.floor(featuredChamberTotal / 2) + 1;
  const featuredSeatsMap =
    featuredBill?.chamber === 'junta_departamental'
      ? chambers.juntaByParty
      : featuredIsSenado
      ? chambers.senateByParty
      : chambers.deputiesByParty;
  const estimatedYesVotes = featuredBill
    ? Math.round(
        featuredStage === 'asamblea_general' || featuredStage === 'veto_parcial_o_total'
          ? gameState.parties.reduce(
              (sum, p) =>
                sum +
                ((chambers.deputiesByParty[p.id] ?? 0) + (chambers.senateByParty[p.id] ?? 0)) *
                  estimatePartyBillSupport(gameState, featuredBill, p),
              0
            ) + 1
          : gameState.parties.reduce(
              (sum, p) => sum + (featuredSeatsMap[p.id] ?? 0) * estimatePartyBillSupport(gameState, featuredBill, p),
              0
            ) + (featuredIsSenado && featuredBill.chamber !== 'junta_departamental' ? 1 : 0)
      )
    : 0;

  const approvedBills = gameState.bills.filter((b) => b.status === 'aprobada');
  const rejectedBills = gameState.bills.filter((b) => b.status === 'rechazada');
  const pendingVenias = (gameState.pendingVenias ?? []).filter((v) => v.status === 'pendiente');

  const getNextStageActionLabel = (bill: BillProposal): string => {
    const st = bill.legislativeStage ?? 'camara_origen_comision';
    if (st === 'camara_origen_comision') return 'Despachar Comisión (-2 CP)';
    if (st === 'camara_origen_plenario') {
      const cost = Math.max(4, Math.round(bill.politicalCapitalCost * 0.5));
      return bill.chamber === 'junta_departamental'
        ? `Votar Junta (-${cost} CP)`
        : `Votar Cámara Origen (-${cost} CP)`;
    }
    if (st === 'camara_revisora') return 'Votar Cámara Revisora (-3 CP)';
    if (st === 'devuelta_origen') return 'Votar Modificaciones (-3 CP)';
    if (st === 'asamblea_general') return 'Asamblea General 2/3 (-3 CP)';
    if (st === 'veto_parcial_o_total') return 'Asamblea 3/5 p/ Veto (-3 CP)';
    if (st === 'promulgacion_ejecutivo') return 'Tramitar Ejecutivo (-2 CP)';
    return 'Avanzar Trámite';
  };

  return (
    <div className="space-y-5 animate-editorial-in">
      {/* Cabecera Palacio Legislativo */}
      <section className="relative overflow-hidden rounded-xl border border-[#574239]/55 bg-[#171C1D] text-[#DFE3E4] shadow-xl">
        {bannerImgOk && (
          <img
            src={VISUAL_ASSETS.ceremonyPalacio}
            alt="Salón de los Pasos Perdidos del Palacio Legislativo"
            referrerPolicy="no-referrer"
            onError={() => setBannerImgOk(false)}
            className="h-36 w-full object-cover opacity-35 sm:h-40"
          />
        )}
        <div
          className={`${
            bannerImgOk ? 'absolute inset-0 bg-gradient-to-r from-[#0A0F10]/95 via-[#171C1D]/85 to-[#171C1D]/60' : 'bg-[#171C1D]'
          } flex flex-wrap items-center justify-between gap-4 p-5`}
        >
          <div>
            <div className="font-mono-data text-[11px] font-semibold uppercase tracking-[0.14em] text-[#FFB691]">
              Poder Legislativo · Asamblea General (130) y Juntas Departamentales
            </div>
            <h2 className="mt-1 font-display text-xl font-bold text-[#DFE3E4] sm:text-2xl">
              Palacio Legislativo y Trámite Bicameral ROU
            </h2>
            <p className="mt-1 text-xs text-[#CDC6B8]">
              Cargo actual: <strong className="text-[#FFB691]">{caps.roleSummaryLabel}</strong> · Senado 30+VP (Art. 94), Diputados 99, Comisiones, Vetos 3/5 y Venias Art. 187.
            </p>
          </div>
          <div className="rounded-lg border border-[#574239]/50 bg-[#0A0F10]/90 px-3.5 py-2 text-right">
            <div className="font-mono-data text-[10px] font-semibold uppercase tracking-wider text-[#DEC1B4]">
              Capital político disponible
            </div>
            <div className="font-mono-data text-lg font-bold text-[#E87532]">
              {gameState.player.politicalCapital} CP
            </div>
          </div>
        </div>
      </section>

      {/* Chamber Toggle Tabs en Móvil + Grilla 3 Hemiciclos en Desktop */}
      <div className="space-y-3">
        <div className="flex rounded-xl bg-[#262B2C] p-1 lg:hidden">
          {[
            { id: 'senado', label: 'Senado (30+VP)', icon: Gavel },
            { id: 'diputados', label: 'Diputados (99)', icon: Users },
            { id: 'junta', label: 'Junta (31)', icon: Landmark },
          ].map((c) => {
            const Icon = c.icon;
            const active = chamberTab === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setChamberTab(c.id as typeof chamberTab)}
                className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-2 font-mono-data text-[11px] font-semibold transition ${
                  active ? 'bg-[#E87532] text-[#511E00] shadow-xs' : 'text-[#DEC1B4] hover:text-[#DFE3E4]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>

        {/* Móvil */}
        <div className="lg:hidden">
          {chamberTab === 'senado' && (
            <ParliamentHemicycle
              title="Cámara de Senadores (30 + VP)"
              subtitle="Palacio Legislativo • Art. 94 Constitución"
              daisLabel="Vicepresidencia: voz y voto ordinario (31 votos)"
              seatsByParty={chambers.senateByParty}
              parties={gameState.parties}
              totalSeats={30}
            />
          )}
          {chamberTab === 'diputados' && (
            <ParliamentHemicycle
              title="Cámara de Representantes (99)"
              subtitle="Palacio Legislativo • Sala de Diputados"
              daisLabel="Mesa de Presidencia: Cámara de Representantes"
              seatsByParty={chambers.deputiesByParty}
              parties={gameState.parties}
              totalSeats={99}
            />
          )}
          {chamberTab === 'junta' && (
            <ParliamentHemicycle
              title="Junta Departamental (31 Ediles)"
              subtitle="Gobierno Departamental • Art. 272"
              daisLabel="Mesa de la Junta Departamental"
              seatsByParty={chambers.juntaByParty}
              parties={gameState.parties}
              totalSeats={31}
            />
          )}
        </div>

        {/* Desktop */}
        <div className="hidden gap-4 lg:grid lg:grid-cols-3">
          <ParliamentHemicycle
            title="Cámara de Senadores (30 + VP)"
            subtitle="Palacio Legislativo • Art. 94"
            daisLabel="Vicepresidencia: voz y voto ordinario (31)"
            seatsByParty={chambers.senateByParty}
            parties={gameState.parties}
            totalSeats={30}
          />
          <ParliamentHemicycle
            title="Cámara de Representantes (99)"
            subtitle="Palacio Legislativo • Diputados"
            daisLabel="Presidencia de Representantes"
            seatsByParty={chambers.deputiesByParty}
            parties={gameState.parties}
            totalSeats={99}
          />
          <ParliamentHemicycle
            title="Junta Departamental (31 Ediles)"
            subtitle="Órgano Legislativo Departamental"
            daisLabel="Mayoría Automática Art. 272"
            seatsByParty={chambers.juntaByParty}
            parties={gameState.parties}
            totalSeats={31}
          />
        </div>
      </div>

      {/* Proyecto Destacado */}
      {featuredBill && (
        <section className="warroom-card-high relative overflow-hidden rounded-xl p-4 shadow-lg">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[#E87532]" />
              <span className="font-mono-data text-[10px] font-semibold uppercase tracking-widest text-[#E87532]">
                Proyecto en Trámite Bicameral
              </span>
            </div>
            <div className="flex items-center gap-2">
              {featuredBill.deadlineDaysRemaining !== undefined && (
                <span className="inline-flex items-center gap-1 rounded bg-[#E87532]/20 px-2 py-0.5 font-mono-data text-[10px] font-bold text-[#FFB691]">
                  <Clock className="h-3 w-3" />
                  Plazo Art. 217: {featuredBill.deadlineDaysRemaining} días
                </span>
              )}
              <span className="rounded bg-[#93000A] px-2 py-0.5 font-mono-data text-[10px] font-bold uppercase text-[#FFDAD6]">
                {STAGE_META[featuredStage].stageLabel}
              </span>
            </div>
          </div>

          <h3 className="font-display text-lg font-medium leading-snug text-[#DFE3E4]">
            {featuredBill.title}
          </h3>
          <p className="mt-1 text-xs text-[#DEC1B4]">{featuredBill.summary}</p>

          <div className="mt-3 flex flex-col gap-1.5 rounded-lg bg-[#0A0F10] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-mono-data text-[11px]">
                <span className="font-semibold text-[#DFE3E4]">Votos Proyectados:</span>
                <span
                  className={`font-bold ${
                    estimatedYesVotes >= featuredChamberMajority ? 'text-[#ACCEBF]' : 'text-[#FFB691]'
                  }`}
                >
                  {estimatedYesVotes} / {featuredChamberMajority}
                </span>
                <span className="text-[10px] text-[#DEC1B4]">
                  ({STAGE_META[featuredStage].articleRef})
                </span>
              </div>
              <span
                className={`font-mono-data text-[10px] font-semibold uppercase ${
                  estimatedYesVotes >= featuredChamberMajority ? 'text-[#ACCEBF]' : 'text-[#FFB4AB]'
                }`}
              >
                {estimatedYesVotes >= featuredChamberMajority
                  ? 'Mayoría proyectada favorable'
                  : `Faltan ${featuredChamberMajority - estimatedYesVotes} votos`}
              </span>
            </div>

            <div className="relative flex h-3 w-full overflow-hidden rounded-full bg-[#313637]">
              <div
                className={`h-full rounded-l-full transition-all duration-500 ${
                  estimatedYesVotes >= featuredChamberMajority ? 'bg-[#ACCEBF]' : 'bg-[#E87532]'
                }`}
                style={{ width: `${Math.min(100, (estimatedYesVotes / featuredChamberTotal) * 100)}%` }}
              />
              <div
                className="absolute top-0 z-10 h-full w-0.5 bg-[#DFE3E4] opacity-80"
                style={{ left: `${(featuredChamberMajority / featuredChamberTotal) * 100}%` }}
                title={`Meta: ${featuredChamberMajority} votos`}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 font-mono-data text-[10px] text-[#DEC1B4]">
              <span>Impacto: {featuredBill.effectsDescription}</span>
              <span className="font-semibold text-[#FFB691]">Meta instancia: {featuredChamberMajority} votos</span>
            </div>
          </div>
        </section>
      )}

      {/* Control Parlamentario: Oficialismo vs Oposición */}
      <section className="warroom-card space-y-4 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#574239]/40 pb-3">
          <div>
            <h2 className="font-display text-base font-bold text-[#DFE3E4]">
              Control Parlamentario: Bancadas Oficialistas vs. Oposición
            </h2>
            <p className="text-xs text-[#CDC6B8]">
              Correlación de fuerzas en Diputados (99), Senado (30 electos + Vicepresidencia con voz y voto ordinario, Art. 94) y Asamblea General (130).
            </p>
          </div>
          <span className="rounded-md border border-[#ACCEBF]/35 bg-[#0A0F10] px-2.5 py-1 font-mono-data text-xs font-bold text-[#ACCEBF]">
            Apoyo parlamentario al gobierno: {gameState.politicalIndicators.parliamentarySupportPct}%
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-[#574239]/35 bg-[#171C1D] p-3.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-[#ACCEBF]">Diputados · Oficialismo: {depGovSeats}/99</span>
              <span className="text-[#FFB691]">Oposición: {depOppSeats}/99</span>
            </div>
            <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-[#0A0F10]">
              <div
                className="bg-[#7B9C8E] transition-all"
                style={{ width: `${Math.round((depGovSeats / 99) * 100)}%` }}
              />
              <div
                className="bg-[#E87532] transition-all"
                style={{ width: `${Math.round((depOppSeats / 99) * 100)}%` }}
              />
            </div>
            <div className="mt-1.5 text-[11px] text-[#CDC6B8]">
              Mayoría absoluta: 50 bancas · 1/3 interpelación: 33 · 3/5 veto: 60 ·{' '}
              {depGovSeats >= 50 ? 'Oficialismo con mayoría propia' : 'Requiere acuerdos'}
            </div>
          </div>

          <div className="rounded-lg border border-[#574239]/35 bg-[#171C1D] p-3.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-[#ACCEBF]">Senado · Oficialismo: {senGovSeats}/30 (+1 VP)</span>
              <span className="text-[#FFB691]">Oposición: {senOppSeats}/30</span>
            </div>
            <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-[#0A0F10]">
              <div
                className="bg-[#7B9C8E] transition-all"
                style={{ width: `${Math.round((senGovSeats / 30) * 100)}%` }}
              />
              <div
                className="bg-[#E87532] transition-all"
                style={{ width: `${Math.round((senOppSeats / 30) * 100)}%` }}
              />
            </div>
            <div className="mt-1.5 text-[11px] text-[#CDC6B8]">
              Mayoría simple: 16 de 31 votos (30 electos + Vicepresidencia con voz y voto ordinario, Art. 94) · Venias Art. 187: 18/30 (16 tras 60 días)
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {gameState.parties
            .filter((p) => (chambers.deputiesByParty[p.id] ?? 0) > 0 || (chambers.senateByParty[p.id] ?? 0) > 0)
            .map((p) => {
              const isGov = gameState.coalitionPartyIds.includes(p.id);
              const isInOppBloc = gameState.opposition?.oppositionBlocPartyIds.includes(p.id);
              const isPlayer = p.id === gameState.player.partyId;
              const roleLabel = isGov
                ? 'Oficialismo'
                : isPlayer
                ? 'Tu partido'
                : isInOppBloc
                ? 'Bloque opositor'
                : 'Oposición';
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-2 rounded-lg border border-[#574239]/40 bg-[#171C1D] px-3 py-1.5 text-xs"
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="font-bold text-[#DFE3E4]">{p.acronym}</span>
                  <span className="font-mono-data text-[#CDC6B8]">
                    S:{chambers.senateByParty[p.id] ?? 0} · D:{chambers.deputiesByParty[p.id] ?? 0}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      isGov
                        ? 'bg-[#7B9C8E]/25 text-[#ACCEBF]'
                        : isInOppBloc || isPlayer
                        ? 'bg-[#E87532]/25 text-[#FFB691]'
                        : 'bg-[#313637] text-[#CDC6B8]'
                    }`}
                  >
                    {roleLabel}
                  </span>
                </div>
              );
            })}
        </div>
      </section>

      {/* Venias del Senado (Art. 187) y Censura Ministerial activa (Arts. 147–148) */}
      {(pendingVenias.length > 0 || gameState.censureProcess) && (
        <section className="warroom-card space-y-3 rounded-xl p-5">
          <h3 className="flex items-center gap-2 font-display text-base font-bold text-[#DFE3E4]">
            <ShieldAlert className="h-4 w-4 text-[#E87532]" />
            Instancias Especiales del Senado y Asamblea General
          </h3>

          {pendingVenias.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-[#FFB691]">
                Venias Constitucionales Pendientes en el Senado (Art. 187: 18/30 en primeros 60 días · 16/30 luego)
              </div>
              {pendingVenias.map((venia) => {
                const req = venia.daysElapsed >= 60 ? 16 : 18;
                return (
                  <div
                    key={venia.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#574239]/40 bg-[#171C1D] p-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-[#DFE3E4]">
                        {venia.enterpriseName} — Propuesto: {venia.nomineeName}
                      </div>
                      <div className="font-mono-data text-[11px] text-[#CDC6B8]">
                        Transcurridos: {venia.daysElapsed} días · Mayoría requerida hoy: {req}/30 senadores
                      </div>
                    </div>
                    <button
                      onClick={() => handleVoteVenia(venia.id)}
                      className="min-h-[36px] rounded-lg bg-[#E87532] px-3 py-1.5 text-xs font-bold text-[#511E00] transition hover:brightness-110"
                    >
                      Votar Venia en Senado
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {gameState.censureProcess && (
            <div className="rounded-lg border border-[#FFB4AB]/45 bg-[#93000A]/25 p-3.5 text-xs">
              <div className="font-bold text-[#FFDAD6]">
                Proceso de Censura Ministerial (Arts. 147–148): {gameState.censureProcess.ministerName} ({gameState.censureProcess.ministryCode})
              </div>
              <div className="mt-1 text-[#DEC1B4]">
                Estado: <strong>{gameState.censureProcess.status}</strong> · Votos Asamblea:{' '}
                {gameState.censureProcess.assemblyVotesYes ?? 0}/130 · Motivo: {gameState.censureProcess.reason}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {gameState.censureProcess.status === 'en_asamblea' && caps.canPromulgateOrVetoBills && (
                  <>
                    <button
                      onClick={() => {
                        const res = resolveCensureAction(gameState, 'aceptar_renuncia');
                        setParlFeedback(res.message);
                        onUpdateState(res.nextState);
                      }}
                      className="rounded-lg bg-[#7B9C8E]/25 px-3 py-1.5 font-bold text-[#ACCEBF] hover:bg-[#7B9C8E]/40"
                    >
                      Aceptar renuncia del Ministro
                    </button>
                    <button
                      onClick={() => {
                        const res = resolveCensureAction(gameState, 'observar_pe');
                        setParlFeedback(res.message);
                        onUpdateState(res.nextState);
                      }}
                      className="rounded-lg bg-[#E87532] px-3 py-1.5 font-bold text-[#511E00]"
                    >
                      Observar Censura (Art. 148)
                    </button>
                  </>
                )}
                {gameState.censureProcess.status === 'observada_pe' && (
                  <button
                    onClick={() => {
                      const res = resolveCensureAction(gameState, 'ratificar_35');
                      setParlFeedback(res.message);
                      onUpdateState(res.nextState);
                    }}
                    className="rounded-lg bg-[#E87532] px-3 py-1.5 font-bold text-[#511E00]"
                  >
                    Votar Ratificación 3/5 (78/130) en Asamblea
                  </button>
                )}
                {gameState.censureProcess.status === 'ratificada' && caps.canPromulgateOrVetoBills && (
                  <>
                    <button
                      onClick={() => {
                        const res = resolveCensureAction(gameState, 'aceptar_renuncia');
                        setParlFeedback(res.message);
                        onUpdateState(res.nextState);
                      }}
                      className="rounded-lg bg-[#7B9C8E]/25 px-3 py-1.5 font-bold text-[#ACCEBF]"
                    >
                      Cesar Ministro
                    </button>
                    <button
                      onClick={() => {
                        const res = resolveCensureAction(gameState, 'disolver_camaras');
                        setParlFeedback(res.message);
                        onUpdateState(res.nextState);
                      }}
                      className="rounded-lg bg-[#93000A] px-3 py-1.5 font-bold text-[#FFDAD6]"
                    >
                      Disolver Cámaras y Convocar Elecciones (Art. 148)
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Agenda Legislativa, Contralor y Negociación de Bancadas */}
      <section className="warroom-card space-y-4 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#574239]/40 pb-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-base font-bold text-[#DFE3E4]">
              <Landmark className="h-4 w-4 text-[#E87532]" />
              Agenda Legislativa, Contralor y Trámite Bicameral
            </h2>
            <p className="text-xs text-[#CDC6B8]">
              Cargo actual: <strong className="text-[#FFB691]">{caps.roleSummaryLabel}</strong>
            </p>
          </div>
          <span className="font-mono-data text-xs font-bold text-[#FFB691]">
            Saldo: {gameState.player.politicalCapital} CP
          </span>
        </div>

        {!caps.canVoteOrSubmitInParliament && !caps.canSubmitToJunta && (
          <details className="rounded-lg border border-[#E87532]/45 bg-[#E87532]/15 p-3 text-xs text-[#FFDBCB]">
            <summary className="flex cursor-pointer items-center gap-2 font-bold">
              <Lock className="h-4 w-4 shrink-0 text-[#FFB691]" />
              Votación y presentación formal de leyes restringidas en tu rol actual
            </summary>
            <p className="mt-1.5 text-[11px] text-[#CDC6B8]">{caps.lockReasons.parliamentActions}</p>
          </details>
        )}

        {/* Contralor parlamentario completo (Arts. 118, 119, 120, 147–148) */}
        {(caps.canOversightGovernment || caps.canControlIntendente) && (
          <div className="space-y-3 rounded-lg border border-[#574239]/40 bg-[#171C1D] p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-[#DFE3E4]">
                <Gavel className="h-4 w-4 text-[#E87532]" />
                Contralor Constitucional al Poder Ejecutivo (Arts. 118–120 y 147–148)
              </span>
              {caps.canOversightGovernment && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <select
                    value={oversightChamber}
                    onChange={(e) => setOversightChamber(e.target.value as 'diputados' | 'senado')}
                    className="rounded border border-[#574239]/50 bg-[#0A0F10] px-2 py-1 text-xs text-[#DFE3E4]"
                  >
                    <option value="diputados">Diputados (1/3 = 33 · Maj. 50)</option>
                    <option value="senado">Senado (1/3 = 11 · Maj. 16)</option>
                  </select>
                  <select
                    value={selectedMinisterId}
                    onChange={(e) => setSelectedMinisterId(e.target.value)}
                    className="rounded border border-[#574239]/50 bg-[#0A0F10] px-2 py-1 text-xs text-[#DFE3E4]"
                  >
                    {gameState.cabinet
                      .filter((m) => !m.isVacant)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.ministryCode} — {m.holderName}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>

            {caps.canOversightGovernment && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={invTopic}
                  onChange={(e) => setInvTopic(e.target.value)}
                  placeholder="Objeto de comisión investigadora o censura"
                  className="min-w-[200px] flex-1 rounded-lg border border-[#574239]/50 bg-[#0A0F10] px-2.5 py-1.5 text-xs text-[#DFE3E4]"
                />
                <button
                  onClick={() => handleOversightAction('informe')}
                  className="min-h-[34px] rounded-lg border border-[#574239]/50 bg-[#262B2C] px-3 text-xs font-semibold text-[#DFE3E4] hover:border-[#E87532]"
                >
                  Informes Art. 118 (-4 CP)
                </button>
                <button
                  onClick={() => handleOversightAction('interpelacion')}
                  className="min-h-[34px] rounded-lg border border-[#E87532]/60 bg-[#E87532]/20 px-3 text-xs font-semibold text-[#FFB691] hover:bg-[#E87532] hover:text-[#511E00]"
                >
                  Interpelación 1/3 Art. 119 (-7 CP)
                </button>
                <button
                  onClick={() => handleOversightAction('investigadora')}
                  className="min-h-[34px] rounded-lg border border-[#ACCEBF]/50 bg-[#7B9C8E]/20 px-3 text-xs font-semibold text-[#ACCEBF] hover:bg-[#7B9C8E]/35"
                >
                  Investigadora Art. 120 (-6 CP)
                </button>
                <button
                  onClick={() => handleOversightAction('censura')}
                  className="min-h-[34px] rounded-lg border border-[#FFB4AB]/50 bg-[#93000A]/40 px-3 text-xs font-semibold text-[#FFDAD6] hover:bg-[#93000A]/70"
                >
                  Censura Art. 147 (-9 CP)
                </button>
              </div>
            )}

            {caps.canControlIntendente && (
              <button
                onClick={() => handleOversightAction('edil_informe')}
                className="min-h-[34px] rounded-lg border border-[#574239]/50 bg-[#262B2C] px-3 text-xs font-semibold text-[#DFE3E4] transition hover:border-[#E87532]"
              >
                Pedido de informes al Intendente (-3 CP)
              </button>
            )}
          </div>
        )}

        {/* Búsqueda informal de apoyos parlamentarios */}
        {!caps.canVoteOrSubmitInParliament && caps.canSeekParliamentarySupport && (
          <div className="rounded-lg border border-[#574239]/40 bg-[#171C1D] p-3.5">
            <div className="text-xs font-bold text-[#DFE3E4]">
              Ronda de diálogo con bancadas parlamentarias (Facultad de candidato / dirigente)
            </div>
            <p className="mt-0.5 text-[11px] text-[#CDC6B8]">
              Podés reunirte con sectores parlamentarios para preparar acuerdos (-3 CP).
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {gameState.parties
                .filter((p) => p.id !== gameState.player.partyId && (chambers.deputiesByParty[p.id] ?? 0) > 0)
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSeekInformalSupport(p.id)}
                    className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-[#574239]/50 bg-[#262B2C] px-2.5 text-xs font-semibold text-[#DFE3E4] transition hover:border-[#E87532]"
                  >
                    <Handshake className="h-3.5 w-3.5 text-[#FFB691]" />
                    Reunión con {p.acronym}
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Presentar nuevo proyecto de ley */}
        {(caps.canIntroduceNationalBills || caps.canSubmitToJunta) && (
          <form onSubmit={handleSubmitNewBill} className="rounded-lg border border-[#574239]/40 bg-[#171C1D] p-4">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-[#DFE3E4]">
              <FilePlus2 className="h-4 w-4 text-[#E87532]" />
              {caps.isInNationalOpposition
                ? 'Presentar proyecto alternativo de oposición (-5 CP)'
                : 'Presentar nuevo proyecto legislativo bicameral (-5 CP)'}
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Título del proyecto"
                className="rounded-lg border border-[#574239]/50 bg-[#0A0F10] px-3 py-2 text-xs text-[#DFE3E4] placeholder:text-[#CDC6B8]/50 focus:border-[#E87532] focus:outline-none"
              />
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as BillProposal['category'])}
                className="rounded-lg border border-[#574239]/50 bg-[#0A0F10] px-3 py-2 text-xs text-[#DFE3E4] focus:border-[#E87532] focus:outline-none"
              >
                <option value="economica">Económica</option>
                <option value="social">Social</option>
                <option value="laboral">Laboral</option>
                <option value="seguridad">Seguridad</option>
                <option value="institucional">Institucional</option>
                <option value="presupuestal">Presupuestal (plazo 45d)</option>
              </select>
              <select
                value={newOriginChamber}
                onChange={(e) => setNewOriginChamber(e.target.value as typeof newOriginChamber)}
                className="rounded-lg border border-[#574239]/50 bg-[#0A0F10] px-3 py-2 text-xs text-[#DFE3E4] focus:border-[#E87532] focus:outline-none"
              >
                {caps.canIntroduceNationalBills && (
                  <>
                    <option value="diputados">Origen: Diputados -&gt; Senado</option>
                    <option value="senado">Origen: Senado -&gt; Diputados</option>
                  </>
                )}
                {caps.canSubmitToJunta && (
                  <option value="junta_departamental">Junta Departamental</option>
                )}
              </select>
              <div className="flex gap-2">
                <input
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  placeholder="Objetivo del proyecto"
                  className="flex-1 rounded-lg border border-[#574239]/50 bg-[#0A0F10] px-3 py-2 text-xs text-[#DFE3E4] placeholder:text-[#CDC6B8]/50 focus:border-[#E87532] focus:outline-none"
                />
                <button
                  type="submit"
                  className="min-h-[38px] shrink-0 rounded-lg bg-[#E87532] px-3 text-xs font-bold text-[#511E00] transition hover:brightness-110"
                >
                  Ingresar
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Filtro */}
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'todas', label: `Todos (${gameState.bills.length})` },
              {
                id: 'oficialismo',
                label: `Oficialismo (${gameState.bills.filter((b) => b.origin === 'oficialismo' && b.status === 'en_negociacion').length})`,
              },
              {
                id: 'oposicion',
                label: `Oposición / Propios (${gameState.bills.filter((b) => b.origin !== 'oficialismo' && b.status === 'en_negociacion').length})`,
              },
              {
                id: 'resueltas',
                label: `Resueltos (${gameState.bills.filter((b) => b.status !== 'en_negociacion').length})`,
              },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              onClick={() => setBillFilter(f.id)}
              className={`rounded-full px-3.5 py-1.5 font-mono-data text-xs font-semibold transition ${
                billFilter === f.id
                  ? 'bg-[#E87532] text-[#511E00]'
                  : 'bg-[#262B2C] text-[#DEC1B4] hover:text-[#DFE3E4]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {parlFeedback && (
          <div className="rounded-lg border border-[#ACCEBF]/40 bg-[#7B9C8E]/15 p-3 text-xs font-medium text-[#E9E2D4]">
            {parlFeedback}
          </div>
        )}

        <div className="space-y-4">
          {filteredBills.map((bill) => {
            const isJuntaBill = bill.chamber === 'junta_departamental';
            const allowedForThisBill = canInteractWithBill(bill);
            const sponsorParty = gameState.parties.find((p) => p.id === bill.sponsorPartyId);
            const isOficialista = bill.origin === 'oficialismo';
            const stage: LegislativeStage = bill.legislativeStage ?? 'camara_origen_comision';
            const stageMeta = STAGE_META[stage];
            const relevantRivals = gameState.parties.filter((p) => {
              if (p.id === gameState.player.partyId) return false;
              if (isJuntaBill) return (chambers.juntaByParty[p.id] ?? 0) > 0;
              return (chambers.deputiesByParty[p.id] ?? 0) > 0 || (chambers.senateByParty[p.id] ?? 0) > 0;
            });

            return (
              <div key={bill.id} className="rounded-xl border border-[#574239]/40 bg-[#171C1D] p-4 shadow-md">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2 font-mono-data text-[10px] font-semibold uppercase text-[#DEC1B4]">
                      <span
                        className={`rounded px-1.5 py-0.5 font-bold ${
                          isOficialista
                            ? 'bg-[#7B9C8E]/25 text-[#ACCEBF]'
                            : 'bg-[#E87532]/25 text-[#FFB691]'
                        }`}
                      >
                        {isOficialista
                          ? `Oficialismo (${sponsorParty?.acronym ?? ''})`
                          : `Oposición / Propio (${sponsorParty?.acronym ?? ''})`}
                      </span>
                      <span className="rounded bg-[#262B2C] px-1.5 py-0.5 text-[#FFB691]">
                        {stageMeta.stageLabel} · {stageMeta.articleRef}
                      </span>
                      {bill.deadlineDaysRemaining !== undefined && bill.status === 'en_negociacion' && (
                        <span className="inline-flex items-center gap-1 rounded bg-[#93000A]/45 px-1.5 py-0.5 text-[#FFDAD6]">
                          <Clock className="h-3 w-3" />
                          Plazo: {bill.deadlineDaysRemaining} días
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1 font-display text-base font-semibold text-[#DFE3E4]">{bill.title}</h3>
                    <p className="mt-1 text-xs text-[#CDC6B8]">{bill.summary}</p>
                    <div className="mt-1 text-[11px] text-[#DEC1B4]">
                      Comisión: {bill.committeeName ?? 'Comisión General'} · Origen:{' '}
                      {bill.originChamber === 'senado'
                        ? 'Senado (31 c/ VP)'
                        : bill.originChamber === 'junta_departamental'
                        ? 'Junta Departamental (31)'
                        : 'Diputados (99)'}
                    </div>
                    <div className="mt-1 text-[11px] font-medium text-[#FFB691]">
                      Impacto estimado: {bill.effectsDescription}
                    </div>

                    {/* Barra visual de hitos bicamerales */}
                    {!isJuntaBill && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {STAGE_PROGRESS_ORDER.map((sKey, idx) => {
                          const currentIdx = STAGE_PROGRESS_ORDER.indexOf(stage);
                          const isPassed =
                            stage === 'aprobada' ||
                            (currentIdx >= 0 && idx < currentIdx) ||
                            (stage === 'devuelta_origen' && idx <= 2) ||
                            (stage === 'asamblea_general' && idx <= 2) ||
                            (stage === 'veto_parcial_o_total' && idx <= 3);
                          const isCurrent = sKey === stage;
                          const labels: Record<string, string> = {
                            camara_origen_comision: '1. Comisión',
                            camara_origen_plenario: '2. Origen',
                            camara_revisora: '3. Revisora',
                            promulgacion_ejecutivo: '4. Ejecutivo',
                            aprobada: '5. Vigente',
                          };
                          return (
                            <span
                              key={sKey}
                              className={`rounded px-2 py-0.5 font-mono-data text-[10px] font-bold ${
                                isCurrent
                                  ? 'bg-[#E87532] text-[#511E00]'
                                  : isPassed
                                  ? 'bg-[#7B9C8E]/25 text-[#ACCEBF]'
                                  : 'bg-[#0A0F10] text-[#CDC6B8]/55'
                              }`}
                            >
                              {labels[sKey]}
                            </span>
                          );
                        })}
                        {(stage === 'devuelta_origen' || stage === 'asamblea_general' || stage === 'veto_parcial_o_total') && (
                          <span className="rounded bg-[#93000A] px-2 py-0.5 font-mono-data text-[10px] font-bold text-[#FFDAD6]">
                            {stage === 'devuelta_origen'
                              ? 'Devuelta a Origen'
                              : stage === 'veto_parcial_o_total'
                              ? `Veto ${bill.executiveVetoKind ?? ''} (3/5)`
                              : 'Asamblea General (2/3)'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {bill.status === 'en_negociacion' ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {stage === 'promulgacion_ejecutivo' && caps.canPromulgateOrVetoBills ? (
                        <>
                          <button
                            onClick={() => handleExecutiveAction(bill, 'promulgar')}
                            className="inline-flex min-h-[38px] items-center gap-1 rounded-lg bg-[#7B9C8E] px-3 py-1.5 text-xs font-bold text-[#0A0F10] transition hover:brightness-110"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Promulgar (Art. 137)
                          </button>
                          <button
                            onClick={() => handleExecutiveAction(bill, 'veto_parcial')}
                            className="inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-[#E87532] bg-[#E87532]/20 px-2.5 py-1.5 text-xs font-bold text-[#FFB691] transition hover:bg-[#E87532] hover:text-[#511E00]"
                          >
                            Veto Parcial
                          </button>
                          <button
                            onClick={() => handleExecutiveAction(bill, 'veto_total')}
                            className="inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-[#FFB4AB]/50 bg-[#93000A]/45 px-2.5 py-1.5 text-xs font-bold text-[#FFDAD6] transition hover:bg-[#93000A]"
                          >
                            Veto Total
                          </button>
                        </>
                      ) : (
                        <>
                          {(caps.canParticipateInCommittees || (isJuntaBill && caps.canVoteInJunta)) &&
                            stage === 'camara_origen_comision' && (
                              <button
                                onClick={() => handleCommitteeDebate(bill)}
                                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#574239]/50 bg-[#262B2C] px-3 py-1.5 text-xs font-semibold text-[#DFE3E4] transition hover:border-[#E87532]"
                              >
                                <MessageSquare className="h-3.5 w-3.5 text-[#ACCEBF]" />
                                Dictaminar en Comisión (-3 CP)
                              </button>
                            )}
                          <button
                            disabled={!allowedForThisBill}
                            onClick={() => handleAdvanceBillStage(bill)}
                            className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-lg bg-[#E87532] px-3.5 py-2 text-xs font-bold text-[#511E00] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
                            title={!allowedForThisBill ? (isJuntaBill ? caps.lockReasons.juntaActions : caps.lockReasons.parliamentActions) : ''}
                          >
                            {allowedForThisBill ? <ArrowRight className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                            {getNextStageActionLabel(bill)}
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1.5 font-mono-data text-xs font-bold ${
                        bill.status === 'aprobada' ? 'text-[#ACCEBF]' : 'text-[#FFB4AB]'
                      }`}
                    >
                      {bill.status === 'aprobada' ? <Check className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      {bill.status === 'aprobada' ? 'LEY / DECRETO PROMULGADO' : 'RECHAZADA / ARCHIVADA'}
                    </span>
                  )}
                </div>

                {/* Fijar postura de la bancada ante proyectos */}
                {bill.status === 'en_negociacion' && bill.sponsorPartyId !== gameState.player.partyId && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#574239]/35 bg-[#0A0F10] px-3 py-2">
                    <span className="text-[11px] font-semibold text-[#CDC6B8]">
                      Postura de tu bancada (y voto VP si ejercés la Vicepresidencia):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          { id: 'a_favor', label: 'Apoyar (a favor)', activeCls: 'border-[#ACCEBF] bg-[#7B9C8E]/25 text-[#ACCEBF]' },
                          { id: 'en_contra', label: 'Votar en contra', activeCls: 'border-[#FFB4AB] bg-[#93000A]/50 text-[#FFDAD6]' },
                          { id: 'abstencion', label: 'Abstenerse', activeCls: 'border-[#E87532] bg-[#E87532]/25 text-[#FFB691]' },
                        ] as const
                      ).map((pos) => {
                        const active = bill.playerBenchPosition === pos.id;
                        return (
                          <button
                            key={pos.id}
                            onClick={() => handleSetBenchPosition(bill.id, pos.id)}
                            className={`rounded border px-2.5 py-1 text-[11px] font-bold transition ${
                              active
                                ? pos.activeCls
                                : 'border-[#574239]/40 bg-[#1B2021] text-[#DEC1B4] hover:border-[#E87532]'
                            }`}
                          >
                            {pos.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {bill.status === 'en_negociacion' && (
                  <div className="mt-3 border-t border-[#574239]/35 pt-3">
                    <div className="mb-2 text-[11px] font-semibold text-[#DEC1B4]">
                      Posición estimada por bancada
                      {allowedForThisBill ? ' y negociación de votos:' : ' (solo lectura para tu cargo actual):'}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {relevantRivals.map((p) => {
                        const prob = Math.round(estimatePartyBillSupport(gameState, bill, p) * 100);
                        return (
                          <div
                            key={p.id}
                            className="flex items-center gap-2 rounded-lg border border-[#574239]/40 bg-[#262B2C] px-2.5 py-1.5 text-xs"
                          >
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                            <span className="font-bold text-[#DFE3E4]">{p.acronym}</span>
                            <span
                              className={`font-mono-data font-bold ${
                                prob >= 60 ? 'text-[#ACCEBF]' : prob >= 40 ? 'text-[#FFB691]' : 'text-[#FFB4AB]'
                              }`}
                            >
                              {prob}%
                            </span>
                            {allowedForThisBill && (
                              <button
                                onClick={() => handleNegotiateBill(bill.id, p.id, 'concesion')}
                                className="inline-flex items-center gap-1 rounded bg-[#0A0F10] px-2 py-1 font-mono-data text-[10px] font-semibold text-[#FFB691] transition hover:bg-[#E87532] hover:text-[#511E00]"
                                title="Negociar concesión programática (-5 CP)"
                              >
                                <Handshake className="h-3 w-3" /> Negociar (-5 CP)
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {bill.concessionsApplied.length > 0 && (
                      <div className="mt-2 text-[11px] font-medium text-[#ACCEBF]">
                        Acuerdos e instancias: {bill.concessionsApplied.join(' · ')}
                      </div>
                    )}
                  </div>
                )}

                {/* Trazabilidad de votaciones bicamerales */}
                {(bill.originChamberResult || bill.reviewChamberResult || bill.assemblyResult || bill.voteBreakdown) && (
                  <div className="mt-3 space-y-1.5 border-t border-[#574239]/35 pt-3 text-xs">
                    {bill.originChamberResult && (
                      <div className="text-[11px] text-[#CDC6B8]">
                        <strong className="text-[#DFE3E4]">Origen ({bill.originChamberResult.chamberName}):</strong>{' '}
                        <span className="font-mono-data text-[#ACCEBF]">{bill.originChamberResult.yes} Sí</span> /{' '}
                        <span className="font-mono-data text-[#FFB4AB]">{bill.originChamberResult.no} No</span>
                        {bill.originChamberResult.vpVoted && ` · VP: ${bill.originChamberResult.vpVoted === 'a_favor' ? 'A favor' : 'En contra'}`}
                      </div>
                    )}
                    {bill.reviewChamberResult && (
                      <div className="text-[11px] text-[#CDC6B8]">
                        <strong className="text-[#DFE3E4]">Revisora ({bill.reviewChamberResult.chamberName}):</strong>{' '}
                        <span className="font-mono-data text-[#ACCEBF]">{bill.reviewChamberResult.yes} Sí</span> /{' '}
                        <span className="font-mono-data text-[#FFB4AB]">{bill.reviewChamberResult.no} No</span>
                        {bill.reviewChamberResult.modified ? ' (con modificaciones)' : ''}
                      </div>
                    )}
                    {bill.assemblyResult && (
                      <div className="text-[11px] text-[#CDC6B8]">
                        <strong className="text-[#FFB691]">{bill.assemblyResult.reason}:</strong>{' '}
                        <span className="font-mono-data text-[#ACCEBF]">{bill.assemblyResult.yes} Sí</span> /{' '}
                        <span className="font-mono-data text-[#FFB4AB]">{bill.assemblyResult.no} No</span>
                      </div>
                    )}
                    {bill.voteBreakdown && (
                      <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-[#CDC6B8]">
                        {bill.voteBreakdown.byParty.map((bp) => (
                          <span key={bp.partyId}>
                            <strong className="text-[#E9E2D4]">{bp.partyName}:</strong> {bp.yes}–{bp.no}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Historial Legislativo */}
      <section className="warroom-card rounded-xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[#CDC6B8]" />
            <span className="font-display text-base font-medium text-[#DFE3E4]">
              Historial Legislativo del Período
            </span>
          </div>
          <span className="font-mono-data text-[11px] text-[#DEC1B4]">Ciclo #{gameState.cycleNumber}</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-lg bg-[#171C1D] p-3">
            <div className="flex items-center justify-between">
              <span className="font-mono-data text-[10px] font-semibold uppercase text-[#ACCEBF]">
                Promulgadas
              </span>
              <Check className="h-4 w-4 text-[#ACCEBF]" />
            </div>
            <div className="mt-1 font-display text-2xl font-bold text-[#DFE3E4]">{approvedBills.length}</div>
            <span className="text-[11px] text-[#DEC1B4]">Sanción y promulgación registrada</span>
          </div>

          <div className="rounded-lg bg-[#171C1D] p-3">
            <div className="flex items-center justify-between">
              <span className="font-mono-data text-[10px] font-semibold uppercase text-[#FFB4AB]">
                Rechazadas / Vencidas
              </span>
              <XCircle className="h-4 w-4 text-[#FFB4AB]" />
            </div>
            <div className="mt-1 font-display text-2xl font-bold text-[#DFE3E4]">{rejectedBills.length}</div>
            <span className="text-[11px] text-[#DEC1B4]">Sin sanción o plazo expirado</span>
          </div>
        </div>
      </section>
    </div>
  );
};
