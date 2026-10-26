import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDailyFixture } from "../puzzles/dailyFixture";
import { readGuestPlayer, saveGuestName } from "../storage/guestPlayer";
import { LocalProgressStore } from "../storage/progress";

const rpc = vi.fn();
vi.mock("./supabase", () => ({ requireSupabaseClient: () => ({ rpc }) }));
const {
  canJoinAsGuest,
  checkGuestName,
  claimGuestDailies,
  getDailyLeaderboard,
  joinDailyAsGuest,
  projectedRank,
  submitGuestDailyResult,
} = await import("./leaderboard");

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

let ids = 0;
function solve(store: LocalProgressStore, date: string, reveal = false) {
  let attempt = store.start(createDailyFixture(date));
  if (reveal) attempt = store.markAssisted(attempt);
  attempt = store.recordCommand(attempt, { command: "git merge style", elapsedMs: 1000, ok: true, output: "" });
  return store.complete(attempt, false);
}

const row = {
  rank: 1, display_name: "pixelhen", avatar_url: null, elapsed_ms: 42_000, restart_count: 0,
  command_count: 2, completed_at: "2026-10-19T10:00:00Z", is_current_user: true, is_guest: true,
};

describe("guest leaderboard names", () => {
  let localStorage: MemoryStorage;

  beforeEach(() => {
    rpc.mockReset();
    localStorage = new MemoryStorage();
    vi.stubGlobal("window", { localStorage });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("tidies names and rejects ones the server would refuse", () => {
    expect(checkGuestName("  Pixel   Hen ")).toEqual({ ok: true, name: "Pixel Hen" });
    expect(checkGuestName("Núria_ç")).toEqual({ ok: true, name: "Núria_ç" });
    expect(checkGuestName("x")).toEqual({ ok: false, reason: "length" });
    expect(checkGuestName("a".repeat(25))).toEqual({ ok: false, reason: "length" });
    expect(checkGuestName("_hidden")).toEqual({ ok: false, reason: "characters" });
    expect(checkGuestName("me<script>")).toEqual({ ok: false, reason: "characters" });
    expect(checkGuestName("http://spam")).toEqual({ ok: false, reason: "characters" });
    expect(checkGuestName("rtl‮name")).toEqual({ ok: false, reason: "characters" });
  });

  it("submits a guest solve with its token and name, never as a signed-in attempt", async () => {
    rpc.mockResolvedValue({ data: { status: "submitted" }, error: null });
    const store = new LocalProgressStore(new MemoryStorage(), Date.now, () => `attempt-${ids++}`);
    const done = solve(store, "2026-10-19");

    await submitGuestDailyResult("t".repeat(64), "pixelhen", done);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("submit_guest_daily_result", {
      guest_token: "t".repeat(64),
      guest_name: "pixelhen",
      target_puzzle_id: done.puzzleId,
      target_puzzle_version: done.puzzleVersion,
      submitted_elapsed_ms: done.elapsedMs,
      submitted_restart_count: 0,
      submitted_command_count: 1,
      submitted_transcript: done.commands,
    });
  });

  it("never submits a solve whose solution was revealed", async () => {
    const store = new LocalProgressStore(new MemoryStorage(), Date.now, () => `attempt-${ids++}`);
    const assisted = solve(store, "2026-10-19", true);
    await expect(submitGuestDailyResult("t".repeat(64), "pixelhen", assisted)).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("asks for the guest's own row and marks guest entries", async () => {
    const guest = saveGuestName("pixelhen");
    rpc.mockResolvedValue({ data: [row], error: null });

    const entries = await getDailyLeaderboard("daily-2026-10-19", 1, 100);

    expect(rpc).toHaveBeenCalledWith("get_daily_leaderboard", {
      target_puzzle_id: "daily-2026-10-19", target_puzzle_version: 1, result_limit: 100, guest_token: guest.token,
    });
    expect(entries[0]).toMatchObject({ displayName: "pixelhen", isCurrentUser: true, isGuest: true });
  });

  it("still loads the board before the guest migration is applied", async () => {
    saveGuestName("pixelhen");
    rpc
      .mockResolvedValueOnce({ data: null, error: { code: "PGRST202", message: "Could not find the function" } })
      .mockResolvedValueOnce({ data: [{ ...row, is_guest: undefined, is_current_user: false }], error: null });

    const entries = await getDailyLeaderboard("daily-2026-10-19", 1);

    expect(rpc).toHaveBeenLastCalledWith("get_daily_leaderboard", {
      target_puzzle_id: "daily-2026-10-19", target_puzzle_version: 1, result_limit: 50,
    });
    expect(entries[0]).toMatchObject({ isGuest: false, isCurrentUser: false });
  });

  it("moves guest solves to the account on sign-in, then removes the guest name", async () => {
    const guest = saveGuestName("pixelhen");
    rpc.mockImplementation(async (name: string) =>
      name === "start_daily_attempt" ? { data: "server-attempt", error: null } : { data: null, error: null },
    );
    const store = new LocalProgressStore(new MemoryStorage(), Date.now, () => `attempt-${ids++}`);
    solve(store, "2026-10-19");

    expect(await claimGuestDailies(store, "user-1")).toBe(1);

    const calls = rpc.mock.calls.map(([name]) => name);
    expect(calls.indexOf("forget_guest_player")).toBeGreaterThan(calls.indexOf("submit_daily_result"));
    expect(rpc).toHaveBeenCalledWith("forget_guest_player", { guest_token: guest.token });
    expect(readGuestPlayer()).toBeUndefined();
  });

  it("keeps the guest name while a solve still has to move to the account", async () => {
    saveGuestName("pixelhen");
    rpc.mockResolvedValue({ data: null, error: { message: "offline" } });
    const store = new LocalProgressStore(new MemoryStorage(), Date.now, () => `attempt-${ids++}`);
    solve(store, "2026-10-19");

    expect(await claimGuestDailies(store, "user-1")).toBe(0);
    expect(rpc.mock.calls.some(([name]) => name === "forget_guest_player")).toBe(false);
    expect(readGuestPlayer()?.displayName).toBe("pixelhen");
  });

  it("offers an unjoined guest solve until it joins under a name", async () => {
    rpc.mockResolvedValue({ data: { status: "submitted" }, error: null });
    const store = new LocalProgressStore(new MemoryStorage(), Date.now, () => `attempt-${ids++}`);
    const done = solve(store, "2026-10-19");
    expect(canJoinAsGuest(done)).toBe(true);
    expect(canJoinAsGuest(solve(store, "2026-10-20", true))).toBe(false);
    expect(canJoinAsGuest({ ...done, ranked: true })).toBe(false);

    await joinDailyAsGuest("pixelhen", done);

    expect(rpc).toHaveBeenCalledWith("submit_guest_daily_result", expect.objectContaining({ guest_name: "pixelhen" }));
    expect(readGuestPlayer()).toMatchObject({ displayName: "pixelhen", submitted: [done.id] });
    expect(canJoinAsGuest(done)).toBe(false);
  });

  it("keeps a solve joinable when the guest submission fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "offline" } });
    const store = new LocalProgressStore(new MemoryStorage(), Date.now, () => `attempt-${ids++}`);
    const done = solve(store, "2026-10-19");

    await expect(joinDailyAsGuest("pixelhen", done)).rejects.toThrow();
    expect(canJoinAsGuest(done)).toBe(true);
  });
});

describe("projected leaderboard spot", () => {
  const entry = (elapsedMs: number, restartCount = 0, commandCount = 3, completedAt = "2026-10-19T10:00:00Z") => ({
    elapsedMs, restartCount, commandCount, completedAt,
  });
  const board = [entry(30_000), entry(45_000, 1), entry(60_000)];

  it("places a result after everyone faster", () => {
    expect(projectedRank(board, entry(10_000))).toBe(1);
    expect(projectedRank(board, entry(50_000))).toBe(3);
    expect(projectedRank(board, entry(90_000))).toBe(4);
    expect(projectedRank([], entry(90_000))).toBe(1);
  });

  it("breaks time ties by retries, then commands, then completion time", () => {
    expect(projectedRank(board, entry(45_000, 0))).toBe(2);
    expect(projectedRank(board, entry(45_000, 2))).toBe(3);
    expect(projectedRank(board, entry(60_000, 0, 2))).toBe(3);
    expect(projectedRank(board, entry(60_000, 0, 3, "2026-10-19T11:00:00.000Z"))).toBe(4);
  });
});
