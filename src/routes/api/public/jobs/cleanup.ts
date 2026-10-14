import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Daily job: purge Trash older than 30 days, then delete their storage objects,
// photos removed during edits, and unreferenced uploads older than one day.
export const Route = createFileRoute("/api/public/jobs/cleanup")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: claimed, error: claimErr } = await supabaseAdmin.rpc("claim_expired_trash", { p_limit: 200 });
        if (claimErr) return Response.json({ error: claimErr.message }, { status: 500 });

        const { data: orphans } = await supabaseAdmin.rpc("find_orphan_objects", { p_limit: 200 });
        if (orphans && orphans.length) {
          await supabaseAdmin.from("cleanup_jobs").insert({ kind: "orphan", object_paths: orphans.map((o: { name: string }) => o.name) });
        }

        const { data: jobs } = await supabaseAdmin.from("cleanup_jobs").select("*").eq("state", "pending").lt("attempts", 10).limit(100);
        let done = 0;
        for (const j of jobs ?? []) {
          const paths = j.object_paths as string[];
          const { error } = paths.length ? await supabaseAdmin.storage.from("photos").remove(paths) : { error: null };
          await supabaseAdmin.from("cleanup_jobs").update(
            error ? { attempts: j.attempts + 1, last_error: error.message, state: j.attempts + 1 >= 10 ? "failed" : "pending" }
                  : { state: "done", completed_at: new Date().toISOString(), attempts: j.attempts + 1 },
          ).eq("id", j.id);
          if (!error) done++;
        }
        return Response.json({ purged: claimed, jobsDone: done });
      },
    },
  },
});
