// scripts/convert-5etools.js
const fs = require("fs");
const path = require("path");

const SOURCE_5ETOOLS_DIR = process.env.FIVE_TOOLS_DIR || "d:/Dev/5etools-local-fr";
const TARGET_II_DIR = process.env.II_DIR || path.resolve(__dirname, "..");

console.log(`[convert-5etools] Source: ${SOURCE_5ETOOLS_DIR} (READ-ONLY)`);
console.log(`[convert-5etools] Target: ${TARGET_II_DIR}`);

// -------------------------------------------------------------
// Dictionnaires de traduction et correspondances
// -------------------------------------------------------------
const SIZE_MAP = {
  F: "Infime",
  D: "Minuscule",
  T: "Très petite",
  S: "Petite",
  M: "Moyenne",
  L: "Grande",
  H: "Très grande",
  G: "Gigantesque",
  C: "Colossale"
};

const ALIGNMENT_MAP = {
  L: "loyal",
  C: "chaotique",
  N: "neutre",
  G: "bon",
  E: "mauvais",
  U: "sans alignement",
  A: "tout alignement"
};

const SCHOOL_MAP = {
  A: "Abjuration",
  C: "Invocation",
  D: "Divination",
  E: "Enchantement",
  V: "Évocation",
  I: "Illusion",
  N: "Nécromancie",
  T: "Transmutation",
  P: "Psionique"
};

const CONDITION_MAP = {
  blinded: "aveuglé",
  charmed: "charmé",
  deafened: "assourdi",
  exhaustion: "épuisement",
  frightened: "effrayé",
  grappled: "agrippé",
  incapacitated: "neutralisé",
  invisible: "invisible",
  paralyzed: "paralysé",
  petrified: "pétrifié",
  poisoned: "empoisonné",
  prone: "à terre",
  restrained: "entravé",
  stunned: "étourdi",
  unconscious: "inconscient"
};

const DAMAGE_TYPE_MAP = {
  acid: "acide",
  bludgeoning: "contondant",
  cold: "froid",
  fire: "feu",
  force: "force",
  lightning: "foudre",
  necrotic: "nécrotique",
  piercing: "perforant",
  poison: "poison",
  psychic: "psychique",
  radiant: "radiant",
  slashing: "tranchant",
  thunder: "tonnerre"
};

const SKILL_MAP = {
  athletics: "Athlétisme",
  acrobatics: "Acrobaties",
  "sleight of hand": "Escamotage",
  stealth: "Discrétion",
  arcana: "Arcanes",
  history: "Histoire",
  investigation: "Investigation",
  nature: "Nature",
  religion: "Religion",
  "animal handling": "Dressage",
  insight: "Intuition",
  medicine: "Médecine",
  perception: "Perception",
  survival: "Survie",
  deception: "Tromperie",
  intimidation: "Intimidation",
  performance: "Représentation",
  persuasion: "Persuasion"
};

const SENSE_MAP = {
  darkvision: "vision dans le noir",
  blindsight: "vision aveugle",
  truesight: "vision véritable",
  tremorsense: "perception des vibrations",
  "passive perception": "Perception passive"
};

// -------------------------------------------------------------
// Fonctions de conversion métrique / cases (5 ft. = 1,5 m = 1 case)
// -------------------------------------------------------------
function convertDistance(feetNum) {
  const n = parseInt(feetNum, 10);
  if (isNaN(n)) return feetNum;
  const meters = n * 0.3;
  const metersStr = Number.isInteger(meters)
    ? `${meters} m`
    : `${meters.toFixed(1).replace(".", ",")} m`;
  const squares = Math.round(n / 5);
  const squaresStr = squares <= 1 ? "1 case" : `${squares} cases`;
  return `${metersStr} (${squaresStr})`;
}

function convertDistanceInText(text) {
  if (!text || typeof text !== "string") return text;
  let str = text;

  // 1. Portées avec slash: "20/60 ft." ou "30/120 pieds"
  str = str.replace(
    /(\d+)\s*\/\s*(\d+)\s*(?:ft\.?|feet|foot|pieds?)\b/gi,
    (match, p1, p2) => {
      return `${convertDistance(p1)} / ${convertDistance(p2)}`;
    }
  );

  // 2. Distances uniques: "5 pieds", "30 ft.", "60 feet", etc.
  str = str.replace(
    /(\d+)\s*(?:ft\.?|feet|foot|pieds?)(?=[^\w]|$)/gi,
    (match, p1) => {
      return convertDistance(p1);
    }
  );

  return str;
}

// -------------------------------------------------------------
// 1. Nettoyage des balises 5etools
// -------------------------------------------------------------
function clean5eTags(text) {
  if (text == null) return "";
  if (typeof text !== "string") return String(text);

  let str = text;

  // Remplacement des modificateurs et dés
  str = str.replace(/\{@hit (\+?-?\d+)\}/gi, "+$1");
  str = str.replace(/\{@d20 ([^}]+)\}/gi, "$1");
  str = str.replace(/\{@damage ([^}]+)\}/gi, "$1");
  str = str.replace(/\{@dice ([^}]+)\}/gi, "$1");
  str = str.replace(/\{@scaledice [^|]+\|[^|]+\|([^}]+)\}/gi, "$1");
  str = str.replace(/\{@scaledamage [^|]+\|[^|]+\|([^}]+)\}/gi, "$1");
  str = str.replace(/\{@dc (\d+)\}/gi, "DD $1");
  str = str.replace(/\{@recharge (\d?)\}/gi, (_, d) => (d ? `(Recharge ${d}-6)` : "(Recharge 6)"));

  // Types d'attaques
  str = str.replace(/\{@atk mw\}/gi, "Attaque au corps à corps avec une arme :");
  str = str.replace(/\{@atk rw\}/gi, "Attaque à distance avec une arme :");
  str = str.replace(/\{@atk mw,rw\}/gi, "Attaque avec une arme au corps à corps ou à distance :");
  str = str.replace(/\{@atk ms\}/gi, "Attaque de sort au corps à corps :");
  str = str.replace(/\{@atk rs\}/gi, "Attaque de sort à distance :");
  str = str.replace(/\{@h\s*([^}]*)\}/gi, (_, extra) => (extra ? `Touché : ${extra}` : "Touché : "));

  // Formatage
  str = str.replace(/\{@b ([^}]+)\}/gi, "**$1**");
  str = str.replace(/\{@bold ([^}]+)\}/gi, "**$1**");
  str = str.replace(/\{@i ([^}]+)\}/gi, "*$1*");
  str = str.replace(/\{@italic ([^}]+)\}/gi, "*$1*");
  str = str.replace(/\{@s ([^}]+)\}/gi, "~~$1~~");
  str = str.replace(/\{@strike ([^}]+)\}/gi, "~~$1~~");
  str = str.replace(/\{@u ([^}]+)\}/gi, "$1");
  str = str.replace(/\{@underline ([^}]+)\}/gi, "$1");
  str = str.replace(/\{@note ([^}]+)\}/gi, "($1)");
  str = str.replace(/\{@chance ([^|}]+)(?:\|[^}]+)?\}/gi, "$1%");

  // Conditions avec traduction FR
  str = str.replace(/\{@condition ([^|}]+)(?:\|[^}]+)?\}/gi, (_, c) => {
    const key = c.toLowerCase().trim();
    return CONDITION_MAP[key] || c;
  });

  // Liens d'entités (sorts, créatures, objets, compétences, etc.)
  const linkTags = [
    "spell", "creature", "item", "disease", "status",
    "skill", "sense", "action", "background", "race", "class",
    "feat", "optfeature", "table", "variantrule", "book", "adventure",
    "filter", "link", "hazard", "reward", "deck", "card"
  ];
  const tagRegex = new RegExp(`\\{@(?:${linkTags.join("|")})\\s+([^}]+)\\}`, "gi");

  str = str.replace(tagRegex, (_, content) => {
    const parts = content.split("|");
    if (parts.length >= 3 && parts[2]) return parts[2];
    return parts[0];
  });

  // Nettoyage générique pour toute autre balise résiduelle
  str = str.replace(/\{@\w+\s+([^|}]+)(?:\|[^}]*)?\}/gi, "$1");
  str = str.replace(/\{@\w+\}/gi, "");

  // Nettoyage des parenthèses avec espaces inutiles ex: ( 2d6 + 5 ) -> (2d6 + 5)
  str = str.replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");

  // Conversion des distances en mètres / cases dans le texte
  str = convertDistanceInText(str);

  // Nettoyage des espaces multiples
  str = str.replace(/[ \t]+/g, " ").trim();

  return str;
}

function parseEntries(entries) {
  if (!entries) return "";
  if (typeof entries === "string") return clean5eTags(entries);
  if (!Array.isArray(entries)) entries = [entries];

  const lines = [];

  for (const entry of entries) {
    if (typeof entry === "string") {
      lines.push(clean5eTags(entry));
    } else if (typeof entry === "object" && entry !== null) {
      if (entry.type === "entries" || entry.type === "section") {
        const title = entry.name ? `**${clean5eTags(entry.name)}.** ` : "";
        const body = parseEntries(entry.entries);
        lines.push(`${title}${body}`.trim());
      } else if (entry.type === "list") {
        if (Array.isArray(entry.items)) {
          entry.items.forEach(item => {
            if (typeof item === "string") {
              lines.push(`* ${clean5eTags(item)}`);
            } else if (item.name && item.entry) {
              lines.push(`* **${clean5eTags(item.name)}** : ${clean5eTags(item.entry)}`);
            } else if (item.entries) {
              lines.push(`* ${parseEntries(item.entries)}`);
            }
          });
        }
      } else if (entry.type === "table") {
        if (entry.caption) lines.push(`**${clean5eTags(entry.caption)}**`);
        if (Array.isArray(entry.colLabels) && Array.isArray(entry.rows)) {
          const header = `| ${entry.colLabels.map(c => clean5eTags(String(c))).join(" | ")} |`;
          const sep = `| ${entry.colLabels.map(() => "---").join(" | ")} |`;
          lines.push(header);
          lines.push(sep);
          entry.rows.forEach(row => {
            if (Array.isArray(row)) {
              lines.push(`| ${row.map(c => clean5eTags(String(c))).join(" | ")} |`);
            }
          });
        }
      } else if (entry.type === "inline" || entry.type === "inlineBlock") {
        lines.push(parseEntries(entry.entries));
      } else if (entry.entries) {
        const title = entry.name ? `**${clean5eTags(entry.name)}.** ` : "";
        lines.push(`${title}${parseEntries(entry.entries)}`.trim());
      } else if (entry.entry) {
        lines.push(clean5eTags(entry.entry));
      } else if (entry.text) {
        lines.push(clean5eTags(entry.text));
      }
    }
  }

  return lines.join("\n\n");
}

// -------------------------------------------------------------
// 2. Conversion des Monstres / Créatures (StatBlock)
// -------------------------------------------------------------
function formatMonsterType(m) {
  let sizeStr = "Moyenne";
  if (Array.isArray(m.size) && m.size[0]) {
    sizeStr = SIZE_MAP[m.size[0]] || m.size[0];
  } else if (typeof m.size === "string") {
    sizeStr = SIZE_MAP[m.size] || m.size;
  }

  let typeStr = "";
  if (typeof m.type === "string") {
    typeStr = m.type;
  } else if (typeof m.type === "object" && m.type !== null) {
    typeStr = m.type.type || "";
    if (Array.isArray(m.type.tags) && m.type.tags.length > 0) {
      typeStr += ` (${m.type.tags.join(", ")})`;
    }
  }

  let alignStr = "";
  if (Array.isArray(m.alignment)) {
    alignStr = m.alignment.map(a => ALIGNMENT_MAP[a] || a).join(" ");
  } else if (typeof m.alignment === "string") {
    alignStr = ALIGNMENT_MAP[m.alignment] || m.alignment;
  }

  const parts = [sizeStr, typeStr].filter(Boolean).join(" ");
  return alignStr ? `${parts}, ${alignStr}` : parts;
}

function formatMonsterAC(m) {
  if (!m.ac) return { Value: 10, Notes: "" };
  if (typeof m.ac === "number") return { Value: m.ac, Notes: "" };
  if (Array.isArray(m.ac) && m.ac.length > 0) {
    const first = m.ac[0];
    if (typeof first === "number") {
      const notes = m.ac.slice(1).map(x => (typeof x === "object" ? x.condition : String(x))).filter(Boolean).join(", ");
      return { Value: first, Notes: notes ? `(${notes})` : "" };
    }
    if (typeof first === "object" && first !== null) {
      const val = first.ac || 10;
      const froms = first.from ? first.from.join(", ") : "";
      const cond = first.condition ? first.condition : "";
      const notes = [froms, cond].filter(Boolean).join(" ");
      return { Value: val, Notes: notes ? `(${clean5eTags(notes)})` : "" };
    }
  }
  return { Value: 10, Notes: "" };
}

function formatMonsterHP(m) {
  if (!m.hp) return { Value: 1, Notes: "" };
  if (typeof m.hp === "number") return { Value: m.hp, Notes: "" };
  const avg = m.hp.average || 1;
  const formula = m.hp.formula ? `(${clean5eTags(m.hp.formula)})` : m.hp.special ? `(${clean5eTags(m.hp.special)})` : "";
  return { Value: avg, Notes: formula };
}

function formatMonsterSpeed(m) {
  if (!m.speed) return ["9 m (6 cases)"];
  const list = [];
  if (typeof m.speed === "number") return [convertDistance(m.speed)];
  if (typeof m.speed === "string") return [convertDistanceInText(clean5eTags(m.speed))];

  if (m.speed.walk != null) {
    const num = typeof m.speed.walk === "object" ? m.speed.walk.number : m.speed.walk;
    const cond = typeof m.speed.walk === "object" && m.speed.walk.condition ? ` ${m.speed.walk.condition}` : "";
    list.push(`${convertDistance(num || 30)}${cond}`);
  }
  const modeMap = {
    fly: "vol",
    swim: "nage",
    climb: "escalade",
    burrow: "fouissement"
  };
  for (const mode in modeMap) {
    if (m.speed[mode] != null) {
      const val = m.speed[mode];
      const num = typeof val === "object" ? val.number : val;
      const cond = typeof val === "object" && val.condition ? ` ${val.condition}` : "";
      list.push(`${modeMap[mode]} ${convertDistance(num || 30)}${cond}`);
    }
  }
  if (m.speed.canHover) {
    list.push("vol stationnaire");
  }
  return list.length > 0 ? list : ["9 m (6 cases)"];
}

function formatMonsterSaves(m) {
  if (!m.save) return [];
  const statMap = { str: "Str", dex: "Dex", con: "Con", int: "Int", wis: "Wis", cha: "Cha" };
  const saves = [];
  for (const k in m.save) {
    const shortName = statMap[k.toLowerCase()] || k;
    const val = parseInt(String(m.save[k]).replace("+", ""), 10) || 0;
    saves.push({ Name: shortName, Modifier: val });
  }
  return saves;
}

function formatMonsterSkills(m) {
  if (!m.skill) return [];
  const skills = [];
  for (const k in m.skill) {
    const keyLower = k.toLowerCase().trim();
    const skillName = SKILL_MAP[keyLower] || (k.charAt(0).toUpperCase() + k.slice(1));
    const val = parseInt(String(m.skill[k]).replace("+", ""), 10) || 0;
    skills.push({ Name: skillName, Modifier: val });
  }
  return skills;
}

function formatSenses(sensesArray, passive) {
  const result = [];
  if (Array.isArray(sensesArray)) {
    for (const sense of sensesArray) {
      if (typeof sense === "string") {
        let str = sense;
        for (const en in SENSE_MAP) {
          const regex = new RegExp(`\\b${en}\\b`, "gi");
          str = str.replace(regex, SENSE_MAP[en]);
        }
        result.push(convertDistanceInText(clean5eTags(str)));
      }
    }
  }
  if (passive) {
    result.push(`Perception passive ${passive}`);
  }
  return result;
}

function formatStringArray(arr, translationMap = null) {
  if (!arr) return [];
  if (typeof arr === "string") {
    const cleaned = clean5eTags(arr);
    return [translationMap && translationMap[cleaned.toLowerCase()] ? translationMap[cleaned.toLowerCase()] : cleaned];
  }
  if (!Array.isArray(arr)) return [];
  const res = [];
  for (const item of arr) {
    if (typeof item === "string") {
      const cleaned = clean5eTags(item);
      const translated = translationMap && translationMap[cleaned.toLowerCase()] ? translationMap[cleaned.toLowerCase()] : cleaned;
      res.push(translated);
    } else if (typeof item === "object" && item !== null) {
      if (item.immune) res.push(...formatStringArray(item.immune, translationMap));
      if (item.resist) res.push(...formatStringArray(item.resist, translationMap));
      if (item.vulnerable) res.push(...formatStringArray(item.vulnerable, translationMap));
      if (item.conditionImmune) res.push(...formatStringArray(item.conditionImmune, CONDITION_MAP));
      if (item.special) res.push(clean5eTags(item.special));
      if (item.note) res.push(clean5eTags(item.note));
    }
  }
  return res;
}

function formatActionList(items) {
  if (!Array.isArray(items)) return [];
  return items.map(item => {
    const name = clean5eTags(item.name || "");
    const content = parseEntries(item.entries);
    return {
      Name: name,
      Content: content,
      Usage: ""
    };
  });
}

function formatSpellcastingTraits(spellcastingList) {
  if (!Array.isArray(spellcastingList)) return [];
  const traits = [];

  for (const sc of spellcastingList) {
    const name = clean5eTags(sc.name || "Incantation");
    let content = "";

    if (Array.isArray(sc.headerEntries)) {
      content += parseEntries(sc.headerEntries) + "\n\n";
    }

    if (sc.will && Array.isArray(sc.will)) {
      const spells = sc.will.map(clean5eTags).join(", ");
      content += `* **À volonté** : ${spells}\n`;
    }

    if (sc.daily && typeof sc.daily === "object") {
      for (const times in sc.daily) {
        const spells = sc.daily[times].map(clean5eTags).join(", ");
        const timesStr = times.replace("e", "/jour");
        content += `* **${timesStr}** : ${spells}\n`;
      }
    }

    if (sc.spells && typeof sc.spells === "object") {
      for (let lvl = 0; lvl <= 9; lvl++) {
        const sInfo = sc.spells[lvl] || sc.spells[String(lvl)];
        if (sInfo && Array.isArray(sInfo.spells) && sInfo.spells.length > 0) {
          const spells = sInfo.spells.map(clean5eTags).join(", ");
          if (lvl === 0) {
            content += `* **Tours de magie (à volonté)** : ${spells}\n`;
          } else {
            const slots = sInfo.slots ? ` (${sInfo.slots} emplacements)` : "";
            content += `* **Niveau ${lvl}${slots}** : ${spells}\n`;
          }
        }
      }
    }

    if (Array.isArray(sc.footerEntries)) {
      content += "\n" + parseEntries(sc.footerEntries);
    }

    traits.push({
      Name: name,
      Content: content.trim(),
      Usage: ""
    });
  }

  return traits;
}

function convertMonster(m) {
  const name = clean5eTags(m.name || "Créature");
  const source = m.source || "5eTools";
  const type = formatMonsterType(m);
  const hp = formatMonsterHP(m);
  const ac = formatMonsterAC(m);
  const speed = formatMonsterSpeed(m);

  const abilities = {
    Str: m.str || 10,
    Dex: m.dex || 10,
    Con: m.con || 10,
    Int: m.int || 10,
    Wis: m.wis || 10,
    Cha: m.cha || 10
  };

  const dexMod = Math.floor((abilities.Dex - 10) / 2);
  const saves = formatMonsterSaves(m);
  const skills = formatMonsterSkills(m);
  const senses = formatSenses(m.senses, m.passive);

  const languages = formatStringArray(m.languages);
  let cr = "0";
  if (typeof m.cr === "string") cr = m.cr;
  else if (typeof m.cr === "number") cr = String(m.cr);
  else if (typeof m.cr === "object" && m.cr !== null && m.cr.cr) cr = String(m.cr.cr);

  const traits = formatActionList(m.trait || []);
  if (m.spellcasting) {
    traits.push(...formatSpellcastingTraits(m.spellcasting));
  }

  const actions = formatActionList(m.action || []);
  const bonusActions = formatActionList(m.bonus || []);
  const reactions = formatActionList(m.reaction || []);
  const legendaryActions = formatActionList(m.legendary || []);
  const mythicActions = formatActionList(m.mythic || []);

  const damageVulnerabilities = formatStringArray(m.vulnerable, DAMAGE_TYPE_MAP);
  const damageResistances = formatStringArray(m.resist, DAMAGE_TYPE_MAP);
  const damageImmunities = formatStringArray(m.immune, DAMAGE_TYPE_MAP);
  const conditionImmunities = formatStringArray(m.conditionImmune, CONDITION_MAP);
  const imageUrl = resolveMonsterImageUrl(m);

  return {
    Name: name,
    Source: source,
    Type: type,
    HP: hp,
    AC: ac,
    Speed: speed,
    Abilities: abilities,
    InitiativeModifier: dexMod,
    DamageVulnerabilities: damageVulnerabilities,
    DamageResistances: damageResistances,
    DamageImmunities: damageImmunities,
    ConditionImmunities: conditionImmunities,
    Saves: saves,
    Skills: skills,
    Senses: senses,
    Languages: languages,
    Challenge: cr,
    Traits: traits,
    Actions: actions,
    BonusActions: bonusActions,
    Reactions: reactions,
    LegendaryActions: legendaryActions,
    MythicActions: mythicActions,
    Description: "",
    Player: "",
    ImageURL: imageUrl
  };
}

function resolveMonsterImageUrl(m) {
  const source = m.source || "5eTools";
  const name = m.name;
  if (!name) return "";

  const tokensBaseDir = path.join(SOURCE_5ETOOLS_DIR, "img", "bestiary", "tokens");

  const candidates = [
    name,
    name.replace(/["']/g, "").replace(/\s+/g, " ").trim(),
    name.replace(/"([^"]+)"/g, "$1").replace(/\s+/g, " ").trim(),
    name.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
    name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/["']/g, "")
  ];

  for (const cand of candidates) {
    if (fs.existsSync(path.join(tokensBaseDir, source, `${cand}.webp`))) {
      return `/tokens/${source}/${encodeURIComponent(cand)}.webp`;
    }
    if (fs.existsSync(path.join(tokensBaseDir, source, `${cand}.png`))) {
      return `/tokens/${source}/${encodeURIComponent(cand)}.png`;
    }
  }

  return `/tokens/${source}/${encodeURIComponent(name)}.webp`;
}

// -------------------------------------------------------------
// 3. Conversion des Sorts (Spell)
// -------------------------------------------------------------
function formatSpellCastingTime(s) {
  if (!s.time || !Array.isArray(s.time) || s.time.length === 0) return "1 action";
  const t = s.time[0];
  const unitMap = {
    action: "action",
    bonus: "action bonus",
    reaction: "réaction",
    round: "round",
    minute: "minute",
    hour: "heure"
  };
  const unit = unitMap[t.unit] || t.unit;
  const num = t.number || 1;
  const numStr = num > 1 && unit.endsWith("e") ? `${num} ${unit}s` : `${num} ${unit}`;
  const cond = t.condition ? ` (${clean5eTags(t.condition)})` : "";
  return `${numStr}${cond}`;
}

function formatSpellRange(s) {
  if (!s.range) return "Portée inconnue";
  const r = s.range;
  if (r.type === "point") {
    if (r.distance) {
      if (r.distance.type === "feet") return convertDistance(r.distance.amount);
      if (r.distance.type === "touch") return "Contact";
      if (r.distance.type === "self") return "Personnelle";
      if (r.distance.type === "sight") return "À vue";
      if (r.distance.type === "unlimited") return "Illimitée";
      return `${r.distance.amount} ${r.distance.type}`;
    }
    return "Point";
  }
  if (r.type === "self") return "Personnelle";
  if (r.type === "touch") return "Contact";
  if (r.type === "sight") return "À vue";
  if (r.type === "unlimited") return "Illimitée";
  if (r.type === "special") return "Spéciale";
  if (r.type === "radius") return `Rayon de ${r.distance?.type === "feet" ? convertDistance(r.distance.amount) : `${r.distance?.amount || ""} ${r.distance?.type || ""}`}`.trim();
  if (r.type === "sphere") return `Sphère de ${r.distance?.type === "feet" ? convertDistance(r.distance.amount) : `${r.distance?.amount || ""} ${r.distance?.type || ""}`}`.trim();
  if (r.type === "cone") return `Cône de ${r.distance?.type === "feet" ? convertDistance(r.distance.amount) : `${r.distance?.amount || ""} ${r.distance?.type || ""}`}`.trim();
  if (r.type === "line") return `Ligne de ${r.distance?.type === "feet" ? convertDistance(r.distance.amount) : `${r.distance?.amount || ""} ${r.distance?.type || ""}`}`.trim();
  if (r.type === "cube") return `Cube de ${r.distance?.type === "feet" ? convertDistance(r.distance.amount) : `${r.distance?.amount || ""} ${r.distance?.type || ""}`}`.trim();
  if (r.type === "hemisphere") return `Hémisphère de ${r.distance?.type === "feet" ? convertDistance(r.distance.amount) : `${r.distance?.amount || ""} ${r.distance?.type || ""}`}`.trim();
  return clean5eTags(JSON.stringify(r));
}

function formatSpellComponents(s) {
  if (!s.components) return "V, S";
  const parts = [];
  if (s.components.v) parts.push("V");
  if (s.components.s) parts.push("S");
  if (s.components.m) {
    const mat = typeof s.components.m === "string" ? s.components.m : (s.components.m.text || "un composant matériel");
    parts.push(`M (${clean5eTags(mat)})`);
  }
  if (s.components.r) parts.push("R");
  return parts.join(", ");
}

function formatSpellDuration(s) {
  if (!s.duration || !Array.isArray(s.duration) || s.duration.length === 0) return "Instantanée";
  const d = s.duration[0];
  if (d.type === "instant") return "Instantanée";
  if (d.type === "permanent") return "Permanente";
  if (d.type === "special") return "Spéciale";
  if (d.type === "timed" && d.duration) {
    const unitMap = {
      round: "round",
      minute: "minute",
      hour: "heure",
      day: "jour"
    };
    const unit = unitMap[d.duration.type] || d.duration.type;
    const num = d.duration.amount || 1;
    const numStr = num > 1 ? `${num} ${unit}s` : `${num} ${unit}`;
    const conc = d.concentration ? "Concentration, jusqu'à " : "";
    return `${conc}${numStr}`;
  }
  return "Instantanée";
}

function convertSpell(s, spellSourcesMap) {
  const name = clean5eTags(s.name || "Sort");
  const source = s.source || "PHB";
  const level = typeof s.level === "number" ? s.level : parseInt(s.level, 10) || 0;
  const school = SCHOOL_MAP[s.school] || s.school || "Universel";
  const castingTime = formatSpellCastingTime(s);
  const range = formatSpellRange(s);
  const components = formatSpellComponents(s);
  const duration = formatSpellDuration(s);
  const ritual = !!(s.meta && s.meta.ritual);

  let description = parseEntries(s.entries);
  if (s.entriesHigherLevel && Array.isArray(s.entriesHigherLevel)) {
    description += "\n\n" + parseEntries(s.entriesHigherLevel);
  }

  let classes = [];
  if (spellSourcesMap && spellSourcesMap[source] && spellSourcesMap[source][s.name]) {
    const classList = spellSourcesMap[source][s.name].class || [];
    classes = Array.from(new Set(classList.map(c => c.name)));
  }
  if (classes.length === 0 && Array.isArray(s.classes?.fromClassList)) {
    classes = Array.from(new Set(s.classes.fromClassList.map(c => c.name)));
  }

  return {
    Name: name,
    Source: source,
    Level: level,
    School: school,
    CastingTime: castingTime,
    Range: range,
    Components: components,
    Duration: duration,
    Classes: classes,
    Description: description,
    Ritual: ritual
  };
}

// -------------------------------------------------------------
// 4. Pipeline Principal de Conversion
// -------------------------------------------------------------
async function runConversion() {
  console.log("=== Début de la conversion 5etools -> Improved Initiative (avec conversion en m / cases) ===");

  // 1. Map des classes de sorts
  let spellSourcesMap = {};
  const sourcesPath = path.join(SOURCE_5ETOOLS_DIR, "data", "spells", "sources.json");
  if (fs.existsSync(sourcesPath)) {
    try {
      spellSourcesMap = JSON.parse(fs.readFileSync(sourcesPath, "utf8"));
    } catch (e) {
      console.warn("Impossible de lire spells sources.json:", e.message);
    }
  }

  // 2. Traitement de tous les sorts
  const spellsDir = path.join(SOURCE_5ETOOLS_DIR, "data", "spells");
  const spellFiles = fs.readdirSync(spellsDir).filter(f => f.startsWith("spells-") && f.endsWith(".json"));

  const allSpells = [];
  const spellIdSet = new Set();

  for (const file of spellFiles) {
    const fullPath = path.join(spellsDir, file);
    try {
      const data = JSON.parse(fs.readFileSync(fullPath, "utf8"));
      if (Array.isArray(data.spell)) {
        for (const s of data.spell) {
          const converted = convertSpell(s, spellSourcesMap);
          const key = `${converted.Source}.${converted.Name}`.toLowerCase();
          if (!spellIdSet.has(key)) {
            spellIdSet.add(key);
            allSpells.push(converted);
          }
        }
      }
    } catch (e) {
      console.error(`Erreur lors du traitement des sorts ${file}:`, e.message);
    }
  }

  console.log(`✓ ${allSpells.length} sorts convertis.`);

  // 3. Traitement de tous les monstres du Bestiaire
  const bestiaryDir = path.join(SOURCE_5ETOOLS_DIR, "data", "bestiary");
  const bestiaryFiles = fs.readdirSync(bestiaryDir).filter(f => f.startsWith("bestiary-") && f.endsWith(".json"));

  const allMonsters = [];
  const monsterIdSet = new Set();

  for (const file of bestiaryFiles) {
    const fullPath = path.join(bestiaryDir, file);
    try {
      const data = JSON.parse(fs.readFileSync(fullPath, "utf8"));
      if (Array.isArray(data.monster)) {
        for (const m of data.monster) {
          if (m._copy && !m.str && !m.hp) continue;

          const converted = convertMonster(m);
          const key = `${converted.Source}.${converted.Name}`.toLowerCase();
          if (!monsterIdSet.has(key)) {
            monsterIdSet.add(key);
            allMonsters.push(converted);
          }
        }
      }
    } catch (e) {
      console.error(`Erreur lors du traitement des monstres ${file}:`, e.message);
    }
  }

  console.log(`✓ ${allMonsters.length} monstres convertis.`);

  // 4. Écriture des fichiers JSON cibles
  const frCreaturesPath = path.join(TARGET_II_DIR, "fr_creatures.json");
  const frSpellsPath = path.join(TARGET_II_DIR, "fr_spells.json");

  fs.writeFileSync(frCreaturesPath, JSON.stringify(allMonsters, null, 2), "utf8");
  fs.writeFileSync(frSpellsPath, JSON.stringify(allSpells, null, 2), "utf8");

  const oglCreaturesPath = path.join(TARGET_II_DIR, "ogl_creatures.json");
  const oglSpellsPath = path.join(TARGET_II_DIR, "ogl_spells.json");

  fs.writeFileSync(oglCreaturesPath, JSON.stringify(allMonsters, null, 2), "utf8");
  fs.writeFileSync(oglSpellsPath, JSON.stringify(allSpells, null, 2), "utf8");

  console.log(`✓ Fichier créé : ${frCreaturesPath} (${(fs.statSync(frCreaturesPath).size / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`✓ Fichier créé : ${frSpellsPath} (${(fs.statSync(frSpellsPath).size / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`✓ Fichiers ogl_creatures.json & ogl_spells.json mis à jour !`);
  console.log("=== Conversion terminée avec succès ! ===");
}

runConversion().catch(err => {
  console.error("FATAL ERROR in convert-5etools:", err);
  process.exit(1);
});
