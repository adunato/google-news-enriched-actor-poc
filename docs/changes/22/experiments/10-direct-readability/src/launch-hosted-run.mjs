import process from "node:process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApifyCliAdapter } from "./apify-cli-adapter.mjs";
import { createHostedRunPlan, executeHostedRunPlan } from "./hosted-run-controller.mjs";
import { experimentRootFromModule, verifySourceContinuity } from "./source-continuity.mjs";

const root = experimentRootFromModule();
const trustedHead = process.env.I10_TRUSTED_HEAD;
const suppliedRoot = process.env.I10_EXPERIMENT_ROOT;
const liveLaunch = process.env.I10_LIVE_LAUNCH === "APPROVED-ISSUE22-ITERATION10";
const SAFE_DIAGNOSTIC_KEYS = ["kind", "stage", "status", "exitCode", "signal", "code", "apifyErrorType", "apifyErrorCode", "requestId", "apifyTimestamp", "requestTimestamp", "method", "endpoint"];

export function safeFailure(error) {
  const safeMessages = new Set(["actor_create_failed", "actor_privacy_or_permission_gate_failed", "version_source_snapshot_mismatch", "build_creation_failed", "build_snapshot_or_status_gate_failed", "actor_readback_privacy_or_permission_gate_failed", "run_start_ambiguous_aborted_no_retry", "run_readback_gate_failed", "run_gate_record_not_observed", "run_abort_not_confirmed", "ambiguous_run_abort_not_confirmed"]);
  const diagnostic = error?.diagnostic && typeof error.diagnostic === "object"
    ? Object.fromEntries(SAFE_DIAGNOSTIC_KEYS.filter((key) => Object.hasOwn(error.diagnostic, key)).map((key) => [key, error.diagnostic[key]]))
    : undefined;
  return { status: "failed", error: safeMessages.has(error?.message) ? error.message : "hosted_launch_failed", ...(diagnostic ? { diagnostic } : {}) };
}

async function main() {
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
    try {
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
    } catch (error) {
      console.log(JSON.stringify(safeFailure(error)));
      process.exitCode = 1;
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
