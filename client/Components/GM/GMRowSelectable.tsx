// /client/Components/GM/GMRowSelectable.tsx
import * as React from "react";
import { SelectionStore } from "./SelectionStore";

const selectedStyle: React.CSSProperties = {
  outline: "2px solid rgba(102,204,255,0.9)",
  background: "rgba(102,204,255,0.12)",
  borderRadius: 6,
};

type Props = React.PropsWithChildren<{
  combatantId: string;
  index: number;           // position visuelle dans la liste affichée
  sortedIds: string[];     // mêmes ids que ceux utilisés dans le .map(...)
  selection: SelectionStore;
  onPrimary?: (id: string) => void; // optionnel
}>;

export function GMRowSelectable({ combatantId, index, sortedIds, selection, onPrimary, children }: Props) {
  const isSelected = selection.isSelected(combatantId);

  const onClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
      selection.selectNone();
      selection.toggle(combatantId, index);
      onPrimary?.(combatantId);
      return;
    }
    if (e.metaKey || e.ctrlKey) {
      selection.toggle(combatantId, index);
      return;
    }
    if (e.shiftKey) {
      if (selection.lastAnchorIndex === null) selection.lastAnchorIndex = index;
      selection.selectRange(sortedIds, index);
      return;
    }
  };

  return (
    <div className="gm-row" style={isSelected ? selectedStyle : undefined} onClick={onClick} aria-selected={isSelected} role="row">
      {children}
    </div>
  );
}
