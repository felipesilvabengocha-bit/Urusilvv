import React from 'react';
import { AlertTriangle, Flag, Handshake, Swords, Users } from 'lucide-react';
import type { EcosystemAction, PoliticalEcosystemState } from '../../types/expansion';
import type { GameState } from '../../types/game';
import { Btn, EC, EcoCard, Empty, Meter, Pill, Row, toneFor } from './ecosystemUi';

interface Props {
  gameState: GameState;
  eco: PoliticalEcosystemState;
  run: (action: EcosystemAction) => void;
}

const POSTURE: Record<string, { label: string; tone: 'good' | 'warn' | 'bad' }> = {
  apoyo: { label: 'Apoyo', tone: 'good' },
  neutral: { label: 'Neutral', tone: 'warn' },
  obstruccion: { label: 'Obstrucción', tone: 'bad' },
};

export const FactionsSection: React.FC<Props> = ({ gameState, eco, run }) => {
  const factions = eco.factions.filter((f) => f.partyId === gameState.player.partyId);
  const challenges = eco.challenges.filter((c) => c.status === 'abierta');
  return (
    <EcoCard
      title="Facciones internas"
      subtitle="Lealtad, demandas y disputa por la conducción"
      icon={<Users className="h-4 w-4 text-[#FFB691]" />}
      right={<Pill tone="accent">{factions.length} sectores</Pill>}
    >
      {challenges.map((challenge) => (
        <Row key={challenge.id} className="border-[#C25A4E]/50">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-[#F08A7E]">Desafío de {challenge.factionName}</span>
            <Pill tone="bad">{challenge.internalSupportPct.toFixed(0)}% apoyo</Pill>
          </div>
          <p className="mt-0.5 text-[11px] text-[#CDC6B8]">
            {challenge.challengerName} cuestiona tu conducción. Se resuelve solo en 3 meses.
          </p>
        </Row>
      ))}
      {factions.length === 0 && <Empty>Tu partido no tiene sectores registrados.</Empty>}
      {factions.map((faction) => {
        const posture = POSTURE[faction.posture];
        return (
          <Row key={faction.id}>
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="min-w-0">
                <span className="text-xs font-bold text-[#DFE3E4]">{faction.shortName}</span>
                <span className="ml-1.5 text-[11px] text-[#CDC6B8]">{faction.leaderName}</span>
              </div>
              <Pill tone={posture.tone}>{posture.label}</Pill>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <div>
                <div className="flex justify-between text-[10px] text-[#CDC6B8]">
                  <span>Lealtad</span>
                  <span>{faction.loyalty.toFixed(0)}</span>
                </div>
                <Meter value={faction.loyalty} tone={toneFor(faction.loyalty)} />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-[#CDC6B8]">
                  <span>Influencia</span>
                  <span>{faction.influence.toFixed(0)}</span>
                </div>
                <Meter value={faction.influence} tone="good" />
              </div>
            </div>
            <p className="mt-1 text-[10px] text-[#CDC6B8]">Demanda: {faction.demand}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <Btn onClick={() => run({ type: 'court_faction', factionId: faction.id })}>Acercar · 3 CP</Btn>
              <Btn onClick={() => run({ type: 'grant_faction_post', factionId: faction.id })}>
                Cargo · 5 CP + $3M
              </Btn>
              <Btn tone="danger" onClick={() => run({ type: 'confront_faction', factionId: faction.id })}>
                Confrontar · 4 CP
              </Btn>
            </div>
          </Row>
        );
      })}
    </EcoCard>
  );
};

export const NegotiationsSection: React.FC<Props> = ({ gameState, eco, run }) => {
  const others = gameState.parties.filter((p) => p.id !== gameState.player.partyId);
  const open = eco.negotiations.filter((n) => n.status === 'abierta');
  const active = eco.negotiations.filter((n) => n.status === 'aceptada');
  return (
    <EcoCard
      title="Negociación política"
      subtitle="Apoyo parlamentario, cargos y compromisos programáticos"
      icon={<Handshake className="h-4 w-4 text-[#ACCEBF]" />}
    >
      {open.map((negotiation) => (
        <Row key={negotiation.id} className="border-[#E87532]/45">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-xs font-bold text-[#DFE3E4]">{negotiation.partyName}</span>
            <Pill tone="accent">{negotiation.acceptanceChance}% aceptación</Pill>
          </div>
          <p className="mt-0.5 text-[11px] text-[#CDC6B8]">{negotiation.demandLabel}</p>
          <div className="mt-1.5 flex gap-1">
            <Btn tone="primary" onClick={() => run({ type: 'accept_negotiation', negotiationId: negotiation.id })}>
              Aceptar
            </Btn>
            <Btn onClick={() => run({ type: 'reject_negotiation', negotiationId: negotiation.id })}>Rechazar</Btn>
          </div>
        </Row>
      ))}
      {active.map((negotiation) => (
        <Row key={negotiation.id}>
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-xs font-bold text-[#DFE3E4]">{negotiation.partyName}</span>
            <Pill tone={negotiation.compliance >= 55 ? 'good' : 'warn'}>
              Cumplimiento {negotiation.compliance.toFixed(0)}%
            </Pill>
          </div>
          <p className="mt-0.5 text-[11px] text-[#CDC6B8]">
            {negotiation.demandLabel} · {negotiation.monthsRemaining} meses restantes
          </p>
          <Btn tone="danger" className="mt-1.5" onClick={() => run({ type: 'break_agreement', negotiationId: negotiation.id })}>
            Romper acuerdo
          </Btn>
        </Row>
      ))}
      <div className="max-h-[340px] space-y-1.5 overflow-y-auto pr-1">
        {others.map((party) => {
          const relation = gameState.player.relations.find((r) => r.partyId === party.id)?.affinity ?? 0;
          return (
            <Row key={party.id}>
              <div className="flex items-center justify-between gap-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: party.color }}
                  />
                  <span className="truncate text-xs font-bold text-[#DFE3E4]">{party.acronym}</span>
                  <span className="text-[10px] text-[#CDC6B8]">{party.currentPollShare.toFixed(1)}%</span>
                </div>
                <Pill tone={relation >= 20 ? 'good' : relation <= -20 ? 'bad' : 'warn'}>
                  {relation > 0 ? '+' : ''}
                  {relation.toFixed(0)}
                </Pill>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                <Btn onClick={() => run({ type: 'start_negotiation', partyId: party.id, kind: 'apoyo_parlamentario' })}>
                  Apoyo · 4 CP
                </Btn>
                <Btn onClick={() => run({ type: 'start_negotiation', partyId: party.id, kind: 'cargos' })}>
                  Cargos
                </Btn>
                <Btn onClick={() => run({ type: 'start_negotiation', partyId: party.id, kind: 'programa' })}>
                  Programa
                </Btn>
              </div>
            </Row>
          );
        })}
      </div>
    </EcoCard>
  );
};

export const SocialActorsSection: React.FC<Props> = ({ gameState, eco, run }) => {
  const actors = gameState.socialActors ?? [];
  return (
    <EcoCard
      title="Organizaciones y conflicto social"
      subtitle="Confianza, movilización y mesas de acuerdo"
      icon={<Flag className="h-4 w-4 text-[#E8C57A]" />}
    >
      {actors.length === 0 && <Empty>No hay organizaciones sociales registradas.</Empty>}
      {actors.map((actor) => (
        <Row key={actor.id}>
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="truncate text-xs font-bold text-[#DFE3E4]">{actor.name}</span>
            <Pill tone={actor.conflictLevel >= 60 ? 'bad' : actor.conflictLevel >= 35 ? 'warn' : 'good'}>
              Conflicto {actor.conflictLevel.toFixed(0)}
            </Pill>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <div>
              <div className="flex justify-between text-[10px] text-[#CDC6B8]">
                <span>Confianza</span>
                <span>{(actor.governmentTrust ?? 50).toFixed(0)}</span>
              </div>
              <Meter value={actor.governmentTrust ?? 50} tone={toneFor(actor.governmentTrust ?? 50)} />
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-[#CDC6B8]">
                <span>Presión</span>
                <span>{actor.pressureCapacity}</span>
              </div>
              <Meter value={actor.pressureCapacity} tone="warn" />
            </div>
          </div>
          {actor.activeAgreement && (
            <p className="mt-1 text-[10px] text-[#ACCEBF]">
              Acuerdo: {actor.activeAgreement.topic} ({actor.activeAgreement.monthsRemaining} meses)
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1">
            <Btn onClick={() => run({ type: 'negotiate_social_actor', actorId: actor.id, offer: 'salarial' })}>
              Oferta salarial · 4 CP
            </Btn>
            <Btn onClick={() => run({ type: 'negotiate_social_actor', actorId: actor.id, offer: 'presupuesto' })}>
              Presupuesto · 5 CP
            </Btn>
            <Btn onClick={() => run({ type: 'negotiate_social_actor', actorId: actor.id, offer: 'programatico' })}>
              Mesa programática
            </Btn>
          </div>
        </Row>
      ))}
    </EcoCard>
  );
};

export const CabinetCrisisSection: React.FC<Props> = ({ eco, run }) => {
  const crises = eco.cabinetCrises.filter((c) => c.status === 'abierta');
  return (
    <EcoCard
      title="Crisis de gabinete"
      subtitle="Renuncias, conflictos y escándalos ministeriales"
      icon={<AlertTriangle className="h-4 w-4 text-[#F08A7E]" />}
      right={<Pill tone={crises.length > 0 ? 'bad' : 'good'}>{crises.length} abiertas</Pill>}
    >
      {crises.map((crisis) => (
        <Row key={crisis.id} className="border-[#C25A4E]/50">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-xs font-bold text-[#F08A7E]">{crisis.ministryName}</span>
            <Pill tone="bad">Severidad {crisis.severity.toFixed(0)}</Pill>
          </div>
          <p className="mt-0.5 text-[11px] text-[#CDC6B8]">{crisis.description}</p>
          <p className="mt-0.5 text-[10px] text-[#CDC6B8]">
            {crisis.monthsOpen} meses abierta · si no la resolvés, el ministro renuncia.
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <Btn onClick={() => run({ type: 'resolve_cabinet_crisis', crisisId: crisis.id, option: 'mediar' })}>
              Mediar · 4 CP
            </Btn>
            <Btn onClick={() => run({ type: 'resolve_cabinet_crisis', crisisId: crisis.id, option: 'reestructurar' })}>
              Reestructurar · 6 CP
            </Btn>
            <Btn tone="danger" onClick={() => run({ type: 'resolve_cabinet_crisis', crisisId: crisis.id, option: 'cesar' })}>
              Cesar · 3 CP
            </Btn>
          </div>
        </Row>
      ))}
      {crises.length === 0 && <Empty>Gabinete estable. Las crisis aparecen por baja gestión o lealtad.</Empty>}
    </EcoCard>
  );
};

export const ChallengesHint: React.FC<{ count: number }> = ({ count }) =>
  count > 0 ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#F08A7E]">
      <Swords className="h-3 w-3" /> {count} desafío(s)
    </span>
  ) : null;
