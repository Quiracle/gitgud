import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDailyFixture } from "../puzzles/dailyFixture";
import { LocalProgressStore } from "../storage/progress";

const rpc = vi.fn();
vi.mock("./supabase", () => ({ requireSupabaseClient: () => ({ rpc }) }));
const { claimDailyCompletion, claimGuestDailies } = await import("./leaderboard");

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

let ids = 0;
function solve(store: LocalProgressStore, date: string, reveal = false) {
  let attempt = store.start(createDailyFixture(date));
  if (reveal) attempt = store.markAssisted(attempt);
  attempt = store.recordCommand(attempt, { command: "git merge style", elapsedMs: 1000, ok: true, output: "" });
  return store.complete(attempt, false);
}

describe("claiming guest daily solves after login", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockImplementation(async (name: string) =>
      name === "start_daily_attempt" ? { data: "server-attempt", error: null } : { data: { status: "submitted" }, error: null },
    );
  });

  it("submits an unranked guest solve and marks it ranked for that account", async () => {
    const store = new LocalProgressStore(new MemoryStorage(), Date.now, () => `attempt-${ids++}`);
    const done = solve(store, "2026-10-10");

    await claimDailyCompletion(store, done, "user-1");

    expect(rpc).toHaveBeenCalledWith("start_daily_attempt", { target_puzzle_id: done.puzzleId, target_puzzle_version: done.puzzleVersion });
    expect(rpc).toHaveBeenCalledWith("submit_daily_result", expect.objectContaining({
      target_attempt_id: "server-attempt",
      submitted_elapsed_ms: done.elapsedMs,
      submitted_restart_count: 0,
      submitted_command_count: 1,
    }));
    expect(store.latestCompletion(done.puzzleId, done.puzzleVersion)).toMatchObject({ ranked: true, rankedUserId: "user-1" });
    expect(store.unrankedDailyCompletions()).toEqual([]);
  });

  it("never claims a solve whose solution was revealed, even after a refresh", async () => {
    const storage = new MemoryStorage();
    const store = new LocalProgressStore(storage, Date.now, () => `attempt-${ids++}`);
    solve(store, "2026-10-09", true);
    solve(store, "2026-10-10");

    const reloaded = new LocalProgressStore(storage);
    expect(await claimGuestDailies(reloaded, "user-1")).toBe(1);
    expect(rpc.mock.calls.filter(([name]) => name === "submit_daily_result")).toHaveLength(1);
  });

  it("shares one submission between concurrent claims of the same solve", async () => {
    const store = new LocalProgressStore(new MemoryStorage(), Date.now, () => `attempt-${ids++}`);
    const done = solve(store, "2026-10-10");

    await Promise.all([claimDailyCompletion(store, done, "user-1"), claimGuestDailies(store, "user-1")]);
    expect(rpc.mock.calls.filter(([name]) => name === "submit_daily_result")).toHaveLength(1);
  });

  it("keeps a failed claim unranked so it is retried later", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "offline" } });
    const store = new LocalProgressStore(new MemoryStorage(), Date.now, () => `attempt-${ids++}`);
    solve(store, "2026-10-10");

    expect(await claimGuestDailies(store, "user-1")).toBe(0);
    expect(store.unrankedDailyCompletions()).toHaveLength(1);
  });
});
