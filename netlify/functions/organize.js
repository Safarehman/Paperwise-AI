// netlify/functions/organize.js
// Relays a page image to Claude and returns organized JSON.
// The API key lives ONLY here (server-side), never in the browser.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

const PROMPT = `You are a document organizer. Read this photo of a page and return ONLY a JSON object (no code fences, no commentary).

IMPORTANT: capture EVERY sentence on the page. Never summarize, shorten, or drop any text. If unsure whether to include something, include it.

Return this shape:
{"title":"short title","date":"","tag":"","sections":[ { "kind":"...", "heading":"...", ...fields } ]}

Section kinds (use the one that fits; include ONLY that kind's fields):
- "para" -> a paragraph OR a quotation. Put the COMPLETE text in "text". Represent quotes here, including the full quote and who said it.
- "list" -> bullet points. "items": ["...", "..."]
- "numbered" -> numbered steps. "items": ["...", "..."]
- "table" -> "columns": ["..."], "rows": [["..."]], and "totalRow": true only if the last row is a total.
- "callout" -> a SHORT highlighted note such as a date, deadline, or reminder. Put its text in "lines": ["..."]. Never output a callout with empty lines.

Rules:
- Every section needs a brief "heading". If none is natural, write a short descriptive one.
- Transcribe numbers, names, and quotations exactly as written.
- Prefer "para" for any block of prose longer than one short line; only use "callout" for brief highlighted notes.
- Return valid JSON only.`;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  try {
    const { image, mediaType } = JSON.parse(event.body || "{}");
    if (!image) return { statusCode: 400, body: JSON.stringify({ error: "No image provided" }) };

    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: image } },
          { type: "text", text: PROMPT },
        ] }],
      }),
    });

    const data = await res.json();
    if (data.error) return { statusCode: 502, body: JSON.stringify({ error: data.error.message }) };
    const text = (data.content || []).map((b) => (b.type === "text" ? b.text : "")).join("");
    return { statusCode: 200, headers: { "content-type": "application/json" }, body: JSON.stringify({ result: text }) };
  } catch {
    return { statusCode: 500, body: JSON.stringify({ error: "Failed to process the page." }) };
  }
};
