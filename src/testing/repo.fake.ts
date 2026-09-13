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
}

export function makeFakeRepo<T>() {
  const ops: RecordedOp[] = [];

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
        ops.push(pending as RecordedOp);
        return {};
      },
    };
    return qb;
  });

  const repo = {
    createQueryBuilder,
    findOne: jest.fn(),
  } as any;

  return {
    repo: repo as any,
    ops,
    /** Rows handed to each INSERT, in order — i.e. the batching. */
    batches: () =>
      ops.filter((o) => o.type === 'insert').map((o) => o.rows as T[]),
    deletes: () => ops.filter((o) => o.type === 'delete').length,
  };
}
