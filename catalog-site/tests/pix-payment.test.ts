import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as React from "react";
import * as jsx from "react/jsx-runtime";

// A hook harness allows exercising the payment actions without a bank connection.
test("Pix UI copies the canonical code and never confirms a payment on the customer's behalf", async () => {
  const values: unknown[] = []; let cursor = 0; const copied: string[] = [];
  const source = readFileSync(new URL("../components/pix-payment.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  type Element = React.ReactElement<Record<string, unknown>>;
  const exports: {PixPayment?: (p: unknown) => Element} = {};
  vm.runInNewContext(compiled, {exports,navigator:{clipboard:{writeText:async (value:string)=>{copied.push(value);}}},require:(name:string)=>{
    if(name==='react/jsx-runtime')return jsx;
    if(name==='react')return {...React,useEffect:()=>{},useRef:()=>({current:null}),useState:(initial:unknown)=>{const i=cursor++;if(!(i in values))values[i]=initial;return [values[i],(value:unknown)=>{values[i]=value;}];}};
    if(name==='next/image')return 'Image';
    if(name==='lucide-react')return {};
    if(name==='@/lib/format')return {money:(value:number)=>String(value)};
    throw new Error(`Unexpected import: ${name}`);
  }});
  const props={receipt:{id:'order',code:'EXC-1',total:10000,whatsappUrl:'https://wa.me/5584996008220',paymentStatus:'awaiting_verification',pix:{copyPaste:'000201canonical',receiverName:'LOJA'}}};
  function all(element: unknown): Element[] {
    if(!React.isValidElement(element))return [];
    const item=element as Element;
    return [item,...React.Children.toArray(item.props.children as React.ReactNode).flatMap(all)];
  }
  const render=()=>{cursor=0;return all(exports.PixPayment!(props));};
  let tree=render();
  const copy=tree.find(e=>e.type==='button'&&React.Children.toArray(e.props.children as React.ReactNode).includes(' Copiar código Pix'));
  assert.ok(copy);
  await (copy.props.onClick as ()=>Promise<void>)();
  assert.deepEqual(copied,['000201canonical']);
  tree=render();
  assert.ok(tree.some(e=>e.props.role==='status'&&e.props.children==='Aguardando conferência'));
  assert.ok(tree.some(e=>e.type==='a'&&e.props.href===props.receipt.whatsappUrl));
  assert.equal(tree.some(e=>e.type==='button'&&String(e.props.children).includes('Confirmar')),false);
});
