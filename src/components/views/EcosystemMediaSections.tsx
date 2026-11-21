import React from 'react';
import { Briefcase, Mic, Newspaper, UserRound } from 'lucide-react';
import { DEBATE_QUESTIONS } from '../../data/expansionData';
import type { EcosystemAction, PoliticalEcosystemState } from '../../types/expansion';
import type { GameState } from '../../types/game';
import { Btn, EC, EcoCard, Empty, Meter, Pill, Row, toneFor } from './ecosystemUi';

interface Props {
  gameState: GameState;
  eco: PoliticalEcosystemState;
  run: (action: EcosystemAction) => void;
}

export const AdvisorsSection: React.FC<Props> = ({ eco, run }) => {
  const hired = eco.advisors.filter((a) => a.status === 'contratado');
  const available = eco.advisors.filter((a) => a.status === 'disponible');
  const totalSalary = hired.reduce((sum, a) => sum + a.salaryMonthlyUYU, 0);
  return (
    <EcoCard
      title="Equipo y asesores"
      subtitle="Capacidad real aplicada a cada área"
      icon={<Briefcase className="h-4 w-4 text-[#FFB691]" />}
      right={
        <Pill tone={hired.length > 0 ? 'good' : 'neutral'}>
          {hired.length} contratados · ${(totalSalary / 1000000).toFixed(1)}M/mes
        </Pill>
      }
    >
      {hired.map((advisor) => (
        <Row key={advisor.id}>
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-xs font-bold text-[#DFE3E4]">{advisor.name}</span>
            <Pill tone="good">{advisor.roleLabel}</Pill>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Meter value={advisor.capacity} tone="good" />
            <span className="shrink-0 text-[10px] text-[#CDC6B8]">{advisor.capacity}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[10px] text-[#CDC6B8]">{advisor.effectSummary}</span>
            <Btn tone="danger" onClick={() => run({ type: 'dismiss_advisor', advisorId: advisor.id })}>
              Despedir · 2 CP
            </Btn>
          </div>
        </Row>
      ))}
      {hired.length === 0 && <Empty>Sin asesores contratados: perdés los bonus mensuales de gestión.</Empty>}
      <div className="max-h-[300px] space-y-1.5 overflow-y-auto pr-1">
        {available.map((advisor) => (
          <Row key={advisor.id}>
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="text-xs font-bold text-[#DFE3E4]">{advisor.name}</span>
              <Pill tone="accent">{advisor.roleLabel}</Pill>
            </div>
            <p className="mt-0.5 text-[10px] text-[#CDC6B8]">{advisor.effectSummary}</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="text-[10px] text-[#CDC6B8]">
                ${(advisor.salaryMonthlyUYU / 1000000).toFixed(1)}M/mes · alta $
                {(advisor.signingCostUYU / 1000000).toFixed(1)}M
              </span>
              <Btn tone="primary" onClick={() => run({ type: 'hire_advisor', advisorId: advisor.id })}>
                Contratar · 4 CP
              </Btn>
            </div>
          </Row>
        ))}
      </div>
    </EcoCard>
  );
};

export const MediaSection: React.FC<Props> = ({ eco, run }) => {
  const news = eco.mediaNews.slice(0, 4);
  return (
    <EcoCard
      title="Medios y opinión"
      subtitle="Cobertura, credibilidad y agenda pública"
      icon={<Newspaper className="h-4 w-4 text-[#ACCEBF]" />}
      right={
        <Btn tone="primary" onClick={() => run({ type: 'media_press_conference', outletId: eco.mediaOutlets[0]?.id ?? '' })}>
          <Mic className="h-3 w-3" /> Conferencia · 5 CP
        </Btn>
      }
    >
      {news.map((item) => (
        <Row key={item.id}>
          <div className="flex items-start justify-between gap-1">
            <p className="text-[11px] font-semibold text-[#DFE3E4]">{item.headline}</p>
            <Pill tone={item.tone === 'positiva' ? 'good' : item.tone === 'negativa' ? 'bad' : 'warn'}>
              {item.tone}
            </Pill>
          </div>
          <p className="mt-0.5 text-[10px] text-[#CDC6B8]">
            {item.outletName} · {item.dateLabel}
          </p>
        </Row>
      ))}
      <div className="max-h-[260px] space-y-1.5 overflow-y-auto pr-1">
        {eco.mediaOutlets.map((outlet) => (
          <Row key={outlet.id}>
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="text-xs font-bold text-[#DFE3E4]">{outlet.name}</span>
              <Pill tone={outlet.affinity >= 55 ? 'good' : outlet.affinity <= 35 ? 'bad' : 'warn'}>
                Afinidad {outlet.affinity.toFixed(0)}
              </Pill>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <Meter value={outlet.affinity} tone={toneFor(outlet.affinity)} />
              <span className="shrink-0 text-[10px] text-[#CDC6B8]">{outlet.audiencePct}% aud.</span>
            </div>
            <div className="mt-1.5 flex justify-end">
              <Btn onClick={() => run({ type: 'media_interview', outletId: outlet.id })}>
                Entrevista · 3 CP
              </Btn>
            </div>
          </Row>
        ))}
      </div>
    </EcoCard>
  );
};

export const DebatesSection: React.FC<Props> = ({ gameState, eco, run }) => {
  const inProgress = eco.debates.find((d) => d.status === 'en_curso');
  const scheduled = eco.debates.find((d) => d.status === 'programado');
  const finished = eco.debates.filter((d) => d.status === 'finalizado').slice(-2).reverse();
  const question = inProgress ? DEBATE_QUESTIONS[inProgress.currentQuestionIndex] : undefined;

  return (
    <EcoCard
      title="Debates"
      subtitle="Coherencia ideológica, argumento y propuesta"
      icon={<UserRound className="h-4 w-4 text-[#E8C57A]" />}
      right={
        inProgress && question ? (
          <Pill tone="accent">
            {inProgress.currentQuestionIndex + 1}/{Math.min(5, DEBATE_QUESTIONS.length)}
          </Pill>
        ) : undefined
      }
    >
      {!inProgress && scheduled && (
        <Row className="border-[#E87532]/45">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-xs font-bold text-[#DFE3E4]">Debate {scheduled.kind}</span>
            <Pill tone="accent">
              {scheduled.scheduledMonth}/{String(scheduled.scheduledYear).slice(2)}
            </Pill>
          </div>
          <p className="mt-0.5 text-[11px] text-[#CDC6B8]">
            Rivales: {scheduled.opponentNames.join(', ') || 'a confirmar'}
          </p>
          <Btn tone="primary" className="mt-1.5" onClick={() => run({ type: 'start_debate', debateId: scheduled.id })}>
            Iniciar debate
          </Btn>
        </Row>
      )}
      {inProgress && question && (
        <Row className="border-[#E87532]/60">
          <p className="text-[11px] font-bold text-[#FFB691]">{question.topic}</p>
          <p className="mt-0.5 text-xs text-[#DFE3E4]">{question.prompt}</p>
          <div className="mt-1.5 space-y-1">
            {question.options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => run({ type: 'answer_debate', debateId: inProgress.id, optionId: option.id })}
                className={`w-full rounded-lg border ${EC.border} bg-[#262B2C] px-2.5 py-1.5 text-left text-[11px] text-[#DFE3E4] transition hover:border-[#E87532]/60 hover:bg-[#2E3435] active:scale-[0.99]`}
              >
                {option.text}
              </button>
            ))}
          </div>
        </Row>
      )}
      {inProgress && !question && <Empty>El debate se está cerrando.</Empty>}
      {!inProgress && !scheduled && <Empty>No hay debates agendados en esta fase.</Empty>}
      {finished.map((debate) => (
        <Row key={debate.id}>
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-bold text-[#DFE3E4]">Debate {debate.kind}</span>
            <Pill tone={debate.score >= 60 ? 'good' : debate.score >= 45 ? 'warn' : 'bad'}>
              {debate.score.toFixed(0)}/100
            </Pill>
          </div>
          <p className="mt-0.5 text-[10px] text-[#CDC6B8]">{debate.summary}</p>
        </Row>
      ))}
      {gameState.careerPhase !== 'campana' && (
        <p className="text-[10px] text-[#CDC6B8]">
          Los debates se habilitan durante la campaña electoral.
        </p>
      )}
    </EcoCard>
  );
};
