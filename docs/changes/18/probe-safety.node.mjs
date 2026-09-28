import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { Readable } from "node:stream";
import {
  addressIsPublic,
  boundedNodePrefix,
  createPinnedLookup,
  resolvePublicHttpTarget,
  resolveRedirectUrl,
} from "./probe-network.mjs";
import { classifyIdentity, cleanTitle, decodeEntities, normalizeTitle } from "./probe-title.mjs";

test("public-address filter rejects private and special IPv4/IPv6 ranges", () => {
  for (const address of [
    "0.1.2.3",
    "10.0.0.1",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.0.2.1",
    "198.18.0.1",
    "224.0.0.1",
    "::",
    "::1",
    "fc00::1",
    "fe80::1",
    "ff02::1",
    "2001:db8::1",
    "::ffff:127.0.0.1",
  ]) {
    assert.equal(addressIsPublic(address), false, address);
  }
  assert.equal(addressIsPublic("93.184.216.34"), true);
  assert.equal(addressIsPublic("2606:4700:4700::1111"), true);
});

test("candidate and redirect targets resolving to private addresses are rejected", async () => {
  const resolver = async () => [{ address: "10.0.0.4", family: 4 }];
  const candidate = await resolvePublicHttpTarget("https://publisher.example.org/article", {
    resolver,
  });
  assert.deepEqual(candidate, { ok: false, reason: "non_public_dns_address" });
  const redirect = resolveRedirectUrl(
    "http://127.0.0.1/admin",
    "https://publisher.example.org/article",
  );
  const redirectCheck = await resolvePublicHttpTarget(redirect);
  assert.deepEqual(redirectCheck, { ok: false, reason: "non_public_dns_address" });
});

test("pinned lookup reuses validated A/AAAA answers without a second DNS lookup", async () => {
  let dnsLookups = 0;
  const resolver = async () => {
    dnsLookups++;
    return [{ address: "93.184.216.34", family: 4 }];
  };
  const target = await resolvePublicHttpTarget("https://publisher.example.org/article", {
    resolver,
  });
  assert.equal(target.ok, true);
  const lookup = createPinnedLookup(target);
  const result = await new Promise((resolve, reject) =>
    lookup("publisher.example.org", { all: true }, (error, addresses) =>
      error ? reject(error) : resolve(addresses),
    ),
  );
  assert.deepEqual(result, [{ address: "93.184.216.34", family: 4 }]);
  assert.equal(dnsLookups, 1);
});

test("soft hyphens and repeated HTML entities normalize to the expected title", () => {
  assert.equal(normalizeTitle("gov\u00adernment"), normalizeTitle("government"));
  assert.equal(cleanTitle("C&amp;amp;EN reporters"), "C&EN reporters");
  assert.equal(normalizeTitle("C&amp;amp;EN reporters"), normalizeTitle("C&EN reporters"));
});

test("invalid numeric entities fail soft and cannot confirm identity", () => {
  const malformed = "Headline &#xD800; and &#x110000; and &#99999999999999999999;";
  assert.equal(decodeEntities(malformed), malformed);
  assert.doesNotThrow(() => cleanTitle(malformed));
  assert.equal(
    classifyIdentity(
      "Expected title",
      "source.example",
      [{ kind: "og:title", value: malformed }],
      false,
    ).status,
    "unverifiable",
  );
});

test("bounded response reading retains the allowed prefix even when Content-Length is larger", async () => {
  const response = Readable.from([Buffer.from("0123456789")]);
  response.headers = { "content-length": "10", "content-encoding": "identity" };
  assert.deepEqual(await boundedNodePrefix(response, 4), { text: "0123", truncated: true });
});

test("one or conflicting nonmatching title signals remain unverifiable", () => {
  assert.equal(
    classifyIdentity("Expected", "source.example", [{ kind: "h1", value: "Other" }], false).status,
    "unverifiable",
  );
  assert.equal(
    classifyIdentity(
      "Expected",
      "source.example",
      [
        { kind: "h1", value: "Other" },
        { kind: "og:title", value: "Different" },
      ],
      false,
    ).status,
    "unverifiable",
  );
  assert.equal(
    classifyIdentity(
      "Expected",
      "source.example",
      [
        { kind: "h1", value: "Other" },
        { kind: "og:title", value: "Other" },
      ],
      false,
    ).status,
    "confirmed_mismatch",
  );
});
