import * as express from "express";
import * as fs from "fs";
import * as path from "path";
import * as _ from "lodash";

import { ListingMeta } from "../common/Listable";
import { Req, Res } from "./routes";
import { StatBlock } from "../common/StatBlock";
import { Spell } from "../common/Spell";

const sourceAbbreviations: Record<string, string> = {
  "monster-manual": "mm",
  "basic-rules": "mm",
  "players-handbook": "phb"
};

const formatStringForId = (str: string) =>
  str
    .toLocaleLowerCase()
    .replace(/[\s]/g, "-")
    .replace(/[^a-z0-9-]/g, "");

const createId = (name: string, source: string) => {
  const sourceString = formatStringForId(source);
  const sourcePrefix = sourceAbbreviations[sourceString] || sourceString;
  const lowerCaseName = formatStringForId(name);
  return `${sourcePrefix}.${lowerCaseName}`;
};

const SOURCE_FRIENDLY_NAMES: Record<string, string> = {
  mm: "Monster Manual (2014) [FR]",
  xmm: "Monster Manual (2024) [FR]",
  mpmm: "Monsters of the Multiverse [FR]",
  vgm: "Volo's Guide to Monsters [FR]",
  mtf: "Mordenkainen's Tome of Foes [FR]",
  ftd: "Fizban's Treasury of Dragons [FR]",
  bgg: "Glory of the Giants [FR]",
  phb: "Player's Handbook (2014) [FR]",
  xphb: "Player's Handbook (2024) [FR]",
  tce: "Tasha's Cauldron of Everything [FR]",
  xge: "Xanathar's Guide to Everything [FR]",
  "wotc-srd": "Règles 5e & Bestiaire Principal [FR]"
};

type ListingsWithSourceTitle = {
  sourceTitle: string;
  listings: ListingMeta[];
};

export async function configureOpen5eContent(
  app: express.Application
): Promise<void> {
  console.log("Loading local 5e French monsters and spells for library...");

  const creaturesPath = path.join(__dirname, "..", "ogl_creatures.json");
  const spellsPath = path.join(__dirname, "..", "ogl_spells.json");

  let rawCreatures: StatBlock[] = [];
  let rawSpells: Spell[] = [];

  try {
    rawCreatures = JSON.parse(fs.readFileSync(creaturesPath, "utf8"));
  } catch (e) {
    console.error("Could not read ogl_creatures.json:", e);
  }

  try {
    rawSpells = JSON.parse(fs.readFileSync(spellsPath, "utf8"));
  } catch (e) {
    console.error("Could not read ogl_spells.json:", e);
  }

  // 1. Process Monsters
  const monsterListingsBySource: Record<string, ListingsWithSourceTitle> = {};
  const defaultMonsterListings: ListingMeta[] = [];

  for (const c of rawCreatures) {
    if (!c.Name || !c.Source) continue;
    c.Id = createId(c.Name, c.Source);

    const sourceSlug = formatStringForId(c.Source);
    const sourceTitle =
      SOURCE_FRIENDLY_NAMES[sourceSlug] || `${c.Source} [FR]`;

    const listing: ListingMeta = {
      Id: c.Id,
      Name: c.Name,
      Path: c.Path || "",
      Link: `/statblocks/${c.Id}`,
      LastUpdateMs: 0,
      SearchHint: StatBlock.GetSearchHint(c),
      FilterDimensions: StatBlock.FilterDimensions(c)
    };

    if (!monsterListingsBySource[sourceSlug]) {
      monsterListingsBySource[sourceSlug] = {
        sourceTitle,
        listings: []
      };
    }
    monsterListingsBySource[sourceSlug].listings.push(listing);

    // Add MM/SRD/XMM to default preloaded source "wotc-srd"
    if (["mm", "srd", "basic-rules", "xmm"].includes(sourceSlug)) {
      defaultMonsterListings.push(listing);
    }
  }

  // If no specific match for default, include all creatures in wotc-srd
  monsterListingsBySource["wotc-srd"] = {
    sourceTitle: SOURCE_FRIENDLY_NAMES["wotc-srd"],
    listings: defaultMonsterListings.length > 0 ? defaultMonsterListings : rawCreatures.map(c => ({
      Id: createId(c.Name, c.Source),
      Name: c.Name,
      Path: c.Path || "",
      Link: `/statblocks/${createId(c.Name, c.Source)}`,
      LastUpdateMs: 0,
      SearchHint: StatBlock.GetSearchHint(c),
      FilterDimensions: StatBlock.FilterDimensions(c)
    }))
  };

  // 2. Process Spells
  const spellListingsBySource: Record<string, ListingsWithSourceTitle> = {};
  const defaultSpellListings: ListingMeta[] = [];

  for (const s of rawSpells) {
    if (!s.Name || !s.Source) continue;
    s.Id = createId(s.Name, s.Source);

    const sourceSlug = formatStringForId(s.Source);
    const sourceTitle =
      SOURCE_FRIENDLY_NAMES[sourceSlug] || `${s.Source} [FR]`;

    const listing: ListingMeta = {
      Id: s.Id,
      Name: s.Name,
      Path: s.Path || "",
      Link: `/spells/${s.Id}`,
      LastUpdateMs: 0,
      SearchHint: Spell.GetSearchHint(s),
      FilterDimensions: Spell.GetFilterDimensions(s)
    };

    if (!spellListingsBySource[sourceSlug]) {
      spellListingsBySource[sourceSlug] = {
        sourceTitle,
        listings: []
      };
    }
    spellListingsBySource[sourceSlug].listings.push(listing);

    // Add PHB/XPHB/SRD to default preloaded spell source "wotc-srd"
    if (["phb", "srd", "basic-rules", "xphb"].includes(sourceSlug)) {
      defaultSpellListings.push(listing);
    }
  }

  spellListingsBySource["wotc-srd"] = {
    sourceTitle: SOURCE_FRIENDLY_NAMES["wotc-srd"],
    listings: defaultSpellListings.length > 0 ? defaultSpellListings : rawSpells.map(s => ({
      Id: createId(s.Name, s.Source),
      Name: s.Name,
      Path: s.Path || "",
      Link: `/spells/${createId(s.Name, s.Source)}`,
      LastUpdateMs: 0,
      SearchHint: Spell.GetSearchHint(s),
      FilterDimensions: Spell.GetFilterDimensions(s)
    }))
  };

  console.log(
    `✓ Populated library endpoints: ${Object.keys(monsterListingsBySource).length} monster sources, ${Object.keys(spellListingsBySource).length} spell sources.`
  );

  // 3. Mount API Routes
  app.get("/open5e/", (req: Req, res: Res) => {
    const monsterSources = _.mapValues(
      monsterListingsBySource,
      v => v.sourceTitle
    );
    const spellSources = _.mapValues(spellListingsBySource, v => v.sourceTitle);
    res.json({
      monsterSources,
      spellSources
    });
  });

  for (const sourceSlug in monsterListingsBySource) {
    app.get(`/open5e/${sourceSlug}/`, (req: Req, res: Res) => {
      res.json(monsterListingsBySource[sourceSlug].listings);
    });
  }

  for (const sourceSlug in spellListingsBySource) {
    app.get(`/open5e-spells/${sourceSlug}/`, (req: Req, res: Res) => {
      res.json(spellListingsBySource[sourceSlug].listings);
    });
  }
}
