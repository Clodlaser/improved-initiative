import * as express from "express";
import { ParseJSONOrDefault } from "../common/Toolbox";
import { Res, Req } from "./routes";
import request = require("request");
import { PlayerViewManager } from "./playerviewmanager";
import axios from "axios";

const ddbCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes


export function configureImportRoutes(
  app: express.Application,
  playerViews: PlayerViewManager
) {
  const importEncounter = async (req, res: Res) => {
    const newViewId = await playerViews.InitializeNew();
    const session = req.session;

    if (typeof req.body.Combatants === "string") {
      session.postedEncounter = {
        Combatants: ParseJSONOrDefault(req.body.Combatants, [])
      };
    } else {
      session.postedEncounter = req.body;
    }

    res.redirect("/e/" + newViewId);
  };

  app.post("/launchencounter/", importEncounter);
  app.post("/importencounter/", importEncounter);

  app.get("/encounterfrom/", async (req: Req, res: Res) => {
    const session = req.session!;
    if (typeof req.query.url !== "string") {
      return res.status(400).send("Missing url parameter.");
    }
    request.get(req.query.url, async (error, _, body) => {
      if (error) {
        return res.status(400).send("Error fetching URL: " + error);
      }
      if (body.length > 1000000) {
        return res.status(400).send("Encounter JSON too large.");
      }
      try {
        const json = JSON.parse(body);
        if (typeof json.Combatants === "object" && json.Combatants.length > 0) {
          session.postedEncounter = {
            Combatants: json.Combatants
          };
          const newEncounterViewId = await playerViews.InitializeNew();
          res.redirect("/e/" + newEncounterViewId);
        } else {
          return res.status(400).send("Invalid JSON: Missing Combatants.");
        }
      } catch (e) {
        return res.status(400).send("Invalid JSON; could not parse: " + e);
      }
    });
  });

  app.get("/sampleencounter/", async (req: Req, res: Res) => {
    return res.send({
      Combatants: [
        { Name: "Nemo", HP: { Value: 10 } },
        { Name: "Fat Goblin", HP: { Value: 20 }, Id: "mm.goblin" },
        { Id: "mm.goblin" }
      ]
    });
  });

  app.get("/import/dndbeyond", async (req: Req, res: Res) => {
    const urlParam = req.query.url;
    if (typeof urlParam !== "string") {
      return res.status(400).send("Missing url parameter.");
    }

    const match = urlParam.match(/characters\/(\d+)/) || urlParam.match(/^(\d+)$/);
    if (!match) {
      return res.status(400).send("Invalid D&D Beyond URL or Character ID.");
    }

    const characterId = match[1];
    const nowTime = Date.now();
    const cached = ddbCache.get(characterId);
    if (cached && (nowTime - cached.timestamp < CACHE_DURATION_MS)) {
      return res.json(cached.data);
    }

    try {
      const apiResponse = await axios.get(`https://character-service.dndbeyond.com/character/v5/character/${characterId}`, {
        timeout: 10000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
        }
      });

      if (apiResponse.data && apiResponse.data.success === true && apiResponse.data.data) {
        const charData = apiResponse.data.data;
        const mappedCharacter = mapDndBeyondCharacter(charData, urlParam);
        
        ddbCache.set(characterId, { data: mappedCharacter, timestamp: nowTime });
        
        return res.json(mappedCharacter);
      } else {
        const message = apiResponse.data?.message || "Could not retrieve character data.";
        return res.status(400).send(`Failed to import character: ${message} (Make sure the character sheet is set to 'Public' in Share Options).`);
      }
    } catch (error: any) {
      if (error.response?.status === 403 || error.response?.status === 404) {
        return res.status(error.response.status).send("Failed to retrieve character. The character sheet might be set to 'Private' or the character ID does not exist. Please set it to 'Public' in D&D Beyond Sharing Options.");
      }
      return res.status(500).send(`Error fetching character from D&D Beyond: ${error.message || error}`);
    }
  });
}

function cleanHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/\[rollable\](.*?);\{[^}]*\}\[\/rollable\]/gi, "$1") // clean D&D Beyond rollable tags
    .replace(/<p>/gi, "")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<strong>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<b>(.*?)<\/b>/gi, "**$1**")
    .replace(/<em>(.*?)<\/em>/gi, "*$1*")
    .replace(/<i>(.*?)<\/i>/gi, "*$1*")
    .replace(/<\/?[a-z][a-z0-9]*[^<>]*>/gi, "") // strip all other HTML tags
    .replace(/&nbsp;/g, " ")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .trim();
}

function mapDndBeyondCharacter(charData: any, originalUrl: string) {
  const name = charData.name || "D&D Beyond Character";

  const getModifierBonus = (statName: string): number => {
    let sum = 0;
    if (charData.modifiers) {
      const categories = ["race", "class", "background", "item", "feat", "condition"];
      for (const cat of categories) {
        const list = charData.modifiers[cat];
        if (Array.isArray(list)) {
          for (const mod of list) {
            if (mod.type === "bonus" && mod.subType === `${statName.toLowerCase()}-score`) {
              sum += mod.value || 0;
            }
          }
        }
      }
    }
    return sum;
  };

  const getAbilityScore = (index: number, id: number, statName: string) => {
    const baseObj = charData.stats?.find?.((s: any) => s.id === id) || charData.stats?.[index];
    const baseVal = typeof baseObj === "object" ? (baseObj?.value ?? 0) : (baseObj ?? 0);

    const bonusObj = charData.bonusStats?.find?.((s: any) => s.id === id) || charData.bonusStats?.[index];
    const bonusVal = typeof bonusObj === "object" ? (bonusObj?.value ?? 0) : (bonusObj ?? 0);

    const overrideObj = charData.overrideStats?.find?.((s: any) => s.id === id) || charData.overrideStats?.[index];
    const overrideVal = typeof overrideObj === "object" ? (overrideObj?.value ?? 0) : (overrideObj ?? 0);

    if (overrideVal && overrideVal > 0) {
      return overrideVal;
    }
    
    const modifierVal = getModifierBonus(statName);

    return baseVal + bonusVal + modifierVal;
  };

  const abilities = {
    Str: getAbilityScore(0, 1, "Strength"),
    Dex: getAbilityScore(1, 2, "Dexterity"),
    Con: getAbilityScore(2, 3, "Constitution"),
    Int: getAbilityScore(3, 4, "Intelligence"),
    Wis: getAbilityScore(4, 5, "Wisdom"),
    Cha: getAbilityScore(5, 6, "Charisma")
  };

  const conMod = Math.floor((abilities.Con - 10) / 2);
  const dexMod = Math.floor((abilities.Dex - 10) / 2);
  const totalLevel = charData.classes?.reduce((sum: number, c: any) => sum + (c.level || 0), 0) || 1;
  const profBonus = Math.floor((totalLevel - 1) / 4) + 2;

  const calculatedMaxHP = (charData.baseHitPoints || 0) + (charData.bonusHitPoints || 0) + (conMod * totalLevel);
  const maxHP = Math.max(1, calculatedMaxHP);
  const currentHP = Math.max(0, maxHP - (charData.removedHitPoints || 0));

  // Armor Class calculation
  let baseAC = 10 + dexMod;
  let shieldBonus = 0;
  if (charData.inventory && Array.isArray(charData.inventory)) {
    for (const item of charData.inventory) {
      if (item.equipped && item.definition) {
        const def = item.definition;
        const isShield = def.armorTypeId === 4 || (def.name && def.name.toLowerCase().includes("shield"));
        if (isShield) {
          shieldBonus += def.armorClass || 2;
        } else if (def.armorClass && def.armorTypeId) {
          if (def.armorTypeId === 1) { // Light
            baseAC = def.armorClass + dexMod;
          } else if (def.armorTypeId === 2) { // Medium
            baseAC = def.armorClass + Math.min(2, dexMod);
          } else if (def.armorTypeId === 3) { // Heavy
            baseAC = def.armorClass;
          }
        }
      }
    }
  }
  const ac = baseAC + shieldBonus;

  // Speed
  const baseSpeed = charData.race?.baseWalkingSpeed || 30;
  let speedBonus = 0;
  if (charData.modifiers) {
    const categories = ["race", "class", "background", "item", "feat", "condition"];
    for (const cat of categories) {
      const list = charData.modifiers[cat];
      if (Array.isArray(list)) {
        for (const mod of list) {
          if (mod.type === "bonus" && mod.subType === "speed") {
            speedBonus += mod.value || 0;
          }
        }
      }
    }
  }
  const speed = [`${baseSpeed + speedBonus} ft.`];

  // Saves
  const saves: { Name: string; Modifier: number }[] = [];
  const statNames = ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"];
  const statShortNames = ["Str", "Dex", "Con", "Int", "Wis", "Cha"];
  const statAbilities = [abilities.Str, abilities.Dex, abilities.Con, abilities.Int, abilities.Wis, abilities.Cha];

  for (let i = 0; i < 6; i++) {
    const statName = statNames[i];
    const shortName = statShortNames[i];
    const abScore = statAbilities[i];
    const abMod = Math.floor((abScore - 10) / 2);
    
    let isProficient = false;
    let bonus = 0;
    
    if (charData.modifiers) {
      const categories = ["race", "class", "background", "item", "feat", "condition"];
      for (const cat of categories) {
        const list = charData.modifiers[cat];
        if (Array.isArray(list)) {
          for (const mod of list) {
            if (mod.type === "proficiency" && mod.subType === `${statName.toLowerCase()}-saving-throws`) {
              isProficient = true;
            }
            if (mod.type === "bonus") {
              if (mod.subType === "saving-throws") {
                bonus += mod.value || 0;
              } else if (mod.subType === `${statName.toLowerCase()}-saving-throws`) {
                bonus += mod.value || 0;
              }
            }
          }
        }
      }
    }
    
    if (isProficient || bonus !== 0) {
      saves.push({
        Name: shortName,
        Modifier: abMod + (isProficient ? profBonus : 0) + bonus
      });
    }
  }

  // Skills
  const skillList = [
    { name: "Acrobatics", key: "acrobatics", ability: "Dex" },
    { name: "Animal Handling", key: "animal-handling", ability: "Wis" },
    { name: "Arcana", key: "arcana", ability: "Int" },
    { name: "Athletics", key: "athletics", ability: "Str" },
    { name: "Deception", key: "deception", ability: "Cha" },
    { name: "History", key: "history", ability: "Int" },
    { name: "Insight", key: "insight", ability: "Wis" },
    { name: "Intimidation", key: "intimidation", ability: "Cha" },
    { name: "Investigation", key: "investigation", ability: "Int" },
    { name: "Medicine", key: "medicine", ability: "Wis" },
    { name: "Nature", key: "nature", ability: "Int" },
    { name: "Perception", key: "perception", ability: "Wis" },
    { name: "Performance", key: "performance", ability: "Cha" },
    { name: "Persuasion", key: "persuasion", ability: "Cha" },
    { name: "Religion", key: "religion", ability: "Int" },
    { name: "Sleight of Hand", key: "sleight-of-hand", ability: "Dex" },
    { name: "Stealth", key: "stealth", ability: "Dex" },
    { name: "Survival", key: "survival", ability: "Wis" }
  ] as const;

  const skills: { Name: string; Modifier: number }[] = [];

  for (const skill of skillList) {
    const abMod = Math.floor((abilities[skill.ability] - 10) / 2);
    let profMultiplier = 0;
    let bonus = 0;
    let hasJackOfAllTrades = false;
    
    if (charData.modifiers) {
      const categories = ["race", "class", "background", "item", "feat", "condition"];
      for (const cat of categories) {
        const list = charData.modifiers[cat];
        if (Array.isArray(list)) {
          for (const mod of list) {
            if (mod.type === "half-proficiency" && mod.subType === "ability-checks") {
              hasJackOfAllTrades = true;
            }
            if (mod.subType === skill.key) {
              if (mod.type === "proficiency") {
                profMultiplier = Math.max(profMultiplier, 1);
              } else if (mod.type === "expertise" || mod.type === "twice-proficiency") {
                profMultiplier = Math.max(profMultiplier, 2);
              } else if (mod.type === "half-proficiency") {
                profMultiplier = Math.max(profMultiplier, 0.5);
              }
              if (mod.type === "bonus") {
                bonus += mod.value || 0;
              }
            }
          }
        }
      }
    }
    
    if (profMultiplier === 0 && hasJackOfAllTrades) {
      profMultiplier = 0.5;
    }
    
    if (profMultiplier > 0 || bonus !== 0) {
      const profBonusToAdd = Math.floor(profBonus * profMultiplier);
      skills.push({
        Name: skill.name,
        Modifier: abMod + profBonusToAdd + bonus
      });
    }
  }

  // Senses
  const perceptionMod = skills.find(s => s.Name === "Perception")?.Modifier ?? Math.floor((abilities.Wis - 10) / 2);
  const passivePerception = 10 + perceptionMod;
  const senses = [`passive Perception ${passivePerception}`];
  
  if (charData.modifiers) {
    const categories = ["race", "class", "background", "item", "feat", "condition"];
    for (const cat of categories) {
      const list = charData.modifiers[cat];
      if (Array.isArray(list)) {
        for (const mod of list) {
          if (mod.type === "sense") {
            const senseName = mod.friendlySubtypeName || mod.subType;
            if (senseName) {
              const senseValue = mod.value ? ` ${mod.value} ft.` : "";
              const senseStr = `${senseName}${senseValue}`.toLowerCase();
              if (!senses.includes(senseStr)) {
                senses.push(senseStr);
              }
            }
          }
        }
      }
    }
  }

  // Languages
  const languages: string[] = [];
  if (charData.modifiers) {
    const categories = ["race", "class", "background", "item", "feat", "condition"];
    for (const cat of categories) {
      const list = charData.modifiers[cat];
      if (Array.isArray(list)) {
        for (const mod of list) {
          if (mod.type === "language") {
            const langName = mod.friendlySubtypeName || mod.friendlyName || mod.subType;
            if (langName) {
              const formattedLang = langName.charAt(0).toUpperCase() + langName.slice(1);
              if (!languages.includes(formattedLang)) {
                languages.push(formattedLang);
              }
            }
          }
        }
      }
    }
  }

  // Resistances and Immunities
  const damageVulnerabilities: string[] = [];
  const damageResistances: string[] = [];
  const damageImmunities: string[] = [];
  const conditionImmunities: string[] = [];
  
  if (charData.modifiers) {
    const categories = ["race", "class", "background", "item", "feat", "condition"];
    for (const cat of categories) {
      const list = charData.modifiers[cat];
      if (Array.isArray(list)) {
        for (const mod of list) {
          const type = mod.type;
          const name = mod.friendlySubtypeName || mod.friendlyName || mod.subType;
          if (!name) continue;
          const formattedName = name.toLowerCase();
          
          if (type === "damage-vulnerability" && !damageVulnerabilities.includes(formattedName)) {
            damageVulnerabilities.push(formattedName);
          } else if (type === "damage-resistance" && !damageResistances.includes(formattedName)) {
            damageResistances.push(formattedName);
          } else if (type === "damage-immunity" && !damageImmunities.includes(formattedName)) {
            damageImmunities.push(formattedName);
          } else if (type === "condition-immunity" && !conditionImmunities.includes(formattedName)) {
            conditionImmunities.push(formattedName);
          }
        }
      }
    }
  }

  // Traits (Passive racial traits & class features)
  // We keep only the Spellcasting trait to avoid massive clutter.
  const traits: { Name: string; Content: string }[] = [];

  // Spellcasting trait generation
  const spellLevels: Record<number, string[]> = {
    0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: []
  };

  const collectSpells = (list: any[]) => {
    if (!Array.isArray(list)) return;
    for (const s of list) {
      const def = s.definition;
      if (!def) continue;
      
      const level = def.level ?? 0;
      const isPrepared =
        s.prepared ||
        s.alwaysPrepared ||
        s.countsAsKnownSpell ||
        s.usesSpellSlot ||
        level === 0 ||
        !s.hasOwnProperty("prepared");
      
      if (isPrepared && level >= 0 && level <= 9) {
        const spellName = def.name;
        if (spellName && !spellLevels[level].includes(spellName)) {
          spellLevels[level].push(spellName);
        }
      }
    }
  };

  if (charData.spells) {
    collectSpells(charData.spells.class);
    collectSpells(charData.spells.race);
    collectSpells(charData.spells.feat);
    collectSpells(charData.spells.item);
    collectSpells(charData.spells.background);
  }
  if (charData.classSpells && Array.isArray(charData.classSpells)) {
    for (const classSpellInfo of charData.classSpells) {
      if (Array.isArray(classSpellInfo.spells)) {
        collectSpells(classSpellInfo.spells);
      }
    }
  }

  let primaryCastingAbility = "Wis";
  let castingAbilityName = "Wisdom";
  let fullCasterLevels = 0;
  let halfCasterLevels = 0;
  let warlockLevels = 0;
  let thirdCasterLevels = 0;

  if (charData.classes && Array.isArray(charData.classes)) {
    for (const c of charData.classes) {
      const className = c.definition?.name?.toLowerCase() || "";
      const lvl = c.level || 0;
      
      if (["cleric", "wizard", "druid", "sorcerer", "bard"].includes(className)) {
        fullCasterLevels += lvl;
      } else if (["paladin", "ranger", "artificer"].includes(className)) {
        halfCasterLevels += lvl;
      } else if (className === "warlock") {
        warlockLevels += lvl;
      } else if (className === "fighter" || className === "rogue") {
        const subclass = c.subclassDefinition?.name?.toLowerCase() || "";
        if (subclass === "eldritch knight" || subclass === "arcane trickster") {
          thirdCasterLevels += lvl;
        }
      }
      
      // Determine casting ability (first class with casting ability)
      if (["wizard", "artificer"].includes(className)) {
        primaryCastingAbility = "Int";
        castingAbilityName = "Intelligence";
      } else if (["cleric", "druid", "ranger"].includes(className)) {
        primaryCastingAbility = "Wis";
        castingAbilityName = "Wisdom";
      } else if (["bard", "sorcerer", "warlock", "paladin"].includes(className)) {
        primaryCastingAbility = "Cha";
        castingAbilityName = "Charisma";
      }
    }
  }

  const totalCasterLevel = Math.max(0, fullCasterLevels + Math.ceil(halfCasterLevels / 2) + Math.floor(thirdCasterLevels / 3));

  // Calculate spell slots
  const getSpellSlots = (casterLevel: number): Record<number, number> => {
    const table: Record<number, number[]> = {
      1: [2],
      2: [3],
      3: [4, 2],
      4: [4, 3],
      5: [4, 3, 2],
      6: [4, 3, 3],
      7: [4, 3, 3, 1],
      8: [4, 3, 3, 2],
      9: [4, 3, 3, 3, 1],
      10: [4, 3, 3, 3, 2],
      11: [4, 3, 3, 3, 2, 1],
      12: [4, 3, 3, 3, 2, 1],
      13: [4, 3, 3, 3, 2, 1, 1],
      14: [4, 3, 3, 3, 2, 1, 1],
      15: [4, 3, 3, 3, 2, 1, 1, 1],
      16: [4, 3, 3, 3, 2, 1, 1, 1],
      17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
      18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
      19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
      20: [4, 3, 3, 3, 3, 2, 2, 1, 1]
    };
    const slots = table[Math.min(20, Math.max(1, casterLevel))] || [];
    const result: Record<number, number> = {};
    for (let i = 0; i < slots.length; i++) {
      result[i + 1] = slots[i];
    }
    return result;
  };

  const getWarlockSlots = (wLevel: number): { slots: number; level: number } => {
    if (wLevel <= 0) return { slots: 0, level: 0 };
    const slots = wLevel >= 11 ? 3 : 2;
    let lvl = 1;
    if (wLevel >= 3) lvl = 2;
    if (wLevel >= 5) lvl = 3;
    if (wLevel >= 7) lvl = 4;
    if (wLevel >= 9) lvl = 5;
    return { slots, level: lvl };
  };

  const slotsByLevel: Record<number, number> = {};
  if (totalCasterLevel > 0) {
    Object.assign(slotsByLevel, getSpellSlots(totalCasterLevel));
  }
  if (warlockLevels > 0) {
    const wSlots = getWarlockSlots(warlockLevels);
    if (wSlots.level > 0 && wSlots.slots > 0) {
      slotsByLevel[wSlots.level] = (slotsByLevel[wSlots.level] || 0) + wSlots.slots;
    }
  }

  const castingMod = Math.floor((abilities[primaryCastingAbility as keyof typeof abilities] - 10) / 2);
  const spellDC = 8 + castingMod + profBonus;
  const spellAttack = castingMod + profBonus;
  const spellAttackSign = spellAttack >= 0 ? `+${spellAttack}` : `${spellAttack}`;

  let hasAnySpells = false;
  let spellcastingContent = `The character's spellcasting ability is ${castingAbilityName} (spell save DC ${spellDC}, ${spellAttackSign} to hit with spell attacks). It has the following spells prepared:\n\n`;

  const suffixes = ["th", "st", "nd", "rd", "th", "th", "th", "th", "th", "th"];
  const getLevelName = (lvl: number): string => {
    if (lvl === 0) return "Cantrips (at will)";
    const suffix = suffixes[lvl] || "th";
    const slotsCount = slotsByLevel[lvl] || 0;
    const slotsStr = slotsCount > 0 ? ` (${slotsCount} slots)` : "";
    return `${lvl}${suffix} level${slotsStr}`;
  };

  for (let lvl = 0; lvl <= 9; lvl++) {
    const list = spellLevels[lvl];
    if (list && list.length > 0) {
      hasAnySpells = true;
      spellcastingContent += `* **${getLevelName(lvl)}**: ${list.join(", ")}\n`;
    }
  }

  if (hasAnySpells) {
    traits.push({
      Name: "Spellcasting",
      Content: spellcastingContent
    });
  }

  // Actions, Bonus Actions, Reactions
  const actions: { Name: string; Content: string; Usage?: string }[] = [];
  const bonusActions: { Name: string; Content: string; Usage?: string }[] = [];
  const reactions: { Name: string; Content: string; Usage?: string }[] = [];

  const addActionToList = (act: any) => {
    if (!act.name) return;
    const nameStr = act.name;
    const descStr = cleanHtml(act.description || "");
    const item = {
      Name: nameStr,
      Content: descStr,
      Usage: ""
    };
    
    const actType = act.activation?.activationType;
    if (actType === 1) {
      if (!actions.some(a => a.Name === nameStr)) actions.push(item);
    } else if (actType === 2) {
      if (!bonusActions.some(ba => ba.Name === nameStr)) bonusActions.push(item);
    } else if (actType === 3) {
      if (!reactions.some(r => r.Name === nameStr)) reactions.push(item);
    }
  };

  if (charData.actions) {
    const actionCategories = ["class", "race", "feat", "item"];
    for (const cat of actionCategories) {
      const list = charData.actions[cat];
      if (Array.isArray(list)) {
        list.forEach(addActionToList);
      }
    }
  }

  // Calculate Weapon attacks from equipped inventory
  const isProficientWithWeapon = (def: any): boolean => {
    if (!charData.modifiers) return false;
    const categories = ["race", "class", "background", "item", "feat"];
    const weaponName = def.name?.toLowerCase() || "";
    const classification = def.weaponClassificationId === 1 ? "simple-weapons" : "martial-weapons";
    
    for (const cat of categories) {
      const list = charData.modifiers[cat];
      if (Array.isArray(list)) {
        for (const mod of list) {
          if (mod.type === "proficiency") {
            const sub = mod.subType?.toLowerCase() || "";
            if (sub === weaponName || sub === classification) {
              return true;
            }
          }
        }
      }
    }
    return false;
  };

  const getWeaponMagicBonus = (item: any): { attack: number; damage: number } => {
    let attack = 0;
    let damage = 0;
    
    const modifiers = item.definition?.grantedModifiers;
    if (Array.isArray(modifiers)) {
      for (const mod of modifiers) {
        if (mod.type === "bonus") {
          const subType = mod.subType;
          if (subType === "magic" || subType === "attacks" || subType === "to-hit-and-damage-rolls") {
            attack += mod.value || 0;
            damage += mod.value || 0;
          } else if (subType === "to-hit" || subType === "attack-rolls") {
            attack += mod.value || 0;
          } else if (subType === "damage" || subType === "damage-rolls") {
            damage += mod.value || 0;
          }
        }
      }
    }
    
    return { attack, damage };
  };

  let archeryBonus = 0;
  let duelingBonus = 0;

  if (charData.modifiers) {
    const categories = ["class", "feat"];
    for (const cat of categories) {
      const list = charData.modifiers[cat];
      if (Array.isArray(list)) {
        for (const mod of list) {
          if (mod.type === "bonus") {
            if (mod.subType === "ranged-attacks") {
              archeryBonus += mod.value || 0;
            }
            if (mod.subType === "melee-damage") {
              duelingBonus += mod.value || 0;
            }
          }
        }
      }
    }
  }

  if (charData.inventory && Array.isArray(charData.inventory)) {
    for (const item of charData.inventory) {
      if (item.equipped && item.definition) {
        const def = item.definition;
        const isWeapon = def.filterType === "Weapon" || def.attackType || def.weaponClassificationId;
        
        if (isWeapon) {
          const weaponName = def.name;
          const magic = getWeaponMagicBonus(item);
          const isProficient = isProficientWithWeapon(def);
          
          const isFinesse = def.properties?.some((p: any) => p.name === "Finesse") || false;
          const isRanged = def.attackType === 2 || def.properties?.some((p: any) => p.name === "Ranged") || def.range || def.longRange;
          
          const strMod = Math.floor((abilities.Str - 10) / 2);
          const dexMod = Math.floor((abilities.Dex - 10) / 2);
          
          let abMod = strMod;
          if (isRanged || (isFinesse && dexMod > strMod)) {
            abMod = dexMod;
          }
          
          const toHit = abMod + (isProficient ? profBonus : 0) + magic.attack + (isRanged ? archeryBonus : 0);
          const toHitSign = toHit >= 0 ? `+${toHit}` : `${toHit}`;
          
          const diceCount = def.damage?.diceCount || 1;
          const diceValue = def.damage?.diceValue || 4;
          const damageType = (def.damageType || def.damage?.damageType || "slashing").toLowerCase();
          
          const damageBonus = abMod + magic.damage + (isRanged ? 0 : duelingBonus);
          const damageBonusStr = damageBonus > 0 ? ` + ${damageBonus}` : damageBonus < 0 ? ` - ${Math.abs(damageBonus)}` : "";
          const avgDamage = Math.floor(diceCount * (diceValue + 1) / 2) + damageBonus;
          
          const rangeStr = def.range ? `range ${def.range}/${def.longRange || def.range * 4} ft.` : "reach 5 ft.";
          const weaponType = isRanged ? "Ranged Weapon Attack" : "Melee Weapon Attack";
          
          const content = `${weaponType}: ${toHitSign} to hit, ${rangeStr}, one target. Hit: ${avgDamage} (${diceCount}d${diceValue}${damageBonusStr}) ${damageType} damage.`;
          
          if (!actions.some(a => a.Name === weaponName)) {
            actions.push({
              Name: weaponName,
              Content: content,
              Usage: ""
            });
          }
        }
      }
    }
  }

  // Default Unarmed Strike
  const strMod = Math.floor((abilities.Str - 10) / 2);
  const unarmedToHit = strMod + profBonus;
  const unarmedToHitSign = unarmedToHit >= 0 ? `+${unarmedToHit}` : `${unarmedToHit}`;
  const unarmedDamage = 1 + strMod;
  
  if (!actions.some(a => a.Name.toLowerCase() === "unarmed strike")) {
    actions.push({
      Name: "Unarmed Strike",
      Content: `Melee Weapon Attack: ${unarmedToHitSign} to hit, reach 5 ft., one target. Hit: ${unarmedDamage > 0 ? unarmedDamage : 1} bludgeoning damage.`,
      Usage: ""
    });
  }

  const raceName = charData.race?.fullName || charData.race?.baseName || "Player Character";
  const classList = charData.classes?.map((c: any) => `${c.definition?.name || ""} ${c.level || ""}`).join(" / ") || "";
  const avatarUrl = charData.decorations?.avatarUrl || charData.avatarUrl || "";

  return {
    Id: String(charData.id),
    Name: name,
    HP: { Value: maxHP, Notes: "" },
    CurrentHP: currentHP,
    AC: { Value: ac, Notes: "" },
    Abilities: abilities,
    InitiativeModifier: dexMod,
    Type: raceName,
    Challenge: classList,
    ImageURL: avatarUrl,
    Description: `Imported from D&D Beyond: ${originalUrl}`,
    Player: "player",
    Speed: speed,
    Saves: saves,
    Skills: skills,
    Senses: senses,
    Languages: languages,
    DamageVulnerabilities: damageVulnerabilities,
    DamageResistances: damageResistances,
    DamageImmunities: damageImmunities,
    ConditionImmunities: conditionImmunities,
    Traits: traits,
    Actions: actions,
    Reactions: reactions,
    LegendaryActions: [],
    BonusActions: bonusActions
  };
}


