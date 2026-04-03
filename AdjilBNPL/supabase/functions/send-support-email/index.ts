// @ts-nocheck
/// <reference lib="deno.ns" />
// Supabase Edge Function (Deno) - Send support email on new ticket
// Expects JSON: { id, user_email, subject, description, created_at }
// Uses RESEND_API_KEY to send email to Adjil.BNPL@gmail.com
 
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SUPPORT_EMAIL = "Adjil.BNPL@gmail.com";

async function sendEmail(subject: string, text: string, toEmail: string) {
  if (!RESEND_API_KEY) {
    return { ok: false, error: "missing_resend_api_key" };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "Adjil Support <no-reply@adjil.dz>",
      to: [toEmail],
      subject,
      text
    })
  });
  if (!res.ok) {
    const errText = await res.text();
    return { ok: false, error: errText };
  }
  const data = await res.json();
  return { ok: true, data };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }
  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const type = String(payload.type || "support");
  const id = String(payload.id || "");
  const userEmail = String(payload.user_email || "");
  const subject = String(payload.subject || (type === "low_balance" ? "تنبيه: رصيدك في آجل قارب على الانتهاء" : "تذكرة دعم جديدة"));
  const description = String(payload.description || "");
  const createdAt = String(payload.created_at || "");
  const toEmail = String(payload.to_email || SUPPORT_EMAIL);

  const bodyText = type === "low_balance"
    ? (
      `تنبيه رصيد منخفض\n\n` +
      `البريد: ${userEmail}\n` +
      `الوصف:\n${description}\n\n` +
      `—\nمنصة آجل (Adjil BNPL)`
    )
    : (
      `تذكرة دعم جديدة\n\n` +
      `رقم التذكرة: ${id}\n` +
      `البريد المرسل: ${userEmail}\n` +
      `الموضوع: ${subject}\n` +
      `الوصف:\n${description}\n\n` +
      `تاريخ الإنشاء: ${createdAt}\n` +
      `—\nمنصة آجل (Adjil BNPL)`
    );

  const result = await sendEmail(`[Adjil Support] ${subject}`, bodyText, toEmail);
  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.error }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
  return new Response(JSON.stringify({ ok: true, id }), { status: 200, headers: { "Content-Type": "application/json" } });
});
