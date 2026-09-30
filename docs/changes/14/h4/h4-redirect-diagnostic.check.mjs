import assert from "node:assert/strict";
import test from "node:test";
import {
  positiveControlIds,
  runRedirectDiagnostic,
  sanitizedUrlShape,
  selectPositiveControls,
} from "./h4-redirect-diagnostic.mjs";

function labels() {
  return {
    rows: [
      ...Array.from({ length: 79 }, (_, index) => ({
        recordType: "row",
        rowId: `positive-${index}`,
        identityStatus: "confirmed_match",
      })),
      { recordType: "row", rowId: "unresolved-control", identityStatus: "unverifiable" },
    ],
  };
}

function manifest() {
  return {
    rows: [
      ...Array.from({ length: 79 }, (_, index) => ({
        rowId: `positive-${index}`,
        googleNewsUrl: `https://news.google.com/rss/articles/id-${index}?token=private-${index}`,
      })),
      {
        rowId: "unresolved-control",
        get googleNewsUrl() {
          throw new Error("unresolved row data was accessed");
        },
        get title() {
          throw new Error("unresolved title was accessed");
        },
      },
    ],
  };
}

function response(status, location = null) {
  return {
    status,
    headers: {
      get(name) {
        return name === "location" ? location : null;
      },
    },
    body: { async cancel() {} },
  };
}

test("selects exactly the historical positive controls and does not inspect unresolved row data", () => {
  const controls = selectPositiveControls(manifest(), labels());
  assert.equal(positiveControlIds(labels()).size, 79);
  assert.equal(controls.length, 79);
  assert.ok(controls.every((row) => row.rowId.startsWith("positive-")));
});

test("redacts dynamic host/path/query data to origin and path shapes", () => {
  const shape = sanitizedUrlShape(
    "https://consent.google.com/consent/AbC987XYZ?continue=https%3A%2F%2Fprivate.example%2Fsecret",
  );
  assert.deepEqual(shape, {
    origin: "https://consent.google.com",
    pathShape: "/letters/letters-and-digits",
  });
  assert.equal(JSON.stringify(shape).includes("AbC987XYZ"), false);
  assert.equal(JSON.stringify(shape).includes("private.example"), false);
});

test("reports missing and malformed redirect locations without retaining their values or fetching another hop", async () => {
  for (const scenario of [
    { location: null, reason: "redirect_location_missing", secret: null },
    {
      location: "https://[PRIVATE_DYNAMIC_HOST?token=private-value",
      reason: "redirect_location_malformed",
      secret: "PRIVATE_DYNAMIC_HOST",
    },
  ]) {
    const controls = selectPositiveControls(manifest(), labels());
    let requests = 0;
    const report = await runRedirectDiagnostic(controls, async () => {
      requests += 1;
      return response(302, scenario.location);
    });
    assert.equal(requests, 79);
    assert.equal(report.requestsAttempted, 79);
    assert.equal(report.rowsWithRedirect, 79);
    assert.equal(report.observations.length, 1);
    assert.equal(report.observations[0].rejectionReason, scenario.reason);
    assert.equal(report.observations[0].status, 302);
    assert.equal(report.observations[0].hop, 0);
    assert.equal(report.observations[0].count, 79);
    assert.equal(report.observations[0].destinationOrigin, null);
    const serialized = JSON.stringify(report);
    if (scenario.secret) assert.equal(serialized.includes(scenario.secret), false);
    assert.equal(serialized.includes("private-value"), false);
  }
});

test("follows no more than five allowed redirects and cancels each response without reading it", async () => {
  const controls = selectPositiveControls(manifest(), labels());
  let requests = 0;
  let canceled = 0;
  const report = await runRedirectDiagnostic(controls, async (_url, options) => {
    requests += 1;
    assert.equal(options.redirect, "manual");
    return {
      status: 302,
      headers: {
        get(name) {
          return name === "location"
            ? "https://news.google.com/redirect/secret-id?token=secret"
            : null;
        },
      },
      body: {
        async cancel() {
          canceled += 1;
        },
      },
    };
  });
  assert.equal(requests, 79 * 6);
  assert.equal(canceled, requests);
  assert.equal(report.requestsAttempted, requests);
  assert.equal(report.rowsCompleted, 79);
  assert.equal(
    report.observations
      .filter((item) => item.rejectionReason === "redirect_limit")
      .reduce((n, item) => n + item.count, 0),
    79,
  );
  assert.equal(
    report.observations
      .filter((item) => item.rejectionReason === "allowed_google_redirect")
      .reduce((n, item) => n + item.count, 0),
    79 * 5,
  );
  assert.equal(JSON.stringify(report).includes("secret-id"), false);
  assert.equal(JSON.stringify(report).includes("secret"), false);
});

test("only requests selected controls, stops before a disallowed hop, and retains aggregate sanitized evidence", async () => {
  const controls = selectPositiveControls(manifest(), labels());
  const requested = [];
  const report = await runRedirectDiagnostic(controls, async (url, options) => {
    requested.push(url);
    assert.equal(options.redirect, "manual");
    assert.ok(options.signal);
    return response(
      302,
      "https://consent.google.com/consent/DYNAMIC_PRIVATE_ID?token=private-token",
    );
  });
  assert.equal(requested.length, 79);
  assert.ok(requested.every((url) => url.startsWith("https://news.google.com/")));
  assert.equal(report.controlsSelected, 79);
  assert.equal(report.rowsCompleted, 79);
  assert.equal(report.requestsAttempted, 79);
  assert.equal(report.rowsWithRedirect, 79);
  assert.equal(
    report.observations.reduce((sum, item) => sum + item.count, 0),
    79,
  );
  assert.ok(
    report.observations.every((item) => item.rejectionReason === "unexpected_redirect_destination"),
  );
  const serialized = JSON.stringify(report);
  for (const secret of [
    "private-token",
    "DYNAMIC_PRIVATE_ID",
    "another-private-id",
    "unresolved-control",
    "positive-0",
  ]) {
    assert.equal(serialized.includes(secret), false);
  }
});

test("enforces the positive-control input boundary before accepting a run", async () => {
  await assert.rejects(runRedirectDiagnostic([]), /only the 79 historical positive controls/);
});
