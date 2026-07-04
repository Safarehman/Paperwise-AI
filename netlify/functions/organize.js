// netlify/functions/organize.js
// Relays a page image to Claude and returns organized JSON.
// The API key lives ONLY here (server-side), never in the browser.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

const PROMPT = `You are a document organizer. Read this photo and return ONLY JSON (no fences):
{"title":"...","date":"","tag":"","sections":[{"kind":"list|numbered|table|callout|para","heading":"...","items":["..."],"columns":["..."],"rows":[["..."]],"totalRow":false,"lines":["..."],"text":"..."}]}
Use only the fields each kind needs. Transcribe table numbers exactly; totalRow:true if last row is a total. Valid JSON only.`;

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
        max_tokens: 1200,
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
