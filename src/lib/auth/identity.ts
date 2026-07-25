import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import { getDb, schema } from "@/db/client";
import { getAuth } from "@/lib/auth/server";
import { isBetterAuthEnabled } from "@/lib/auth/provider";
import { createAdminClient } from "@/lib/supabase/server";

export type AuthIdentityUser = {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  createdAt: string;
  bannedUntil: string | null;
  lastSignInAt: string | null;
  raw?: Record<string, unknown>;
};

const BAN_DURATION_HOURS: Record<string, number | null> = {
  none: null,
  "24h": 24,
  "72h": 72,
  "168h": 168,
  "720h": 720,
  "8760h": 8760,
};

function bannedUntilFromDuration(duration: string): Date | null {
  const hours = BAN_DURATION_HOURS[duration];
  if (hours === undefined) {
    throw new Error(`Invalid ban duration: ${duration}`);
  }
  if (hours === null) return null;
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

/** List users for admin UIs. */
export async function listIdentityUsers(options?: {
  page?: number;
  perPage?: number;
  search?: string;
}): Promise<{ users: AuthIdentityUser[]; total: number }> {
  const page = options?.page || 1;
  const perPage = options?.perPage || 20;

  if (!isBetterAuthEnabled()) {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users) {
      return { users: [], total: 0 };
    }
    return {
      total: data.total ?? data.users.length,
      users: data.users.map((u) => ({
        id: u.id,
        email: u.email || "",
        name:
          typeof u.user_metadata?.full_name === "string"
            ? u.user_metadata.full_name
            : typeof u.user_metadata?.name === "string"
              ? u.user_metadata.name
              : null,
        emailVerified: Boolean(u.email_confirmed_at),
        createdAt: u.created_at,
        bannedUntil:
          (u as { banned_until?: string | null }).banned_until ?? null,
        lastSignInAt: u.last_sign_in_at ?? null,
        raw: u as unknown as Record<string, unknown>,
      })),
    };
  }

  const db = getDb();
  const search = options?.search?.trim();
  const where = search
    ? or(
        ilike(schema.users.email, `%${search}%`),
        ilike(schema.users.name, `%${search}%`),
      )
    : undefined;

  const [rows, countRow] = await Promise.all([
    db
      .select()
      .from(schema.users)
      .where(where)
      .orderBy(desc(schema.users.createdAt))
      .limit(perPage)
      .offset((page - 1) * perPage),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.users)
      .where(where),
  ]);

  return {
    total: countRow[0]?.count ?? 0,
    users: rows.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      emailVerified: u.emailVerified,
      createdAt: u.createdAt.toISOString(),
      bannedUntil: u.bannedUntil?.toISOString() ?? null,
      lastSignInAt: null,
    })),
  };
}

export async function getIdentityUserById(
  userId: string,
): Promise<AuthIdentityUser | null> {
  if (!isBetterAuthEnabled()) {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data?.user) return null;
    const u = data.user;
    return {
      id: u.id,
      email: u.email || "",
      name:
        typeof u.user_metadata?.full_name === "string"
          ? u.user_metadata.full_name
          : typeof u.user_metadata?.name === "string"
            ? u.user_metadata.name
            : null,
      emailVerified: Boolean(u.email_confirmed_at),
      createdAt: u.created_at,
      bannedUntil: (u as { banned_until?: string | null }).banned_until ?? null,
      lastSignInAt: u.last_sign_in_at ?? null,
      raw: u as unknown as Record<string, unknown>,
    };
  }

  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    emailVerified: row.emailVerified,
    createdAt: row.createdAt.toISOString(),
    bannedUntil: row.bannedUntil?.toISOString() ?? null,
    lastSignInAt: null,
  };
}

export async function isIdentityUserBanned(userId: string): Promise<boolean> {
  const user = await getIdentityUserById(userId);
  if (!user?.bannedUntil) return false;
  return new Date(user.bannedUntil).getTime() > Date.now();
}

export async function setIdentityUserBan(
  userId: string,
  duration: string,
): Promise<{ bannedUntil: string | null }> {
  if (!isBetterAuthEnabled()) {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: duration as
        | "none"
        | "24h"
        | "72h"
        | "168h"
        | "720h"
        | "8760h",
    });
    if (error) throw new Error(error.message);
    return {
      bannedUntil:
        (data.user as { banned_until?: string | null }).banned_until ?? null,
    };
  }

  const until = bannedUntilFromDuration(duration);
  const db = getDb();
  await db
    .update(schema.users)
    .set({ bannedUntil: until })
    .where(eq(schema.users.id, userId));
  return { bannedUntil: until?.toISOString() ?? null };
}

export async function createIdentityUser(input: {
  email: string;
  password: string;
  name?: string;
  emailVerified?: boolean;
}): Promise<{ id: string }> {
  if (!isBetterAuthEnabled()) {
    const admin = createAdminClient();
    const displayName = input.name?.trim() || "";
    const { data, error } = await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: input.emailVerified ?? false,
      user_metadata: displayName
        ? { full_name: displayName, name: displayName }
        : {},
    });
    if (error || !data?.user) {
      throw new Error(error?.message || "Failed to create user");
    }
    return { id: data.user.id };
  }

  const result = await getAuth().api.signUpEmail({
    body: {
      email: input.email,
      password: input.password,
      name: input.name?.trim() || input.email.split("@")[0] || "Usuario",
    },
  });

  if (!result?.user?.id) {
    throw new Error("Failed to create user via better-auth");
  }

  if (input.emailVerified) {
    const db = getDb();
    await db
      .update(schema.users)
      .set({ emailVerified: true })
      .where(eq(schema.users.id, result.user.id));
  }

  return { id: result.user.id };
}

export async function updateIdentityUser(
  userId: string,
  patch: {
    name?: string;
    emailVerified?: boolean;
    email?: string;
  },
): Promise<void> {
  if (!isBetterAuthEnabled()) {
    const admin = createAdminClient();
    const payload: {
      email?: string;
      email_confirm?: boolean;
      user_metadata?: Record<string, string>;
    } = {};
    if (patch.email) payload.email = patch.email;
    if (typeof patch.emailVerified === "boolean") {
      payload.email_confirm = patch.emailVerified;
    }
    if (patch.name !== undefined) {
      const { data: existing } = await admin.auth.admin.getUserById(userId);
      const previousMeta =
        existing?.user?.user_metadata &&
        typeof existing.user.user_metadata === "object"
          ? (existing.user.user_metadata as Record<string, unknown>)
          : {};
      payload.user_metadata = {
        ...Object.fromEntries(
          Object.entries(previousMeta).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        ),
        full_name: patch.name,
        name: patch.name,
      };
    }
    const { error } = await admin.auth.admin.updateUserById(userId, payload);
    if (error) throw new Error(error.message);
    return;
  }

  const db = getDb();
  await db
    .update(schema.users)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.email !== undefined ? { email: patch.email } : {}),
      ...(typeof patch.emailVerified === "boolean"
        ? { emailVerified: patch.emailVerified }
        : {}),
    })
    .where(eq(schema.users.id, userId));
}

export async function deleteIdentityUser(userId: string): Promise<void> {
  if (!isBetterAuthEnabled()) {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    return;
  }

  const db = getDb();
  await db.delete(schema.users).where(eq(schema.users.id, userId));
}

/** Convenience for lockout + ban checks that only need email/ban. */
export async function findIdentityUserByEmail(
  email: string,
): Promise<AuthIdentityUser | null> {
  if (!isBetterAuthEnabled()) {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const match = data?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (!match) return null;
    return getIdentityUserById(match.id);
  }

  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email.toLowerCase()))
    .limit(1);
  if (!row) {
    const [row2] = await db
      .select()
      .from(schema.users)
      .where(and(ilike(schema.users.email, email)))
      .limit(1);
    if (!row2) return null;
    return {
      id: row2.id,
      email: row2.email,
      name: row2.name,
      emailVerified: row2.emailVerified,
      createdAt: row2.createdAt.toISOString(),
      bannedUntil: row2.bannedUntil?.toISOString() ?? null,
      lastSignInAt: null,
    };
  }
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    emailVerified: row.emailVerified,
    createdAt: row.createdAt.toISOString(),
    bannedUntil: row.bannedUntil?.toISOString() ?? null,
    lastSignInAt: null,
  };
}
