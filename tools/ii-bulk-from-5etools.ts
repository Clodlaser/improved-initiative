// npx ts-node tools/ii-bulk-from-5etools.ts --in data/bestiary/bestiary-pabtso.json --out out/ii-pabtso.json
import * as fs from "fs";
import * as path from "path";

type FiveESpeed = { walk?: string|number; swim?: string|number; fly?: string|number; climb?: string|number; burrow?: string|number; canHover?: boolean };
type FiveEEntry = {
  name: string;
  source?: string;
  page?: number;
  size?: string | string[];
  type?: any;
  alignment?: any;
  ac?: Array<number | { ac: number; from?: string[] }>;
  hp?: { average?: number; formula?: string };
  speed?: FiveESpeed;
  str?: number; dex?: number; con?: number; int?: number; wis?: number; cha?: number;
  save?: Record<string, string | number>;
  skill?: Record<string, string | number>;
  resist?: string[] | string;
  immune?: string[] | string;
  conditionImmune?: string[] | string;
  senses?: string[];
  passive?: number;
  languages?: string[] | string;
  cr?: string | number;
  trait?: { name: string; entries: (string|any)[] }[];
  action?: { name: string; entries: (string|any)[] }[];
  bonus?: { name: string; entries: (string|any)[] }[];
  reaction?: { name: string; entries: (string|any)[] }[];
  legendary?: { name?: string; entries: (string|any)[] }[];
  mythic?: { name?: string; entries: (string|any)[] }[];
  spellcasting?: any[];
};

type IIAbility = { Str:number; Dex:number; Con:number; Int:number; Wis:number; Cha:number };

type IIEntry = {
  Name?: string;
  Source?: string;
  Type?: string;
  HP?: { Value:number; Notes?:string };
  AC?: { Value:number; Notes?:string };
  InitiativeModifier?: number;
  InitiativeAdvantage?: boolean;
  Speed?: string[]; // ex: ["walk 30 ft.","fly 60 ft. (hover)"]
  Abilities?: IIAbility;
  Saves?: { Name:string; Modifier:number }[];
  Skills?: { Name:string; Modifier:number }[];
  DamageVulnerabilities?: string[];
  DamageResistances?: string[];
  DamageImmunities?: string[];
  ConditionImmunities?: string[];
  Senses?: string[];
  Languages?: string[];
  Challenge?: string;
  Traits?: { Name:string; Content:string }[];
  Actions?: { Name:string; Content:string }[];
  BonusActions?: { Name:string; Content:string }[];
  Reactions?: { Name:string; Content:string }[];
  LegendaryActions?: { Name:string; Content:string }[];
  MythicActions?: { Name:string; Content:string }[];
  Description?: string;
  Player?: string;
  Version?: string;
  ImageURL?: string;
  LastUpdateMs?: number;
};

// ---------- helpers ----------
const asArray = <T>(v: T|T[]|undefined) => v==null ? [] : (Array.isArray(v) ? v : [v]);
const ft = (v: string|number|undefined) => v==null ? undefined : (typeof v==="number" ? `${v} ft.` : v);
const clean = (s:string) => s.replace(/\s+/g," ").trim();
const joinEntries = (entries:any[]):string => {
  const flatten = (x:any):string => {
    if (typeof x === "string") return x;
    if (Array.isArray(x?.entries)) return x.entries.map(flatten).join(" ");
    if (x?.type === "list" && Array.isArray(x?.items)) return x.items.map(flatten).join(" ");
    if (x?.type === "table") return ""; // ignore tables in body
    if (x?.type === "abilityDc") return `Save DC ${x.dc}`;
    return "";
  };
  return clean(entries.map(flatten).filter(Boolean).join(" "));
};

const mapSpeed = (sp?: FiveESpeed): string[] => {
  if (!sp) return [];
  const out: string[] = [];
  const add = (mode:string, val?:string|number) => {
    if (val==null) return;
    let txt = typeof val==="number" ? `${val} ft.` : val;
    out.push(`${mode} ${txt}${mode==="fly"&&sp.canHover? " (hover)": ""}`);
  };
  add("walk", sp.walk);
  add("fly", sp.fly);
  add("swim", sp.swim);
  add("climb", sp.climb);
  add("burrow", sp.burrow);
  return out;
};

const mapAC = (ac?: FiveEEntry["ac"]): {Value:number; Notes?:string}|undefined => {
  if (!ac || !ac.length) return undefined;
  const first = ac[0];
  if (typeof first === "number") return { Value:first };
  return { Value:first.ac, Notes: first.from?.join(", ") };
};

const mapSaves = (save?: FiveEEntry["save"]): IIEntry["Saves"] => {
  if (!save) return [];
  const cap = (k:string)=>({ str:"Str",dex:"Dex",con:"Con",int:"Int",wis:"Wis",cha:"Cha" } as any)[k.toLowerCase()]||k;
  return Object.entries(save).map(([k,v])=>({ Name: cap(k), Modifier: Number(String(v).replace(/[^-+\d]/g,"")) }));
};

const mapSkills = (skill?: FiveEEntry["skill"]): IIEntry["Skills"] => {
  if (!skill) return [];
  return Object.entries(skill).map(([k,v])=>({ Name: k[0].toUpperCase()+k.slice(1), Modifier: Number(String(v).replace(/[^-+\d]/g,"")) }));
};

const mapAbilities = (m: FiveEEntry): IIAbility|undefined => {
  if ([m.str,m.dex,m.con,m.int,m.wis,m.cha].some(v=>typeof v==="number"))
    return { Str:m.str||10, Dex:m.dex||10, Con:m.con||10, Int:m.int||10, Wis:m.wis||10, Cha:m.cha||10 };
  return undefined;
};

const mapSenses = (m: FiveEEntry): string[] => {
  const arr: string[] = [];
  for (const s of asArray(m.senses)) arr.push(s.toLowerCase());
  if (typeof m.passive === "number") arr.push(`passive Perception ${m.passive}`);
  return arr;
};

const mapLangs = (v: FiveEEntry["languages"]): string[] => {
  if (!v) return [];
  return (Array.isArray(v) ? v : String(v).split(",")).map(x=>clean(String(x)));
};

const textBlocks = (list?: {name:string; entries:any[]}[]) =>
  asArray(list).map(e=>({ Name:e.name, Content: joinEntries(e.entries||[]) }));

const mapCR = (cr: FiveEEntry["cr"]): string|undefined => {
  if (cr==null) return undefined;
  const s = String(typeof cr==="object" ? (cr as any).cr || "" : cr);
  const m = s.match(/\d+\/?\d*/);
  return m ? m[0] : undefined;
};

const mapResistArray = (v: FiveEEntry["resist"]) => asArray(v).map(x=>String(x).toLowerCase());
const mapImmuneArray = (v: FiveEEntry["immune"]) => asArray(v).map(x=>String(x).toLowerCase());
const mapCondImmArray = (v: FiveEEntry["conditionImmune"]) => asArray(v).map(x=>String(x).toLowerCase());

// ---------- main ----------
function convertFile(inPath:string, outPath:string){
  const raw = JSON.parse(fs.readFileSync(inPath,"utf8")) as { monster: FiveEEntry[] };
  const monsters = raw.monster || [];
  const iiList: IIEntry[] = monsters.map(m=>{
    const source = m.source || "";
    const page = m.page!=null ? `, p.${m.page}` : "";
    const typeBits: string[] = [];
    if (m.size) typeBits.push(Array.isArray(m.size)? m.size.join("/"): m.size);
    if (m.type) typeBits.push(typeof m.type==="string"? m.type: (m.type?.type || ""));
    if (m.alignment) typeBits.push(
      Array.isArray(m.alignment)
        ? m.alignment.map((a:any)=> (typeof a==="string"? a : a.alignment||"")).filter(Boolean).join(" ")
        : (typeof m.alignment==="string"? m.alignment : "")
    );
    const Type = clean(typeBits.filter(Boolean).join(", "));

    const entry: IIEntry = {
      Name: m.name,
      Source: source ? `${source}${page}` : undefined,
      Type: Type || undefined,
      HP: m.hp ? { Value: Number(m.hp.average ?? 0), Notes: m.hp.formula? `(${m.hp.formula})`: undefined } : undefined,
      AC: mapAC(m.ac),
      InitiativeModifier: undefined,           // 5e.tools n’expose pas l’initiative direct
      InitiativeAdvantage: undefined,
      Speed: mapSpeed(m.speed),
      Abilities: mapAbilities(m),
      Saves: mapSaves(m.save),
      Skills: mapSkills(m.skill),
      DamageVulnerabilities: [],               // 5e.tools n’a pas de champ “vulnerable” pour tous; on peut étendre si présent
      DamageResistances: mapResistArray(m.resist),
      DamageImmunities: mapImmuneArray(m.immune),
      ConditionImmunities: mapCondImmArray(m.conditionImmune),
      Senses: mapSenses(m),
      Languages: mapLangs(m.languages),
      Challenge: mapCR(m.cr),
      Traits: textBlocks(m.trait),
      Actions: textBlocks(m.action),
      BonusActions: textBlocks(m.bonus),
      Reactions: textBlocks(m.reaction),
      LegendaryActions: textBlocks(m.legendary),
      MythicActions: textBlocks(m.mythic),
      Description: "",
      Player: "",
      Version: "3.13.3",
      ImageURL: "",
      LastUpdateMs: Date.now()
    };
    // Remplissages utiles
    if (entry.AC && entry.AC.Notes) entry.AC.Notes = `(${entry.AC.Notes})`;
    return entry;
  });

  fs.mkdirSync(path.dirname(outPath), { recursive:true });
  fs.writeFileSync(outPath, JSON.stringify(iiList, null, 2), "utf8");
  console.log(`✓ ${iiList.length} créatures converties → ${outPath}`);
}

const args = process.argv.slice(2);
const inIdx = args.indexOf("--in"); const outIdx = args.indexOf("--out");
if (inIdx>=0 && args[inIdx+1] && outIdx>=0 && args[outIdx+1]) {
  convertFile(args[inIdx+1], args[outIdx+1]);
} else {
  console.log("Usage:\n  npx ts-node tools/ii-bulk-from-5etools.ts --in data/bestiary/bestiary-pabtso.json --out out/ii-pabtso.json");
}
