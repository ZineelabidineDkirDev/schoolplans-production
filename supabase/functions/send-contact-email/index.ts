import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function corsHeaders(origin: string | null) {
  const permittedOrigin = origin && allowedOrigins.includes(origin)
    ? origin
    : (allowedOrigins[0] ?? "null");
  return {
    "Access-Control-Allow-Origin": permittedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8",
  };
}

function json(status: number, body: Record<string, unknown>, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) });
}

serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders(origin) });
  }

  console.log("send-contact-email request", {
    method: req.method,
    origin,
    allowedOriginCount: allowedOrigins.length,
  });

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" }, origin);
  }

  if (allowedOrigins.length && origin && !allowedOrigins.includes(origin)) {
    console.warn("Contact email rejected: origin not allowed", { origin });
    return json(403, { error: "Origin not allowed" }, origin);
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const recipient = Deno.env.get("CONTACT_EMAIL") ?? "zainmawada@gmail.com";
  const sender = Deno.env.get("RESEND_FROM_EMAIL") ?? "Madrassa-Ti <onboarding@resend.dev>";

  // Never log secret values. Log only whether the required setting is present.
  console.log("Contact email configuration", {
    hasResendApiKey: Boolean(apiKey),
    hasRecipient: Boolean(recipient),
    hasSender: Boolean(sender),
  });

  if (!apiKey) {
    console.error("Contact email not sent: RESEND_API_KEY is missing");
    return json(503, { error: "Configuration email incomplète : RESEND_API_KEY est absent." }, origin);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" }, origin);
  }

  const fields = ["type", "name", "email", "phone", "subject", "message"] as const;
  const values = Object.fromEntries(fields.map((field) => [field, String(body[field] ?? "").trim()]));
  const limits: Record<(typeof fields)[number], number> = {
    type: 80,
    name: 100,
    email: 254,
    phone: 30,
    subject: 120,
    message: 4000,
  };

  for (const field of fields) {
    if (!values[field] || values[field].length > limits[field]) {
      return json(400, { error: `Champ invalide : ${field}` }, origin);
    }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    return json(400, { error: "Adresse e-mail invalide." }, origin);
  }

  const safe = (value: string) => value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char] ?? char);

  const html = `
    <h2>Nouvelle demande depuis Madrassa-Ti</h2>
    <p><strong>Type :</strong> ${safe(values.type)}</p>
    <p><strong>Nom :</strong> ${safe(values.name)}</p>
    <p><strong>E-mail :</strong> ${safe(values.email)}</p>
    <p><strong>Téléphone :</strong> ${safe(values.phone)}</p>
    <p><strong>Sujet :</strong> ${safe(values.subject)}</p>
    <p><strong>Message :</strong></p>
    <p style="white-space:pre-wrap">${safe(values.message)}</p>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender,
        to: [recipient],
        reply_to: values.email,
        subject: `Madrassa-Ti — ${values.type}: ${values.subject}`.slice(0, 180),
        html,
      }),
    });

    const responseText = await response.text();
    let resendResult: Record<string, unknown> = {};
    try {
      resendResult = responseText ? JSON.parse(responseText) : {};
    } catch {
      // Keep the response body out of the client response if it isn't valid JSON.
    }

    if (!response.ok) {
      const providerMessage = typeof resendResult.message === "string"
        ? resendResult.message
        : typeof resendResult.error === "string"
        ? resendResult.error
        : "Resend a refusé l'envoi.";
      console.error("Resend rejected contact email", {
        status: response.status,
        name: typeof resendResult.name === "string" ? resendResult.name : undefined,
        message: providerMessage,
      });
      return json(502, {
        error: "Resend a refusé l'envoi.",
        providerStatus: response.status,
        detail: providerMessage.slice(0, 300),
      }, origin);
    }

    const resendId = typeof resendResult.id === "string" ? resendResult.id : null;
    console.log("Resend accepted contact email", {
      status: response.status,
      resendId,
      recipientDomain: recipient.split("@")[1] ?? "unknown",
    });

    if (!resendId) {
      console.warn("Resend returned success without an email id", { status: response.status });
      return json(502, { error: "Resend n'a pas retourné d'identifiant d'e-mail. Consultez les logs Supabase." }, origin);
    }

    return json(200, { ok: "true", id: resendId }, origin);
  } catch (error) {
    console.error("Contact email request failed before Resend confirmed delivery", {
      message: error instanceof Error ? error.message : String(error),
    });
    return json(502, { error: "Impossible de contacter le service d'e-mail. Consultez les logs Supabase." }, origin);
  }
});
