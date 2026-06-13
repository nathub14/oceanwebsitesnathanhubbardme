import { onRequestPost } from '../functions/api/contact.js';
const mk = body => new Request('http://x/api/contact', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
async function run(label, body, env, expect) {
  const res = await onRequestPost({ request: mk(body), env });
  const j = await res.json();
  const pass = res.status === expect;
  console.log(`${pass?'PASS':'FAIL'}  ${label}  -> ${res.status} ${JSON.stringify(j)}`);
}
await run('no API key (offline)', {name:'A',email:'a@b.com',message:'hi'}, {}, 503);
await run('honeypot bot',        {name:'A',email:'a@b.com',message:'hi',depth:'x'}, {RESEND_API_KEY:'k'}, 200);
await run('bad email',           {name:'A',email:'nope',message:'hi'}, {RESEND_API_KEY:'k'}, 422);
await run('empty message',       {name:'A',email:'a@b.com',message:''}, {RESEND_API_KEY:'k'}, 422);
await run('missing name',        {email:'a@b.com',message:'hi'}, {RESEND_API_KEY:'k'}, 422);
