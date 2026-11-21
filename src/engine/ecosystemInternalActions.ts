import { DEBATE_QUESTIONS } from '../data/expansionData';
import type {
  DebateAnswerRecord,
  DebateSessionState,
  EcosystemActionResult,
  MediaNewsState,
  NewsTone,
} from '../types/expansion';
import type { GameState } from '../types/game';
import { createInitialEcosystemState } from './ecosystemFactory';
import {
  applyApproval,
  canSpend,
  clamp,
  ensureEcosystem,
  fail,
  getAdvisorCapacity,
  postureFor,
  r1,
  setExpansion,
  spend,
  success,
  withLog,
} from './ecosystemShared';

export function courtFaction(state: GameState, factionId: string): EcosystemActionResult {
  const eco = ensureEcosystem(state, createInitialEcosystemState);
  const faction = eco.factions.find(
    (f) => f.id === factionId && f.partyId === state.player.partyId
  );
  if (!faction) return fail(state, 'No encontré ese sector en tu partido.');
  const costError = canSpend(state, 3);
  if (costError) return fail(state, costError);

  const factions = eco.factions.map((f) =>
    f.id === factionId
      ? {
          ...f,
          loyalty: r1(clamp(f.loyalty + 8, 0, 100)),
          mood: r1(clamp(f.mood + 7, 0, 100)),
          influence: r1(clamp(f.influence + 1, 0, 100)),
          posture: postureFor(f.loyalty + 8),
          lastActionDateLabel: `${state.currentYear}-${state.currentMonth}`,
        }
      : f
  );
  const challenges = eco.challenges.map((c) =>
    c.factionId === factionId && c.status === 'abierta'
      ? { ...c, internalSupportPct: r1(clamp(c.internalSupportPct - 4, 0, 100)) }
      : c
  );

  const next = setExpansion(spend(state, 3), { ...eco, factions, challenges });
  return success(
    state,
    `Acercamiento con ${faction.shortName}: +8 lealtad interna.`,
    withLog(
      state,
      next,
      `Acercamiento con ${faction.shortName}`,
      'La conducción partidaria atendió demandas del sector y mejoró la convivencia interna.',
      'politica'
    )
  );
}

export function grantFactionPost(state: GameState, factionId: string): EcosystemActionResult {
  const eco = ensureEcosystem(state, createInitialEcosystemState);
  const faction = eco.factions.find(
    (f) => f.id === factionId && f.partyId === state.player.partyId
  );
  if (!faction) return fail(state, 'No encontré ese sector en tu partido.');
  const costError = canSpend(state, 5, 3000000);
  if (costError) return fail(state, costError);

  const vacant = state.cabinet.find((m) => m.isVacant);
  const cabinet = vacant
    ? state.cabinet.map((m) =>
        m.id === vacant.id
          ? {
              ...m,
              isVacant: false,
              holderName: faction.leaderName,
              partyId: faction.partyId,
              sectorName: faction.shortName,
              management: Math.round(clamp(45 + faction.influence * 0.3, 30, 90)),
              popularity: Math.round(clamp(40 + faction.influence * 0.2, 25, 85)),
              experience: Math.round(clamp(40 + faction.influence * 0.3, 25, 90)),
              affinity: Math.round(faction.loyalty),
              loyalty: Math.round(clamp(55 + faction.loyalty * 0.25, 30, 98)),
            }
          : m
      )
    : state.cabinet;

  const factions = eco.factions.map((f) =>
    f.id === factionId
      ? {
          ...f,
          loyalty: r1(clamp(f.loyalty + 15, 0, 100)),
          influence: r1(clamp(f.influence + 5, 0, 100)),
          mood: r1(clamp(f.mood + 12, 0, 100)),
          demandsMet: f.demandsMet + 1,
          posture: 'apoyo' as const,
          lastActionDateLabel: `${state.currentYear}-${state.currentMonth}`,
        }
      : f
  );

  const next = setExpansion(spend(state, 5, 3000000), {
    ...eco,
    factions,
  });
  const detail = vacant
    ? `${faction.leaderName} asumió ${vacant.ministryName} y el sector se incorporó al gobierno.`
    : 'Se otorgó un cargo partidario de primera línea al sector.';
  return success(
    state,
    `${faction.shortName}: +15 lealtad${vacant ? ' y un ministerio' : ''}.`,
    withLog(state, { ...next, cabinet }, `Cargo para ${faction.shortName}`, detail, 'gobierno')
  );
}

export function confrontFaction(state: GameState, factionId: string): EcosystemActionResult {
  const eco = ensureEcosystem(state, createInitialEcosystemState);
  const faction = eco.factions.find(
    (f) => f.id === factionId && f.partyId === state.player.partyId
  );
  if (!faction) return fail(state, 'No encontré ese sector en tu partido.');
  const costError = canSpend(state, 4);
  if (costError) return fail(state, costError);

  let factions = eco.factions.map((f) => {
    if (f.id === factionId) {
      const loyalty = clamp(f.loyalty - 18, 0, 100);
      return {
        ...f,
        loyalty: r1(loyalty),
        mood: r1(clamp(f.mood - 15, 0, 100)),
        influence: r1(clamp(f.influence - 8, 0, 100)),
        posture: postureFor(loyalty),
        lastActionDateLabel: `${state.currentYear}-${state.currentMonth}`,
      };
    }
    if (f.partyId === state.player.partyId) {
      return { ...f, loyalty: r1(clamp(f.loyalty + 3, 0, 100)) };
    }
    return f;
  });

  let challenges = eco.challenges.map((c) =>
    c.factionId === factionId && c.status === 'abierta'
      ? { ...c, internalSupportPct: r1(clamp(c.internalSupportPct - 10, 0, 100)) }
      : c
  );
  const hasOpen = challenges.some(
    (c) => c.partyId === state.player.partyId && c.status === 'abierta'
  );
  if (!hasOpen && faction.influence > 45 && Math.random() < 0.25) {
    challenges = [
      ...challenges,
      {
        id: `challenge_${Date.now()}`,
        partyId: state.player.partyId,
        factionId,
        factionName: faction.shortName,
        challengerName: faction.leaderName,
        dateLabel: `${state.currentYear}-${state.currentMonth}`,
        internalSupportPct: r1(clamp(45 + Math.random() * 20, 25, 75)),
        monthsOpen: 0,
        status: 'abierta' as const,
      },
    ];
  }

  const next = setExpansion(spend(state, 4), { ...eco, factions, challenges });
  return success(
    state,
    `Confrontaste a ${faction.shortName}: -18 lealtad, +3 en el resto del partido.`,
    withLog(
      state,
      next,
      `Confrontación interna con ${faction.shortName}`,
      'La conducción marcó límites al sector y el resto de las corrientes cerró filas.',
      'politica'
    )
  );
}

export function hireAdvisor(state: GameState, advisorId: string): EcosystemActionResult {
  const eco = ensureEcosystem(state, createInitialEcosystemState);
  const advisor = eco.advisors.find((a) => a.id === advisorId && a.status === 'disponible');
  if (!advisor) return fail(state, 'Ese asesor no está disponible.');
  const costError = canSpend(state, 4, advisor.signingCostUYU);
  if (costError) return fail(state, costError);

  const advisors = eco.advisors.map((a) =>
    a.id === advisorId
      ? {
          ...a,
          status: 'contratado' as const,
          hiredDateLabel: `${state.currentYear}-${state.currentMonth}`,
        }
      : a
  );
  const next = setExpansion(spend(state, 4, advisor.signingCostUYU), { ...eco, advisors });
  return success(
    state,
    `${advisor.name} se sumó al equipo (${advisor.roleLabel}).`,
    withLog(
      state,
      next,
      `Nuevo asesor: ${advisor.name}`,
      `${advisor.roleLabel} · ${advisor.effectSummary}`,
      'gobierno'
    )
  );
}

export function dismissAdvisor(state: GameState, advisorId: string): EcosystemActionResult {
  const eco = ensureEcosystem(state, createInitialEcosystemState);
  const advisor = eco.advisors.find((a) => a.id === advisorId && a.status === 'contratado');
  if (!advisor) return fail(state, 'Ese asesor no está contratado.');
  const costError = canSpend(state, 2);
  if (costError) return fail(state, costError);

  const severance = Math.min(state.player.campaignFundsUYU, advisor.salaryMonthlyUYU);
  const advisors = eco.advisors.map((a) =>
    a.id === advisorId
      ? { ...a, status: 'despedido' as const }
      : a.status === 'contratado'
      ? { ...a, loyalty: r1(clamp(a.loyalty - 3, 0, 100)) }
      : a
  );
  const next = setExpansion(spend(state, 2, severance), { ...eco, advisors });
  return success(
    state,
    `${advisor.name} dejó el equipo.`,
    withLog(
      state,
      next,
      `Salida de asesor`,
      `${advisor.name} fue despedido; el resto del equipo resintió la decisión.`,
      'gobierno'
    )
  );
}

function mediaScore(state: GameState, affinity: number): number {
  const communication = getAdvisorCapacity(state, 'comunicacion');
  return clamp(
    50 +
      (state.player.attributes.charisma - 50) * 0.5 +
      (affinity - 50) * 0.35 +
      communication * 0.12 +
      (Math.random() * 20 - 10),
    0,
    100
  );
}

function toneFor(score: number): NewsTone {
  return score >= 62 ? 'positiva' : score <= 42 ? 'negativa' : 'neutra';
}

function addMediaNews(
  eco: GameState['expansion'],
  news: MediaNewsState
): GameState['expansion'] {
  if (!eco) return eco;
  return { ...eco, mediaNews: [news, ...eco.mediaNews].slice(0, 12) };
}

export function mediaInterview(state: GameState, outletId: string): EcosystemActionResult {
  const eco = ensureEcosystem(state, createInitialEcosystemState);
  const outlet = eco.mediaOutlets.find((o) => o.id === outletId);
  if (!outlet) return fail(state, 'No encontré ese medio.');
  const costError = canSpend(state, 3);
  if (costError) return fail(state, costError);

  const score = mediaScore(state, outlet.affinity);
  const tone = toneFor(score);
  const impact = ((score - 50) / 10) * (outlet.credibility / 100) * (outlet.audiencePct / 25);
  const approvalDelta = impact * 0.5;
  const popularityDelta = impact * 0.65;
  const nextNews: MediaNewsState = {
    id: `news_int_${Date.now()}`,
    dateLabel: `${state.currentYear}-${state.currentMonth}`,
    outletId: outlet.id,
    outletName: outlet.name,
    headline:
      tone === 'positiva'
        ? `${state.player.name} defendió su gestión en ${outlet.name}`
        : tone === 'negativa'
        ? `Entrevista tensa: ${state.player.name} respondió por la economía`
        : `${state.player.name} repasó su agenda en ${outlet.name}`,
    tone,
    impact: Math.round(impact),
    topic: 'Entrevista',
  };
  const mediaOutlets = eco.mediaOutlets.map((o) =>
    o.id === outletId
      ? {
          ...o,
          affinity: r1(clamp(o.affinity + (tone === 'positiva' ? 3 : tone === 'negativa' ? -2 : 0), 5, 95)),
          lastCoverageDateLabel: `${state.currentYear}-${state.currentMonth}`,
        }
      : o
  );
  const withApproval = applyApproval(state, approvalDelta, popularityDelta);
  const next = setExpansion(spend(withApproval, 3), {
    ...eco,
    mediaOutlets,
    mediaNews: [nextNews, ...eco.mediaNews].slice(0, 12),
  });
  return success(
    state,
    `Entrevista en ${outlet.name}: ${tone} (${Math.round(score)}/100).`,
    withLog(
      state,
      next,
      `Entrevista en ${outlet.name}`,
      nextNews.headline,
      'campana'
    )
  );
}

export function mediaPressConference(
  state: GameState,
  outletId: string
): EcosystemActionResult {
  const eco = ensureEcosystem(state, createInitialEcosystemState);
  const outlet = eco.mediaOutlets.find((o) => o.id === outletId) ?? eco.mediaOutlets[0];
  if (!outlet) return fail(state, 'No hay medios disponibles.');
  const costError = canSpend(state, 5, 1000000);
  if (costError) return fail(state, costError);

  const score = clamp(mediaScore(state, outlet.affinity) + 4, 0, 100);
  const tone = toneFor(score);
  const reach = eco.mediaOutlets.reduce(
    (sum, o) => sum + (o.audiencePct / 100) * (o.credibility / 100),
    0
  );
  const impact = ((score - 50) / 10) * reach;
  const approvalDelta = impact * 0.6;
  const popularityDelta = impact * 0.85;

  const topOutlets = [...eco.mediaOutlets].sort((a, b) => b.audiencePct - a.audiencePct).slice(0, 2);
  const freshNews: MediaNewsState[] = topOutlets.map((o, index) => ({
    id: `news_pc_${Date.now()}_${index}`,
    dateLabel: `${state.currentYear}-${state.currentMonth}`,
    outletId: o.id,
    outletName: o.name,
    headline:
      tone === 'positiva'
        ? `Conferencia de prensa: el gobierno marcó la agenda`
        : tone === 'negativa'
        ? `Conferencia de prensa: preguntas incómodas y respuestas débiles`
        : `El gobierno expuso sus prioridades ante la prensa`,
    tone,
    impact: Math.round(impact),
    topic: 'Conferencia',
  }));
  const mediaOutlets = eco.mediaOutlets.map((o) => ({
    ...o,
    affinity: r1(
      clamp(o.affinity + (tone === 'positiva' ? 2 : tone === 'negativa' ? -1 : 0), 5, 95)
    ),
    lastCoverageDateLabel: `${state.currentYear}-${state.currentMonth}`,
  }));
  const withApproval = applyApproval(state, approvalDelta, popularityDelta);
  const next = setExpansion(spend(withApproval, 5, 1000000), {
    ...eco,
    mediaOutlets,
    mediaNews: [...freshNews, ...eco.mediaNews].slice(0, 12),
  });
  return success(
    state,
    `Conferencia de prensa: impacto ${tone} (${Math.round(score)}/100).`,
    withLog(
      state,
      next,
      'Conferencia de prensa',
      `Cobertura en ${topOutlets.map((o) => o.name).join(' y ')}.`,
      'campana'
    )
  );
}

export function startDebate(state: GameState, debateId: string): EcosystemActionResult {
  const eco = ensureEcosystem(state, createInitialEcosystemState);
  const debate = eco.debates.find((d) => d.id === debateId && d.status === 'programado');
  if (!debate) return fail(state, 'Ese debate no está disponible.');
  if (
    state.currentYear < debate.scheduledYear ||
    (state.currentYear === debate.scheduledYear && state.currentMonth < debate.scheduledMonth)
  ) {
    return fail(state, 'El debate todavía no está agendado para este mes.');
  }
  const debates = eco.debates.map((d) =>
    d.id === debateId ? { ...d, status: 'en_curso' as const, currentQuestionIndex: 0 } : d
  );
  const next = setExpansion(state, { ...eco, debates });
  return success(
    state,
    'Debate iniciado. Respondé las preguntas para definir tu desempeño.',
    withLog(
      state,
      next,
      `Debate ${debate.kind}`,
      `Cara a cara con ${debate.opponentNames.join(', ')}.`,
      'campana'
    )
  );
}

export function answerDebate(
  state: GameState,
  debateId: string,
  optionId: string
): EcosystemActionResult {
  const eco = ensureEcosystem(state, createInitialEcosystemState);
  const debate = eco.debates.find((d) => d.id === debateId && d.status === 'en_curso');
  if (!debate) return fail(state, 'No hay un debate en curso.');
  const questions = DEBATE_QUESTIONS.slice(0, 5);
  const question = questions[debate.currentQuestionIndex];
  if (!question) return fail(state, 'El debate ya terminó.');
  const option = question.options.find((o) => o.id === optionId);
  if (!option) return fail(state, 'Esa respuesta no está disponible.');

  const idealDistance =
    (Math.abs(option.economic - state.player.ideology.economic) +
      Math.abs(option.social - state.player.ideology.social)) /
    2;
  const coherence = clamp(100 - idealDistance, 0, 100);
  const communication = getAdvisorCapacity(state, 'comunicacion');
  const argument = clamp(
    option.argument * (0.65 + state.player.attributes.negotiation / 300) + communication * 0.15,
    0,
    100
  );
  const proposal = clamp(
    option.proposal * (0.65 + state.player.attributes.management / 300),
    0,
    100
  );
  const score = clamp(
    coherence * 0.4 + argument * 0.3 + proposal * 0.3 + (Math.random() * 8 - 4),
    0,
    100
  );
  const record: DebateAnswerRecord = {
    questionId: question.id,
    optionId,
    score: r1(score),
    note:
      coherence >= 70
        ? 'Coherente con tu perfil ideológico.'
        : coherence >= 45
        ? 'Postura aceptable, con matices.'
        : 'Respuesta incómoda para tu base.',
  };
  const answers = [...debate.answers, record];
  const isLast = answers.length >= questions.length;

  let debates = eco.debates.map((d) =>
    d.id === debateId
      ? {
          ...d,
          answers,
          currentQuestionIndex: isLast ? d.currentQuestionIndex : d.currentQuestionIndex + 1,
        }
      : d
  );

  if (!isLast) {
    const next = setExpansion(state, { ...eco, debates });
    return success(
      state,
      `${question.topic}: ${Math.round(score)}/100. ${record.note}`,
      withLog(state, next, `Debate · ${question.topic}`, record.note, 'campana')
    );
  }

  const total = r1(answers.reduce((sum, a) => sum + a.score, 0) / answers.length);
  const pollImpact = r1((total - 50) / 8);
  const approvalImpact = r1((total - 50) / 20);
  const reputationImpact = r1((total - 50) / 10);
  const finalDebate: DebateSessionState = {
    ...debate,
    answers,
    currentQuestionIndex: questions.length,
    status: 'finalizado',
    score: total,
    pollImpact,
    approvalImpact,
    reputationImpact,
    summary:
      total >= 65
        ? 'Actuación sólida: ganaste la agenda del debate.'
        : total >= 50
        ? 'Actuación aceptable, sin errores graves.'
        : 'Actuación floja: la oposición capitalizó el debate.',
  };
  debates = debates.map((d) => (d.id === debateId ? finalDebate : d));
  const parties = state.parties.map((p) =>
    p.id === state.player.partyId
      ? {
          ...p,
          currentPollShare: r1(clamp(p.currentPollShare + pollImpact, 0.5, 70)),
          campaignMomentum: r1(clamp(p.campaignMomentum + pollImpact * 0.5, -15, 15)),
        }
      : p
  );
  const withApproval = applyApproval(state, approvalImpact, reputationImpact);
  const next = setExpansion({ ...withApproval, parties }, { ...eco, debates });
  return success(
    state,
    `Debate finalizado: ${Math.round(total)}/100 · ${finalDebate.summary}`,
    withLog(
      state,
      next,
      `Debate ${debate.kind} finalizado`,
      `${finalDebate.summary} Impacto en encuestas: ${pollImpact >= 0 ? '+' : ''}${pollImpact} pts.`,
      'campana'
    )
  );
}
