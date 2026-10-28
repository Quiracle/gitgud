/** Service-role adapter; candidate artifacts and hidden proofs never reach a public response. */
export function createProceduralDailyStore(db: any, storyModel?: string) {
  return {
    async published(date: string) {
      const result = await db.from("daily_puzzles").select("id,difficulty").eq("published_on", date).eq("is_current", true).maybeSingle();
      check(result);
      return result.data ?? undefined;
    },
    async reserve(proposal: { date: string; difficulty: string; sourceFingerprint: string }) {
      const result = await db.rpc("reserve_procedural_daily", {
        target_date: proposal.date, target_difficulty: proposal.difficulty, target_source_fingerprint: proposal.sourceFingerprint,
      });
      check(result);
      if (!result.data) throw new Error("Missing date reservation.");
      return result.data;
    },
    async startRun(metadata: any) {
      const result = await db.from("daily_generation_runs").insert({
        published_on: metadata.date, selected_difficulty: metadata.difficulty, status: "running", attempt_number: 1,
        provider: "deterministic", model: storyModel ?? null, generation_method: "procedural-v1",
        brief_version: 4, prompt_version: 3, graph_archetype: metadata.novelty.commandPattern,
        candidate_id: metadata.candidateId, mechanics_signature: metadata.novelty.mechanicsHash,
        quality_metrics: metadata.certificate,
      }).select("id").single();
      check(result);
      return result.data.id as string;
    },
    async recordStory(runId: string, source: string, failure?: string) {
      check(await db.from("daily_generation_runs").update({ story_source: source, failure_categories: failure ? { [failure]: 1 } : {} }).eq("id", runId));
    },
    async publish(runId: string, validated: any) {
      const result = await db.rpc("publish_daily_puzzle", {
        target_run_id: runId, target_definition: validated.puzzle,
        target_solution_commands: validated.privateMetadata.solutionCommands, target_validation_status: "validated",
      });
      check(result);
      return result.data as string;
    },
    async failed(runId: string, category: string) {
      check(await db.from("daily_generation_runs").update({ status: "failed", error_summary: category, completed_at: new Date().toISOString() }).eq("id", runId));
    },
  };
}
function check(result: { error: unknown }) { if (result.error) throw result.error; }
