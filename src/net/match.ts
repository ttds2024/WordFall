import { parseServerMessage, type ClientMessage, type ServerMessage } from './protocol';

/** The multiplayer server's WebSocket address, or undefined when online play is not set up. */
export function serverUrl(): string | undefined {
  const url = import.meta.env.VITE_MULTIPLAYER_URL;
  if (url) return url;
  // `npm run dev` talks to a server started locally (see docs/MULTIPLAYER.md).
  return import.meta.env.DEV ? 'ws://localhost:8080/ws' : undefined;
}

export interface MatchHandlers {
  onMessage(message: ServerMessage): void;
  /** The connection closed without the round ending (or could not open). */
  onClose(): void;
}

/** One connection to the multiplayer server, for one match. */
export class MatchConnection {
  private readonly socket: WebSocket;
  private readonly queue: ClientMessage[] = [];
  private closed = false;

  constructor(
    url: string,
    private readonly handlers: MatchHandlers,
  ) {
    this.socket = new WebSocket(url);
    this.socket.addEventListener('open', () => {
      for (const message of this.queue.splice(0)) this.socket.send(JSON.stringify(message));
    });
    this.socket.addEventListener('message', (event) => {
      if (this.closed || typeof event.data !== 'string') return;
      const message = parseServerMessage(event.data);
      if (message) this.handlers.onMessage(message);
    });
    this.socket.addEventListener('close', () => {
      if (this.closed) return;
      this.closed = true;
      this.handlers.onClose();
    });
  }

  /** Sends a message, after the connection opens if it has not yet. */
  send(message: ClientMessage): void {
    if (this.closed) return;
    if (this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
    else this.queue.push(message);
  }

  /** Leaves the match and closes the connection; no more handlers are called. */
  close(): void {
    if (this.closed) return;
    if (this.socket.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify({ type: 'leave' }));
    this.closed = true;
    this.socket.close();
  }
}
