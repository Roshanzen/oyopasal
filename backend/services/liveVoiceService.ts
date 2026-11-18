import http from 'node:http';
import { URL } from 'node:url';
import { LiveServerMessage, Modality } from '@google/genai';
import { WebSocket, WebSocketServer } from 'ws';
import { ENV } from '../config/env.ts';
import { AuthenticatedUser, resolveUserFromToken } from '../middleware/auth.ts';
import {
  addItemsToCartDecl,
  buildConciergeSystemInstruction,
  buildLiveMarketplaceContext,
  ConciergeToolAccumulator,
  createConciergeAiClient,
  executeConciergeToolCall,
  findBestSellerOffersDecl,
  placeDirectPurchaseDecl,
  prepareDirectPurchaseDecl,
  UserLocationInput,
} from './conciergeService.ts';

interface LiveStartPayload {
  type: 'start';
  token?: string;
  sessionKey?: string;
  userLocation?: UserLocationInput;
  language?: 'en' | 'ne';
}

interface LiveAudioPayload {
  type: 'audio';
  audio: string;
}

interface LiveTextPayload {
  type: 'text';
  text: string;
}

type ClientMessage = LiveStartPayload | LiveAudioPayload | LiveTextPayload;

function sendJson(ws: WebSocket, payload: Record<string, unknown>) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function extractLiveErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  if (err && typeof err === 'object') {
    const obj = err as { message?: unknown; error?: { message?: unknown }; reason?: unknown };
    if (typeof obj.error?.message === 'string' && obj.error.message.trim()) {
      return obj.error.message;
    }
    if (typeof obj.message === 'string' && obj.message.trim()) {
      return obj.message;
    }
    if (typeof obj.reason === 'string' && obj.reason.trim()) {
      return obj.reason;
    }
  }
  return fallback;
}

export function attachLiveVoiceServer(httpServer: http.Server) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    try {
      const host = request.headers.host || 'localhost:3000';
      const parsed = new URL(request.url || '/', `http://${host}`);
      if (parsed.pathname !== '/api/v1/live') {
        return;
      }
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', (clientWs: WebSocket, req: http.IncomingMessage) => {
    let liveSession: Awaited<
      ReturnType<ReturnType<typeof createConciergeAiClient>['live']['connect']>
    > | null = null;
    let isClosing = false;
    let hasReportedError = false;
    let accumulator: ConciergeToolAccumulator = {
      collectedOffers: [],
      orderPreview: null,
      placedOrder: null,
      cartUpdated: false,
    };

    const cleanup = () => {
      isClosing = true;
      if (liveSession) {
        try {
          liveSession.close();
        } catch {
          // ignore close errors
        }
        liveSession = null;
      }
    };

    clientWs.on('close', cleanup);
    clientWs.on('error', cleanup);

    clientWs.on('message', async (rawData) => {
      if (isClosing) return;
      let parsed: ClientMessage;
      try {
        parsed = JSON.parse(rawData.toString()) as ClientMessage;
      } catch {
        sendJson(clientWs, { type: 'error', message: 'Invalid WebSocket JSON payload.' });
        return;
      }

      if (parsed.type === 'start') {
        const apiKey = ENV.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
          sendJson(clientWs, {
            type: 'error',
            message: 'GEMINI_API_KEY is not configured in Settings > Secrets.',
          });
          clientWs.close();
          return;
        }

        try {
          let authUser: AuthenticatedUser | undefined;
          if (parsed.token) {
            const resolved = await resolveUserFromToken(parsed.token);
            if (resolved && resolved.isActive) {
              authUser = resolved;
            }
          }

          const sessionKey = authUser
            ? `user-${authUser.id}`
            : parsed.sessionKey && /^[a-zA-Z0-9_-]{6,80}$/.test(parsed.sessionKey)
            ? parsed.sessionKey
            : 'guest-browser-default';

          const language = parsed.language === 'ne' ? 'ne' : 'en';
          const context = await buildLiveMarketplaceContext(
            authUser,
            sessionKey,
            parsed.userLocation
          );

          const systemInstruction = buildConciergeSystemInstruction({
            context,
            authUser,
            language,
            forVoice: true,
          });

          const liveAi = createConciergeAiClient(apiKey);
          const session = await liveAi.live.connect({
            model: 'gemini-3.8-live',
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
              },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              tools: [
                {
                  functionDeclarations: [
                    findBestSellerOffersDecl,
                    prepareDirectPurchaseDecl,
                    placeDirectPurchaseDecl,
                    addItemsToCartDecl,
                  ],
                },
              ],
              systemInstruction,
            },
            callbacks: {
              onopen: () => {},
              onmessage: async (message: LiveServerMessage) => {
                if (isClosing) return;

                const content = message.serverContent;
                if (content?.inputTranscription?.text) {
                  sendJson(clientWs, {
                    type: 'inputTranscript',
                    text: content.inputTranscription.text,
                  });
                }
                if (content?.outputTranscription?.text) {
                  sendJson(clientWs, {
                    type: 'outputTranscript',
                    text: content.outputTranscription.text,
                  });
                }

                for (const part of content?.modelTurn?.parts ?? []) {
                  if (part.inlineData?.data) {
                    sendJson(clientWs, {
                      type: 'audio',
                      audio: part.inlineData.data,
                    });
                  }
                }

                if (content?.interrupted) {
                  sendJson(clientWs, { type: 'interrupted' });
                }

                if (content?.turnComplete) {
                  sendJson(clientWs, { type: 'turnComplete' });
                }

                const toolCalls = message.toolCall?.functionCalls ?? [];
                if (toolCalls.length > 0 && liveSession) {
                  const functionResponses: Array<{
                    id?: string;
                    name?: string;
                    response: Record<string, unknown>;
                  }> = [];

                  for (const fc of toolCalls) {
                    accumulator = {
                      collectedOffers: [],
                      orderPreview: null,
                      placedOrder: null,
                      cartUpdated: false,
                    };
                    const result = await executeConciergeToolCall(
                      fc.name || '',
                      (fc.args as Record<string, unknown>) || {},
                      {
                        authUser,
                        context,
                        ipAddress: req.socket.remoteAddress || undefined,
                        accumulator,
                      }
                    );

                    if (accumulator.collectedOffers.length > 0) {
                      sendJson(clientWs, {
                        type: 'offers',
                        offers: accumulator.collectedOffers,
                      });
                    }
                    if (accumulator.orderPreview && !accumulator.placedOrder) {
                      sendJson(clientWs, {
                        type: 'orderPreview',
                        orderPreview: accumulator.orderPreview,
                      });
                    }
                    if (accumulator.placedOrder) {
                      sendJson(clientWs, {
                        type: 'placedOrder',
                        order: accumulator.placedOrder,
                      });
                    }
                    if (accumulator.cartUpdated) {
                      sendJson(clientWs, { type: 'cartUpdated', cartUpdated: true });
                    }

                    functionResponses.push({
                      id: fc.id,
                      name: fc.name,
                      response: result as Record<string, unknown>,
                    });
                  }

                  liveSession.sendToolResponse({ functionResponses });
                }
              },
              onerror: (err: unknown) => {
                if (isClosing || hasReportedError) return;
                hasReportedError = true;
                const msg = extractLiveErrorMessage(
                  err,
                  'Live voice connection encountered an error.'
                );
                sendJson(clientWs, { type: 'error', message: msg });
              },
              onclose: (event: unknown) => {
                if (!isClosing && !hasReportedError) {
                  const closeReason = extractLiveErrorMessage(event, '');
                  if (closeReason && !/normal|1000/i.test(closeReason)) {
                    hasReportedError = true;
                    sendJson(clientWs, { type: 'error', message: closeReason });
                  } else {
                    sendJson(clientWs, { type: 'closed' });
                  }
                }
              },
            },
          });

          if (isClosing) {
            try {
              session.close();
            } catch {
              // ignore
            }
            return;
          }
          liveSession = session;
          sendJson(clientWs, {
            type: 'ready',
            model: 'gemini-3.8-live',
            assignedLocation: context.assignedLocation,
            totalProducts: context.offers.length,
          });
        } catch (err: unknown) {
          if (!hasReportedError) {
            hasReportedError = true;
            const msg = extractLiveErrorMessage(
              err,
              'Failed to connect to Gemini Live voice session.'
            );
            sendJson(clientWs, { type: 'error', message: msg });
          }
        }
        return;
      }

      if (!liveSession) return;

      if (parsed.type === 'audio' && parsed.audio) {
        liveSession.sendRealtimeInput({
          audio: { data: parsed.audio, mimeType: 'audio/pcm;rate=16000' },
        });
      } else if (parsed.type === 'text' && parsed.text) {
        liveSession.sendRealtimeInput({
          text: parsed.text,
        });
      }
    });
  });

  return wss;
}
