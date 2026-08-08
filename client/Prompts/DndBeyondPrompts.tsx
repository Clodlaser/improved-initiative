import * as React from "react";
import { PromptProps } from "./PendingPrompts";
import { Field } from "formik";
import { StandardPromptLayout } from "./StandardPromptLayout";

type DndBeyondUrlModel = {
  Url: string;
};

export function DndBeyondUrlPrompt(
  onSubmitUrl: (url: string) => void
): PromptProps<DndBeyondUrlModel> {
  return {
    autoFocusSelector: "input[name='Url']",
    children: (
      <StandardPromptLayout className="p-dndbeyond-url" label="Import from D&D Beyond">
        <Field
          name="Url"
          type="text"
          placeholder="D&D Beyond Character URL or ID"
          autoComplete="off"
          style={{ width: "20rem" }}
        />
      </StandardPromptLayout>
    ),
    initialValues: {
      Url: ""
    },
    onSubmit: model => {
      if (!model.Url || model.Url.trim() === "") {
        return false;
      }
      onSubmitUrl(model.Url.trim());
      return true;
    }
  };
}

type DndBeyondReviewModel = {
  Name: string;
  MaxHP: number;
  CurrentHP: number;
  AC: number;
  InitiativeModifier: number;
};

export function DndBeyondReviewPrompt(
  initialData: {
    Name: string;
    HP: { Value: number; Notes: string };
    CurrentHP: number;
    AC: { Value: number; Notes: string };
    InitiativeModifier: number;
    Type: string;
    Challenge: string;
    ImageURL: string;
    Description: string;
    Abilities: any;
  },
  onConfirm: (finalData: any) => void
): PromptProps<DndBeyondReviewModel> {
  return {
    autoFocusSelector: "input[name='Name']",
    children: (
      <StandardPromptLayout className="p-dndbeyond-review" label={`Review D&D Beyond Character`}>
        <div style={{ display: "flex", flexDirection: "column", gap: "5px", padding: "5px" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: "5px" }}>
            <label style={{ width: "90px", fontWeight: "bold" }}>Name:</label>
            <Field name="Name" type="text" placeholder="Name" autoComplete="off" style={{ flexGrow: 1 }} />
          </div>
          <div style={{ display: "flex", gap: "10px", marginBottom: "5px" }}>
            <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <label style={{ width: "90px", fontWeight: "bold" }}>Max HP:</label>
              <Field name="MaxHP" type="number" placeholder="Max HP" />
            </div>
            <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <label style={{ width: "90px", fontWeight: "bold" }}>Current HP:</label>
              <Field name="CurrentHP" type="number" placeholder="Current HP" />
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", marginBottom: "5px" }}>
            <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <label style={{ width: "90px", fontWeight: "bold" }}>AC:</label>
              <Field name="AC" type="number" placeholder="AC" />
            </div>
            <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <label style={{ width: "90px", fontWeight: "bold" }}>Init Mod:</label>
              <Field name="InitiativeModifier" type="number" placeholder="Init" />
            </div>
          </div>
          <div style={{ fontSize: "0.85em", color: "#888", fontStyle: "italic", marginTop: "5px" }}>
            Double check the Armor Class (AC) and Initiative Modifier.
          </div>
        </div>
      </StandardPromptLayout>
    ),
    initialValues: {
      Name: initialData.Name,
      MaxHP: initialData.HP.Value,
      CurrentHP: initialData.CurrentHP,
      AC: initialData.AC.Value,
      InitiativeModifier: initialData.InitiativeModifier
    },
    onSubmit: model => {
      onConfirm({
        ...initialData,
        Name: model.Name,
        HP: { Value: model.MaxHP, Notes: "" },
        CurrentHP: model.CurrentHP,
        AC: { Value: model.AC, Notes: "" },
        InitiativeModifier: model.InitiativeModifier
      });
      return true;
    }
  };
}

type DndBeyondErrorModel = {};

export function DndBeyondErrorPrompt(
  errorMessage: string
): PromptProps<DndBeyondErrorModel> {
  return {
    autoFocusSelector: "button[type='submit']",
    children: (
      <StandardPromptLayout className="p-dndbeyond-error" label="Import Failed">
        <div style={{ padding: "5px 0", maxWidth: "300px" }}>
          <p style={{ color: "#d9534f", fontWeight: "bold", margin: "0 0 5px 0" }}>
            Import Error
          </p>
          <p style={{ margin: "0", fontSize: "0.95em", lineHeight: "1.4" }}>
            {errorMessage}
          </p>
        </div>
      </StandardPromptLayout>
    ),
    initialValues: {},
    onSubmit: () => {
      return true;
    }
  };
}
