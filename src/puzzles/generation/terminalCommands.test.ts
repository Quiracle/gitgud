import { describe, expect, it } from "vitest";
import { executeCommand, getSnapshot, type Repository } from "../../engine";
import { createConstructiveProblem } from "./constructiveGraph";
import { dailySearchCommands } from "./quality";
import { dailyTerminalCommands } from "./terminalCommands";
import { snapshotKey } from "./mechanicsState";

function newMainSnapshots(repository: Repository, commands: string[]) {
  const before = repository.currentBranch === "main" ? snapshotKey(getSnapshot(repository)) : undefined;
  const states = new Set<string>();
  for (const command of commands) {
    const step = executeCommand(repository, command);
    if (!step.ok || step.repository.currentBranch !== "main") continue;
    const state = snapshotKey(getSnapshot(step.repository));
    if (state !== before) states.add(state);
  }
  return [...states].sort();
}

describe("terminal daily search representatives", () => {
  it("preserves every new winning snapshot across full squash partitions and reachable histories", () => {
    let checked = 0;
    for (let seed = 0; seed < 16; seed++) {
      const initial = createConstructiveProblem(`terminal-snapshots-${seed}`, "medium").repository;
      const first = dailySearchCommands(initial, 4096);
      const repositories = [initial];
      for (const command of first.commands) {
        const step = executeCommand(initial, command);
        if (step.ok && step.mutated) repositories.push(step.repository);
      }
      for (const repository of repositories) {
        const exhaustive = dailySearchCommands(repository, 4096);
        if (!exhaustive.complete) continue;
        expect(newMainSnapshots(repository, dailyTerminalCommands(repository))).toEqual(newMainSnapshots(repository, exhaustive.commands));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(100);
  });
});
