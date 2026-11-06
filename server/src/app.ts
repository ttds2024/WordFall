import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { ROOM_NAME } from '../../src/online/protocol.ts';
import { WordfallRoom } from './room.ts';

/** The game server, not yet listening; `room` is replaced in tests. */
export function createServer(room: typeof WordfallRoom = WordfallRoom): Server {
  const server = new Server({
    transport: new WebSocketTransport(),
    greet: false,
    // On SIGTERM (docker stop) rooms are disposed before the process exits.
    gracefullyShutdown: true,
  });
  // Quick match pairs players by language and room size; private rooms are joined by code.
  server.define(ROOM_NAME, room).filterBy(['lang', 'seats']);
  return server;
}
