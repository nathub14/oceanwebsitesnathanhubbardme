// Cloudflare Pages Function — POST /api/contact
// Sends the contact message via the Resend API.
// RESEND_API_KEY is injected as an environment variable at deploy time.

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function esc(s = '') {
  return String(s).replace(/[<>&"']/g, c => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export async function onRequestPost({ request, env }) {
  let data;
  try {
    data = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Malformed request.' }), {
      status: 400, headers: JSON_HEADERS,
    });
  }

  const name = (data.name || '').toString().trim();
  const email = (data.email || '').toString().trim();
  const message = (data.message || '').toString().trim();
  // Honeypot — bots fill hidden fields; humans never see it.
  const trap = (data.depth || '').toString().trim();

  if (trap) {
    // Pretend success so the bot moves on.
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: JSON_HEADERS });
  }

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!name || name.length > 120 || !emailOk || !message || message.length > 5000) {
    return new Response(JSON.stringify({ ok: false, error: 'Please check your name, email, and message.' }), {
      status: 422, headers: JSON_HEADERS,
    });
  }

  if (!env.RESEND_API_KEY) {
    return new Response(JSON.stringify({ ok: false, error: 'The transmitter is offline. Try again later.' }), {
      status: 503, headers: JSON_HEADERS,
    });
  }

  // Configurable at deploy time; sensible defaults for first deploy.
  const TO = env.CONTACT_TO || 'hubbard_nathan@outlook.com';
  const FROM = env.CONTACT_FROM || 'Abyssal <onboarding@resend.dev>';

  const body = {
    from: FROM,
    to: [TO],
    reply_to: email,
    subject: `Transmission from ${name} — abyssal`,
    html: `
      <div style="font-family:ui-monospace,Menlo,Consolas,monospace;background:#04080f;color:#cfe6f2;padding:28px;border-radius:10px;max-width:560px">
        <p style="letter-spacing:.18em;color:#3fd0c8;font-size:11px;margin:0 0 18px">◢ INCOMING TRANSMISSION</p>
        <p style="margin:0 0 6px"><strong style="color:#8fb7c9">FROM</strong>&nbsp;&nbsp;${esc(name)}</p>
        <p style="margin:0 0 6px"><strong style="color:#8fb7c9">CHANNEL</strong>&nbsp;&nbsp;${esc(email)}</p>
        <hr style="border:none;border-top:1px solid #16303f;margin:18px 0">
        <p style="white-space:pre-wrap;line-height:1.6;color:#e6f3f8;margin:0">${esc(message)}</p>
      </div>`,
    text: `Incoming transmission\nFrom: ${name}\nChannel: ${email}\n\n${message}`,
  };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error('Resend error', res.status, detail);
      return new Response(JSON.stringify({ ok: false, error: 'The message could not be sent. Please try again.' }), {
        status: 502, headers: JSON_HEADERS,
      });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: JSON_HEADERS });
  } catch (err) {
    console.error('contact handler failure', err);
    return new Response(JSON.stringify({ ok: false, error: 'Network fault. Please try again.' }), {
      status: 500, headers: JSON_HEADERS,
    });
  }
}

// Reject non-POST methods cleanly.
export async function onRequest({ request }) {
  if (request.method === 'POST') return; // handled by onRequestPost
  return new Response(JSON.stringify({ ok: false, error: 'Method not allowed.' }), {
    status: 405, headers: { ...JSON_HEADERS, Allow: 'POST' },
  });
}
