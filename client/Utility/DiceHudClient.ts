import { RollResult } from "../Rules/RollResult";

interface DiceHudRollMessage {
  type: "roll";
  room: string;
  player?: string;
  target?: string;
  title?: string;
  payload: {
    n: number;
    faces: number;
    mod: number;
    rolls: number[];
    subtotal: number;
    total: number;
    formula?: string;
  };
  ts: number;
}

const qs = new URLSearchParams(window.location.search);
const DEFAULT_ROOM = qs.get("room") || "session-1";
const DEFAULT_TARGET = qs.get("target") || "table";
const DEFAULT_PLAYER = qs.get("player") || "gm";
const WS_OVERRIDE = qs.get("ws");

function getWsUrl(): string {
  if (WS_OVERRIDE) {
    return WS_OVERRIDE;
  }
  const host = window.location.hostname || "127.0.0.1";
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${host}:8091/hud`;
}

class DiceHudClient {
  private ws: WebSocket | null = null;
  private ready = false;
  private queue: string[] = [];
  private url: string;

  constructor(url?: string) {
    this.url = url || getWsUrl();
    this.connect();
  }

  private connect() {
    try {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => {
        this.ready = true;
        this.flush();
      };
      this.ws.onclose = () => {
        this.ready = false;
        setTimeout(() => this.connect(), 1200);
      };
      this.ws.onerror = () => {
        this.ready = false;
      };
    } catch {
      this.ready = false;
    }
  }

  private flush() {
    if (!this.ready || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    while (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) {
        try {
          this.ws.send(next);
        } catch {
          // swallow send errors
        }
      }
    }
  }

  private sendRaw(obj: DiceHudRollMessage) {
    const payload = JSON.stringify(obj);
    if (this.ready && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(payload);
        return;
      } catch {
        // fall through to queue
      }
    }
    this.queue.push(payload);
  }

  public sendRoll(payload: DiceHudRollMessage["payload"], title?: string) {
    const msg: DiceHudRollMessage = {
      type: "roll",
      room: DEFAULT_ROOM,
      player: DEFAULT_PLAYER,
      target: DEFAULT_TARGET,
      payload,
      ts: Date.now()
    };
    if (title) {
      msg.title = title;
    }
    this.sendRaw(msg);
  }
}

export const diceHudClient = new DiceHudClient();

export function sendDiceHudRoll(
  diceExpression: string,
  roll: RollResult,
  title?: string
) {
  if (!roll) {
    return;
  }
  const subtotal = roll.Rolls.reduce((a, b) => a + b, 0);
  diceHudClient.sendRoll(
    {
      n: roll.Rolls.length,
      faces: roll.DieSize,
      mod: roll.Modifier,
      rolls: roll.Rolls,
      subtotal,
      total: roll.Total,
      formula: diceExpression
    },
    title
  );
}
