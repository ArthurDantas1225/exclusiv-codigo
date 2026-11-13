import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
test('manual Pix freezes receiver, audits confirmation and denies public writes',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create table public.catalog_orders(id uuid primary key,payment text,total bigint,status text default 'pending',updated_at timestamptz default now());`);
 await db.exec(readFileSync(new URL('../supabase-catalog/migrations/20261113123000_inter_manual_pix.sql',import.meta.url),'utf8'));
 const id='11111111-1111-4111-8111-111111111111',actor='22222222-2222-4222-8222-222222222222';
 await db.exec(`insert into catalog_orders(id,payment,total) values('${id}','Pix',1000)`);
 assert.equal((await db.query<{payment_status:string}>(`select payment_status from catalog_orders`)).rows[0].payment_status,'not_required');
 await db.exec(`update catalog_pix_settings set key='123e4567-e89b-12d3-a456-426614174000',receiver_name='EXCLUSIV',city='PATU',enabled=true;delete from catalog_orders;insert into catalog_orders(id,payment,total) values('${id}','Pix',12345)`);
 const snapshot=(await db.query<{payment_status:string,pix_snapshot:{key:string}}>('select payment_status,pix_snapshot from catalog_orders')).rows[0];
 assert.equal(snapshot.payment_status,'awaiting_verification');
 await db.exec(`update catalog_pix_settings set key='123e4567-e89b-12d3-a456-426614174001'`);
 assert.equal((await db.query<{key:string}>('select pix_snapshot->>\'key\' key from catalog_orders')).rows[0].key,snapshot.pix_snapshot.key);
 await db.query('select mark_catalog_pix_paid($1,$2)',[id,actor]);
 const paid=(await db.query<{payment_status:string,payment_confirmed_by:string,payment_confirmed_at:Date}>('select payment_status,payment_confirmed_by,payment_confirmed_at from catalog_orders')).rows[0];
 assert.equal(paid.payment_status,'paid');assert.equal(paid.payment_confirmed_by,actor);
 await db.query('select mark_catalog_pix_paid($1,$2)',[id,id]);
 assert.equal((await db.query<{payment_confirmed_by:string}>('select payment_confirmed_by from catalog_orders')).rows[0].payment_confirmed_by,actor);
 await db.exec('set role anon');
 await assert.rejects(db.query('select * from catalog_pix_settings'),/permission denied/);
 await assert.rejects(db.query('select mark_catalog_pix_paid($1,$2)',[id,actor]),/permission denied/);
 }finally{await db.close();}
});
