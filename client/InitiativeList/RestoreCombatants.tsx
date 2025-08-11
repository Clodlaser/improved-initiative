import * as React from "react";
import { CommandContext } from "./CommandContext";
import { Button } from "../Components/Button";

export const RestoreCombatants = () => {
  const { RemovedCombatants, RestoreCombatants, ClearRemovedCombatants } =
    React.useContext(CommandContext);

  return (
    RemovedCombatants.length > 0 && (
      <div className="removed-combatants">
        {RemovedCombatants.length == 1 && (
          <span>
            {RemovedCombatants[0].StatBlock.Name} removed from encounter.
          </span>
        )}
        {RemovedCombatants.length > 1 && (
          <span>
            {RemovedCombatants[0].StatBlock.Name} and{" "}
            {RemovedCombatants.length - 1} other combatants removed from
            encounter.
          </span>
        )}
        <Button
          onClick={() => RestoreCombatants(RemovedCombatants.map(c => c.Id))}
          text="Restore"
        />
        <Button
          onClick={() => ClearRemovedCombatants()}
          text="Dismiss"
          additionalClassNames="button-expires"
        />
      </div>
    )
  );
};
