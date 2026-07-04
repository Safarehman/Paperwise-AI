// netlify/functions/customize.js
// Relays the "Customize with AI" design request to Claude.
// The client builds the full instruction; this function just adds the key.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  try {
    const { prompt } = JSON.parse(event.body || "{}");
    if (!prompt) return { statusCode: 400, body: JSON.stringify({ error: "No prompt provided" }) };

    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await res.json();
    if (data.error) return { statusCode: 502, body: JSON.stringify({ error: data.error.message }) };
    const text = (data.content || []).map((b) => (b.type === "text" ? b.text : "")).join("");
    return { statusCode: 200, headers: { "content-type": "application/json" }, body: JSON.stringify({ result: text }) };
  } catch {
    return { statusCode: 500, body: JSON.stringify({ error: "Customize request failed." }) };
  }
};
