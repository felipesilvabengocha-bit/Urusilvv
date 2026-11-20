import { GameState } from '../types/game';

export interface RoomPlayerSummary {
  playerId: string;
  name: string;
  partyId: string;
  partyName: string;
  partyAcronym: string;
  partyColor: string;
  isHost: boolean;
  readyForNextMonth: boolean;
  connected: boolean;
}

export interface RoomChatItem {
  id: string;
  senderId: string;
  senderName: string;
  partyAcronym: string;
  text: string;
  createdAt: string;
}

export interface RoomAllianceOffer {
  id: string;
  fromPlayerId: string;
  fromName: string;
  fromPartyId: string;
  toPartyId: string;
  proposalType: 'electoral' | 'coalicion' | 'fusion';
  terms: string;
  promisedMinistries: number;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface MultiplayerRoomSnapshot {
  code: string;
  hostId: string;
  status: 'lobby' | 'playing';
  scenarioId: string;
  difficultyId: string;
  players: RoomPlayerSummary[];
  sharedState: GameState | null;
  chat: RoomChatItem[];
  offers: RoomAllianceOffer[];
}

export type MultiplayerEvent =
  | { type: 'room:joined'; playerId: string; room: MultiplayerRoomSnapshot }
  | { type: 'room:sync'; room: MultiplayerRoomSnapshot }
  | { type: 'room:started'; room: MultiplayerRoomSnapshot }
  | { type: 'room:error'; message: string };

class MultiplayerClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<(ev: MultiplayerEvent) => void>();
  public playerId: string | null = null;
  public currentRoom: MultiplayerRoomSnapshot | null = null;

  private getWsUrl(): string {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  }

  public connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.getWsUrl());
      this.ws = ws;
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error('No se pudo conectar al servidor WebSocket (/ws).'));
      ws.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data as string) as MultiplayerEvent;
          if (parsed.type === 'room:joined') {
            this.playerId = parsed.playerId;
            this.currentRoom = parsed.room;
          } else if (parsed.type === 'room:sync' || parsed.type === 'room:started') {
            this.currentRoom = parsed.room;
          }
          for (const fn of this.listeners) fn(parsed);
        } catch {
          // Ignorar payload inválido
        }
      };
      ws.onclose = () => {
        this.ws = null;
      };
    });
  }

  public subscribe(fn: (ev: MultiplayerEvent) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  public send(payload: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Conexión multijugador cerrada.');
    }
    this.ws.send(JSON.stringify(payload));
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.playerId = null;
    this.currentRoom = null;
  }
}

export const multiplayerClient = new MultiplayerClient();
