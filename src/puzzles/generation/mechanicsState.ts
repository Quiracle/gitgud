/** Semantic states use allowlisted primitive values. Property insertion order is irrelevant. */
export function snapshotKey(state: Record<string, unknown>): string {
  return JSON.stringify(Object.entries(state).sort(([a], [b]) => a.localeCompare(b)));
}
