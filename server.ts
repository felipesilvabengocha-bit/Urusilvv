import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import { WebSocket, WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MODEL_NAME = 'gemini-4-hydrogen';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no configurada en el servidor.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// ---------- Tipos Multijugador (Autoritativo en Servidor) ----------
interface RoomPlayer {
  playerId: string;
  name: string;
  partyId: string;
  partyName: string;
  partyAcronym: string;
  partyColor: string;
  isHost: boolean;
  readyForNextMonth: boolean;
  connected: boolean;
  ws: WebSocket | null;
}

interface RoomChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  partyAcronym: string;
  text: string;
  createdAt: string;
}

interface AllianceOffer {
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

interface MultiplayerRoom {
  code: string;
  hostId: string;
  status: 'lobby' | 'playing';
  scenarioId: string;
  difficultyId: string;
  players: Map<string, RoomPlayer>;
  sharedState: unknown | null;
  chat: RoomChatMessage[];
  offers: AllianceOffer[];
  updatedAt: number;
}

const rooms = new Map<string, MultiplayerRoom>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function serializeRoom(room: MultiplayerRoom) {
  return {
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    scenarioId: room.scenarioId,
    difficultyId: room.difficultyId,
    players: Array.from(room.players.values()).map((p) => ({
      playerId: p.playerId,
      name: p.name,
      partyId: p.partyId,
      partyName: p.partyName,
      partyAcronym: p.partyAcronym,
      partyColor: p.partyColor,
      isHost: p.isHost,
      readyForNextMonth: p.readyForNextMonth,
      connected: p.connected,
    })),
    sharedState: room.sharedState,
    chat: room.chat.slice(-40),
    offers: room.offers.slice(-15),
  };
}

function broadcastRoom(room: MultiplayerRoom, eventType = 'room:sync', extra?: Record<string, unknown>) {
  const payload = JSON.stringify({
    type: eventType,
    room: serializeRoom(room),
    ...extra,
  });
  for (const player of room.players.values()) {
    if (player.ws && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(payload);
    }
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'qqg-uruguay', rooms: rooms.size });
  });

  // ---------- Endpoint IA de Políticas Públicas ----------
  app.post('/api/policies/chat', async (req, res) => {
    try {
      const { messages, gameStateSummary, currentDraft } = req.body ?? {};
      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: 'Se requiere historial de conversación (messages).' });
        return;
      }

      const ai = getGeminiClient();

      const systemInstruction = `Sos el Asesor Técnico-Económico de la Oficina de Planeamiento y Presupuesto (OPP) y el Ministerio de Economía y Finanzas (MEF) de la República Oriental del Uruguay en el simulador político "¿Quién quiere gobernar Uruguay?".

TU FUNCIÓN:
Interpretar propuestas de políticas públicas escritas libremente por el jugador, evaluarlas con rigor económico e institucional uruguayo usando los indicadores REALES proporcionados en el contexto, hacer preguntas aclaratorias cuando falten elementos clave (instrumento, financiamiento, población objetivo o plazo) y generar/actualizar una Ficha Estructurada de Política Pública realista.

REGLAS ESTRICTAS:
1. Nunca inventes resultados milagrosos ni ocultes costos fiscales o efectos colaterales negativos.
2. Toda política pública tiene TANTO externalidades positivas como externalidades negativas o riesgos (inflación, déficit fiscal, puja distributiva, cuello de botella productivo, conflictividad sindical/empresarial).
3. Si el planteo es muy vago (por ejemplo "bajar la pobreza" o "mejorar la educación" sin decir cómo, cuánto ni cómo se financia), poné status="needs_clarification", respondé brevemente y hacé 2 o 3 preguntas concretas en clarifyingQuestions. Podés omitir policyDraft o dejarlo en progreso.
4. Si la propuesta tiene suficiente definición (o el usuario respondió aclaraciones), poné status="ready_for_approval" y generá policyDraft completo con valores realistas para Uruguay:
   - ministryArea debe ser EXACTAMENTE uno de: educacion, salud, seguridad, jubilaciones, desarrollo_social, infraestructura, transporte, vivienda, ciencia_tecnologia, desarrollo_productivo, cultura, medioambiente, defensa, relaciones_exteriores, administracion, intereses_otros.
   - categoryCode: letra A..J según dominio (A Fiscal, B Crecimiento/Producción, C Trabajo/Seguridad Social, D Monetaria/Financiera, E Educación/Ciencia/Cultura, F Salud/Protección Social, G Seguridad/Defensa/Justicia, H Infraestructura/Vivienda/Transporte/Entes, I Ambiente/Agua/Energía, J Reforma Estado/Exterior/Territorio).
   - orientation: uno de socialdemocrata, liberal, conservadora, desarrollista, socialista, centrista, productivista.
   - legalInstrument: uno de decreto_pe, resolucion_admin, reglamentacion, proyecto_ley, ley_presupuestal, convenio, ente_autonomo.
   - responsibleBody: organismo ejecutor real en Uruguay (ej. "MEF / DGI", "MTSS / DINAE", "MVOT", "MTOP", "ANEP / MEC").
   - requiredCompetence: norma o facultad habilitante (ej. "Decreto del Poder Ejecutivo (Art. 168)", "Ley Tributaria (Art. 85)", "Ley Presupuestal (Art. 214)").
   - riskLevel: bajo, medio o alto.
   - fiscalCostPctGdp: costo fiscal anual en % del PIB (0.05 a 1.80).
   - expectedRevenuePctGdp: recaudación o retorno fiscal anual estimado en % del PIB (0.00 a 1.40).
   - gdpDelta: impacto anualizado esperado en % PIB (-0.6 a +0.9).
   - inflationDelta: impacto anualizado en inflación (-0.6 a +1.2).
   - unemploymentDelta: cambio en desempleo (-1.2 a +0.6).
   - povertyDelta: cambio en pobreza (-1.5 a +0.5).
   - giniDelta: cambio en coeficiente de Gini (-0.015 a +0.012).
   - productionDelta: cambio en índice de producción (-1.5 a +3.5).
   - publicInvestmentDelta / privateInvestmentDelta: cambio en % del PIB (-0.5 a +1.2).
   - timelineMonths: duración de implementación y vigencia entre 6 y 48 meses.
   - politicalCapitalCost: entre 5 y 22 CP según complejidad política.
   - moneyCostUYU: costo operativo inicial entre 300000 y 3500000 UYU.
   - synergyTags: 2 o 3 etiquetas en snake_case de áreas relacionadas (ej: "empleo_juvenil", "educacion_tecnica", "transicion_verde", "disciplina_fiscal", "vivienda_social", "competitividad").
5. Respondé siempre en español rioplatense claro, técnico y conciso.`;

      const contextText = `CONTEXTO ACTUAL DEL PAÍS Y GOBIERNO:
${JSON.stringify(gameStateSummary ?? {}, null, 2)}

BORRADOR ACTUAL (si existe):
${JSON.stringify(currentDraft ?? null, null, 2)}

CONVERSACIÓN:
${messages
  .slice(-10)
  .map((m: { role?: string; content?: string }) => `${m.role === 'user' ? 'JUGADOR' : 'ASESOR OPP/MEF'}: ${m.content ?? ''}`)
  .join('\n')}`;

      const macroEffectSchema = {
        type: Type.OBJECT,
        properties: {
          gdpDelta: { type: Type.NUMBER },
          inflationDelta: { type: Type.NUMBER },
          unemploymentDelta: { type: Type.NUMBER },
          employmentDelta: { type: Type.NUMBER },
          povertyDelta: { type: Type.NUMBER },
          indigenceDelta: { type: Type.NUMBER },
          realWageDelta: { type: Type.NUMBER },
          purchasingPowerDelta: { type: Type.NUMBER },
          giniDelta: { type: Type.NUMBER },
          publicInvestmentDelta: { type: Type.NUMBER },
          privateInvestmentDelta: { type: Type.NUMBER },
          productionDelta: { type: Type.NUMBER },
          fiscalCostPctGdp: { type: Type.NUMBER },
          expectedRevenuePctGdp: { type: Type.NUMBER },
          approvalDelta: { type: Type.NUMBER },
        },
      };

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: contextText,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              assistantReply: { type: Type.STRING },
              status: { type: Type.STRING, enum: ['needs_clarification', 'ready_for_approval'] },
              clarifyingQuestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              policyDraft: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  categoryCode: { type: Type.STRING, enum: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] },
                  orientation: {
                    type: Type.STRING,
                    enum: ['socialdemocrata', 'liberal', 'conservadora', 'desarrollista', 'socialista', 'centrista', 'productivista'],
                  },
                  legalInstrument: {
                    type: Type.STRING,
                    enum: ['decreto_pe', 'resolucion_admin', 'reglamentacion', 'proyecto_ley', 'ley_presupuestal', 'convenio', 'ente_autonomo'],
                  },
                  responsibleBody: { type: Type.STRING },
                  requiredCompetence: { type: Type.STRING },
                  normativeText: { type: Type.STRING },
                  riskLevel: { type: Type.STRING, enum: ['bajo', 'medio', 'alto'] },
                  socialResistance: { type: Type.ARRAY, items: { type: Type.STRING } },
                  targetIndicators: { type: Type.ARRAY, items: { type: Type.STRING } },
                  ministryArea: {
                    type: Type.STRING,
                    enum: [
                      'educacion',
                      'salud',
                      'seguridad',
                      'jubilaciones',
                      'desarrollo_social',
                      'infraestructura',
                      'transporte',
                      'vivienda',
                      'ciencia_tecnologia',
                      'desarrollo_productivo',
                      'cultura',
                      'medioambiente',
                      'defensa',
                      'relaciones_exteriores',
                      'administracion',
                      'intereses_otros',
                    ],
                  },
                  summary: { type: Type.STRING },
                  objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
                  instruments: { type: Type.ARRAY, items: { type: Type.STRING } },
                  financingSource: { type: Type.STRING },
                  beneficiaries: { type: Type.STRING },
                  timelineMonths: { type: Type.INTEGER },
                  implementationSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
                  conditions: { type: Type.ARRAY, items: { type: Type.STRING } },
                  politicalCapitalCost: { type: Type.INTEGER },
                  moneyCostUYU: { type: Type.INTEGER },
                  estimatedEffects: macroEffectSchema,
                  delayedEffects: macroEffectSchema,
                  positiveExternalities: { type: Type.ARRAY, items: { type: Type.STRING } },
                  negativeExternalities: { type: Type.ARRAY, items: { type: Type.STRING } },
                  viabilityNote: { type: Type.STRING },
                  synergyTags: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: [
                  'title',
                  'ministryArea',
                  'summary',
                  'objectives',
                  'instruments',
                  'financingSource',
                  'beneficiaries',
                  'timelineMonths',
                  'implementationSteps',
                  'conditions',
                  'politicalCapitalCost',
                  'moneyCostUYU',
                  'estimatedEffects',
                  'delayedEffects',
                  'positiveExternalities',
                  'negativeExternalities',
                  'viabilityNote',
                  'synergyTags',
                ],
              },
            },
            required: ['assistantReply', 'status', 'clarifyingQuestions'],
          },
        },
      });

      const rawText = response.text;
      if (!rawText) {
        res.status(502).json({ error: 'El servicio de análisis devolvió una respuesta vacía.' });
        return;
      }

      const parsed = JSON.parse(rawText);
      if (parsed.policyDraft && !parsed.policyDraft.id) {
        parsed.policyDraft.id = `pol_${Date.now()}`;
      }
      res.json(parsed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error interno consultando análisis de políticas.';
      res.status(500).json({ error: msg });
    }
  });

  // ---------- Servidor HTTP + WebSocket Multijugador ----------
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    let boundRoomCode: string | null = null;
    let boundPlayerId: string | null = null;

    const sendError = (message: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'room:error', message }));
      }
    };

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type: string;
          roomCode?: string;
          playerId?: string;
          playerName?: string;
          partyId?: string;
          partyName?: string;
          partyAcronym?: string;
          partyColor?: string;
          scenarioId?: string;
          difficultyId?: string;
          sharedState?: unknown;
          actionSummary?: string;
          text?: string;
          toPartyId?: string;
          proposalType?: 'electoral' | 'coalicion' | 'fusion';
          terms?: string;
          promisedMinistries?: number;
          offerId?: string;
          accept?: boolean;
        };

        if (msg.type === 'room:create') {
          const code = generateRoomCode();
          const playerId = msg.playerId || `p_${Date.now()}_${Math.floor(Math.random() * 999)}`;
          const room: MultiplayerRoom = {
            code,
            hostId: playerId,
            status: 'lobby',
            scenarioId: msg.scenarioId || 'contemporaneo_2024',
            difficultyId: msg.difficultyId || 'normal',
            players: new Map(),
            sharedState: null,
            chat: [
              {
                id: `sys_${Date.now()}`,
                senderId: 'system',
                senderName: 'Sistema',
                partyAcronym: 'ROU',
                text: `Sala ${code} creada. Compartí el código para sumar competidores.`,
                createdAt: new Date().toISOString(),
              },
            ],
            offers: [],
            updatedAt: Date.now(),
          };
          room.players.set(playerId, {
            playerId,
            name: msg.playerName?.trim() || 'Anfitrión',
            partyId: msg.partyId || 'fa',
            partyName: msg.partyName || 'Frente Amplio',
            partyAcronym: msg.partyAcronym || 'FA',
            partyColor: msg.partyColor || '#1d4ed8',
            isHost: true,
            readyForNextMonth: false,
            connected: true,
            ws,
          });
          rooms.set(code, room);
          boundRoomCode = code;
          boundPlayerId = playerId;
          ws.send(JSON.stringify({ type: 'room:joined', playerId, room: serializeRoom(room) }));
          return;
        }

        if (msg.type === 'room:join') {
          const code = (msg.roomCode || '').trim().toUpperCase();
          const room = rooms.get(code);
          if (!room) {
            sendError(`No existe ninguna sala con el código ${code}.`);
            return;
          }
          const playerId = msg.playerId || `p_${Date.now()}_${Math.floor(Math.random() * 999)}`;
          const existing = room.players.get(playerId);

          if (existing) {
            existing.connected = true;
            existing.ws = ws;
            if (msg.playerName?.trim()) existing.name = msg.playerName.trim();
          } else {
            if (room.players.size >= 8) {
              sendError('La sala alcanzó el máximo de 8 participantes.');
              return;
            }
            const usedPartyIds = new Set(Array.from(room.players.values()).map((p) => p.partyId));
            const defaultOptions = [
              { id: 'pn', name: 'Partido Nacional', acr: 'PN', color: '#0ea5e9' },
              { id: 'pc', name: 'Partido Colorado', acr: 'PC', color: '#dc2626' },
              { id: 'ca', name: 'Cabildo Abierto', acr: 'CA', color: '#d97706' },
              { id: 'is', name: 'Identidad Soberana', acr: 'IS', color: '#16a34a' },
              { id: 'pi', name: 'Partido Independiente', acr: 'PI', color: '#7c3aed' },
              { id: 'fa', name: 'Frente Amplio', acr: 'FA', color: '#1d4ed8' },
            ];
            const freeParty = defaultOptions.find((o) => !usedPartyIds.has(o.id)) ?? defaultOptions[0];
            room.players.set(playerId, {
              playerId,
              name: msg.playerName?.trim() || `Jugador ${room.players.size + 1}`,
              partyId: msg.partyId && !usedPartyIds.has(msg.partyId) ? msg.partyId : freeParty.id,
              partyName: msg.partyName || freeParty.name,
              partyAcronym: msg.partyAcronym || freeParty.acr,
              partyColor: msg.partyColor || freeParty.color,
              isHost: false,
              readyForNextMonth: false,
              connected: true,
              ws,
            });
          }

          boundRoomCode = code;
          boundPlayerId = playerId;
          room.updatedAt = Date.now();
          ws.send(JSON.stringify({ type: 'room:joined', playerId, room: serializeRoom(room) }));
          broadcastRoom(room, 'room:sync');
          return;
        }

        const room = boundRoomCode ? rooms.get(boundRoomCode) : undefined;
        if (!room || !boundPlayerId) {
          sendError('No estás conectado a una sala activa.');
          return;
        }

        const player = room.players.get(boundPlayerId);
        if (!player) return;

        if (msg.type === 'room:select_party') {
          const wantedPartyId = msg.partyId || player.partyId;
          const takenByOther = Array.from(room.players.values()).some(
            (p) => p.playerId !== player.playerId && p.partyId === wantedPartyId
          );
          if (takenByOther) {
            sendError('Otro jugador en la sala ya eligió ese lema. Seleccioná un partido distinto.');
            return;
          }
          player.partyId = wantedPartyId;
          player.partyName = msg.partyName || player.partyName;
          player.partyAcronym = msg.partyAcronym || player.partyAcronym;
          player.partyColor = msg.partyColor || player.partyColor;
          room.updatedAt = Date.now();
          broadcastRoom(room);
          return;
        }

        if (msg.type === 'room:start') {
          if (player.playerId !== room.hostId) {
            sendError('Solo el anfitrión puede iniciar la partida.');
            return;
          }
          room.status = 'playing';
          room.sharedState = msg.sharedState ?? room.sharedState;
          room.updatedAt = Date.now();
          broadcastRoom(room, 'room:started');
          return;
        }

        if (msg.type === 'room:player_action') {
          if (msg.sharedState) {
            room.sharedState = msg.sharedState;
          }
          if (msg.actionSummary) {
            room.chat.push({
              id: `act_${Date.now()}`,
              senderId: player.playerId,
              senderName: player.name,
              partyAcronym: player.partyAcronym,
              text: `[Acción] ${msg.actionSummary}`,
              createdAt: new Date().toISOString(),
            });
          }
          room.updatedAt = Date.now();
          broadcastRoom(room, 'room:sync');
          return;
        }

        if (msg.type === 'room:advance_month') {
          player.readyForNextMonth = true;
          const allReady = Array.from(room.players.values())
            .filter((p) => p.connected)
            .every((p) => p.readyForNextMonth);

          if ((allReady || player.isHost) && msg.sharedState) {
            room.sharedState = msg.sharedState;
            for (const p of room.players.values()) {
              p.readyForNextMonth = false;
            }
            room.chat.push({
              id: `turn_${Date.now()}`,
              senderId: 'system',
              senderName: 'Calendario',
              partyAcronym: 'ROU',
              text: `${player.name} (${player.partyAcronym}) avanzó el mes de la partida compartida.`,
              createdAt: new Date().toISOString(),
            });
          }
          room.updatedAt = Date.now();
          broadcastRoom(room, 'room:sync');
          return;
        }

        if (msg.type === 'room:alliance_offer') {
          const offer: AllianceOffer = {
            id: `off_${Date.now()}`,
            fromPlayerId: player.playerId,
            fromName: player.name,
            fromPartyId: player.partyId,
            toPartyId: msg.toPartyId || '',
            proposalType: msg.proposalType || 'electoral',
            terms: msg.terms || 'Acuerdo político bilateral',
            promisedMinistries: Number(msg.promisedMinistries || 0),
            status: 'pending',
            createdAt: new Date().toISOString(),
          };
          room.offers.push(offer);
          room.chat.push({
            id: `offmsg_${Date.now()}`,
            senderId: player.playerId,
            senderName: player.name,
            partyAcronym: player.partyAcronym,
            text: `Propuesta de ${offer.proposalType} enviada a ${offer.toPartyId.toUpperCase()}: ${offer.terms}`,
            createdAt: new Date().toISOString(),
          });
          broadcastRoom(room, 'room:sync');
          return;
        }

        if (msg.type === 'room:alliance_respond') {
          const target = room.offers.find((o) => o.id === msg.offerId);
          if (target) {
            target.status = msg.accept ? 'accepted' : 'rejected';
            room.chat.push({
              id: `offres_${Date.now()}`,
              senderId: player.playerId,
              senderName: player.name,
              partyAcronym: player.partyAcronym,
              text: `${player.partyAcronym} ${msg.accept ? 'ACEPTÓ' : 'RECHAZÓ'} el acuerdo de ${target.fromName}.`,
              createdAt: new Date().toISOString(),
            });
            broadcastRoom(room, 'room:sync');
          }
          return;
        }

        if (msg.type === 'room:chat' && msg.text?.trim()) {
          room.chat.push({
            id: `msg_${Date.now()}_${Math.floor(Math.random() * 999)}`,
            senderId: player.playerId,
            senderName: player.name,
            partyAcronym: player.partyAcronym,
            text: msg.text.trim().slice(0, 280),
            createdAt: new Date().toISOString(),
          });
          room.updatedAt = Date.now();
          broadcastRoom(room, 'room:sync');
          return;
        }
      } catch (err) {
        sendError(err instanceof Error ? err.message : 'Mensaje WebSocket inválido.');
      }
    });

    ws.on('close', () => {
      if (!boundRoomCode || !boundPlayerId) return;
      const room = rooms.get(boundRoomCode);
      if (!room) return;
      const p = room.players.get(boundPlayerId);
      if (p) {
        p.connected = false;
        p.ws = null;
        if (room.hostId === p.playerId) {
          const nextHost = Array.from(room.players.values()).find((x) => x.connected);
          if (nextHost) {
            nextHost.isHost = true;
            room.hostId = nextHost.playerId;
          }
        }
        broadcastRoom(room);
      }
    });
  });

  // ---------- Vite Middleware en Desarrollo / Static en Producción ----------
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor ¿Quién quiere gobernar Uruguay? escuchando en http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Error fatal al iniciar el servidor:', err);
  process.exit(1);
});
