// Minimal D1 adapter boundary for the migration. It deliberately exposes only
// primitives needed by the portal replacement instead of emulating Kysely.
export const parseRecord = row => ({...JSON.parse(row.data), id: row.id, _kind: row.kind});

export async function listRecords(db) {
  const {results=[]}=await db.prepare(
    'SELECT id, kind, student_id, parent_id, data, revision, updated_at FROM portal_records'
  ).all();
  return results.map(parseRecord);
}

export async function putRecord(db, kind, item) {
  const data={...item}; delete data._kind;
  const studentId=kind==='students'?data.id:(data.studentId||null);
  const parentId=kind==='parents'?data.id:(data.parentId||null);
  await db.prepare(`INSERT INTO portal_records
    (id,kind,student_id,parent_id,data,revision,updated_at)
    VALUES (?1,?2,?3,?4,?5,1,CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,student_id=excluded.student_id,
    parent_id=excluded.parent_id,data=excluded.data,revision=portal_records.revision+1,
    updated_at=CURRENT_TIMESTAMP`)
    .bind(data.id,kind,studentId,parentId,JSON.stringify(data)).run();
}

export async function getAccountBySession(db, tokenHash) {
  return db.prepare(`SELECT a.id,a.email,a.name,a.role,a.parent_id AS parentId,
    a.student_id AS studentId FROM portal_sessions s
    JOIN portal_accounts a ON a.id=s.account_id
    WHERE s.token_hash=?1 AND s.expires_at>CURRENT_TIMESTAMP AND a.enabled=1`)
    .bind(tokenHash).first();
}
