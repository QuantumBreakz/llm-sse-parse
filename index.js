/**
 * Parse a Server-Sent Events byte stream into events. Handles events split across chunks (mid-line, mid-JSON,
 * mid-character), CRLF split between chunks, comments and multi-line data, as the HTML standard defines them.
 * @param {AsyncIterable<Uint8Array>} stream for example `response.body` from fetch
 * @returns {AsyncGenerator<{ event: string, data: string }>}
 */
export async function* parseSSE(stream) {
  const decoder = new TextDecoder();
  let buffer = "";
  let event = { event: "message", data: [] };
  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true });
    let newline;
    while ((newline = buffer.search(/\r\n|\r|\n/)) !== -1) {
      if (newline === buffer.length - 1 && buffer.endsWith("\r")) break; // might be half of a CRLF: wait for more
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + (buffer.startsWith("\r\n", newline) ? 2 : 1));
      if (line === "") {
        if (event.data.length) yield { event: event.event, data: event.data.join("\n") };
        event = { event: "message", data: [] };
        continue;
      }
      if (line.startsWith(":")) continue;
      const colon = line.indexOf(":");
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? "" : line.slice(colon + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      if (field === "data") event.data.push(value);
      else if (field === "event") event.event = value;
    }
  }
}

/**
 * Collect the text of an OpenAI-compatible chat completion stream (`choices[0].delta.content`), stopping at `[DONE]`.
 * @param {AsyncIterable<Uint8Array>} stream
 * @param {(delta: string) => void} [onDelta] called with each piece of text as it arrives
 * @returns {Promise<string>}
 */
export async function streamText(stream, onDelta = () => {}) {
  let text = "";
  for await (const { data } of parseSSE(stream)) {
    if (data === "[DONE]") break;
    const delta = JSON.parse(data).choices?.[0]?.delta?.content ?? "";
    text += delta;
    onDelta(delta);
  }
  return text;
}
