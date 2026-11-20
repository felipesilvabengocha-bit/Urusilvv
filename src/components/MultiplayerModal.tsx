import React, { useEffect, useState } from 'react';
import { Copy, Globe2, Play, Send, Users, X } from 'lucide-react';
import { BASE_PARTIES, DIFFICULTIES, SCENARIOS } from '../data/uruguayData';
import { buildNewGameState } from '../engine/gameFactory';
import { multiplayerClient, MultiplayerRoomSnapshot } from '../engine/multiplayerClient';
import { DifficultyId, GameState, ScenarioId } from '../types/game';

interface MultiplayerModalProps {
  onClose: () => void;
  onStartMultiplayerGame: (state: GameState, myPartyId: string, myPlayerName: string) => void;
}

export const MultiplayerModal: React.FC<MultiplayerModalProps> = ({
  onClose,
  onStartMultiplayerGame,
}) => {
  const [playerName, setPlayerName] = useState('Dirigente Online');
  const [joinCode, setJoinCode] = useState('');
  const [scenarioId, setScenarioId] = useState<ScenarioId>('contemporaneo_2024');
  const [difficultyId, setDifficultyId] = useState<DifficultyId>('normal');
  const [room, setRoom] = useState<MultiplayerRoomSnapshot | null>(multiplayerClient.currentRoom);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [chatText, setChatText] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsub = multiplayerClient.subscribe((ev) => {
      if (ev.type === 'room:error') {
        setErrorMsg(ev.message);
        setBusy(false);
        return;
      }
      if (ev.type === 'room:joined' || ev.type === 'room:sync') {
        setRoom(ev.room);
        setErrorMsg(null);
        setBusy(false);
      }
      if (ev.type === 'room:started' && ev.room.sharedState) {
        const me = ev.room.players.find((p) => p.playerId === multiplayerClient.playerId);
        onStartMultiplayerGame(
          ev.room.sharedState,
          me?.partyId ?? ev.room.sharedState.player.partyId,
          me?.name ?? playerName
        );
      }
    });
    return unsub;
  }, [onStartMultiplayerGame, playerName]);

  const handleCreateRoom = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      await multiplayerClient.connect();
      const firstParty = BASE_PARTIES[0];
      multiplayerClient.send({
        type: 'room:create',
        playerName,
        partyId: firstParty.id,
        partyName: firstParty.name,
        partyAcronym: firstParty.acronym,
        partyColor: firstParty.color,
        scenarioId,
        difficultyId,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error conectando.');
      setBusy(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!joinCode.trim()) {
      setErrorMsg('Ingresá un código de sala de 6 caracteres.');
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    try {
      await multiplayerClient.connect();
      multiplayerClient.send({
        type: 'room:join',
        roomCode: joinCode.trim().toUpperCase(),
        playerName,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al unirse.');
      setBusy(false);
    }
  };

  const handleSelectParty = (partyId: string) => {
    const party = BASE_PARTIES.find((p) => p.id === partyId);
    if (!party) return;
    multiplayerClient.send({
      type: 'room:select_party',
      partyId: party.id,
      partyName: party.name,
      partyAcronym: party.acronym,
      partyColor: party.color,
    });
  };

  const handleSendChat = () => {
    if (!chatText.trim()) return;
    multiplayerClient.send({ type: 'room:chat', text: chatText });
    setChatText('');
  };

  const handleStartMatch = () => {
    if (!room) return;
    const hostPlayer = room.players.find((p) => p.isHost) ?? room.players[0];
    const diff = DIFFICULTIES.find((d) => d.id === difficultyId) ?? DIFFICULTIES[2];
    const avg = Math.floor(diff.attributeBudget / 5);
    const initialState = buildNewGameState({
      scenarioId,
      difficultyId,
      originMode: 'partido_existente',
      selectedPartyId: hostPlayer.partyId,
      selectedSectorId:
        BASE_PARTIES.find((p) => p.id === hostPlayer.partyId)?.sectors[0]?.id ?? 'fa_mpp',
      playerName: hostPlayer.name,
      biography: 'Competidor en partida multijugador republicana.',
      attributes: {
        popularity: avg,
        charisma: avg,
        management: avg,
        territorialMachine: avg,
        negotiation: avg,
      },
      targetOffice: 'presidente',
      targetDepartment: 'montevideo',
    });

    multiplayerClient.send({
      type: 'room:start',
      sharedState: initialState,
    });
  };

  const myPlayer = room?.players.find((p) => p.playerId === multiplayerClient.playerId);
  const isHost = Boolean(myPlayer?.isHost);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm">
      <div className="max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#574239]/70 bg-[#171C1D] p-5 text-[#DFE3E4] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#574239]/45 pb-3">
          <div>
            <div className="font-mono-data text-[10px] font-bold uppercase tracking-widest text-[#FFB691]">
              WebSockets en Tiempo Real · Sala Sincronizada
            </div>
            <h2 className="mt-0.5 flex items-center gap-2 font-display text-xl font-bold text-[#DFE3E4]">
              <Globe2 className="h-5 w-5 text-[#E87532]" />
              Multijugador Político Online
            </h2>
          </div>
          <button
            onClick={() => {
              multiplayerClient.disconnect();
              onClose();
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#574239]/60 bg-[#0A0F10] text-[#CDC6B8] hover:text-white"
            aria-label="Cerrar multijugador"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 rounded-lg border border-rose-500/45 bg-rose-950/30 p-2.5 text-xs font-semibold text-rose-300">
            {errorMsg}
          </div>
        )}

        {!room ? (
          <div className="mt-4 space-y-4">
            <label className="block text-xs font-semibold text-[#DFE3E4]">
              Tu nombre político en la sala
              <input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-3 py-2.5 text-sm text-[#DFE3E4]"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3 rounded-xl border border-[#574239]/50 bg-[#1B2021] p-4">
                <div className="font-display text-base font-bold text-[#FFB691]">Crear Sala Nueva</div>
                <label className="block text-[11px] font-semibold text-[#CDC6B8]">
                  Escenario
                  <select
                    value={scenarioId}
                    onChange={(e) => setScenarioId(e.target.value as ScenarioId)}
                    className="mt-1 w-full rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-2.5 py-2 text-xs text-[#DFE3E4]"
                  >
                    {SCENARIOS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-[11px] font-semibold text-[#CDC6B8]">
                  Dificultad
                  <select
                    value={difficultyId}
                    onChange={(e) => setDifficultyId(e.target.value as DifficultyId)}
                    className="mt-1 w-full rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-2.5 py-2 text-xs text-[#DFE3E4]"
                  >
                    {DIFFICULTIES.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={handleCreateRoom}
                  disabled={busy}
                  className="executive-action-btn w-full rounded-lg py-2.5 text-xs font-bold"
                >
                  {busy ? 'Conectando...' : 'Crear Sala e Invitar'}
                </button>
              </div>

              <div className="flex flex-col justify-between space-y-3 rounded-xl border border-[#574239]/50 bg-[#1B2021] p-4">
                <div>
                  <div className="font-display text-base font-bold text-[#ACCEBF]">Unirse con Código</div>
                  <p className="mt-1 text-[11px] text-[#CDC6B8]">
                    Ingresá el código de 6 caracteres compartido por el anfitrión.
                  </p>
                  <input
                    value={joinCode}
                    maxLength={6}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="Ej: A7K9P2"
                    className="mt-3 w-full rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-3 py-2.5 text-center font-mono-data text-base font-bold uppercase tracking-widest text-[#DFE3E4]"
                  />
                </div>
                <button
                  onClick={handleJoinRoom}
                  disabled={busy}
                  className="min-h-[42px] w-full rounded-lg border border-[#ACCEBF]/50 bg-[#557568]/30 py-2.5 text-xs font-bold text-[#DFE3E4] hover:bg-[#557568]/50"
                >
                  Unirse a la Sala
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E87532]/50 bg-[#0A0F10] p-3.5">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#CDC6B8]">Código de Sala</div>
                <div className="font-mono-data text-2xl font-extrabold tracking-widest text-[#FFB691]">
                  {room.code}
                </div>
              </div>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(room.code);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#574239]/60 bg-[#1B2021] px-3 py-2 text-xs font-semibold text-[#DFE3E4]"
              >
                <Copy className="h-3.5 w-3.5 text-[#ACCEBF]" />
                {copied ? 'Copiado' : 'Copiar código'}
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Participantes y selección de partido */}
              <div className="space-y-3 rounded-xl border border-[#574239]/50 bg-[#1B2021] p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-[#DFE3E4]">
                  <Users className="h-4 w-4 text-[#E87532]" />
                  Jugadores en Sala ({room.players.length}/8)
                </div>
                <div className="space-y-1.5">
                  {room.players.map((p) => (
                    <div
                      key={p.playerId}
                      className="flex items-center justify-between rounded-lg border border-[#574239]/40 bg-[#0A0F10] px-2.5 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: p.partyColor }} />
                        <span className="font-bold">{p.name}</span>
                        {p.isHost && <span className="text-[10px] text-[#FFB691]">(Host)</span>}
                      </div>
                      <span className="font-mono-data text-[11px] font-bold text-[#ACCEBF]">
                        {p.partyAcronym}
                      </span>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="mb-1.5 text-[11px] font-semibold text-[#DEC1B4]">Tu Lema / Partido:</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {BASE_PARTIES.slice(0, 6).map((party) => {
                      const takenByOther = room.players.some(
                        (x) => x.playerId !== multiplayerClient.playerId && x.partyId === party.id
                      );
                      const isMine = myPlayer?.partyId === party.id;
                      return (
                        <button
                          key={party.id}
                          disabled={takenByOther}
                          onClick={() => handleSelectParty(party.id)}
                          className={`rounded-lg border px-2 py-1.5 text-left text-[11px] font-bold transition ${
                            isMine
                              ? 'border-[#E87532] bg-[#E87532]/20 text-white'
                              : 'border-[#574239]/45 bg-[#0A0F10] text-[#CDC6B8] disabled:opacity-35'
                          }`}
                        >
                          {party.acronym} · {party.name.split(' ')[0]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Chat Diplomático de Sala */}
              <div className="flex flex-col rounded-xl border border-[#574239]/50 bg-[#1B2021] p-4">
                <div className="text-xs font-bold text-[#DFE3E4]">Canal Diplomático de Sala</div>
                <div className="mt-2 h-44 flex-1 space-y-1.5 overflow-y-auto rounded-lg bg-[#0A0F10] p-2.5 text-[11px]">
                  {room.chat.map((c) => (
                    <div key={c.id}>
                      <span className="font-mono-data font-bold text-[#FFB691]">[{c.partyAcronym}] {c.senderName}: </span>
                      <span className="text-[#DFE3E4]">{c.text}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex gap-1.5">
                  <input
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                    placeholder="Negociar o saludar..."
                    className="flex-1 rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-2.5 py-1.5 text-xs text-[#DFE3E4]"
                  />
                  <button
                    onClick={handleSendChat}
                    className="rounded-lg bg-[#262B2C] px-3 py-1.5 text-xs font-bold text-[#FFB691] hover:bg-[#313637]"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {isHost ? (
              <button
                onClick={handleStartMatch}
                className="executive-action-btn flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold"
              >
                <Play className="h-4 w-4" />
                Iniciar Partida Sincronizada ({room.players.length} jugador/es)
              </button>
            ) : (
              <div className="rounded-xl border border-[#574239]/45 bg-[#0A0F10] p-3 text-center text-xs text-[#CDC6B8]">
                Esperando que el anfitrión inicie la partida compartida...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
