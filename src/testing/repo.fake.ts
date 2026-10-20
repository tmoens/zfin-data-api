/**
 * A fake TypeORM Repository that records what the query builder was asked to do.
 *
 * The load path is written in the query-builder DSL (`.delete().from().where().execute()`,
 * `.insert().into().orIgnore().values().execute()`), so a test that wants to assert "the table was
 * cleared, then written in batches of N, in this order" has to observe that chain. This records
 * each completed chain as one entry in `ops`, which is the shape those assertions actually want.
 */
export interface RecordedOp {
  type: 'delete' | 'insert';
  rows?: unknown[];
  /**
   * Whether the statement ran inside `manager.transaction`.
   *
   * The reload empties the table before refilling it, so this is the difference between readers
   * seeing yesterday's complete data throughout and readers seeing an empty table for as long as
   * the refill takes.
   */
  inTransaction: boolean;
}

export function makeFakeRepo<T>() {
  const ops: RecordedOp[] = [];
  let depth = 0;

  const createQueryBuilder = jest.fn(() => {
    const pending: Partial<RecordedOp> = {};
    const qb: any = {
      delete: () => ((pending.type = 'delete'), qb),
      insert: () => ((pending.type = 'insert'), qb),
      from: () => qb,
      into: () => qb,
      where: () => qb,
      orIgnore: () => qb,
      values: (rows: unknown[]) => ((pending.rows = rows), qb),
      execute: async () => {
        ops.push({ ...pending, inTransaction: depth > 0 } as RecordedOp);
        return {};
      },
    };
    return qb;
  });

  // The transactional EntityManager handed to the callback. Same recorder, so the ops come out in
  // one ordered list either way and a test can ask where the boundary fell.
  const manager: any = {
    createQueryBuilder,
    transaction: jest.fn(async (run: (m: any) => Promise<unknown>) => {
      depth += 1;
      try {
        return await run(manager);
      } finally {
        depth -= 1;
      }
    }),
  };

  const repo = {
    createQueryBuilder,
    findOne: jest.fn(),
    manager,
  } as any;

  return {
    repo: repo as any,
    ops,
    manager,
    /** Rows handed to each INSERT, in order — i.e. the batching. */
    batches: () =>
      ops.filter((o) => o.type === 'insert').map((o) => o.rows as T[]),
    deletes: () => ops.filter((o) => o.type === 'delete').length,
    /** Statements that ran outside a transaction — for the reload, this should be none. */
    outsideTransaction: () => ops.filter((o) => !o.inTransaction),
  };
}
