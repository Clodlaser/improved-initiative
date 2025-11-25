import * as React from "react";
import { useCallback } from "react";
import { TagState } from "../../common/CombatantState";
import { useSubscription } from "../Combatant/linkComponentToObservables";
import { InitiativeList } from "./InitiativeList";
import { CommandContext } from "./CommandContext";
import { TrackerViewModel } from "../TrackerViewModel";

export function InitiativeListHost(props: { tracker: TrackerViewModel }) {
  const { tracker } = props;

  const encounterState = useSubscription(
    tracker.Encounter.ObservableEncounterState
  );
  const combatantViewModels =
    useSubscription(tracker.CombatantViewModels) ?? [];
  const selectedCombatantIds = useSubscription(
    tracker.CombatantCommander.SelectedCombatants
  ).map(c => c.Combatant.Id);
  const combatantCountsByName = useSubscription(
    tracker.Encounter.CombatantCountsByName
  );

  const selectCombatantById = useCallback(
    (combatantId: string, appendSelection: boolean) => {
      const selectedViewModel = combatantViewModels.find(
        c => c.Combatant.Id == combatantId
      );

      if (selectedViewModel !== undefined) {
        tracker.CombatantCommander.Select(selectedViewModel, appendSelection);
      }
    },
    [combatantViewModels, tracker]
  );

  const toggleCombatantSelection = useCallback(
    (combatantId: string, nextState?: boolean) => {
      const combatantViewModel = combatantViewModels.find(
        c => c.Combatant.Id == combatantId
      );
      if (combatantViewModel !== undefined) {
        tracker.CombatantCommander.ToggleSelect(combatantViewModel, nextState);
      }
    },
    [combatantViewModels, tracker]
  );

  const selectAllCombatants = useCallback(() => {
    tracker.CombatantCommander.SelectMany(combatantViewModels);
  }, [combatantViewModels, tracker]);

  const clearSelection = useCallback(
    () => tracker.CombatantCommander.Deselect(),
    [tracker]
  );

  const removeCombatantTag = useCallback(
    (combatantId: string, tagState: TagState) => {
      const combatantViewModel = combatantViewModels.find(
        c => c.Combatant.Id == combatantId
      );
      combatantViewModel?.RemoveTagByState(tagState);
    },
    [combatantViewModels, tracker]
  );

  const applyDamageToCombatant = useCallback(
    (combatantId: string) => {
      const combatantViewModel = combatantViewModels.find(
        c => c.Combatant.Id == combatantId
      );

      if (combatantViewModel !== undefined) {
        tracker.CombatantCommander.ApplyDamageTargeted(combatantViewModel);
      }
    },
    [combatantViewModels, tracker]
  );

  const moveCombatantFromDrag = useCallback(
    (draggedCombatantId: string, droppedOntoCombatantId: string | null) => {
      const combatants = tracker.Encounter.Combatants();
      if (!combatants) {
        return;
      }
      const draggedCombatant = combatants.find(c => c.Id == draggedCombatantId);
      const droppedCombatantIndex =
        droppedOntoCombatantId === null
          ? combatants.length
          : combatants.findIndex(c => c.Id == droppedOntoCombatantId);
      tracker.Encounter.MoveCombatant(draggedCombatant, droppedCombatantIndex);
    },
    [tracker]
  );

  const setCombatantColor = useCallback(
    (combatantId: string, color: string) => {
      const combatant = tracker.Encounter.Combatants().find(
        c => c.Id == combatantId
      );
      combatant.Color(color);
    },
    [tracker]
  );

  const toggleCombatantSpentReaction = useCallback(
    (combatantId: string) => {
      const combatantViewModel = combatantViewModels.find(
        c => c.Combatant.Id == combatantId
      );
      combatantViewModel.ToggleSpentReaction();
    },
    [combatantViewModels, tracker]
  );

  const combatantsPendingRemove = useSubscription(
    tracker.Encounter.CombatantsPendingRemove
  );

  return (
    <CommandContext.Provider
      value={{
        SelectCombatant: selectCombatantById,
        ToggleCombatantSelection: toggleCombatantSelection,
        SelectAllCombatants: selectAllCombatants,
        ClearCombatantSelection: clearSelection,
        RemoveTagFromCombatant: removeCombatantTag,
        ApplyDamageToCombatant: applyDamageToCombatant,
        CombatantCommands: tracker.CombatantCommander.Commands,
        MoveCombatantFromDrag: moveCombatantFromDrag,
        SetCombatantColor: setCombatantColor,
        ToggleCombatantSpentReaction: toggleCombatantSpentReaction,
        CombatantsPendingRemove: combatantsPendingRemove,
        RestoreCombatants: tracker.CombatantCommander.RestoreCombatants,
        FlushCombatants: tracker.CombatantCommander.FlushCombatants
      }}
    >
      <InitiativeList
        encounterState={encounterState}
        selectedCombatantIds={selectedCombatantIds}
        combatantCountsByName={combatantCountsByName}
      />
    </CommandContext.Provider>
  );
}
