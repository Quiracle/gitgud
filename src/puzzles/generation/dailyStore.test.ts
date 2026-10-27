import { describe, expect, it } from "vitest";
import { createDailyStore } from "../../../supabase/functions/_shared/dailyStore";

type Result = { data?: any; error?: unknown };

class FluentQuery {
  readonly operations: Array<[string, ...unknown[]]> = [];
  constructor(private readonly response: Result) {}
  select(...args: unknown[]) { this.operations.push(["select", ...args]); return this; }
  eq(...args: unknown[]) { this.operations.push(["eq", ...args]); return this; }
  in(...args: unknown[]) { this.operations.push(["in", ...args]); return this; }
  lt(...args: unknown[]) { this.operations.push(["lt", ...args]); return this; }
  order(...args: unknown[]) { this.operations.push(["order", ...args]); return this; }
  limit(...args: unknown[]) { this.operations.push(["limit", ...args]); return this; }
  insert(...args: unknown[]) { this.operations.push(["insert", ...args]); return this; }
  update(...args: unknown[]) { this.operations.push(["update", ...args]); return this; }
  maybeSingle() { this.operations.push(["maybeSingle"]); return Promise.resolve(this.response); }
  single() { this.operations.push(["single"]); return Promise.resolve(this.response); }
  then(resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) {
    return Promise.resolve(this.response).then(resolve, reject);
  }
}

class FakeSupabase {
  readonly queries: Array<{ table: string; query: FluentQuery }> = [];
  readonly rpcs: Array<{ name: string; args: Record<string, unknown> }> = [];
  queryResponses = new Map<string, Result[]>();
  rpcResponses = new Map<string, Result[]>();
  from(table: string) {
    const response = (this.queryResponses.get(table) ?? []).shift() ?? { data: [] };
    const query = new FluentQuery(response);
    this.queries.push({ table, query });
    return query;
  }
  async rpc(name: string, args: Record<string, unknown>) {
    this.rpcs.push({ name, args });
    return (this.rpcResponses.get(name) ?? []).shift() ?? { data: null };
  }
}

describe("daily generation Supabase store adapter", () => {
  it("returns persisted reservation fields instead of proposal values", async () => {
    const db = new FakeSupabase();
    db.rpcResponses.set("reserve_deterministic_daily", [{ data: {
      published_on: "2026-11-02", selected_difficulty: "medium", seed: "already-reserved", brief: { templateId: "medium-2", certification: "cert-v7" },
    } }]);
    const store = createDailyStore(db, "cert-v7", "story-model");
    const reservation = await store.reserve({ date: "2026-11-02", difficulty: "easy", seed: "new-proposal", templateId: "easy-0" });
    expect(reservation).toEqual({ date: "2026-11-02", difficulty: "medium", seed: "already-reserved", templateId: "medium-2" });
    expect(db.rpcs[0]).toEqual({
      name: "reserve_deterministic_daily",
      args: {
        target_date: "2026-11-02", target_difficulty: "easy", target_seed: "new-proposal",
        target_template_id: "easy-0", target_certification: "cert-v7",
      },
    });
  });

  it("rejects a reservation with a different mechanics certification", async () => {
    const db = new FakeSupabase();
    db.rpcResponses.set("reserve_deterministic_daily", [{ data: {
      published_on: "2026-11-02", selected_difficulty: "easy", seed: "persisted", brief: { templateId: "easy-1", certification: "old-cert" },
    } }]);
    const store = createDailyStore(db, "current-cert");
    await expect(store.reserve({ date: "2026-11-02", difficulty: "easy", seed: "proposal", templateId: "easy-0" }))
      .rejects.toThrow(/certification/i);
  });

  it("uses only successful earlier deterministic runs for novelty history", async () => {
    const db = new FakeSupabase();
    db.queryResponses.set("daily_generation_runs", [{ data: [
      { mechanics_signature: "sig-a", graph_archetype: "family-a" },
      { mechanics_signature: "sig-b", graph_archetype: "family-b" },
    ] }]);
    const recent = await createDailyStore(db, "cert").recent("2026-11-02");
    expect(recent).toEqual([
      { signature: "sig-a", family: "family-a" },
      { signature: "sig-b", family: "family-b" },
    ]);
    expect(db.queries[0].query.operations).toEqual([
      ["select", "mechanics_signature,graph_archetype"],
      ["eq", "generation_method", "deterministic-v1"],
      ["in", "status", ["validated", "fallback"]],
      ["lt", "published_on", "2026-11-02"],
      ["order", "published_on", { ascending: false }],
      ["limit", 14],
    ]);
  });

  it("keeps public definition and private proof in separate RPC arguments", async () => {
    const db = new FakeSupabase();
    db.rpcResponses.set("publish_daily_puzzle", [{ data: "daily-2026-11-02" }]);
    const validated = {
      puzzle: { id: "daily-2026-11-02", title: "Night Garden", localizations: { en: {}, ca: {}, es: {} } },
      privateMetadata: { solutionCommands: ["git cherry-pick c4", "git revert c2"] },
    };
    const id = await createDailyStore(db, "cert").publish("run-1", validated);
    expect(id).toBe("daily-2026-11-02");
    expect(db.rpcs).toEqual([{
      name: "publish_daily_puzzle",
      args: {
        target_run_id: "run-1",
        target_definition: validated.puzzle,
        target_solution_commands: validated.privateMetadata.solutionCommands,
        target_validation_status: "validated",
      },
    }]);
    expect(db.rpcs[0].args.target_definition).not.toHaveProperty("solutionCommands");
  });

  it("propagates persistence errors rather than treating them as an empty result", async () => {
    const db = new FakeSupabase();
    const failure = new Error("database unavailable");
    db.queryResponses.set("daily_puzzles", [{ data: null, error: failure }]);
    await expect(createDailyStore(db, "cert").published("2026-11-02")).rejects.toBe(failure);
    db.rpcResponses.set("reserve_deterministic_daily", [{ data: null, error: failure }]);
    await expect(createDailyStore(db, "cert").reserve({ date: "2026-11-02", difficulty: "easy", seed: "s" }))
      .rejects.toBe(failure);
  });
});
