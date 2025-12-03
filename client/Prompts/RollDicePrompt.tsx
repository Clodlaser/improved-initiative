import * as React from "react";
import { Field, useFormikContext } from "formik";

import { probablyUniqueString } from "../../common/Toolbox";
import { SubmitButton } from "../Components/Button";
import { Dice } from "../Rules/Dice";
import { RollResult } from "../Rules/RollResult";
import { PromptProps } from "./PendingPrompts";
import { StandardPromptLayout } from "./StandardPromptLayout";

interface AssignableTarget {
  id: string;
  name: string;
}

interface AssignDamageOptions {
  targets: AssignableTarget[];
  applyDamage: (
    targetIds: string[],
    baseAmount: number,
    perTargetAdjust?: Record<string, number>
  ) => void;
}

interface RollDiceModel {
  diceExpression: string;
}

export const RollDicePrompt = (
  rollDiceExpression: (expression: string, sourceName?: string) => void
): PromptProps<RollDiceModel> => {
  const fieldLabelId = probablyUniqueString();
  return {
    onSubmit: (model: RollDiceModel) => {
      if (!model.diceExpression) {
        rollDiceExpression("1d20");
        return true;
      }
      const isLegalExpression = Dice.ValidDicePattern.test(model.diceExpression);
      if (!isLegalExpression) {
        return false;
      }

      rollDiceExpression(model.diceExpression);
      return true;
    },
    initialValues: { diceExpression: "" },
    autoFocusSelector: ".autofocus",
    children: (
      <StandardPromptLayout className="p-roll-dice" label="Roll Dice:">
        <Field
          id={fieldLabelId}
          className="autofocus"
          name="diceExpression"
          placeholder="1d20"
        />
      </StandardPromptLayout>
    )
  };
};

export function ShowDiceRollPrompt(
  diceExpression: string,
  rollResult: RollResult,
  assignOptions?: AssignDamageOptions
): PromptProps<{ damage: number }> {
  return {
    onSubmit: () => true,
    initialValues: { damage: rollResult.Total },
    autoFocusSelector: ".response",
    autoDismissMs: assignOptions ? undefined : 10000,
    autoSubmitOnDismiss: assignOptions ? false : true,
    children: (
      <RollResultPromptBody
        diceExpression={diceExpression}
        rollResult={rollResult}
        assignOptions={assignOptions}
      />
    )
  };
}

function RollResultPromptBody({
  diceExpression,
  rollResult,
  assignOptions
}: {
  diceExpression: string;
  rollResult: RollResult;
  assignOptions?: AssignDamageOptions;
}) {
  const { values } = useFormikContext<{ damage: number }>();
  const [openAssign, setOpenAssign] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [adjustMap, setAdjustMap] = React.useState<Record<string, number>>({});
  const targetList = assignOptions?.targets || [];
  const btnRef = React.useRef<HTMLButtonElement>(null);

  const maxVisible = 8;
  const rowHeight = 52;
  const listMaxHeightPx = Math.max(
    targetList.length > 0 ? Math.min(targetList.length, maxVisible) * rowHeight : 0,
    200
  );

  const toggleTarget = (id: string) => {
    setSelectedIds(cur =>
      cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]
    );
  };

  const bumpAdjust = (id: string, delta: number) => {
    setAdjustMap(cur => {
      const next = { ...cur };
      const val = Number(next[id] || 0) + delta;
      next[id] = Number.isFinite(val) ? val : 0;
      return next;
    });
  };

  const setAdjust = (id: string, val: number) => {
    setAdjustMap(cur => ({ ...cur, [id]: val }));
  };

  const onApplyAssign = () => {
    if (!targetList.length) {
      setOpenAssign(false);
      return;
    }
    const amount = Number(values?.damage ?? rollResult.Total);
    if (isNaN(amount) || selectedIds.length === 0) {
      setOpenAssign(false);
      return;
    }
    assignOptions?.applyDamage(selectedIds, amount, adjustMap);
    setOpenAssign(false);
  };

  const hasAssignTargets = targetList.length > 0;

  const controlButtonStyle: React.CSSProperties = {
    border: "1px solid #d1c6b2",
    background: "#f6efe5",
    padding: "0",
    width: "26px",
    height: "26px",
    borderRadius: "6px",
    cursor: "pointer"
  };

  return (
    <div className="p-roll-dice" style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ flex: 1 }}>
          {"Rolled: "}
          {diceExpression}
          {" -> "}
          <span
            dangerouslySetInnerHTML={{ __html: rollResult.FormattedString }}
          />
        </div>
        <Field
          className="response"
          type="number"
          name="damage"
          style={{ minWidth: "64px" }}
        />
        <button
          type="button"
          ref={btnRef}
          onClick={() => setOpenAssign(o => !o)}
          style={{
            border: "1px solid #d1c6b2",
            background: "#f6efe5",
            padding: "6px 10px",
            borderRadius: "6px",
            cursor: "pointer"
          }}
          title="Assigner les degats aux joueurs"
        >
          Assigner
        </button>
      </div>

      {openAssign && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 12px)",
            background: "#fff",
            border: "1px solid #d1c6b2",
            boxShadow: "0 10px 30px rgba(0,0,0,.25)",
            borderRadius: "12px",
            padding: "16px",
            minWidth: "680px",
            maxWidth: "860px",
            minHeight: "320px",
            maxHeight: "82vh",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: "16px",
              lineHeight: 1.2,
              paddingBottom: "4px",
              borderBottom: "1px solid #efe7dc"
            }}
          >
            Assigner aux joueurs ({targetList.length})
          </div>

          <div
            style={{
              flex: "0 0 auto",
              maxHeight: `${listMaxHeightPx}px`,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              minWidth: "620px",
              paddingRight: "10px",
              paddingBottom: "6px"
            }}
          >
            {hasAssignTargets ? (
              targetList.map(t => (
                <label
                  key={t.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "10px 12px",
                    border: "1px solid #eee",
                    borderRadius: "10px",
                    background: "#fdfbf8",
                    boxShadow: "inset 0 1px 0 rgba(0,0,0,0.02)"
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(t.id)}
                    onChange={() => toggleTarget(t.id)}
                    style={{ width: "18px", height: "18px" }}
                  />
                  <span
                    style={{
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: "14px"
                    }}
                  >
                    {t.name}
                  </span>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "26px 72px 26px",
                      columnGap: "6px",
                      alignItems: "center",
                      justifyContent: "end",
                      minWidth: "180px"
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => bumpAdjust(t.id, -1)}
                      style={controlButtonStyle}
                      title="Reduire"
                    >
                      -
                    </button>

                    <input
                      type="number"
                      value={adjustMap[t.id] ?? 0}
                      onChange={e => setAdjust(t.id, Number(e.target.value || 0))}
                      style={{
                        width: "72px",
                        padding: "5px 8px",
                        border: "1px solid #ccc",
                        borderRadius: "6px",
                        textAlign: "center",
                        background: "#fff"
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => bumpAdjust(t.id, 1)}
                      style={controlButtonStyle}
                      title="Augmenter"
                    >
                      +
                    </button>
                  </div>
                </label>
              ))
            ) : (
              <div
                style={{
                  padding: "8px",
                  color: "#8a7f72",
                  fontStyle: "italic",
                  minWidth: "220px"
                }}
              >
                Aucun joueur detecte.
              </div>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridAutoFlow: "column",
              gridAutoColumns: "max-content",
              gap: "10px",
              justifyContent: "flex-end",
              alignItems: "center",
              paddingTop: "6px",
              borderTop: "1px solid #efe7dc"
            }}
          >
            <button
              type="button"
              onClick={() => setOpenAssign(false)}
              style={{
                border: "1px solid #d1c6b2",
                background: "#f6efe5",
                padding: "8px 12px",
                borderRadius: "6px",
                cursor: "pointer",
                minWidth: "90px"
              }}
            >
              Fermer
            </button>
            {hasAssignTargets && (
              <button
                type="button"
                onClick={onApplyAssign}
                style={{
                  border: "1px solid #2b70c9",
                  background: "#3b82f6",
                  color: "#0a1d35",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: 700,
                  minWidth: "130px"
                }}
              >
                Appliquer
              </button>
            )}
          </div>
        </div>
      )}

      <div style={{ marginTop: "10px" }}>
        <SubmitButton />
      </div>
    </div>
  );
}
