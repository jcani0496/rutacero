import { and, eq, sql } from "drizzle-orm";

import type { Db } from "./client";
import { debts, payments, tenantMemberships } from "./schema";

export interface CreatePaymentAtomicInput {
  /** Authenticated caller — replaces auth.uid() from the SQL function. */
  userId: string;
  debtId: string;
  amount: number;
  currency: string;
  /** ISO date (YYYY-MM-DD). */
  paymentDate: string;
  paymentMethod?: string | null;
}

export interface CreatePaymentAtomicResult {
  paymentId: string;
  paymentAmount: number;
  newDebtBalance: number;
  newDebtStatus: "ACTIVE" | "PAID_OFF";
}

/**
 * Port of the SQL function `create_payment_atomic` v2 (migration 025) to a
 * Drizzle transaction. Same semantics, but ownership is enforced with the
 * caller-provided userId instead of auth.uid() (no Supabase JWT anymore).
 *
 * Not wired into any route yet — Phase 3 replaces the
 * `supabase.rpc("create_payment_atomic", ...)` call sites with this.
 */
export async function createPaymentAtomic(
  db: Db,
  input: CreatePaymentAtomicInput,
): Promise<CreatePaymentAtomicResult> {
  const { userId, debtId, amount, currency, paymentDate, paymentMethod } =
    input;

  if (!userId) {
    throw new Error("Unauthorized");
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid amount");
  }
  if (currency !== "GTQ" && currency !== "USD") {
    throw new Error("Invalid currency");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
    throw new Error("Invalid payment date");
  }

  return db.transaction(async (tx) => {
    // Row lock so concurrent payments against the same debt serialize,
    // mirroring the SELECT ... FOR UPDATE in the SQL function.
    const [debt] = await tx
      .select({
        balance: debts.balance,
        userId: debts.userId,
        tenantId: debts.tenantId,
      })
      .from(debts)
      .where(eq(debts.id, debtId))
      .for("update");

    if (!debt) {
      throw new Error("Debt not found");
    }
    if (debt.userId !== userId) {
      throw new Error("Unauthorized: Debt does not belong to user");
    }

    const [membership] = await tx
      .select({ tenantId: tenantMemberships.tenantId })
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.tenantId, debt.tenantId),
          eq(tenantMemberships.userId, userId),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new Error("Unauthorized: Not a member of tenant");
    }

    const currentBalance = Number(debt.balance);
    const newBalance = Math.max(0, currentBalance - amount);
    const newStatus: CreatePaymentAtomicResult["newDebtStatus"] =
      newBalance === 0 ? "PAID_OFF" : "ACTIVE";

    const [inserted] = await tx
      .insert(payments)
      .values({
        tenantId: debt.tenantId,
        userId,
        debtId,
        amount: String(amount),
        currency,
        paymentDate,
        method: paymentMethod ?? null,
      })
      .returning({ id: payments.id });

    await tx
      .update(debts)
      .set({
        balance: String(newBalance),
        status: newStatus,
        updatedAt: sql`now()`,
      })
      .where(eq(debts.id, debtId));

    return {
      paymentId: inserted.id,
      paymentAmount: amount,
      newDebtBalance: newBalance,
      newDebtStatus: newStatus,
    };
  });
}
