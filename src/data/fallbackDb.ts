// Backup storage for browsers without SharedArrayBuffer (in-app browsers such
// as Messenger and Facebook). It runs SQLite in the page itself and saves a
// copy of the database to the browser's localStorage after every change.
import initSqlJs from 'sql.js/dist/sql-wasm.js';

const KEY = 'schedulens-db';

type Arg = string | number | null;
const flat = (args: unknown[]): Arg[] => (args.length === 1 && Array.isArray(args[0]) ? args[0] : args) as Arg[];

export async function openFallbackDb(schema: string) {
  const SQL = await initSqlJs({ locateFile: () => '/assets/sql-wasm.wasm' });
  let saved: Uint8Array | undefined;
  try {
    const b64 = localStorage.getItem(KEY);
    if (b64) saved = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  } catch {}
  const raw = new SQL.Database(saved);
  raw.exec(schema.replace('PRAGMA journal_mode = WAL;', ''));

  let inTx = 0;
  const persist = () => {
    if (inTx) return;
    try {
      const bytes = raw.export();
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      localStorage.setItem(KEY, btoa(s));
    } catch {}
  };
  const all = (sql: string, args: unknown[]) => {
    const st = raw.prepare(sql);
    st.bind(flat(args));
    const rows: any[] = [];
    while (st.step()) rows.push(st.getAsObject());
    st.free();
    return rows;
  };

  return {
    execSync(sql: string) { raw.exec(sql); persist(); },
    getAllSync(sql: string, ...args: unknown[]) { return all(sql, args); },
    getFirstSync(sql: string, ...args: unknown[]) { return all(sql, args)[0] ?? null; },
    runSync(sql: string, ...args: unknown[]) { raw.run(sql, flat(args)); persist(); },
    withTransactionSync(fn: () => void) {
      raw.exec('BEGIN');
      inTx++;
      try { fn(); inTx--; raw.exec('COMMIT'); } catch (e) { inTx--; raw.exec('ROLLBACK'); throw e; }
      persist();
    },
  };
}
