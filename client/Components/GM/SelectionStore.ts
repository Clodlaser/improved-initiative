// Lightweight store pour gérer la sélection multiple côté MJ (UI-local).
export class SelectionStore {
  public selectedIds = new Set<string>();
  public lastAnchorIndex: number | null = null;

  isSelected = (id: string) => this.selectedIds.has(id);

  selectNone() {
    this.selectedIds.clear();
    this.lastAnchorIndex = null;
  }

  selectAll(ids: string[]) {
    this.selectedIds = new Set(ids);
  }

  toggle(id: string, anchorIndex?: number) {
    if (this.selectedIds.has(id)) this.selectedIds.delete(id);
    else this.selectedIds.add(id);
    if (anchorIndex !== undefined) this.lastAnchorIndex = anchorIndex;
  }

  selectRange(sortedIds: string[], toIndex: number) {
    const fromIndex = this.lastAnchorIndex ?? toIndex;
    const [a, b] = fromIndex < toIndex ? [fromIndex, toIndex] : [toIndex, fromIndex];
    for (let i = a; i <= b; i++) this.selectedIds.add(sortedIds[i]);
  }
}
