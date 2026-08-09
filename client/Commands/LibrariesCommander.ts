import * as ko from "knockout";
import * as _ from "lodash";

import { CombatantState } from "../../common/CombatantState";
import { EncounterState } from "../../common/EncounterState";
import { PersistentCharacter } from "../../common/PersistentCharacter";
import { Spell } from "../../common/Spell";
import { StatBlock } from "../../common/StatBlock";
import {
  concatenatedStringRegex,
  probablyUniqueString
} from "../../common/Toolbox";
import { VariantMaximumHP } from "../Combatant/GetOrRollMaximumHP";
import { Libraries, LibraryType } from "../Library/Libraries";
import { Listing } from "../Library/Listing";
import { TrackerViewModel } from "../TrackerViewModel";
import { Metrics } from "../Utility/Metrics";
import { EncounterCommander } from "./EncounterCommander";
import { MoveEncounterPrompt } from "../Prompts/MoveEncounterPrompt";
import { SaveEncounterPrompt } from "../Prompts/SaveEncounterPrompt";
import { SpellPrompt } from "../Prompts/SpellPrompt";
import { ConditionReferencePrompt } from "../Prompts/ConditionReferencePrompt";
import { SavedEncounter } from "../../common/SavedEncounter";
import { now } from "moment";
import { Library } from "../Library/useLibrary";
import { CurrentSettings } from "../Settings/Settings";
import axios from "axios";
import {
  DndBeyondUrlPrompt,
  DndBeyondReviewPrompt,
  DndBeyondErrorPrompt
} from "../Prompts/DndBeyondPrompts";


export class LibrariesCommander {
  private libraries: Libraries;
  private spellsUpdated = ko.observable(0);

  constructor(
    private tracker: TrackerViewModel,
    private encounterCommander: EncounterCommander
  ) {}

  public SetLibraries = (libraries: Libraries): void => {
    // I don't like this pattern, but it's my first stab at a partial
    // conversion to allow an observable-backed class to also depend
    // on a React hook. This will probably catch fire at some point.
    // It's also probably impossible to test.
    this.libraries = libraries;
    this.spellsUpdated(this.spellsUpdated() + 1);
  };

  public ShowLibraries = (): void => this.tracker.LibrariesVisible(true);
  public HideLibraries = (): void => this.tracker.LibrariesVisible(false);
  public OpenLibraryManagerPane = (startPane: LibraryType): any =>
    this.tracker.LibraryManagerPane(startPane);

  public AddStatBlockFromListing = (
    listing: Listing<StatBlock>,
    hideOnAdd: boolean,
    variantMaximumHP: VariantMaximumHP
  ): boolean => {
    listing.GetAsyncWithUpdatedId(unsafeStatBlock => {
      const statBlock = { ...StatBlock.Default(), ...unsafeStatBlock };
      this.tracker.Encounter.AddCombatantFromStatBlock(
        statBlock,
        hideOnAdd,
        variantMaximumHP
      );
      Metrics.TrackEvent("CombatantAdded", { Name: statBlock.Name });
      this.tracker.EventLog.AddEvent(`${statBlock.Name} added to combat.`);
      const settings = CurrentSettings();
      settings.RecentItemIds = [
        statBlock.Id,
        ...settings.RecentItemIds.filter(id => id !== statBlock.Id)
      ].slice(0, 100);
      this.tracker.SaveUpdatedSettings(settings);
    });
    return true;
  };

  public CanAddPersistentCharacter = (
    listing: Listing<PersistentCharacter>
  ): boolean => {
    return this.tracker.Encounter.CanAddCombatant(listing.Meta().Id);
  };

  public AddPersistentCharacterFromListing = async (
    listing: Listing<PersistentCharacter>,
    hideOnAdd: boolean
  ): Promise<void> => {
    const character = await listing.GetWithTemplate(
      PersistentCharacter.Default()
    );
    this.tracker.Encounter.AddCombatantFromPersistentCharacter(
      character,
      this.UpdatePersistentCharacter,
      hideOnAdd
    );
    Metrics.TrackEvent("PersistentCharacterAdded", { Name: character.Name });
    this.tracker.EventLog.AddEvent(
      `Character ${character.Name} added to combat.`
    );
  };

  public UpdatePersistentCharacter = async (
    persistentCharacterId: string,
    updates: Partial<PersistentCharacter>
  ): Promise<Listing<PersistentCharacter>> => {
    if (updates.StatBlock) {
      updates.Name = updates.StatBlock.Name;
      updates.Path = updates.StatBlock.Path;
      updates.Version = updates.StatBlock.Version;
    }

    const currentCharacterListing =
      await this.libraries.PersistentCharacters.GetOrCreateListingById(
        persistentCharacterId
      );

    const currentCharacter = await currentCharacterListing.GetWithTemplate(
      PersistentCharacter.Default()
    );

    const updatedCharacter = {
      ...currentCharacter,
      ...updates,
      LastUpdateMs: now()
    };

    return await this.libraries.PersistentCharacters.SaveEditedListing(
      currentCharacterListing,
      updatedCharacter
    );
  };

  public CreateAndEditStatBlock = (library: Library<StatBlock>): void => {
    const statBlock = StatBlock.Default();
    const newId = probablyUniqueString();

    statBlock.Name = "New Creature";
    statBlock.Id = newId;

    this.tracker.EditStatBlock({
      editorTarget: "library",
      statBlock,
      onSave: library.SaveNewListing,
      currentListings: library.GetAllListings()
    });
  };

  public EditStatBlock = (
    listing: Listing<StatBlock>,
    library: Library<StatBlock>
  ): void => {
    if (this.tracker.TutorialVisible()) {
      return;
    }

    listing.GetAsyncWithUpdatedId(statBlock => {
      if (listing.Origin === "server") {
        const statBlockWithNewId = {
          ...StatBlock.Default(),
          ...statBlock,
          Id: probablyUniqueString()
        };
        this.tracker.EditStatBlock({
          editorTarget: "library",
          statBlock: statBlockWithNewId,
          onSave: library.SaveNewListing,
          onSaveAsCharacter: this.saveStatblockAsPersistentCharacter,
          currentListings: library.GetAllListings()
        });
      } else {
        this.tracker.EditStatBlock({
          editorTarget: "library",
          statBlock: { ...StatBlock.Default(), ...statBlock },
          onSave: s => library.SaveEditedListing(listing, s),
          currentListings: library.GetAllListings(),
          onDelete: this.deleteSavedStatBlock(listing.Meta().Id),
          onSaveAsCopy: library.SaveNewListing,
          onSaveAsCharacter: this.saveStatblockAsPersistentCharacter
        });
      }
    });
  };

  public CreatePersistentCharacter = async (): Promise<
    Listing<PersistentCharacter>
  > => {
    const statBlock = StatBlock.Default();
    const newId = probablyUniqueString();

    statBlock.Name = "New Character";
    statBlock.Player = "player";
    statBlock.Id = newId;

    const persistentCharacter = PersistentCharacter.Initialize(statBlock);
    return await this.libraries.PersistentCharacters.SaveNewListing(
      persistentCharacter
    );
  };

  public EditPersistentCharacterStatBlock(
    persistentCharacterId: string
  ): Promise<void> {
    if (this.tracker.TutorialVisible()) {
      return;
    }
    this.tracker.EditPersistentCharacterStatBlock(persistentCharacterId);
  }

  public UpdatePersistentCharacterStatBlockInLibraryAndEncounter = (
    persistentCharacterId: string,
    updatedStatBlock: StatBlock,
    hpDifference?: number
  ): void => {
    this.UpdatePersistentCharacter(persistentCharacterId, {
      StatBlock: updatedStatBlock,
      CurrentHP: updatedStatBlock.HP.Value - (hpDifference ?? 0)
    });
    this.tracker.Encounter.UpdatePersistentCharacterStatBlock(
      persistentCharacterId,
      updatedStatBlock
    );
  };

  public CreateAndEditSpell = (): void => {
    const newSpell = {
      ...Spell.Default(),
      Name: "New Spell",
      Source: "Custom",
      Id: probablyUniqueString()
    };
    this.tracker.EditSpell({
      spell: newSpell,
      onSave: this.libraries.Spells.SaveNewListing,
      onDelete: this.libraries.Spells.DeleteListing
    });
  };

  public EditSpell = (listing: Listing<Spell>): void => {
    listing.GetAsyncWithUpdatedId(spell => {
      this.tracker.EditSpell({
        spell: { ...Spell.Default(), ...spell },
        onSave: spell =>
          this.libraries.Spells.SaveEditedListing(listing, spell),
        onDelete: this.libraries.Spells.DeleteListing
      });
    });
  };

  public ReferenceSpell = (spellListing: Listing<Spell>): boolean => {
    const prompt = SpellPrompt(spellListing);
    this.tracker.PromptQueue.Add(prompt);
    return true;
  };

  public GetSpellsByNameRegex = ko.pureComputed(
    (): RegExp => {
      const spells = this.libraries.Spells.ListingsObservable();
      return concatenatedStringRegex(
        spells
          .map(s => s.Meta().Name)
          .filter(n => n.length > 2)
      );
    }
  );

  public LoadEncounter = (
    savedEncounter: EncounterState<CombatantState>
  ): void => {
    this.encounterCommander.LoadSavedEncounter(savedEncounter);
  };

  public SaveEncounter = (): void => {
    const prompt = SaveEncounterPrompt(
      this.tracker.Encounter.FullEncounterState(),
      this.tracker.Encounter.TemporaryBackgroundImageUrl(),
      this.libraries.Encounters.SaveNewListing,
      this.tracker.EventLog.AddEvent,
      _.uniq(this.libraries.Encounters.GetAllListings().map(e => e.Meta().Path))
    );
    this.tracker.PromptQueue.Add(prompt);
  };

  public MoveEncounter = async (
    encounterListing: Listing<SavedEncounter>
  ): Promise<void> => {
    const folderNames = _(this.libraries.Encounters.GetAllListings())
      .map(e => e.Meta().Path)
      .uniq()
      .compact()
      .value();
    const encounter = await encounterListing.GetWithTemplate(
      SavedEncounter.Default()
    );
    const prompt = MoveEncounterPrompt(
      encounter,
      (encounter: SavedEncounter, oldId: string) => {
        this.libraries.Encounters.DeleteListing(oldId);
        this.libraries.Encounters.SaveNewListing(encounter);
      },
      folderNames
    );
    this.tracker.PromptQueue.Add(prompt);
  };

  public ReferenceCondition = (conditionName: string): void => {
    const promptProps = ConditionReferencePrompt(conditionName);
    if (promptProps) {
      this.tracker.PromptQueue.Add(promptProps);
    }
  };

  public LaunchQuickAddPrompt = (): void => {
    this.encounterCommander.QuickAddStatBlock();
  };

  private deleteSavedStatBlock = (statBlockId: string) => (): void => {
    this.libraries.StatBlocks.DeleteListing(statBlockId);
    Metrics.TrackEvent("StatBlockDeleted", { Id: statBlockId });
  };

  private saveStatblockAsPersistentCharacter = (statBlock: StatBlock) => {
    const persistentCharacter = PersistentCharacter.Initialize(statBlock);
    this.libraries.PersistentCharacters.SaveNewListing(persistentCharacter);
  };

  public ImportFromDndBeyond = (): void => {
    const prompt = DndBeyondUrlPrompt(async (url: string) => {
      this.tracker.EventLog.AddEvent("Fetching character from D&D Beyond...");
      try {
        const response = await axios.get(`/import/dndbeyond?url=${encodeURIComponent(url)}`);
        const characterData = response.data;
        
        const reviewPrompt = DndBeyondReviewPrompt(characterData, (finalData) => {
          const statBlock: StatBlock = {
            ...StatBlock.Default(),
            Id: finalData.Id || probablyUniqueString(),
            Name: finalData.Name,
            HP: finalData.HP,
            AC: finalData.AC,
            Abilities: finalData.Abilities,
            InitiativeModifier: finalData.InitiativeModifier,
            Type: finalData.Type,
            Challenge: finalData.Challenge,
            ImageURL: finalData.ImageURL,
            Description: finalData.Description,
            Player: "player",
            Speed: finalData.Speed || [],
            Saves: finalData.Saves || [],
            Skills: finalData.Skills || [],
            Senses: finalData.Senses || [],
            Languages: finalData.Languages || [],
            DamageVulnerabilities: finalData.DamageVulnerabilities || [],
            DamageResistances: finalData.DamageResistances || [],
            DamageImmunities: finalData.DamageImmunities || [],
            ConditionImmunities: finalData.ConditionImmunities || [],
            Traits: finalData.Traits || [],
            Actions: finalData.Actions || [],
            Reactions: finalData.Reactions || [],
            BonusActions: finalData.BonusActions || []
          };
          
          const persistentCharacter = {
            ...PersistentCharacter.Initialize(statBlock),
            CurrentHP: finalData.CurrentHP
          };
          
          this.libraries.PersistentCharacters.SaveNewListing(persistentCharacter);
          this.tracker.EventLog.AddEvent(`Successfully imported ${statBlock.Name} from D&D Beyond.`);
        });
        
        this.tracker.PromptQueue.Add(reviewPrompt);
      } catch (err: any) {
        const errMsg = err.response?.data || err.message || "Unknown error";
        this.tracker.EventLog.AddEvent(`Failed to import character: ${errMsg}`);
        
        const errorPrompt = DndBeyondErrorPrompt(errMsg);
        this.tracker.PromptQueue.Add(errorPrompt);
      }
    });
    
    this.tracker.PromptQueue.Add(prompt);
  };

  public ResyncPersistentCharacter = async (
    listing: Listing<PersistentCharacter>,
    url: string
  ): Promise<void> => {
    this.tracker.EventLog.AddEvent("Fetching updated character from D&D Beyond...");
    try {
      const response = await axios.get(`/import/dndbeyond?url=${encodeURIComponent(url)}`);
      const characterData = response.data;
      
      const originalCharacter = await listing.GetWithTemplate(PersistentCharacter.Default());
      
      const reviewPrompt = DndBeyondReviewPrompt(characterData, async (finalData) => {
        const statBlock: StatBlock = {
          ...originalCharacter.StatBlock,
          Name: finalData.Name,
          HP: finalData.HP,
          AC: finalData.AC,
          Abilities: finalData.Abilities,
          InitiativeModifier: finalData.InitiativeModifier,
          Type: finalData.Type,
          Challenge: finalData.Challenge,
          ImageURL: finalData.ImageURL,
          Description: finalData.Description,
          Speed: finalData.Speed,
          Saves: finalData.Saves,
          Skills: finalData.Skills,
          Senses: finalData.Senses,
          Languages: finalData.Languages,
          DamageVulnerabilities: finalData.DamageVulnerabilities,
          DamageResistances: finalData.DamageResistances,
          DamageImmunities: finalData.DamageImmunities,
          ConditionImmunities: finalData.ConditionImmunities,
          Traits: finalData.Traits,
          Actions: finalData.Actions,
          Reactions: finalData.Reactions,
          BonusActions: finalData.BonusActions
        };
        
        const updatedCharacter = {
          ...originalCharacter,
          Name: finalData.Name,
          CurrentHP: finalData.CurrentHP,
          StatBlock: statBlock,
          LastUpdateMs: now()
        };
        
        await this.libraries.PersistentCharacters.SaveEditedListing(listing, updatedCharacter);
        this.tracker.Encounter.UpdatePersistentCharacterStatBlock(listing.Meta().Id, statBlock);
        
        this.tracker.EventLog.AddEvent(`Successfully synchronized ${statBlock.Name} with D&D Beyond.`);
      });
      
      this.tracker.PromptQueue.Add(reviewPrompt);
    } catch (err: any) {
      const errMsg = err.response?.data || err.message || "Unknown error";
      this.tracker.EventLog.AddEvent(`Failed to resynchronize character: ${errMsg}`);
      
      const errorPrompt = DndBeyondErrorPrompt(errMsg);
      this.tracker.PromptQueue.Add(errorPrompt);
    }
  };
}

