import * as React from "react";
import { Button } from "../Button"; // déjà présent dans le repo
import { SelectionStore } from "./SelectionStore";

// Types minimaux pour interagir avec l'existant
type EncounterStore = {
  // Doit exister dans ton store : Récupère l'ordre d’affichage actuel côté MJ.
  sortedCombatantIds: () => string[];
  // Méthodes déjà existantes ; sinon elles seront appelées via applyHPDeltaToMany (fichier 4)
  getCombatantById: (id: string) => { heal: (n: number) => void; applyDamage: (n: number) => void } | null | undefined;
  history?: { beginGroup: (label: string) => void; endGroup: () => void };
  broadcastState?: () => void;
  // Ajoutée dans le fichier (4) si tu ne l’as pas déjà
  applyHPDeltaToMany?: (ids: string[], delta: number) => void;
};

export function GroupHPAdjust(props: { encounter: EncounterStore; selection: SelectionStore }) {
  const { encounter, selection } = props;
  const [amount, setAmount] = React.useState<number>(0);
  const selected = React.useMemo(() => Array.from(selection.selectedIds), [selection.selectedIds]);
  const canApply = selected.length > 0 && Math.abs(amount) > 0;

  const apply = (sign: 1 | -1) => {
    if (!canApply) return;
    const delta = Math.abs(amount) * sign;

    if (typeof encounter.applyHPDeltaToMany === "function") {
      encounter.applyHPDeltaToMany(selected, delta);
    } else {
      // Fallback si tu préfères ne pas modifier le store (voir fichier 4).
      encounter.history?.beginGroup(`HP ${delta > 0 ? "heal" : "damage"} x${selected.length} (${Math.abs(delta)})`);
      for (const id of selected) {
        const c = encounter.getCombatantById(id);
        if (!c) continue;
        if (delta > 0) c.heal(delta);
        else c.applyDamage(Math.abs(delta));
      }
      encounter.history?.endGroup?.();
      encounter.broadcastState?.();
    }
  };

  // Petit raccourci clavier (optionnel)
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        selection.selectAll(encounter.sortedCombatantIds());
      }
      if (e.key === "Escape") {
        selection.selectNone();
      }
      if (e.shiftKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (canApply) apply(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, encounter, canApply]);

  return (
    <div className="gm-group-hp" style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <span>Sélection : {selected.length}</span>
      <input
        ref={inputRef}
        type="number"
        inputMode="numeric"
        value={amount}
        onChange={(e) => setAmount(Number(e.currentTarget.value))}
        placeholder="Δ PV"
        aria-label="Delta PV"
        style={{ width: 90 }}
      />
      <Button text="– Dégâts" onClick={() => apply(-1)} disabled={!canApply} />
      <Button text="+ Soin" onClick={() => apply(+1)} disabled={!canApply} />
    </div>
  );
}
