// Rehearse the production repair against a private, temporary PostgreSQL cluster.
import EmbeddedPostgres from 'embedded-postgres';
import { readFileSync, readdirSync, mkdtempSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const backup=process.argv[2];
if(!backup)throw Error('Pass backup snapshot.json.gz');
const snapshot=JSON.parse(gunzipSync(readFileSync(backup)));
const payload=JSON.parse(readFileSync('.local/onight-history-payload.json'));
const temp=mkdtempSync(join(tmpdir(),'onight-history-qa-'));
const password=randomBytes(18).toString('hex');
const db=new EmbeddedPostgres({databaseDir:join(temp,'postgres'),user:'onight_qa',password,port:55439,persistent:false,
  initdbFlags:['--wal-segsize=1','--no-sync'],
  postgresFlags:['-h','127.0.0.1','-F','-c','max_wal_size=32MB','-c','min_wal_size=8MB','-c','shared_buffers=16MB'],onLog:()=>{},onError:()=>{}});
let c;
try{
  await db.initialise();await db.start();await db.createDatabase('onight_qa');
  c=db.getPgClient('onight_qa','127.0.0.1');await c.connect();
  await c.query('CREATE ROLE service_role');
  for(const file of readdirSync('database/migrations').filter(f=>f.endsWith('.sql')).sort())
    await c.query(readFileSync(`database/migrations/${file}`,'utf8'));
  const ordered=['organizations','locations','users','suppliers','customers','products','product_variants',
    'product_units','product_supplier_links','inventory_balances','inventory_lots','inventory_movements',
    'sales_orders','sales_order_items','purchase_orders','purchase_order_items','returns','return_items',
    'payments','payment_allocations','checks','recurring_expenses','expenses','document_history'];
  for(const table of ordered){
    const rows=snapshot[table];if(!rows?.length)continue;
    const columns=Object.keys(rows[0]).map(x=>`"${x}"`).join(',');
    await c.query(`INSERT INTO ${table}(${columns}) SELECT ${columns} FROM jsonb_populate_recordset(NULL::${table},$1::jsonb) ON CONFLICT DO NOTHING`,[JSON.stringify(rows)]);
  }
  await c.query(readFileSync('scripts/repair-onight-history.sql','utf8'));
  const first=(await c.query('SELECT repair_onight_history($1::jsonb) AS result',[JSON.stringify(payload)])).rows[0].result;
  assert.deepEqual(first,payload.expected);
  // A repeat must neither duplicate receipts nor consume stock.
  const second=(await c.query('SELECT repair_onight_history($1::jsonb) AS result',[JSON.stringify(payload)])).rows[0].result;
  assert.deepEqual(second,first);
  const {DashboardService}=await import('../apps/api/dist/dashboard/dashboard.service.js');
  const dashboard=new DashboardService({query:c.query.bind(c)});
  const summary=await dashboard.summary();
  assert.equal(summary.cashAvailable,177006);assert.equal(summary.customerReceivables,847591);
  assert.equal(summary.inventoryValue,2231577.27);assert.equal(summary.unitsInStock,14530);
  const report=await dashboard.report('2026-10-01','2026-10-31');
  assert.equal(report.salesRevenue,659960);assert.equal(report.grossMargin,88878.3);assert.equal(report.expenses,45008);
  assert.equal(report.periods.reduce((s,r)=>s+r.salesRevenue,0),report.salesRevenue);
  assert.equal(Math.round(report.periods.reduce((s,r)=>s+r.grossMargin,0)*100)/100,report.grossMargin);
  const analytics=await dashboard.analytics('month');
  if(new Date().toISOString().startsWith('2026-10')){
    assert.equal(analytics.periods.reduce((s,r)=>s+r.revenue,0),659960);
    assert.equal(Math.round(analytics.periods.reduce((s,r)=>s+r.grossMargin,0)*100)/100,88878.3);
    assert.equal(analytics.periods[0].period,'2026-10-01');
  }
  // An invalid reconciliation target must roll back the entire transaction.
  const invalid={...payload,opening_cash:0};
  await assert.rejects(c.query('SELECT repair_onight_history($1::jsonb)',[JSON.stringify(invalid)]),/Reconciliation failed/);
  assert.equal((await dashboard.summary()).cashAvailable,177006);
  await c.query('BEGIN');
  await c.query("INSERT INTO payments(organization_id,direction,method,status,amount) VALUES ('00000000-0000-4000-8000-000000000001','IN','CASH','COMPLETED',100),('00000000-0000-4000-8000-000000000001','IN','CHECK','PENDING',500)");
  await c.query("INSERT INTO expenses(organization_id,name,category,amount,incurred_on) VALUES ('00000000-0000-4000-8000-000000000001','QA cash expense','QA',20,current_date)");
  assert.equal((await dashboard.summary()).cashAvailable,177086);
  await c.query('ROLLBACK');
  console.log(JSON.stringify({repair:first,idempotent:true,rollbackVerified:true,reportVerified:true,calendarMonthVerified:true},null,2));
  const result=spawnSync('pnpm',['--filter','@cosmetics/api','test'],{stdio:'inherit',env:{...process.env,LOCAL_TEST_DATABASE_URL:`postgresql://onight_qa:${password}@127.0.0.1:55439/onight_qa`}});
  if(result.status!==0)throw Error('API integration tests failed');
}finally{await c?.end();await db.stop();}
