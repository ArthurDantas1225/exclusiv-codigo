import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { normalizePixSettings } from "../supabase-catalog/functions/_shared/inter-pix.ts";
import { createRequire } from "node:module";
import { createClient as defaultCreateClient } from "@supabase/supabase-js";
const createClient: typeof defaultCreateClient = process.env.SUPABASE_TEST_CLIENT ? createRequire(import.meta.url)(process.env.SUPABASE_TEST_CLIENT).createClient : defaultCreateClient;

async function runBridge(token: string | null, active = true, body: Record<string, unknown> = { action: "list" }, paymentStatus = "not_required") {
  let handler: (request: Request) => Promise<Response>;
  const profileAuthorizations: string[] = [];
  let catalogReads = 0;
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    if (url.includes('/auth/v1/user')) {
      return headers.get('authorization') === 'Bearer team-session' ? Response.json({ id:'11111111-1111-4111-8111-111111111111' }) : Response.json({message:'Invalid token'}, {status:401});
    }
    if (url.includes('/rest/v1/profiles')) {
      const auth = headers.get('authorization') ?? '';
      profileAuthorizations.push(auth);
      return Response.json(auth === 'Bearer team-session' && active ? [{id:'11111111-1111-4111-8111-111111111111'}] : []);
    }
    if (url.includes('/rest/v1/catalog_orders')) {
      catalogReads++;
      return Response.json([{id:'order-1',code:'EXC-SAVED',status:'pending',payment_status:paymentStatus,catalog_order_items:[]}]);
    }
    throw new Error(`Unexpected request: ${new URL(url).pathname}`);
  };
  const source = readFileSync(new URL('../supabase-catalog/functions/catalog-orders/index.ts',import.meta.url),'utf8');
  const compiled = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;\r?\n/gm,'');
  const context = vm.createContext({
    Request,Response,URL,normalizePixSettings,
    createClient: (url:string,key:string,options:Record<string,unknown>) => createClient(url,key,{...options,global:{...((options.global??{}) as object),fetch:fetcher}}),
    Deno:{env:{get:(key:string)=>key==='SUPABASE_URL'?'https://catalog.test':key==='SUPABASE_SERVICE_ROLE_KEY'?'test-service-key':undefined},serve:(callback:typeof handler)=>{handler=callback;}},
  });
  vm.runInContext(compiled,context);
  const response=await handler!(new Request('https://catalog.test/functions/v1/catalog-orders',{method:'POST',headers:{origin:'https://exclusiv-codigo.vercel.app','content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)}));
  return {response,body:await response.json(),profileAuthorizations,catalogReads};
}

test('active ERP team session can read the saved remote orders',async()=>{
  const result=await runBridge('team-session');
  assert.equal(result.response.status,200);
  assert.deepEqual(result.profileAuthorizations,['Bearer team-session']);
  assert.equal(result.body.orders[0].code,'EXC-SAVED');
});
test('missing, invalid and inactive sessions cannot read private orders',async()=>{
  for(const [token,active,status] of [[null,true,401],['invalid',true,401],['team-session',false,403]] as const){
    const result=await runBridge(token,active);
    assert.equal(result.response.status,status);
    assert.equal(result.catalogReads,0);
  }
});

test('unverified Pix cannot be finalized or sold and non-admin cannot change recipient',async()=>{
 const id='11111111-1111-4111-8111-111111111111';
 for(const action of ['get_for_sale','confirm']){const result=await runBridge('team-session',true,{action,order_id:id,sale_id:id},'awaiting_verification');assert.equal(result.response.status,409);}
 const settings=await runBridge('team-session',true,{action:'save_pix_settings',settings:{}});assert.equal(settings.response.status,403);
});
