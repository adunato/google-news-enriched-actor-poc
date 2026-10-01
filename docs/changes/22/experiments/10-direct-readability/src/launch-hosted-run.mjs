import process from "node:process";
import { resolve } from "node:path";
import { createApifyCliAdapter } from "./apify-cli-adapter.mjs";
import { createHostedRunPlan, executeHostedRunPlan } from "./hosted-run-controller.mjs";
import { experimentRootFromModule, verifySourceContinuity } from "./source-continuity.mjs";

const root = experimentRootFromModule();
const trustedHead = process.env.I10_TRUSTED_HEAD;
const suppliedRoot = process.env.I10_EXPERIMENT_ROOT;
const liveLaunch = process.env.I10_LIVE_LAUNCH === "APPROVED-ISSUE22-ITERATION10";

if (!liveLaunch) {
  const plan = await createHostedRunPlan({ sourceRoot: root });
  console.log(JSON.stringify({
    status: "dry_run_only",
    sourceManifestSha256: plan.sourceManifestSha256,
    sourceFileCount: plan.sourcePaths.length,
    hostedActorCreated: false,
    buildStarted: false,
    runStarted: false,
    liveLaunchRequiresExplicitGate: true,
  }));
} else {
  if (process.env.APIFY_IS_AT_HOME === "1") throw new Error("hosted_runtime_cannot_launch_actor");
  if (typeof suppliedRoot !== "string" || resolve(suppliedRoot) !== root) throw new Error("source_continuity_experiment_root_anchor_required");
  const continuity = await verifySourceContinuity({ experimentRoot: suppliedRoot, trustedHead });
  const plan = await createHostedRunPlan({ sourceRoot: root });
  if (plan.sourceManifestSha256 !== continuity.sourceManifestSha256) throw new Error("source_continuity_changed_after_check");
  const api = await createApifyCliAdapter();
  await api.verifyAuthentication();
  const result = await executeHostedRunPlan(plan, api, {
    sourceCheck: () => verifySourceContinuity({ experimentRoot: suppliedRoot, trustedHead }),
  });
  console.log(JSON.stringify({
    status: result.status,
    actorId: result.actorId,
    buildId: result.buildId,
    buildNumber: result.buildNumber,
    runId: result.runId,
    sourceManifestSha256: plan.sourceManifestSha256,
  }));
}
