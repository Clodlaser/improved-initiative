import * as React from "react";
import { CommandContext } from "./CommandContext";
import { Button } from "../Components/Button";
import Mousetrap = require("mousetrap");
import { SettingsContext } from "../Settings/SettingsContext";

export const RestoreCombatants = () => {
  const { CombatantsPendingRemove, RestoreCombatants, FlushCombatants } =
    React.useContext(CommandContext);
  const { TrackerView } = React.useContext(SettingsContext);

  const restoreCombatants = React.useCallback(() => {
    RestoreCombatants();
  }, [CombatantsPendingRemove, RestoreCombatants]);

  React.useEffect(() => {
    Mousetrap.bind("ctrl+z", restoreCombatants);
    return () => {
      Mousetrap.unbind("ctrl+z");
    };
  }, [restoreCombatants]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      FlushCombatants();
    }, 8000);
    return () => clearTimeout(timer);
  }, [FlushCombatants, CombatantsPendingRemove.length]);

  if (
    CombatantsPendingRemove.length === 0 ||
    TrackerView.DisplayRestoreCombatants === false
  ) {
    return null;
  }

  return (
    <div className="removed-combatants">
      {CombatantsPendingRemove.length === 1 && (
        <span>
          {CombatantsPendingRemove[0].DisplayName()} removed from encounter.
        </span>
      )}
      {CombatantsPendingRemove.length > 1 && (
        <span>
          {CombatantsPendingRemove[0].DisplayName()} and{" "}
          {CombatantsPendingRemove.length - 1} other combatants removed from
          encounter.
        </span>
      )}
      <Button onClick={restoreCombatants} text="Restore" />
      <Button
        onClick={() => FlushCombatants()}
        text="Dismiss"
        key={CombatantsPendingRemove.map(c => c.Id).join("-")}
        additionalClassNames="button-expires"
      />
    </div>
  );
};
