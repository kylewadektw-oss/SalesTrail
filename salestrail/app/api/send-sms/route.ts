import { NextRequest } from 'next/server';

// Optional: Twilio SMS support. Configure env vars to enable
// Required env:
// - TWILIO_ACCOUNT_SID
// - TWILIO_AUTH_TOKEN
// - TWILIO_FROM (e.g., +15551234567)
// - SMS_ALLOWED_ORIGINS (comma-separated allowed origins, optional)

export const runtime = 'nodejs';

function ok(json: any, init?: ResponseInit) {
  return new Response(JSON.stringify(json), { status: 200, headers: { 'Content-Type': 'application/json' }, ...init });
}
function bad(json: any, status = 400) {
  return new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function POST(req: NextRequest) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) {
    return bad({ error: 'SMS not configured' }, 501);
  }

  const origin = req.headers.get('origin') || '';
  const allowed = (process.env.SMS_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (allowed.length && !allowed.includes(origin)) {
    return bad({ error: 'Origin not allowed' }, 403);
  }

  let payload: { to?: string; body?: string } = {};
  try {
    payload = await req.json();
  } catch {}
  const to = (payload.to || '').toString();
  const body = (payload.body || '').toString();
  if (!to || !body) return bad({ error: 'Missing to or body' });

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body }).toString(),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return bad({ error: 'Twilio error', details: txt || res.statusText }, 502);
    }

    const data = await res.json();
    return ok({ ok: true, sid: data.sid });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return bad({ error: msg }, 500);
  }
}

export async function OPTIONS() {
  // Allow CORS preflight if desired
  const headers: Record<string, string> = { 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (process.env.SMS_ALLOWED_ORIGINS) {
    headers['Access-Control-Allow-Origin'] = process.env.SMS_ALLOWED_ORIGINS.split(',')[0] || '*';
  }
  return new Response(null, { status: 204, headers });
}
