import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

const org = '00000000-0000-4000-8000-000000000001';
const source = resolve(process.argv.find(a => a.endsWith('.db')) ?? '/Users/macbook/Downloads/onight_.db');
const apply = process.argv.includes('--apply');
const local = process.argv.includes('--local');
const hash = createHash('sha256').update(readFileSync(source)).digest('hex');
const db = new DatabaseSync(source, { readOnly: true });
if (db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw Error('Invalid source database');
const sourceTables = ['inventaire','ventes','achats','retours','cheques','depenses','salaires','parametres'];
const raw = Object.fromEntries(sourceTables.map(t => [t, db.prepare(`SELECT * FROM ${t} ORDER BY id`).all()]));
const uuid = (ns, value) => {
  const h = createHash('sha256').update(`${ns}:${value}`).digest('hex').slice(0,32).split('');
  h[12]='4'; h[16]=((parseInt(h[16],16)&3)|8).toString(16);
  return `${h.slice(0,8).join('')}-${h.slice(8,12).join('')}-${h.slice(12,16).join('')}-${h.slice(16,20).join('')}-${h.slice(20).join('')}`;
};
const clean = v => String(v ?? '').trim();
const norm = v => clean(v).toLocaleLowerCase('fr').replace(/\s+/g,' ');
const cents = v => Math.round(Number(v ?? 0)*100);
const sum = (rows, fn) => rows.reduce((s,r)=>s+cents(fn(r)),0)/100;
const date = v => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean(v))) throw Error(`Invalid source date: ${v}`);
  return `${v}T12:00:00Z`;
};
const base='https://varsnjhezyerprimsgsb.supabase.co/rest/v1';
const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!local && !secret) throw Error('SUPABASE_SERVICE_ROLE_KEY is required');
const headers={apikey:secret,Authorization:`Bearer ${secret}`,'Content-Type':'application/json'};
async function all(table) {
  const result=[];
  for(let offset=0;;offset+=1000){
    const r=await fetch(`${base}/${table}?select=*&offset=${offset}&limit=1000&order=${table==='audit_logs'?'id':'id'}`,{headers});
    if(!r.ok) throw Error(`Read ${table}: ${r.status} ${await r.text()}`);
    const rows=await r.json(); result.push(...rows); if(rows.length<1000)return result;
  }
}
// Tables with compound keys cannot be ordered by id.
async function readTable(table) {
  if(!['inventory_balances','product_supplier_links','payment_allocations'].includes(table)) return all(table);
  const key={inventory_balances:'variant_id,location_id',product_supplier_links:'variant_id,supplier_id',payment_allocations:'payment_id,sales_order_id'}[table];
  const result=[];
  for(let offset=0;;offset+=1000){
    const r=await fetch(`${base}/${table}?select=*&offset=${offset}&limit=1000&order=${key}`,{headers});
    if(!r.ok)throw Error(`${table}: ${r.status}`);
    const rows=await r.json();result.push(...rows);if(rows.length<1000)return result;
  }
}
let before={};
if(!local){
  const tables=['organizations','locations','users','customers','suppliers','products','product_variants',
    'inventory_balances','inventory_lots','inventory_movements','product_supplier_links','product_units',
    'sales_orders','sales_order_items','purchase_orders','purchase_order_items','payments','payment_allocations',
    'checks','returns','return_items','expenses','recurring_expenses','document_history'];
  for(const table of tables)before[table]=await readTable(table);
  const backup=resolve(`backups/${new Date().toISOString().replace(/[:.]/g,'-')}-before-history-repair`);
  mkdirSync(backup,{recursive:true,mode:0o700});
  const compressed=gzipSync(JSON.stringify(before));
  writeFileSync(`${backup}/snapshot.json.gz`,compressed,{mode:0o600});
  writeFileSync(`${backup}/manifest.json`,JSON.stringify({createdAt:new Date().toISOString(),source,sourceSha256:hash,
    sha256:createHash('sha256').update(compressed).digest('hex'),counts:Object.fromEntries(Object.entries(before).map(([k,v])=>[k,v.length]))},null,2),{mode:0o600});
  console.log(JSON.stringify({backup,counts:Object.fromEntries(Object.entries(before).map(([k,v])=>[k,v.length]))},null,2));
}
const customers=new Map(),suppliers=new Map(),archived=new Map();
const customerNames=new Map((before.customers??[]).map(r=>[norm(r.name),r.id]));
const supplierNames=new Map((before.suppliers??[]).map(r=>[norm(r.name),r.id]));
function partner(name,type){
  const label=clean(name)||(type==='customer'?'Client non renseigné':'Fournisseur non renseigné');
  const names=type==='customer'?customerNames:supplierNames;
  const rows=type==='customer'?customers:suppliers;
  const id=names.get(norm(label))??uuid(`onight-${type}`,norm(label));
  if(!names.has(norm(label)))rows.set(id,{id,name:label.slice(0,160)});
  return id;
}
const inventoryIds=new Set(raw.inventaire.map(r=>Number(r.id)));
function variant(row){
  if(inventoryIds.has(Number(row.produit_id)))return uuid('onight-variant',row.produit_id);
  const key=Number(row.produit_id)>0?`id:${row.produit_id}`:`name:${norm(row.marque)}:${norm(row.produit)}`;
  const id=uuid('onight-history-variant',key);
  if(!archived.has(id))archived.set(id,{id,product_id:uuid('onight-history-product',key),name:(clean(row.produit)||'Produit historique').slice(0,160),brand:(clean(row.marque)||'Historique').slice(0,100),sku:`HIST-${id}`,purchase_price:Number(row.prix_achat_hist??0)});
  return id;
}
const groups=new Map();
for(const row of [...raw.ventes].sort((a,b)=>a.vendu_le.localeCompare(b.vendu_le)||a.id-b.id)){
  const ref=clean(row.facture_ref)||`VENTE-${row.id}`;
  if(!groups.has(ref))groups.set(ref,[]);groups.get(ref).push(row);
}
const orders=[],items=[],payments=[],purchases=[],returns=[],returnItems=[];
for(const [ref,rows]of groups){
  if(new Set(rows.map(r=>r.mode_paiement)).size!==1 || new Set(rows.map(r=>r.vendu_le)).size!==1 || new Set(rows.map(r=>r.produit==='Ancienne Dette')).size!==1)throw Error(`Ambiguous invoice ${ref}`);
  const first=rows[0],id=uuid('onight-credit',ref),customer=partner(first.client_nom,'customer');
  const total=sum(rows,r=>r.total),paid=sum(rows,r=>r.montant_paye);
  const number=ref.length<=40?ref:`CR-${ref.slice(0,27)}-${createHash('sha256').update(ref).digest('hex').slice(0,8)}`;
  orders.push({id,customer_id:customer,order_number:number,grand_total:total,amount_paid:paid,
    status:paid>=total?'PAID':paid>0?'PARTIALLY_PAID':'CONFIRMED',placed_at:date(first.vendu_le),
    legacy_kind:first.produit==='Ancienne Dette'?'OPENING_DEBT':'SALE',legacy_payment_method:first.mode_paiement});
  for(const r of rows){
    if(r.produit!=='Ancienne Dette')items.push({id:uuid('onight-history-sale-item',r.id),sales_order_id:id,variant_id:variant(r),
      description:`${r.marque} ${r.produit}`.trim().slice(0,240),quantity:Number(r.quantite),unit_price:Number(r.prix_unit),unit_cost_snapshot:Number(r.prix_achat_hist),line_total:Number(r.total)});
    const receipt=r.produit==='Ancienne Dette'?Number(r.montant_paye):r.mode_paiement==='Especes'?Number(r.total):r.mode_paiement==='Simple'?Number(r.montant_paye):0;
    if(receipt>0)payments.push({id:uuid('onight-history-sale-receipt',r.id),customer_id:customer,supplier_id:null,sales_order_id:id,purchase_order_id:null,return_id:null,
      direction:'IN',method:'CASH',amount:receipt,reference:`Reprise vente #${r.id}`,paid_at:date(r.vendu_le)});
  }
}
for(const r of raw.achats){
  const id=uuid('onight-payable',r.id),supplier=partner(r.fournisseur,'supplier');
  purchases.push({id,supplier_id:supplier,order_number:`DETTE-${r.id}`,total:Number(r.prix_total),amount_paid:Number(r.montant_paye),ordered_at:date(r.date_achat),notes:clean(r.produit_nom)});
  if(Number(r.montant_paye)>0)payments.push({id:uuid('onight-history-supplier-payment',r.id),customer_id:null,supplier_id:supplier,sales_order_id:null,purchase_order_id:id,return_id:null,
    direction:'OUT',method:'CASH',amount:Number(r.montant_paye),reference:`Reprise achat #${r.id}`,paid_at:date(r.date_achat)});
}
for(const r of raw.retours){
  const id=uuid('onight-history-return',r.id);
  returns.push({id,return_number:`RET-HIST-${r.id}`,refund_total:Number(r.montant_rembourse),returned_at:date(r.retourne_le),legacy_source_id:r.id});
  returnItems.push({id:uuid('onight-history-return-item',r.id),return_id:id,variant_id:variant(r),quantity:Number(r.quantite),refund_amount:Number(r.montant_rembourse)});
  if(Number(r.montant_rembourse)>0)payments.push({id:uuid('onight-history-refund',r.id),customer_id:null,supplier_id:null,sales_order_id:null,purchase_order_id:null,return_id:id,
    direction:'OUT',method:'CASH',amount:Number(r.montant_rembourse),reference:`Reprise retour #${r.id}`,paid_at:date(r.retourne_le)});
}
const opening=Number(raw.parametres.find(r=>r.id===1)?.solde_initial??0);
const sales=raw.ventes.filter(r=>r.produit!=='Ancienne Dette');
const sourceSummary=(from,to)=>{
  const inside=(v)=>!from||(v>=from&&v<=to);
  const sr=sales.filter(r=>inside(r.vendu_le)),rr=raw.retours.filter(r=>inside(r.retourne_le));
  return {revenue:sum(sr,r=>r.total)-sum(rr,r=>r.montant_rembourse),grossMargin:Math.round((sum(sr,r=>r.total)-sum(sr,r=>r.prix_achat_hist*r.quantite)-sum(rr,r=>r.montant_rembourse))*100)/100,
    expenses:sum(raw.depenses.filter(r=>inside(r.ajoute_le)),r=>r.montant)+sum(raw.salaires.filter(r=>inside(r.ajoute_le)),r=>r.montant)};
};
const expected={...sourceSummary(),october:sourceSummary('2026-10-01','2026-10-31'),
  cash:Math.round((opening+sum(payments,r=>r.direction==='IN'?r.amount:-r.amount)+sum(raw.cheques.filter(r=>r.statut==='Encaisse'),r=>r.montant)-sum(raw.depenses,r=>r.montant)-sum(raw.salaires,r=>r.montant))*100)/100,
  receivables:sum(raw.ventes.filter(r=>r.mode_paiement==='Simple'&&r.total>r.montant_paye),r=>r.total-r.montant_paye),
  payables:sum(raw.achats,r=>r.reste_a_payer),stockValue:sum(raw.inventaire,r=>r.quantite*r.prix_achat),units:raw.inventaire.reduce((s,r)=>s+r.quantite,0),activeProducts:raw.inventaire.length};
const payload={source_sha256:hash,opening_cash:opening,customers:[...customers.values()],suppliers:[...suppliers.values()],archived:[...archived.values()],orders,items,payments,purchases,returns,return_items:returnItems,
  source_rows:sourceTables.flatMap(t=>raw[t].map(r=>({source_table:t,source_id:r.id,data:r}))),expected,
  before_orders:(before.sales_orders??[]).map(r=>({id:r.id,grand_total:r.grand_total,amount_paid:r.amount_paid,status:r.status})),
  before_purchases:(before.purchase_orders??[]).map(r=>({id:r.id,total:r.total,amount_paid:r.amount_paid})),
  before_user_ids:(before.users??[]).map(r=>r.id)};
mkdirSync('.local',{recursive:true,mode:0o700});
writeFileSync('.local/onight-history-payload.json',JSON.stringify(payload),{mode:0o600});
console.log(JSON.stringify({sourceSha256:hash,orders:orders.length,items:items.length,archivedProducts:archived.size,payments:payments.length,returns:returns.length,purchases:purchases.length,expected},null,2));
if(apply){
  if(process.env.ONIGHT_HISTORY_CONFIRM!=='RESTORE_HISTORY_AND_RECONCILE')throw Error('Explicit repair confirmation required');
  const r=await fetch(`${base}/rpc/repair_onight_history`,{method:'POST',headers,body:JSON.stringify({payload})});
  if(!r.ok)throw Error(`Repair rolled back: ${r.status} ${await r.text()}`);
  const result=await r.json();
  writeFileSync('.local/onight-history-verification.json',JSON.stringify(result,null,2),{mode:0o600});
  console.log(JSON.stringify({verified:result},null,2));
}
db.close();
