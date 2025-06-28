import * as React from "react";
import { Conditions2014 } from "../Rules/Conditions";
import * as _ from "lodash";

import { PromptProps } from "./PendingPrompts";
import { SubmitButton } from "../Components/Button";

export function ConditionReferencePrompt(
  conditionName: string
): PromptProps<{}> | null {
  const casedConditionName = _.startCase(conditionName);
  const conditionReference = Conditions2014[casedConditionName];
  if (conditionReference === undefined) {
    return null;
  }
  return {
    children: (
      <div className="p-condition-reference">
        <div>
          <h3>{casedConditionName}</h3>
          <div
            dangerouslySetInnerHTML={{
              __html: Conditions2014[casedConditionName]
            }}
          />
        </div>
        <SubmitButton />
      </div>
    ),
    autoFocusSelector: "button",
    initialValues: {},
    onSubmit: () => true
  };
}
