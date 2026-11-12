// Local-only integration fixture. Never points to a production write endpoint.
import http from 'node:http';
const art = (color, label) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 750"><rect width="600" height="750" fill="#242320"/><path d="M220 140 150 180 70 300 165 355 190 310 180 600 420 600 410 310 435 355 530 300 450 180 380 140Q300 200 220 140Z" fill="${color}" stroke="#777" stroke-width="2"/><text x="300" y="380" text-anchor="middle" fill="#ccc" font-size="20">TESTE LOCAL</text><text x="300" y="700" text-anchor="middle" fill="#aaa" font-size="15">${label} · não é produto da loja</text></svg>`);
let orders = 0;
let mode = 'reject';
const keys = [];
const product = (id,name) => ({source_id:id,name,category:'Camiseta',subcategory:'Básica',style:'Streetwear',collection:'',price:7990,published:true});
const variants = [
  {source_id:'v1',product_id:'p1',size:'M',color:'Preta',model:'',stock:2},
  {source_id:'v2',product_id:'p1',size:'G',color:'Azul',model:'',stock:1},
  {source_id:'v3',product_id:'p2',size:'G',color:'Preta',model:'',stock:1},
];
http.createServer((req,res)=>{
  res.setHeader('content-type','application/json');res.setHeader('access-control-allow-origin','http://localhost:4174');res.setHeader('access-control-allow-headers','content-type');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  if(req.url==='/create-order'){
    orders++;
    let body='';
    req.on('data',chunk=>body+=chunk);
    req.on('end',()=>{
      try { keys.push(JSON.parse(body).idempotencyKey); } catch { /* invalid local request */ }
      if(mode==='drop'){res.destroy();return;}
      res.writeHead(409);res.end(JSON.stringify({error:'TESTE LOCAL: estoque alterado. Nenhum pedido real foi registrado.'}));
    });return;
  }
  let data=[];
  if(req.url==='/status')data={localOrderAttempts:orders,keys};
  if(req.url.startsWith('/mode?')){mode=new URL(req.url,'http://localhost').searchParams.get('value');data={mode};}
  if(req.url.includes('catalog_settings'))data=[{shop_name:'EXCLUSIV · TESTE LOCAL',whatsapp:'5584996008220',instagram:'@exclusiv_streetwear',headline:''}];
  if(req.url.includes('catalog_products'))data=[product('p1','TESTE LOCAL · Camiseta 01'),product('p2','TESTE LOCAL · Camiseta sem imagem')];
  if(req.url.includes('catalog_variants'))data=variants;
  if(req.url.includes('catalog_images'))data=[
    {source_id:'i1',product_id:'p1',url:art('#333','Frente'),color:'Preta',view:'front',is_primary:true,position:0},
    {source_id:'i2',product_id:'p1',url:art('#2b426c','Detalhe'),color:'Azul',view:'detail',is_primary:false,position:1},
    {source_id:'i3',product_id:'p2',url:'data:image/png;base64,broken',color:'Preta',view:'front',is_primary:true,position:0},
  ];
  res.end(JSON.stringify(data));
}).listen(4180,'127.0.0.1',()=>console.log('Fixture de revisão: http://127.0.0.1:4180'));
