/**
 * F6 cutover: Supabase server clients removed from the production path.
 * Loose stubs keep dual-path TypeScript compiling.
 *
 * - Runtime (non-test): throws if called (dead branches must not run).
 * - Vitest: returns a chainable noop so mocked suites that still exercise
 *   legacy branches don't crash before their own vi.mock takes over.
 */

function removed(name: string): never {
  throw new Error(
    `${name} was removed in F6 (Supabase cutover). Use getDb() / getAppUser() instead.`,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createTestStub(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stub: any = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') return undefined;
        if (prop === 'catch') return undefined;
        return () => stub;
      },
    },
  );
  stub.from = () => stub;
  stub.select = () => stub;
  stub.insert = () => stub;
  stub.update = () => stub;
  stub.upsert = () => stub;
  stub.delete = () => stub;
  stub.eq = () => stub;
  stub.neq = () => stub;
  stub.order = () => stub;
  stub.limit = () => stub;
  stub.range = () => stub;
  stub.single = async () => ({ data: null, error: null });
  stub.maybeSingle = async () => ({ data: null, error: null });
  stub.then = (resolve: (value: { data: null; error: null; count: null }) => unknown) =>
    Promise.resolve(resolve({ data: null, error: null, count: null }));
  stub.auth = {
    getUser: async () => ({ data: { user: null }, error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
    signOut: async () => ({ error: null }),
    admin: {
      listUsers: async () => ({ data: { users: [], total: 0 }, error: null }),
      createUser: async () => ({ data: { user: null }, error: null }),
      deleteUser: async () => ({ data: null, error: null }),
      updateUserById: async () => ({ data: { user: null }, error: null }),
    },
  };
  stub.storage = { from: () => stub };
  stub.rpc = async () => ({ data: null, error: null });
  return stub;
}

function inTestRuntime() {
  return process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
}

/** @deprecated Removed in F6. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createClient(): Promise<any> {
  if (inTestRuntime()) return createTestStub();
  return removed('createClient');
}

/** @deprecated Removed in F6. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createAdminClient(): any {
  if (inTestRuntime()) return createTestStub();
  return removed('createAdminClient');
}
