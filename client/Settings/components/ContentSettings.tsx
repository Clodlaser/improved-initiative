import * as React from "react";
import * as _ from "lodash";

import { Toggle } from "./Toggle";
import { useRequest } from "../../Utility/useRequest";

export function ContentSettings() {
  const contentSources = useRequest("/open5e/");
  if (contentSources.loading) {
    return <div className="tab-content content">Loading Sources...</div>;
  }
  if (contentSources.error) {
    return (
      <div className="tab-content content">
        Error loading sources: {contentSources.error}
      </div>
    );
  }

  const statblockSourceKeys = _.orderBy(
    Object.keys(contentSources.data.monsterSources),
    [
      k => {
        if (k === "wotc-srd") {
          return "0";
        }
        return contentSources.data.monsterSources[k];
      }
    ]
  );

  const spellSourceKeys = _.orderBy(
    Object.keys(contentSources.data.spellSources),
    k => {
      if (k === "wotc-srd") {
        return "0";
      }
      return contentSources.data.spellSources[k];
    }
  );

  return (
    <div className="tab-content content">
      <h3>Preloaded Content</h3>
      <h2>Creature Statblocks</h2>
      {statblockSourceKeys.map((sourceName: string) => (
        <Toggle
          key={`toggle-monsters-${sourceName}`}
          fieldName={`PreloadedStatBlockSources.${sourceName}`}
        >
          {contentSources.data.monsterSources[sourceName]}
        </Toggle>
      ))}
      <h2>Spells</h2>
      {spellSourceKeys.map((sourceName: string) => (
        <Toggle
          key={`toggle-spells-${sourceName}`}
          fieldName={`PreloadedSpellSources.${sourceName}`}
        >
          {contentSources.data.spellSources[sourceName]}
        </Toggle>
      ))}
      <p style={{ fontWeight: "bold" }}>
        Reload the app after saving your Preloaded Content changes.
      </p>
    </div>
  );
}
