export function isInteractiveTarget(target: EventTarget | null): boolean {
  return !!(target as Element | null)?.closest?.("button, input, select, textarea, a[href], summary, [role=button], [role=switch], [role=slider], [role=checkbox], [contenteditable]:not([contenteditable=false])");
}
