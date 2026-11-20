# llm-sse-parse

Parse streamed LLM responses (**Server-Sent Events**) correctly in Node.js and browsers. Zero dependencies, typed, about 40 lines.

Network chunks don't line up with SSE events. A chunk can end in the middle of a JSON object, in the middle of a multi-byte character, or between the `\r` and `\n` of a line ending. Code that does `chunk.split("\n")` works locally and breaks in production. This parser buffers until a full line arrives, decodes with a streaming `TextDecoder`, and dispatches an event only on the blank line that ends it.

## Install

```bash
npm install llm-sse-parse
```

## Usage

```js
import { parseSSE, streamText } from "llm-sse-parse";

const response = await fetch(url, { method: "POST", headers, body: JSON.stringify({ ...request, stream: true }) });

// Any SSE stream: named events and their data.
for await (const { event, data } of parseSSE(response.body)) {
  console.log(event, data);
}

// Or, for OpenAI-compatible chat completions: the full text, with each delta as it arrives.
const text = await streamText(response.body, (delta) => process.stdout.write(delta));
```

`parseSSE` takes any async iterable of bytes, including `response.body` from `fetch`. `streamText` reads `choices[0].delta.content` and stops at `data: [DONE]`; for providers with a different event shape, use `parseSSE` and read the fields you need.

## What it handles

- Events split across chunks, mid-line and mid-JSON
- Multi-byte UTF-8 characters split between chunks
- `\n`, `\r\n` and `\r` line endings, including a CRLF split between two chunks
- `:` comment lines (keep-alives), `event:` names, multi-line `data:`
- An unfinished event at the end of the stream is not dispatched, as the HTML standard requires

It ignores `id:` and `retry:`, which matter for browser reconnection, not for LLM streams.

## Background

How the parser works, the CRLF bug it fixes, and what to do with mid-stream errors: [Parsing a streamed LLM response in Node.js](https://aliahmed.si/blog/parse-sse-llm-stream-nodejs/). To stop paying for tokens when the user leaves: [Cancel the LLM call when the client disconnects](https://aliahmed.si/blog/cancel-llm-request-client-disconnect-nodejs/). More: [Production LLM engineering guide](https://aliahmed.si/topics/production-llm-engineering/).

## License

MIT
