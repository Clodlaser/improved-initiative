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

  const calculatedMaxHP = (charData.baseHitPoints || 0) + (charData.bonusHitPoints || 0) + (conMod * totalLevel);
  const maxHP = Math.max(1, calculatedMaxHP);
  const currentHP = Math.max(0, maxHP - (charData.removedHitPoints || 0));

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

  const raceName = charData.race?.fullName || charData.race?.baseName || "Player Character";
  const classList = charData.classes?.map((c: any) => `${c.definition?.name || ""} ${c.level || ""}`).join(" / ") || "";
  const avatarUrl = charData.decorations?.avatarUrl || charData.avatarUrl || "";

  return {
    Name: name,
    HP: { Value: maxHP, Notes: "" },
    CurrentHP: currentHP,
    AC: { Value: ac, Notes: "" },
    Abilities: abilities,
    InitiativeModifier: dexMod,
    Type: raceName,
    Challenge: classList,
    ImageURL: avatarUrl,
    Description: `Imported from D&D Beyond: ${originalUrl}`
  };
}

