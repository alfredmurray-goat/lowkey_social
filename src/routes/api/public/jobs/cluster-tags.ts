import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/jobs/cluster-tags")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { runTagHubClustering } = await import("@/lib/lowkey/ai-cluster.server");
        const result = await runTagHubClustering();
        return Response.json(result, { status: result.ok ? 200 : 202 });
      },
    },
  },
});