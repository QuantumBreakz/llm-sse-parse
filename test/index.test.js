import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSSE, streamText } from "../index.js";

const enc = new TextEncoder();
const chunks = (...parts) =>
  (async function* () {
    for (const p of parts) yield typeof p === "string" ? enc.encode(p) : p;
  })();
const all = async (it) => {
  const out = [];
  for await (const e of it) out.push(e);
  return out;
};

test("event split mid-JSON", async () => {
  assert.deepEqual(await all(parseSSE(chunks('data: {"a"', ":1}\n", "\n"))), [{ event: "message", data: '{"a":1}' }]);
});

test("multi-byte character split between chunks", async () => {
  const bytes = enc.encode("data: café\n\n");
  assert.deepEqual(await all(parseSSE(chunks(bytes.slice(0, 10), bytes.slice(10)))), [{ event: "message", data: "café" }]);
});

test("CRLF, comments, named events, multi-line data", async () => {
  assert.deepEqual(await all(parseSSE(chunks(": keep-alive\r\n\r\nevent: usage\r\ndata: line1\r\ndata: line2\r\n\r\n"))), [
    { event: "usage", data: "line1\nline2" },
  ]);
});

test("half a CRLF at a chunk boundary is not an empty line", async () => {
  assert.deepEqual(await all(parseSSE(chunks("data: x\r", "\ndata: y\n\n"))), [{ event: "message", data: "x\ny" }]);
});

test("unfinished trailing event is not dispatched", async () => {
  assert.deepEqual(await all(parseSSE(chunks("data: partial\n"))), []);
});

test("streamText collects OpenAI-style deltas", async () => {
  const deltas = [];
  const text = await streamText(
    chunks(
      'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\ndata: {"choices":[{"del',
      'ta":{"content":"lo"}}]}\n\n',
      "data: [DONE]\n\n"
    ),
    (d) => deltas.push(d)
  );
  assert.equal(text, "Hello");
  assert.deepEqual(deltas.filter(Boolean), ["Hel", "lo"]);
});
