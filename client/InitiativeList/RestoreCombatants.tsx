import * as React from "react";
import { CommandContext } from "./CommandContext";
import { Button } from "../Components/Button";
import Mousetrap = require("mousetrap");

export const RestoreCombatants = () => {
  const { RemovedCombatants, RestoreCombatants, ClearRemovedCombatants } =
    React.useContext(CommandContext);

  const restoreCombatants = React.useCallback(() => {
    RestoreCombatants(RemovedCombatants.map(c => c.Id));
  }, [RemovedCombatants, RestoreCombatants]);

  React.useEffect(() => {
    Mousetrap.bind("ctrl+z", restoreCombatants);
    return () => {
      Mousetrap.unbind("ctrl+z");
    };
  }, [restoreCombatants]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      ClearRemovedCombatants();
    }, 8000);
    return () => clearTimeout(timer);
  }, [ClearRemovedCombatants, RemovedCombatants.length]);

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
        <Button onClick={restoreCombatants} text="Restore" />
        <Button
          onClick={() => ClearRemovedCombatants()}
          text="Dismiss"
          key={RemovedCombatants.join("-")}
          additionalClassNames="button-expires"
        />
      </div>
    )
  );
};
