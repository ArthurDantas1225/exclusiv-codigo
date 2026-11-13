import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { validPushSubscription, orderPushPayload } from '../supabase-catalog/functions/_shared/team-push.ts';

const subscription = { endpoint: 'https://web.push.apple.com/Qwebpush/test', keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) } };
test('push endpoints only accept trusted HTTPS browser push services', () => {
  assert.equal(validPushSubscription(subscription), true);
  for (const endpoint of ['http://web.push.apple.com/a', 'https://localhost/a', 'https://169.254.169.254/a', 'https://web.push.apple.com.attacker.test/a', 'https://web.push.apple.com:8443/a', 'https://user:password@web.push.apple.com/a']) assert.equal(validPushSubscription({ ...subscription, endpoint }), false);
  assert.equal(validPushSubscription({ ...subscription, keys: { auth: 'bad', p256dh: 'bad' } }), false);
});
test('team notices distinguish manual payment review and confirmation without customer details', () => {
  const event = { id: 'event', order_id: 'order', code: 'EXC-123', payment_status: 'awaiting_verification' };
  assert.match(orderPushPayload(event).body, /confira o recebimento no Inter/);
  assert.match(orderPushPayload({ ...event, payment_status: 'paid' }).body, /confirmado pela equipe/);
  assert.equal(orderPushPayload(event).url, '/app/pedidos');
});

test('outbox records each payment transition once and leases retries without blocking orders', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role; create schema net; create function net.http_post(url text, headers jsonb, body jsonb, timeout_milliseconds integer) returns bigint language sql as 'select 1::bigint'; create schema cron; create function cron.schedule(text,text,text) returns bigint language sql as 'select 1::bigint'; create table public.catalog_orders(id uuid primary key,code text,payment_status text);`);
    const source = readFileSync(new URL('../supabase-catalog/migrations/20261113124000_team_notifications.sql', import.meta.url), 'utf8').replace(/^create extension[^\n]+\n/gm, '');
    await db.exec(source);
    await db.exec(`insert into catalog_orders values('11111111-1111-4111-8111-111111111111','EXC-TEST','awaiting_verification'); update catalog_orders set payment_status='awaiting_verification'; update catalog_orders set payment_status='paid'; update catalog_orders set payment_status='paid';`);
    assert.equal((await db.query<{ n: number }>('select count(*)::int n from catalog_notification_outbox')).rows[0].n, 2);
    assert.equal((await db.query('select * from catalog_claim_notifications()')).rows.length, 2);
    assert.equal((await db.query('select * from catalog_claim_notifications()')).rows.length, 0);
    const privileges = await db.query<{ allowed: boolean }>(`select has_table_privilege('anon','catalog_push_config','select') as allowed`);
    assert.equal(privileges.rows[0].allowed, false);
  } finally { await db.close(); }
});

test('notification boundary rejects missing dispatch secret and inactive team sessions', async () => {
  const source = readFileSync(new URL('../supabase-catalog/functions/team-notifications/index.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/^import .*;\r?\n/gm, '');
  let handler: (request: Request) => Promise<Response>;
  const config = { enabled: true, dispatch_secret: 'valid'.repeat(12), vapid_public_key: 'public', vapid_private_key: 'private' };
  const query = { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: config }; } };
  const erp = { auth: { getUser: async () => ({ data: { user: { id: 'staff' } } }) }, from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }) }) };
  vm.runInNewContext(compiled, { crypto, Request, Response, TextEncoder, Uint8Array, Map, Date, createClient: (url: string) => url.includes('catalog.test') ? { from: () => query } : erp, webpush: { setVapidDetails: () => { throw new Error('Must not dispatch'); } }, Deno: { env: { get: (key: string) => key === 'SUPABASE_URL' ? 'https://catalog.test' : 'server-key' }, serve: (fn: typeof handler) => { handler = fn; } }, validPushSubscription, orderPushPayload });
  const send = (body: object, headers: Record<string, string> = {}) => handler!(new Request('https://catalog.test/functions/v1/team-notifications', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }));
  assert.equal((await send({ action: 'dispatch' })).status, 403);
  assert.equal((await send({ action: 'dispatch' }, { 'x-dispatch-secret': 'wrong' })).status, 403);
  assert.equal((await send({ action: 'subscribe', subscription })).status, 401);
  assert.equal((await send({ action: 'subscribe', subscription }, { authorization: 'Bearer staff' })).status, 403);
});

// Membership lookup requires the internal secret and never discloses another tenant.
test('ERP notification membership rejects wrong secrets and inactive or foreign users', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role; create table profiles(id uuid primary key,active boolean,organization_id uuid);`);
    await db.exec(readFileSync(new URL('../supabase/migrations/20261113124000_catalog_notification_membership.sql', import.meta.url), 'utf8'));
    await db.exec(`insert into catalog_notifications.dispatch_config values(true,repeat('x',43)); insert into profiles values('11111111-1111-4111-8111-111111111111',true,'f993c345-a8ed-4ea4-a91d-b0f7f7946151');`);
    const member = async (secret: string) => (await db.query<{ ok: boolean }>('select is_catalog_notification_member($1,$2) ok', ['11111111-1111-4111-8111-111111111111',secret])).rows[0].ok;
    assert.equal(await member('x'.repeat(43)), true);
    assert.equal(await member('wrong'), false);
    await db.exec('update profiles set active=false');
    assert.equal(await member('x'.repeat(43)), false);
    await db.exec(`update profiles set active=true, organization_id='22222222-2222-4222-8222-222222222222'`);
    assert.equal(await member('x'.repeat(43)), false);
  } finally { await db.close(); }
});
