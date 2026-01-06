import type { Server as HTTPServer } from "http";
import WebSocket, { WebSocketServer } from "ws";

export interface ServerEvent {
  type: string;
  payload: unknown;
}

export class EventBus {
  private wss: WebSocketServer;

  constructor(server: HTTPServer) {
    this.wss = new WebSocketServer({ server });
  }

  broadcast(event: ServerEvent) {
    const message = JSON.stringify(event);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  onConnection(handler: (socket: WebSocket) => void) {
    this.wss.on("connection", handler);
  }
}

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class ExecutionController {
  private paused = false;
  private stepRequested = false;
  private waiters: Array<() => void> = [];

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
    this.stepRequested = false;
    this.releaseAll();
  }

  step() {
    this.paused = true;
    this.stepRequested = true;
    this.releaseOne();
  }

  async wait(stepDelay: number) {
    if (!this.paused) {
      await delay(stepDelay);
      return;
    }

    if (this.stepRequested) {
      this.stepRequested = false;
      return;
    }

    await new Promise<void>((resolve) => this.waiters.push(resolve));

    if (!this.paused) {
      await delay(stepDelay);
      return;
    }

    if (this.stepRequested) {
      this.stepRequested = false;
    }
  }

  private releaseAll() {
    while (this.waiters.length) {
      const waiter = this.waiters.shift();
      waiter?.();
    }
  }

  private releaseOne() {
    const waiter = this.waiters.shift();
    waiter?.();
  }
}
