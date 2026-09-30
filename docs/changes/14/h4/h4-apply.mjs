/* global Buffer:readonly, URL:readonly, console:readonly, process:readonly */
import { createDecipheriv } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { classifyCandidate, h4Verdict, registrableDomain, sha256 } from "./h4-core.mjs";
import { writeFileAtomically } from "./h4-storage.mjs";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const EVIDENCE = resolve(DIR, "h4-evidence");
const FREEZE = resolve(EVIDENCE, "h4-freeze.json");
const SEALED = resolve(EVIDENCE, "h4-candidates.sealed");
const ALIASES = resolve(DIR, "aliases.json");
const CALIBRATION = resolve(EVIDENCE, "h4-calibration.json");

function requiredSealKey() {
  const hex = process.env.H4_SEAL_KEY;
  if (!/^[a-f\d]{64}$/i.test(hex ?? ""))
    throw new Error("Set H4_SEAL_KEY to the external 32-byte key used for capture.");
  return Buffer.from(hex, "hex");
}

function decrypt(payload, key) {
  if (payload.subarray(0, 4).toString() !== "H4S1")
    throw new Error("Unknown sealed candidate pack format.");
  const nonce = payload.subarray(4, 16);
  const tag = payload.subarray(16, 32);
  const encrypted = payload.subarray(32);
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8"));
}

const key = requiredSealKey();
const [freezeBytes, sealed, aliasesBytes, calibrationBytes, manifestBytes, historicalBytes] =
  await Promise.all([
    readFile(FREEZE),
    readFile(SEALED),
    readFile(ALIASES),
    readFile(CALIBRATION),
    readFile(resolve(DIR, "../../../../docs/changes/18/input-manifest.json")),
    readFile(resolve(DIR, "../../../../docs/changes/18/hosted-results.json")),
  ]);
const freeze = JSON.parse(freezeBytes.toString("utf8"));
const aliasesConfig = JSON.parse(aliasesBytes.toString("utf8"));
if (
  freeze.artifact !== "issue14-h4-rule-freeze-v1" ||
  freeze.status !== "frozen_before_unresolved_application"
) {
  throw new Error("A valid H4 freeze record is required before application.");
}
if (freeze.sealedCandidatesSha256 !== sha256(sealed))
  throw new Error("Sealed candidate payload hash does not match the freeze record.");
if (freeze.calibrationSha256 !== sha256(calibrationBytes))
  throw new Error("Calibration artifact hash does not match the freeze record.");
if (freeze.sample.fileSha256 !== sha256(manifestBytes))
  throw new Error("Frozen sample manifest has changed since calibration.");
if (freeze.historicalPositiveLabels.fileSha256 !== sha256(historicalBytes))
  throw new Error("Historical positive-control labels have changed since calibration.");
for (const [file, expected] of Object.entries(freeze.scriptHashes)) {
  const actual = sha256(await readFile(resolve(DIR, file)));
  if (actual !== expected) throw new Error(`Frozen code/config hash mismatch: ${file}`);
}
const payload = decrypt(sealed, key);
if (
  payload.artifact !== "issue14-h4-candidate-pack-v1" ||
  payload.manifestFileSha !== freeze.sample.fileSha256
) {
  throw new Error("Sealed payload does not match the frozen sample.");
}
if (payload.rows.length !== 100)
  throw new Error("Sealed candidate pack does not contain the full frozen matrix.");
const historicalLabels = JSON.parse(historicalBytes.toString("utf8").replace(/^\uFEFF/, ""));
const known = new Map(historicalLabels.rows.map((row) => [row.rowId, row.identityStatus]));
const rows = payload.rows.map((row) => {
  const previous = known.get(row.rowId);
  const result =
    previous === "confirmed_match"
      ? { status: "verified", reason: "previously_confirmed_direct_title_match" }
      : classifyCandidate(row, freeze.rule, aliasesConfig.aliases ?? {});
  return {
    rowId: row.rowId,
    previousIdentityStatus: previous,
    status: result.status,
    reason: result.reason,
    candidateUrlHash: row.candidateUrlHash ?? null,
    sourceRegistrableDomain: registrableDomain(row.sourceHost),
    candidatePresent: !!row.candidateUrl,
  };
});
const priorConfirmedMatches = rows.filter(
  (row) => row.previousIdentityStatus === "confirmed_match",
).length;
const newlyVerified = rows.filter(
  (row) => row.previousIdentityStatus !== "confirmed_match" && row.status === "verified",
).length;
const contradicted = rows.filter((row) => row.status === "contradicted").length;
const verdict = h4Verdict(priorConfirmedMatches, newlyVerified, contradicted);
const report = {
  artifact: "issue14-h4-application-results-v1",
  appliedAtUtc: new Date().toISOString(),
  freezeSha256: sha256(freezeBytes),
  sealedCandidatesSha256: sha256(sealed),
  totals: rows.reduce(
    (counts, row) => ((counts[row.status] = (counts[row.status] ?? 0) + 1), counts),
    {},
  ),
  priorConfirmedMatches,
  newlyVerified,
  contradicted,
  verdict,
  rows,
};
await writeFileAtomically(
  EVIDENCE,
  "h4-application-results.json",
  Buffer.from(`${JSON.stringify(report, null, 2)}\n`),
);
console.log(`H4 application complete: ${newlyVerified} newly verified; verdict ${verdict.status}.`);
