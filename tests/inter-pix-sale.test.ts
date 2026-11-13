import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';
import { parsePromotions, calculatePromotions } from '../supabase/functions/_shared/promotions.ts';
async function run(method:string){
 let handler:(request:Request)=>Promise<Response>;let sales=0;
 const variant='11111111-1111-4111-8111-111111111111', orderId='22222222-2222-4222-8222-222222222222';
 const fetcher:typeof fetch=async(input,init)=>{
  const url=String(input);
  if(url.includes('catalog-orders'))return Response.json({order:{id:orderId,status:'pending',payment_status:'paid',subtotal:100,total:100,promotion_discount:0,promotion_version:0,promotion_campaign_ids:[],catalog_order_items:[{variant_id:variant,quantity:1,unit_price:100}]}});
  if(url.includes('/auth/v1/user'))return Response.json({id:'actor'});
  if(url.includes('/profiles'))return Response.json([{organization_id:'org',role:'admin',active:true}]);
  if(url.includes('/operation_keys'))return Response.json([]);
  if(url.includes('/product_variants'))return Response.json([{id:variant,product_id:variant,stock:10,products:{id:variant,category:'Camisetas',subcategory:'',price:100,active:true}}]);
  if(url.includes('/app_settings'))return Response.json([{value:{version:0,campaigns:[]}}]);
  if(url.includes('/rpc/sale_with_promotions')){assert.equal(new Headers(init?.headers).get('authorization'),'Bearer team-session');sales++;return Response.json({id:'sale-id'});}
  throw new Error(new URL(url).pathname);
 };
 const code=ts.transpileModule(readFileSync(new URL('../supabase/functions/sale-with-promotions/index.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/^import .*;\r?\n/gm,'');
 vm.runInNewContext(code,{Request,Response,URL,fetch:fetcher,parsePromotions,calculatePromotions,createClient:(url:string,key:string,options:Record<string,unknown>)=>createClient(url,key,{...options,global:{...((options.global??{})as object),fetch:fetcher}}),Deno:{env:{get:(key:string)=>key==='SUPABASE_URL'?'https://erp.test':'test-service'},serve:(callback:typeof handler)=>{handler=callback;}}});
 const response=await handler!(new Request('https://erp.test',{method:'POST',headers:{authorization:'Bearer team-session','content-type':'application/json'},body:JSON.stringify({request_id:orderId,promotion_source:'catalog',promotion_order_id:orderId,promotion_version:0,promotion_discount:0,discount:0,items:[{variant_id:variant,quantity:1,unit_price:100}],payments:[{method,amount:100}]})}));
 return {status:response.status,sales};
}
test('paid Inter Pix cannot be recorded as cash or card',async()=>{for(const method of ['Dinheiro','Crédito'])assert.deepEqual(await run(method),{status:409,sales:0});assert.deepEqual(await run('Pix'),{status:200,sales:1});});
