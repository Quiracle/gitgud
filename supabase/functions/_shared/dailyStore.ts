/** Service-role persistence adapter. The domain publisher owns mechanics and proof validation. */
export function createDailyStore(db: any, certification: string, storyModel?: string) {
  return {
    async published(date: string) {
      const result = await db.from("daily_puzzles").select("id,difficulty").eq("published_on", date).eq("is_current", true).maybeSingle();
      check(result);
      return result.data ?? undefined;
    },
    async recent(date: string) {
      const result = await db.from("daily_generation_runs").select("mechanics_signature,graph_archetype")
        .eq("generation_method", "deterministic-v1").in("status", ["validated", "fallback"])
        .lt("published_on", date).order("published_on", { ascending: false }).limit(14);
      check(result);
      return (result.data ?? []).map((row: any) => ({ signature: row.mechanics_signature, family: row.graph_archetype }));
    },
    async reserve(proposal: { date: string; difficulty: string; seed: string; templateId?: string }) {
      const result = await db.rpc("reserve_deterministic_daily", {
        target_date: proposal.date, target_difficulty: proposal.difficulty, target_seed: proposal.seed,
        target_template_id: proposal.templateId, target_certification: certification,
      });
      check(result);
      const row = result.data;
      if (!row || (row.brief?.certification && row.brief.certification !== certification)) {
        throw new Error("Daily reservation requires its original mechanics certification.");
      }
      return { date: row.published_on, difficulty: row.selected_difficulty, seed: row.seed, templateId: row.brief?.templateId };
    },
    async startRun(metadata: any) {
      const result = await db.from("daily_generation_runs").insert({
        published_on: metadata.date, selected_difficulty: metadata.difficulty, status: "running", attempt_number: 1,
        provider: "deterministic", model: storyModel ?? null, generation_method: "deterministic-v1",
        brief_version: 3, prompt_version: metadata.promptVersion, graph_archetype: metadata.family,
        template_id: metadata.templateId, mechanics_signature: metadata.signature, quality_metrics: metadata.quality,
      }).select("id").single();
      check(result);
      return result.data.id as string;
    },
    async recordStory(runId: string, source: string, failure?: string) {
      check(await db.from("daily_generation_runs").update({
        story_source: source, failure_categories: failure ? { [failure]: 1 } : {},
      }).eq("id", runId));
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
      check(await db.from("daily_generation_runs").update({
        status: "failed", error_summary: category, completed_at: new Date().toISOString(),
      }).eq("id", runId));
    },
  };
}

function check(result: { error: unknown }) { if (result.error) throw result.error; }
