// server/server.ts
import * as express from "express";
import * as http from "http";
import * as SocketIO from "socket.io";
import { WebSocketServer, WebSocket } from "ws";

import * as DB from "./dbconnection";
import { getDbConnectionString } from "./getDbConnectionString";
import { GetPlayerViewManager } from "./playerviewmanager";
import ConfigureRoutes from "./routes";
import GetSessionMiddleware from "./session";
import ConfigureSockets from "./sockets";

async function improvedInitiativeServer() {
  const app = express();
  app.set("trust proxy", true);

  // Sert /public (overlay/sniffer/sender/hudStream si présents)
  app.use(express.static("public"));

  const server = http.createServer(app);

  // --- II standard (DB + routes + sessions)
  const dbConnectionString = await getDbConnectionString();
  await DB.initialize(dbConnectionString);

  const playerViews = await GetPlayerViewManager();
  const session = await GetSessionMiddleware(process.env.REDIS_URL);
  app.use(session);
  await ConfigureRoutes(app, playerViews);

  // --- HTTP (IPv4) : 8090 par défaut
  const defaultPort = Number(process.env.PORT) || 8090;
  server.listen(defaultPort, "127.0.0.1", () => {
    console.log(`HTTP listening on ${defaultPort} (IPv4)`);
  });

  // ---------- WebSocket HUD dédié (port séparé) ----------
  const WS_PORT = Number(process.env.WS_PORT) || 8091;
  const wss = new WebSocketServer({
    port: WS_PORT,
    path: "/hud",
    perMessageDeflate: false,
  });
  console.log(`WS /hud listening on ws://127.0.0.1:${WS_PORT}/hud`);

  // Registre de clients
  const clients = new Set<WebSocket>();

  wss.on("connection", (ws, req) => {
    console.log("WS /hud connected from", req?.socket?.remoteAddress);
    clients.add(ws);

    ws.on("close", () => {
      clients.delete(ws);
      console.log("WS /hud closed. clients now:", clients.size);
    });

    // Diffusion (string) + logs — SANS callback, SANS Set.forEach
    ws.on("message", (data) => {
      const text = typeof data === "string" ? data : (data as Buffer).toString();

      // snapshot en array (pas d'itération directe du Set)
      const arr: WebSocket[] = [];
      clients.forEach((c) => arr.push(c));

      const states = arr.map((c: any, i) => `${i}:${c.readyState}`);
      console.log(
        `WS /hud recv: len=${text.length} | clients=${arr.length} | states=[${states.join(", ")}] | BROADCAST=v3`
      );

      let sent = 0, errors = 0;
      for (let i = 0; i < arr.length; i++) {
        const c: any = arr[i];
        try {
          c.send(text);
          sent++;
        } catch (e: any) {
          errors++;
          console.log(`  send[${i}] -> THROW (state=${c.readyState}):`, e?.message || e);
        }
      }
      console.log(`  broadcast result: sent=${sent} errors=${errors}`);
    });
  });

  // Heartbeat (debug) — même mécanique (array snapshot + envoi sync)
  setInterval(() => {
    const hb = JSON.stringify({ type: "debug", at: Date.now(), note: "hb" });

    const arr: WebSocket[] = [];
    clients.forEach((c) => arr.push(c));

    const states = arr.map((c: any, i) => `${i}:${c.readyState}`);
    let sent = 0, errors = 0;
    for (let i = 0; i < arr.length; i++) {
      const c: any = arr[i];
      try {
        c.send(hb);
        sent++;
      } catch (e: any) {
        errors++;
        console.log(`  hb[${i}] -> THROW (state=${c.readyState}):`, e?.message || e);
      }
    }
    console.log(`WS /hud hb: clients=${arr.length} states=[${states.join(", ")}] sent=${sent} errors=${errors}`);
  }, 4000);

  console.log("Launched server.");

  // --- Socket.IO natif de II (inchangé)
  const io = new SocketIO.Server(server);
  ConfigureSockets(io, session, playerViews);
}

improvedInitiativeServer();
