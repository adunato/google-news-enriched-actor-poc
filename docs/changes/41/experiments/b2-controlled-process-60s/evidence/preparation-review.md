# B2 60-second iteration preparation review

## Change boundary

The 60-second candidate is copied into `experiments/b2-controlled-process-60s/` from the completed 24-second candidate. Its only runtime-source change is the `runRowInChild` default in `actor/parent.mjs`, from `24_000` to `60_000` ms. The focused startup-hang test title and assertions now verify the 60,000–62,000 ms parent interval and unchanged 2,000 ms reap allowance. The Actor metadata uses unique build tag `issue41-b2-controlled-60s` on existing version `0.10`.

The 10,000 ms HTTP chain, request construction, redirect/body handling, extraction functions, helpers, timing and IPC stages, inherited environment, concurrency, package/lock, Dockerfile, Actor identity/defaults, and frozen input are unchanged. `candidate-manifest.json` hashes all 11 packaged files and compares them with the prior 24-second manifest; only the parent deadline and the tag field differ among packaged files. The test-source hash is recorded separately. The frozen 100-row fixture hash matches the prior candidate.

## Focused local control

The only new runtime test executed was `startup hang is killed and reaped at the 60-second parent deadline`, using Node `v20.19.0` and the existing pinned dependencies. It passed. No Google News or publisher request was sent. T0-to-spawn was 34.349 ms; the timer requested SIGKILL at 60,010.224 ms; process exit and IPC close/reap were observed at 60,022.904 ms; kill-to-reap was 12.680 ms. There was no ready or HTTP-request marker, as expected for the startup-hang control. The unchanged HTTP parity and scheduler tests were skipped by the focused test-name filter; the prior 24-second candidate's 11/11 suite remains historical evidence and was not rerun.

## Authorized hosted scope and remaining gate

The user authorized one new build and one conditional 100-row run: the frozen acceptance fixture, at most two children, 512 MiB, `restartOnError=false`, a 3,300-second whole-run limit, and a `$0.10` run charge cap. The 60-second child deadline plus two-second reap allowance yields 3,100 seconds over 50 two-child waves, leaving 200 seconds for orchestration. No hosted build or run has been performed for this iteration. The manifest records `hostedBuildOrRunPerformed=false` and `rootExecutionGatePassed=false`.

Independent pre-build review and an explicit root execution gate are still required. If gated, allow exactly one build and one run on version `0.10` with the unique tag above. Require the exact source/fixture hashes, Node `20.20.2` / Undici `6.24.1` startup marker before child work, RESTRICTED run and dataset access, and a token-free direct dataset-items request returning 401/403. Stop on a failed gate; no rebuild, retry, or second run is authorized.

The prior 24-second result remains 8/100 readable and the overall Spike remains open. This candidate changes only the parent wait bound and cannot by itself establish the cause of earlier timeouts or alter the product architecture.
