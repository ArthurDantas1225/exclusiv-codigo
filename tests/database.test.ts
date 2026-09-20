import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
const db = new PGlite();
const org = randomUUID(),
  otherOrg = randomUUID(),
  user = randomUUID(),
  otherUser = randomUUID();
let product: string, variant: string, customer: string, sale: string;
async function command(action: string, p: Record<string, unknown> = {}) {
  const r = await db.query<{ result: { id: string } }>(
    "select public.command($1,$2::jsonb) result",
    [action, JSON.stringify({ request_id: randomUUID(), ...p })],
  );
  return r.rows[0].result.id;
}
async function scalar(sql: string) {
  return (await db.query<Record<string, unknown>>(sql)).rows[0];
}
before(async () => {
  await db.exec(
    `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema public,auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`,
  );
  await db.exec(readFileSync("supabase/migrations/001_core.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/002_metrics.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/004_balances.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/005_operations.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/20260919174030_product_catalog_flow.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/20260919190000_product_grid_media_undo.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/20260919193842_product_subcategory.sql", "utf8"));
  await db.query("insert into auth.users values ($1),($2)", [user, otherUser]);
  await db.query(
    "insert into public.organizations(id,name) values($1,'EXCLUSIV'),($2,'Other')",
    [org, otherOrg],
  );
  await db.query(
    "insert into public.profiles(id,organization_id,name,email) values($1,$2,'Admin','a@example.test'),($3,$4,'Other','b@example.test')",
    [user, org, otherUser, otherOrg],
  );
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec("set role authenticated");
});
after(async () => {
  await db.close();
});
test("catalog, stock and customer via guarded RPC", async () => {
  product = await command("product", {
    name: "Vórtex",
    category: "Camisetas",
    collection: "2026",
    price: 10000,
  });
  variant = await command("variant", {
    product_id: product,
    sku: "VTX-M",
    color: "Preto",
    size: "M",
    stock: 10,
    minimum: 2,
    cost: 4000,
  });
  customer = await command("customer", {
    name: "João",
    phone: "85999999999",
    credit_enabled: true,
    credit_limit: 15000,
  });
  assert.equal((await scalar("select stock from product_variants")).stock, 10);
});
test("a product is only ready for stock and sale after an atomic first variant", async () => {
  const requestId = randomUUID();
  const payload = {
    request_id: requestId,
    name: "Camiseta com grade",
    category: "Camisetas",
    collection: "Essencial",
    price: 6000,
    catalog_visible: true,
    variants: [
      { color: "Preto", size: "M", model: "Oversized", stock: 3, minimum: 1, cost: 2500 },
      { color: "Preto", size: "G", model: "Oversized", stock: 2, minimum: 1, cost: 2500 },
    ],
  };
  const first = await db.query<{ result: { id: string } }>(
    "select public.create_product_bundle($1::jsonb) result", [JSON.stringify(payload)],
  );
  const id = first.rows[0].result.id;
  const repeated = await db.query<{ result: { id: string } }>(
    "select public.create_product_bundle($1::jsonb) result", [JSON.stringify(payload)],
  );
  assert.equal(repeated.rows[0].result.id, id);
  const rows = await db.query<{ model: string; stock: number; cost: number }>(
    "select model,stock,cost from product_variants where product_id=$1 order by size", [id],
  );
  assert.equal(rows.rows.length, 2);
  assert.equal(rows.rows.reduce((sum, row) => sum + row.stock, 0), 5);
  assert.ok(rows.rows.every((row) => row.model === "Oversized" && Number(row.cost) === 2500));
  assert.equal((await db.query<{ catalog_visible: boolean }>("select catalog_visible from products where id=$1", [id])).rows[0].catalog_visible, true);
  const beforeCount = Number((await scalar("select count(*) as n from products")).n);
  await assert.rejects(
    db.query("select public.create_product_bundle($1::jsonb)", [JSON.stringify({
      ...payload,
      request_id: randomUUID(),
      name: "Não pode ficar incompleto",
      variants: [{ color: "Azul", size: "M", stock: -1, minimum: 0, cost: 1000 }],
    })]),
    /Estoque inválido/,
  );
  assert.equal(Number((await scalar("select count(*) as n from products")).n), beforeCount);
  await assert.rejects(db.query("select public.create_product_bundle($1::jsonb)", [JSON.stringify({
    ...payload, request_id: randomUUID(), variants: [],
  })]), /Cadastre de 1 a 50/);
});
test("incomplete products cannot be published; variants can be completed without losing stock", async () => {
  const id = await command("product", { name: "Pendente", price: 7000 });
  await assert.rejects(
    db.query("select public.set_catalog_visible($1,true)", [id]),
    /Cadastre ao menos uma variação/,
  );
  const created = await db.query<{ result: { id: string } }>(
    "select public.save_variant($1::jsonb) result",
    [JSON.stringify({ product_id: id, color: "Laranja", size: "G", model: "Boxy", stock: 4, minimum: 1, cost: 2800 })],
  );
  const vid = created.rows[0].result.id;
  await db.query("select public.save_variant($1::jsonb)", [JSON.stringify({
    id: vid, color: "Preto", size: "M", model: "Oversized", minimum: 2, cost: 3100,
  })]);
  const saved = (await db.query<{ sku: string; stock: number; model: string; cost: number }>(
    "select sku,stock,model,cost from product_variants where id=$1", [vid],
  )).rows[0];
  assert.match(saved.sku, /^EXC-/);
  assert.equal(saved.stock, 4);
  assert.equal(saved.model, "Oversized");
  assert.equal(Number(saved.cost), 3100);
  await db.query("select public.set_catalog_visible($1,true)", [id]);
  assert.equal((await db.query<{ catalog_visible: boolean }>("select catalog_visible from products where id=$1", [id])).rows[0].catalog_visible, true);
  await db.exec("set role anon");
  await assert.rejects(db.query("select public.set_catalog_visible($1,false)", [id]), /permission denied/);
  await db.exec("set role authenticated");
});
test("direct writes denied and tenant isolation", async () => {
  await assert.rejects(
    db.exec("update product_variants set stock=99"),
    /permission denied/,
  );
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    otherUser,
  ]);
  assert.equal((await db.query("select * from products")).rows.length, 0);
  await assert.rejects(
    command("variant", {
      product_id: product,
      sku: "bad",
      size: "M",
      color: "Preto",
      stock: 1,
      minimum: 0,
      cost: 1,
    }),
    /foreign key/,
  );
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
});
test("sale requires open cash", async () => {
  await assert.rejects(
    command("sale", { items: [], payments: [] }),
    /Abra o caixa/,
  );
  await command("open_cash", { amount: 10000 });
  await assert.rejects(command("open_cash", { amount: 0 }), /Já existe/);
});
test("mixed payment, discount, historical cost and idempotency", async () => {
  const p = {
    request_id: randomUUID(),
    customer_id: customer,
    discount: 1000,
    items: [{ variant_id: variant, quantity: 2, unit_price: 10000 }],
    payments: [
      { method: "Pix", amount: 9000 },
      { method: "Fiado", amount: 10000 },
    ],
  };
  sale = await command("sale", p);
  assert.equal(await command("sale", p), sale);
  assert.equal((await scalar("select stock from product_variants")).stock, 8);
  const s = await scalar("select total,cost from sales");
  assert.equal(Number(s.total), 19000);
  assert.equal(Number(s.cost), 8000);
  await command("product", { id: product, name: "Vórtex", price: 12000 });
  assert.equal(
    Number((await scalar("select unit_price from sale_items")).unit_price),
    10000,
  );
});
test("insufficient stock, invalid discount, bad payment roll back", async () => {
  const p = {
    discount: 0,
    items: [{ variant_id: variant, quantity: 9, unit_price: 10000 }],
    payments: [{ method: "Pix", amount: 90000 }],
  };
  await assert.rejects(command("sale", p), /estoque inválido/);
  await assert.rejects(
    command("sale", {
      ...p,
      items: [{ variant_id: variant, quantity: 1, unit_price: 10000 }],
      discount: 11000,
    }),
    /Desconto inválido/,
  );
  await assert.rejects(
    command("sale", {
      ...p,
      items: [{ variant_id: variant, quantity: 1, unit_price: 10000 }],
    }),
    /somar o total/,
  );
  assert.equal((await scalar("select stock from product_variants")).stock, 8);
  assert.equal((await db.query("select * from sales")).rows.length, 1);
});
test("credit limit and partial receipt", async () => {
  await assert.rejects(
    command("sale", {
      customer_id: customer,
      discount: 0,
      items: [{ variant_id: variant, quantity: 1, unit_price: 10000 }],
      payments: [{ method: "Fiado", amount: 10000 }],
    }),
    /Limite/,
  );
  await command("receipt", {
    customer_id: customer,
    amount: 4000,
    description: "Parcial",
    method: "Dinheiro",
  });
  assert.equal(
    Number(
      (
        await scalar(
          "select sum(amount) balance from ledger where kind in ('debt','receipt','credit')",
        )
      ).balance,
    ),
    6000,
  );
  await assert.rejects(
    command("receipt", {
      customer_id: customer,
      amount: 7000,
      description: "Excesso",
      method: "Pix",
    }),
    /maior que o saldo/,
  );
});
test("cancellation preserves history and restores stock once", async () => {
  const id = await command("sale", {
    discount: 0,
    items: [{ variant_id: variant, quantity: 1, unit_price: 10000 }],
    payments: [{ method: "Dinheiro", amount: 10000 }],
  });
  await command("cancel", { sale_id: id, reason: "Desistência" });
  assert.equal((await scalar("select stock from product_variants")).stock, 8);
  await assert.rejects(
    command("cancel", { sale_id: id, reason: "Repetido" }),
    /não pode/,
  );
  assert.equal(
    (await scalar(`select status from sales where id='${id}'`)).status,
    "cancelled",
  );
});
test("return creates credit and stock movement", async () => {
  const item = (
    await scalar(`select id from sale_items where sale_id='${sale}'`)
  ).id;
  await command("return", {
    sale_id: sale,
    item_id: item,
    quantity: 1,
    method: "Crédito na loja",
    reason: "Tamanho incorreto",
  });
  assert.equal((await scalar("select stock from product_variants")).stock, 9);
  assert.equal(
    (await scalar(`select status from sales where id='${sale}'`)).status,
    "partially_returned",
  );
  assert.equal(
    Number(
      (
        await scalar(
          "select sum(amount) balance from ledger where kind in ('debt','receipt','credit')",
        )
      ).balance,
    ),
    -3500,
  );
});
test("cash closing calculation", async () => {
  await command("expense", {
    amount: 1000,
    method: "Dinheiro",
    description: "Embalagens",
  });
  await command("withdrawal", {
    amount: 2000,
    method: "Dinheiro",
    description: "Depósito",
  });
  await command("close_cash", { amount: 11000 });
  const c = await scalar("select expected,counted,status from cash_sessions");
  assert.equal(Number(c.expected), 11000);
  assert.equal(Number(c.counted), 11000);
  assert.equal(c.status, "closed");
});
test("metrics and immutable audit", async () => {
  const m = await db.query<{ result: { count: number } }>(
    "select metrics('2020-01-01','2030-12-31') result",
  );
  assert.equal(m.rows[0].result.count, 1);
  assert.ok((await db.query("select * from audit_logs")).rows.length >= 10);
  await assert.rejects(db.exec("delete from audit_logs"), /permission denied/);
});
test("store credit can be spent without cash and rejects excess", async () => {
  await command("open_cash", { amount: 0 });
  const p = {
    customer_id: customer,
    discount: 0,
    items: [{ variant_id: variant, quantity: 1, unit_price: 3500 }],
    payments: [{ method: "Crédito na loja", amount: 3500 }],
  };
  await command("sale", p);
  assert.equal(
    Number(
      (
        await scalar(
          "select sum(amount) balance from ledger where kind in ('debt','receipt','credit','credit_use')",
        )
      ).balance,
    ),
    0,
  );
  await assert.rejects(command("sale", p), /insuficiente/);
});
test("supplier, partial purchase receipt and payable settlement", async () => {
  const supplier = await command("supplier", { name: "Fornecedor teste" });
  const purchase = await command("purchase", {
    supplier_id: supplier,
    due_date: "2026-10-01",
    items: [{ variant_id: variant, quantity: 3, unit_cost: 4500 }],
  });
  const item = (
    await scalar(
      `select id from purchase_order_items where purchase_id='${purchase}'`,
    )
  ).id;
  const before = Number(
    (await scalar("select stock from product_variants")).stock,
  );
  await command("receive_purchase", {
    purchase_id: purchase,
    items: [{ id: item, quantity: 1 }],
  });
  assert.equal(
    Number((await scalar("select stock from product_variants")).stock),
    before + 1,
  );
  assert.equal(
    (await scalar(`select status from purchase_orders where id='${purchase}'`))
      .status,
    "partial",
  );
  await assert.rejects(
    command("receive_purchase", {
      purchase_id: purchase,
      items: [{ id: item, quantity: 3 }],
    }),
    /acima do pedido/,
  );
  const bill = await scalar(
    `select id,amount from accounts_payable where purchase_id='${purchase}'`,
  );
  assert.equal(Number(bill.amount), 4500);
  await command("pay_bill", { id: bill.id, amount: 2000, method: "Pix" });
  assert.equal(
    Number(
      (await scalar(`select paid from accounts_payable where id='${bill.id}'`))
        .paid,
    ),
    2000,
  );
});
test("CSV import is atomic when a later row has duplicate SKU", async () => {
  const count = (await db.query("select id from products")).rows.length;
  await assert.rejects(
    command("import", {
      kind: "products",
      rows: [
        {
          name: "Novo",
          price: 100,
          sku: "CSV-1",
          size: "P",
          color: "Preto",
          stock: 1,
          minimum: 0,
          cost: 50,
        },
        {
          name: "Duplicado",
          price: 100,
          sku: "VTX-M",
          size: "M",
          color: "Preto",
          stock: 1,
          minimum: 0,
          cost: 50,
        },
      ],
    }),
    /unique/,
  );
  assert.equal((await db.query("select id from products")).rows.length, count);
});
test("inventory count detects concurrent movement", async () => {
  const count = await command("start_count");
  const snapshot = await db.query<{ variant_id: string; expected: number }>(
    "select variant_id,expected from inventory_count_items where count_id=$1", [count],
  );
  await command("stock", {
    variant_id: variant,
    quantity: 1,
    reason: "Entrada após contagem",
  });
  await assert.rejects(
    command("finish_count", {
      count_id: count,
      items: snapshot.rows.map((item) => ({ variant_id: item.variant_id, counted: item.expected })),
    }),
    /Estoque mudou/,
  );
});
test("full return preserves exact discounted total and historical cost reversal", async () => {
  const id = await command("sale", {
    discount: 1,
    items: [{ variant_id: variant, quantity: 3, unit_price: 1000 }],
    payments: [{ method: "Pix", amount: 2999 }],
  });
  const item = (await scalar(`select id from sale_items where sale_id='${id}'`))
    .id;
  await command("return", {
    sale_id: id,
    item_id: item,
    quantity: 1,
    method: "Pix",
    reason: "Teste parcial",
  });
  await command("return", {
    sale_id: id,
    item_id: item,
    quantity: 2,
    method: "Pix",
    reason: "Teste final",
  });
  const value = await scalar(
    `select sum(amount) amount,sum(cost_delta) cost from ledger where sale_id='${id}' and kind='refund'`,
  );
  assert.equal(Number(value.amount), -2999);
  assert.equal(Number(value.cost), -13500);
});
test("one grid edit updates product, quantities and new sizes atomically", async () => {
  const before = (await db.query<{stock:number}>("select stock from product_variants where id=$1",[variant])).rows[0].stock;
  const request_id = randomUUID();
  const payload = { id:product, request_id, name:"Vórtex", category:"Camisetas", collection:"2026",
    price:13000, active:true, catalog_visible:false, variants:[
      { id:variant, sku:"VTX-M", barcode:"", model:"Regular", color:"Preto", size:"M", stock:before+2, minimum:2, cost:5000 },
      { color:"Preto", size:"G", model:"Regular", stock:4, minimum:2, cost:5000 },
    ] };
  const saved = await db.query<{result:{id:string}}>("select public.save_product_grid($1::jsonb) result",[JSON.stringify(payload)]);
  assert.equal(saved.rows[0].result.id,product);
  await db.query("select public.save_product_grid($1::jsonb)",[JSON.stringify(payload)]);
  assert.equal((await db.query("select * from product_variants where product_id=$1",[product])).rows.length,2);
  assert.equal((await db.query<{stock:number}>("select stock from product_variants where id=$1",[variant])).rows[0].stock,before+2);
  assert.equal(Number((await db.query<{price:number}>("select price from products where id=$1",[product])).rows[0].price),13000);
  await assert.rejects(db.query("select public.save_product_grid($1::jsonb)",[JSON.stringify({...payload,request_id:randomUUID(),variants:[
    {...payload.variants[0],stock:before+9},
    {color:"Preto",size:"M",model:"Regular",stock:1,minimum:1,cost:1000},
  ]})]),/repetidos/);
  assert.equal((await db.query<{stock:number}>("select stock from product_variants where id=$1",[variant])).rows[0].stock,before+2);
});
test("product and photos can be hidden and restored without losing records", async () => {
  const path = `${org}/${product}/${randomUUID()}.webp`;
  const image = (await db.query<{result:{id:string}}>("select public.save_product_image($1::jsonb) result",[JSON.stringify({product_id:product,path,color:"Preto",view:"front",is_primary:true})])).rows[0].result.id;
  assert.deepEqual((await db.query<{color:string;view:string}>("select color,view from product_images where id=$1",[image])).rows[0],{color:"Preto",view:"front"});
  await db.query("select public.set_product_image_hidden($1,true)",[image]);
  assert.equal((await db.query<{hidden:boolean}>("select hidden_at is not null hidden from product_images where id=$1",[image])).rows[0].hidden,true);
  await db.query("select public.set_product_image_hidden($1,false)",[image]);
  await db.query("select public.set_product_archived($1,true)",[product]);
  const archived = (await db.query<{active:boolean;catalog_visible:boolean;archived:boolean}>("select active,catalog_visible,archived_at is not null archived from products where id=$1",[product])).rows[0];
  assert.deepEqual(archived,{active:false,catalog_visible:false,archived:true});
  await db.query("select public.set_product_archived($1,false)",[product]);
  assert.equal((await db.query<{archived:boolean}>("select archived_at is not null archived from products where id=$1",[product])).rows[0].archived,false);
});
test("product taxonomy saves with the complete grid and is idempotent", async () => {
  const rows = (await db.query<{id:string;stock:number;sku:string;barcode:string;model:string;color:string;size:string;minimum:number;cost:number}>("select id,stock,sku,barcode,model,color,size,minimum,cost from product_variants where product_id=$1",[product])).rows;
  const request_id = randomUUID();
  const payload = { id:product,request_id,name:"Vórtex",category:"Camisa",subcategory:"Oversized Suedine",collection:"2026",price:13000,active:true,catalog_visible:false,
    variants:rows.map((row) => ({...row})) };
  await db.query("select public.save_product_grid_with_taxonomy($1::jsonb)",[JSON.stringify(payload)]);
  await db.query("select public.save_product_grid_with_taxonomy($1::jsonb)",[JSON.stringify(payload)]);
  const saved = (await db.query<{category:string;subcategory:string}>("select category,subcategory from products where id=$1",[product])).rows[0];
  assert.deepEqual(saved,{category:"Camisa",subcategory:"Oversized Suedine"});
});
test("deactivated users cannot call business functions", async () => {
  await db.exec("reset role");
  await db.query("update profiles set active=false where id=$1", [user]);
  await db.exec("set role authenticated");
  await assert.rejects(
    command("stock", { variant_id: variant, quantity: 1, reason: "No access" }),
    /Acesso/,
  );
  assert.equal((await db.query("select * from products")).rows.length, 0);
});
