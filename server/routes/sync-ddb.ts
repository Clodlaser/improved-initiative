// server/routes/sync-ddb.ts
import type { Request, Response, Router } from "express";
import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { fetch as undiciFetch } from "undici";
import { chromium, type Browser, type Page } from "playwright";
import { upsertUser } from "../dbconnection";
import { AccountStatus } from "../user";

/**
 * ENV utilisables :
 *  SYNC_DDB_TOKEN=CHANGEMOI
 *  DDB_URLS_PATH=./public/sync/ddb-urls.txt
 *  DDB_HEADLESS=false|true
 *  DDB_CONCURRENCY=1
 *  DDB_NAV_TIMEOUT=20000
 *  DDB_GLOBAL_TIMEOUT=600000
 *  DDB_PAGE_RETRIES=2
 */
const HEADLESS = process.env.DDB_HEADLESS !== "false";
const CONCURRENCY = Math.max(1, Number(process.env.DDB_CONCURRENCY || 1));
const NAV_TIMEOUT = Number(process.env.DDB_NAV_TIMEOUT || 20000);
const GLOBAL_TIMEOUT = Number(process.env.DDB_GLOBAL_TIMEOUT || 10 * 60 * 1000);
const PAGE_RETRIES = Math.max(0, Number(process.env.DDB_PAGE_RETRIES || 2));
const PAGE_HARD_TIMEOUT = Math.max(15000, NAV_TIMEOUT + 20000);

/* -------------------- utils -------------------- */
function parseUrlsFile(txt: string) {
  return txt
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => l.replace(/\s+#.*$/, ""))
    .filter(Boolean)
    .map(l => l.split("|").map(s => s.trim()))
    .filter(parts => parts[0] && /characters\/\d+/.test(parts[0]))
    .map(([url, player, displayName]) => ({
      url,
      player: player || "",
      displayName: displayName || ""
    }));
}
const abilMod = (s: number) => Math.floor((s - 10) / 2);
const cleanupNum = (s?: string | null) => {
  if (!s) return null;
  const m = s.replace(/,/g, "").match(/-?\d+/);
  return m ? Number(m[0]) : null;
};

function tmpDir() {
  const p = join(__dirname, "..", "..", "tmp");
  mkdirSync(p, { recursive: true });
  return p;
}
async function safeShot(page: Page, name: string) {
  try {
    const p = join(tmpDir(), name);
    await page.screenshot({ path: p, fullPage: true });
    console.error(`[sync-ddb] screenshot: ${p}`);
  } catch (e) {
    console.error(`[sync-ddb] screenshot failed: ${String(e)}`);
  }
}

async function tryClick(page: Page, selectors: string[], waitAfterMs = 300) {
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if (await el.count()) {
      try {
        await el.click({ timeout: 1500 });
        await page.waitForTimeout(waitAfterMs);
        return true;
      } catch { /* ignore */ }
    }
  }
  return false;
}
async function handleConsent(page: Page) {
  const selectors = [
    'button:has-text("ACCEPT ALL")',
    'button:has-text("Accept all")',
    'button:has-text("Tout accepter")',
    'button:has-text("J’accepte")',
    '[data-testid="cookie-banner-accept"]',
    'button[aria-label*="Accept"]',
    'button:has-text("OK")',
    '.ot-sdk-container .accept-all',
    '.cookie-modal-accept',
    'a:has-text("Accept")'
  ];
  await tryClick(page, selectors, 500);
}

/* -------------------- scraper (tolérant) -------------------- */
async function scrapeCharacterOnce(page: Page, url: string, displayNameOverride?: string) {
  // logs console de la page
  page.on("console", msg => { try { console.log("[DDB]", msg.type(), msg.text()); } catch {} });

  await page.goto(url, { timeout: NAV_TIMEOUT, waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: NAV_TIMEOUT }).catch(() => {});
  await handleConsent(page);
  await page.waitForTimeout(500);
  await safeShot(page, `step1-loaded-${(url.match(/characters\/(\d+)/)||['x'])[1]}.png`);

  const qText = async (sel: string) => {
    try { return (await page.locator(sel).first().textContent())?.trim() || null; } catch { return null; }
  };
  const qAttr = async (sel: string, attr: string) => {
    try { return await page.locator(sel).first().getAttribute(attr); } catch { return null; }
  };
  const pickNum = (s?: string | null) => {
    if (!s) return null;
    const m = s.replace(/,/g, "").match(/-?\d+/);
    return m ? Number(m[0]) : null;
  };
  const grab = async (candidates: string[]) => {
    for (const sel of candidates) {
      const v = await qText(sel);
      if (v != null && v !== "") return v;
    }
    return null;
  };

  const ogTitle = await qAttr('meta[property="og:title"]', 'content');
  const Name = (displayNameOverride || (ogTitle || "").replace(/\s*-\s*D&D Beyond.*$/i, "").trim()) || "Character";
  const ImageURL = (await qAttr('meta[property="og:image"]', 'content')) || "";

  const idMatch = url.match(/characters\/(\d+)/);
  const charId = idMatch ? idMatch[1] : Math.random().toString(36).slice(2);

  const abil = async (root: string) =>
    pickNum(await grab([
      `${root} .ddbc-ability-score-box__score`,
      `${root} .ddbc-ability-score-box__ability-score`,
      `${root} [data-testid="ability-score"]`,
      root
    ]));

  const Str = (await abil(".ddbc-ability-score-box--strength"))     ?? 10;
  const Dex = (await abil(".ddbc-ability-score-box--dexterity"))    ?? 10;
  const Con = (await abil(".ddbc-ability-score-box--constitution")) ?? 10;
  const Int = (await abil(".ddbc-ability-score-box--intelligence")) ?? 10;
  const Wis = (await abil(".ddbc-ability-score-box--wisdom"))       ?? 10;
  const Cha = (await abil(".ddbc-ability-score-box--charisma"))     ?? 10;

  const ACnum = pickNum(await grab([
    ".ddbc-armor-class-box__value",
    '[data-testid="armor-class"] .ddbc-armor-class-box__value',
    '[aria-label*="Armor Class"]'
  ])) ?? (10 + abilMod(Dex));

  const Init = pickNum(await grab([
    ".ddbc-initiative-box__value",
    '[data-testid="initiative"] .ddbc-initiative-box__value',
    '[aria-label*="Initiative"]'
  ])) ?? abilMod(Dex);

  const Speed = pickNum(await grab([
    ".ddbc-speed-box__value",
    '[data-testid="speed"] .ddbc-speed-box__value',
    '[aria-label*="Speed"]'
  ])) ?? 30;

  let HPmax = pickNum(await grab([
    ".ddbc-hit-points-box__max",
    '[data-testid="hit-points-max"]',
    ".ddbc-hit-points-box"
  ]));
  if (HPmax == null) {
    const hpBox = await qText(".ddbc-hit-points-box");
    const m = (hpBox || "").match(/(\d+)\s*\/\s*(\d+)/);
    HPmax = m ? Number(m[2]) : 1;
  }

  let Type = "Humanoid";
  const summary = (await grab([
    '[data-testid="character-summary-descriptor"]',
    '.ddbc-character-summary__race'
  ]));
  if (summary) Type = summary.split(/\s{2,}/)[0].trim() || Type;

  const bodyText = (await qText("body")) || "";
  const cm =
    bodyText.match(/\bClass(?:es)?\b[\s:]*([A-Za-z0-9 /]+)\b/) ||
    (summary ? summary.match(/\b([A-Za-z]+ \d+(?:\s*\/\s*[A-Za-z]+ \d+)*)\b/) : null);
  const Challenge = cm ? cm[1].trim() : "";

  await safeShot(page, `step2-read-${charId}.png`);

  return {
    Id: `ddb-${charId}`,
    Source: "DDB (DOM)",
    Name,
    Type,
    HP: { Value: HPmax, Notes: "" },
    AC: { Value: ACnum, Notes: "" },
    Abilities: { Str, Dex, Con, Int, Wis, Cha },
    Speed: [`${Speed}ft.`],
    InitiativeModifier: Init,
    DamageVulnerabilities: [],
    DamageResistances: [],
    DamageImmunities: [],
    ConditionImmunities: [],
    Saves: [],
    Skills: [],
    Senses: [],
    Languages: [],
    Challenge,
    Traits: [],
    Actions: [],
    Reactions: [],
    LegendaryActions: [],
    ImageURL,
    Description: `[Link to DNDB Character](${url})`
  };
}

async function scrapeCharacter(page: Page, url: string, displayNameOverride?: string) {
  let lastErr: any = null;
  for (let attempt = 0; attempt <= PAGE_RETRIES; attempt++) {
    try {
      const res = await Promise.race([
        scrapeCharacterOnce(page, url, displayNameOverride),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error(`Timeout: scrape ${url} > ${PAGE_HARD_TIMEOUT}ms`)), PAGE_HARD_TIMEOUT)
        )
      ]);
      return res;
    } catch (e: any) {
      lastErr = e;
      console.error(`[sync-ddb] scrape attempt ${attempt + 1} failed for ${url}: ${String(e?.message || e)}`);
      await safeShot(page, `scrape-fail-${(url.match(/characters\/(\d+)/)||['x'])[1]}-a${attempt+1}.png`);
      if (attempt < PAGE_RETRIES) {
        await page.waitForTimeout(1000);
        continue;
      }
    }
  }
  throw lastErr || new Error("scrape failed");
}

/* -------------------- upsert dans Improved Initiative -------------------- */
async function upsertIntoII(req: Request, ch: any) {
  const base = `${req.protocol}://${req.get("host")}`;
  const cookie = req.headers.cookie || "";
  const headers = { cookie, "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" };

  const persistent = {
    Id: ch.Id,
    Version: "3.13.3",
    Name: ch.Name,
    Path: "",
    LastUpdateMs: Date.now(),
    CurrentHP: ch.HP.Value,
    StatBlock: ch,
    Notes: ""
  };

  const existingResp = await undiciFetch(`${base}/my/persistentcharacters`, { headers: { cookie } });
  const existing = existingResp.ok ? await existingResp.json() : {};
  const list: any[] = Object.values(existing || {});
  const found = list.find(x => x?.StatBlock?.Id === ch.Id || x?.Id === ch.Id);

  if (found) {
    const pid = found.Id || found.StatBlock?.Id;
    const r = await undiciFetch(`${base}/my/persistentcharacters/${encodeURIComponent(pid)}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ ...persistent, Id: pid })
    });
    if (!r.ok) throw new Error(`PUT ${r.status}`);
    return { updated: 1, created: 0 };
  } else {
    const r = await undiciFetch(`${base}/my/persistentcharacters`, {
      method: "POST",
      headers,
      body: JSON.stringify(persistent)
    });
    if (!r.ok) throw new Error(`POST ${r.status}`);
    return { updated: 0, created: 1 };
  }
}

/* -------------------- routes -------------------- */
export function installSyncDdbRoute(app: Router) {
  // ping
  app.get("/admin/sync-ddb/ping", (_req: Request, res: Response) => {
    res.json({ ok: true, mode: "dom-headless", headless: HEADLESS, concurrency: CONCURRENCY, ts: Date.now() });
  });

  // debug : liste lue
  app.get("/admin/sync-ddb/debug", (req: Request, res: Response) => {
    const urlsPath = process.env.DDB_URLS_PATH || join(process.cwd(), "public", "sync", "ddb-urls.txt");
    try {
      const rows = parseUrlsFile(readFileSync(urlsPath, "utf8"));
      res.json({ ok: true, path: urlsPath, count: rows.length, rows });
    } catch (e: any) {
      res.status(500).json({ ok: false, path: urlsPath, error: String(e?.message || e) });
    }
  });

  // single (scrape + upsert + renvoie statblock)
  app.get("/admin/sync-ddb/single", async (req: Request, res: Response) => {
    const token = String(process.env.SYNC_DDB_TOKEN || "changeme");
    if (req.query.token !== token) return res.status(401).json({ error: "Unauthorized" });

    const url = String(req.query.url || "");
    if (!/https?:\/\/.*dndbeyond\.com\/characters\/\d+/.test(url)) {
      return res.status(400).json({ error: "Bad or missing ?url=" });
    }

    try {
      // primer session
      const s = (req as any).session;
      if (s) {
        if (!s.userId) {
          const user = await upsertUser(process.env.DEFAULT_PATREON_ID || "local-sync", AccountStatus.Epic, "");
          if (user) s.userId = user._id;
        }
        s.isLoggedIn = true;
        s.hasStorage = true;
        s.hasEpicInitiative = true;
      }

      const browser: Browser = await chromium.launch({ headless: HEADLESS });
      const context = await browser.newContext({
        locale: "fr-FR",
        timezoneId: "Europe/Paris",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        viewport: { width: 1366, height: 800 }
      });

      const page = await context.newPage();
      page.setDefaultTimeout(NAV_TIMEOUT);

      try {
        const ch: any = await scrapeCharacter(page, url);
        ch.Player = String(req.query.player || "");
        const result = await upsertIntoII(req, ch);
        // dump pour debug
        try {
          const id = (url.match(/characters\/(\d+)/) || [])[1] || Date.now().toString();
          writeFileSync(join(tmpDir(), `scrape-json-${id}.json`), JSON.stringify(ch, null, 2), "utf8");
        } catch {}
        return res.json({ ok: true, ...result, statblock: ch });
      } catch (e: any) {
        await safeShot(page, `single-fail-${(url.match(/characters\/(\d+)/)||['x'])[1]}.png`);
        return res.status(500).json({ ok: false, error: String(e?.message || e) });
      } finally {
        await page.close().catch(() => {});
        await context.close().catch(() => {});
        await browser.close().catch(() => {});
      }
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // sync liste
  app.get("/admin/sync-ddb", async (req: Request, res: Response) => {
    try {
      const token = String(process.env.SYNC_DDB_TOKEN || "changeme");
      if (req.query.token !== token) return res.status(401).json({ error: "Unauthorized" });

      const s = (req as any).session;
      if (s) {
        if (!s.userId) {
          const user = await upsertUser(process.env.DEFAULT_PATREON_ID || "local-sync", AccountStatus.Epic, "");
          if (user) s.userId = user._id;
        }
        s.isLoggedIn = true;
        s.hasStorage = true;
        s.hasEpicInitiative = true;
      }

      const urlsPath = process.env.DDB_URLS_PATH || join(process.cwd(), "public", "sync", "ddb-urls.txt");
      const rows = parseUrlsFile(readFileSync(urlsPath, "utf8"));
      if (rows.length === 0) return res.json({ ok: true, created: 0, updated: 0, errors: [], note: "no urls" });

      const browser: Browser = await chromium.launch({ headless: HEADLESS });
      const context = await browser.newContext({
        locale: "fr-FR",
        timezoneId: "Europe/Paris",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        viewport: { width: 1366, height: 800 }
      });

      let created = 0;
      let updated = 0;
      const errors: any[] = [];

      const queue = [...rows];
      let index = 0;

      const worker = async (row: { url: string; player: string; displayName: string }, i: number) => {
        const page = await context.newPage();
        page.setDefaultTimeout(NAV_TIMEOUT);
        try {
          const ch: any = await scrapeCharacter(page, row.url, row.displayName);
          ch.Player = row.player || "";
          const r = await upsertIntoII(req, ch);
          created += r.created;
          updated += r.updated;
        } catch (e: any) {
          const msg = String(e?.message || e);
          errors.push({ url: row.url, error: msg });
          await safeShot(page, `list-fail-${(row.url.match(/characters\/(\d+)/)||['x'])[1]}-i${i}.png`);
        } finally {
          await page.close().catch(() => {});
        }
      };

      const runners: Promise<void>[] = [];
      for (let i = 0; i < CONCURRENCY; i++) {
        runners.push(
          (async function run() {
            while (queue.length) {
              const row = queue.shift()!;
              index++;
              await Promise.race([
                worker(row, index),
                new Promise<void>((_, rej) =>
                  setTimeout(() => rej(new Error(`Timeout worker > ${PAGE_HARD_TIMEOUT}ms`)), PAGE_HARD_TIMEOUT)
                )
              ]).catch((e: any) => {
                const msg = String(e?.message || e);
                errors.push({ url: row.url, error: `worker-timeout: ${msg}` });
              });
            }
          })()
        );
      }

      await Promise.race([
        Promise.all(runners),
        new Promise<void>((_, rej) =>
          setTimeout(() => rej(new Error(`Global timeout ${GLOBAL_TIMEOUT}ms`)), GLOBAL_TIMEOUT)
        )
      ]).catch((e: any) => {
        const msg = String(e?.message || e);
        errors.push({ global: true, error: msg });
      });

      await context.close().catch(() => {});
      await browser.close().catch(() => {});

      return res.json({ ok: true, created, updated, errors });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  console.log("[sync-ddb] (DOM headless) route mounted at /admin/sync-ddb");
}
