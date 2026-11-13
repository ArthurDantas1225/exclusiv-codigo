import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPixPayload, normalizePixSettings } from '../supabase-catalog/functions/_shared/inter-pix.ts';
const settings={enabled:true,key:'123e4567-e89b-12d3-a456-426614174000',receiverName:'EXCLUSIV',city:'NATAL'};
function fields(payload:string){const map=new Map<string,string>();for(let i=0;i<payload.length;){const id=payload.slice(i,i+2),len=Number(payload.slice(i+2,i+4));map.set(id,payload.slice(i+4,i+4+len));i+=4+len;}return map;}
test('Pix uses saved key, exact cents and unique order reference in valid EMV fields',()=>{
 const payload=buildPixPayload(settings,12345,'EXC-1234ABCD');const f=fields(payload);
 assert.equal(f.get('54'),'123.45');assert.equal(f.get('59'),'EXCLUSIV');assert.equal(f.get('60'),'NATAL');
 assert.equal(fields(f.get('26')!).get('01'),settings.key);assert.equal(fields(f.get('62')!).get('05'),'EXC1234ABCD');
 // Independent CRC-16/CCITT-FALSE verification over complete message including checksum.
 const checksum=parseInt(payload.slice(-4),16);let crc=65535;for(const byte of new TextEncoder().encode(payload.slice(0,-4))){crc^=byte<<8;for(let bit=0;bit<8;bit++)crc=(crc&32768)?(crc<<1)^4129:crc<<1;crc&=65535;}
 assert.equal(checksum,crc);
});
test('Pix rejects missing key, invalid money and receiver configuration',()=>{
 assert.throws(()=>normalizePixSettings({...settings,key:'CPF'}));
 assert.throws(()=>normalizePixSettings({...settings,receiverName:''}));
 for(const amount of [0,-1,1.2,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>buildPixPayload(settings,amount,'EXC-1234'));
 assert.throws(()=>buildPixPayload({...settings,enabled:false},100,'EXC-1234'));
 assert.equal(normalizePixSettings({...settings,receiverName:'José da Silva',city:'São Paulo'}).receiverName,'JOSE DA SILVA');
});
