import { describe, expect, it, vi } from "vitest";

import type { Db } from "@/db/client";
import { createPaymentAtomic } from "@/db/payments-atomic";

// Input validation runs before any query, so a throwing stub proves the
// transaction is never reached on invalid input. The happy path is covered
// by the local-DB validation flow (see PR notes), not unit tests.
const dbStub = {
  transaction: vi.fn(() => {
    throw new Error("transaction should not be reached");
  }),
} as unknown as Db;

const validInput = {
  userId: "00000000-0000-4000-8000-000000000001",
  debtId: "00000000-0000-4000-8000-000000000101",
  amount: 100,
  currency: "GTQ",
  paymentDate: "2026-07-19",
};

describe("createPaymentAtomic input validation", () => {
  it("rejects a missing userId", async () => {
    await expect(
      createPaymentAtomic(dbStub, { ...validInput, userId: "" }),
    ).rejects.toThrow("Unauthorized");
  });

  it("rejects non-positive amounts", async () => {
    await expect(
      createPaymentAtomic(dbStub, { ...validInput, amount: 0 }),
    ).rejects.toThrow("Invalid amount");
    await expect(
      createPaymentAtomic(dbStub, { ...validInput, amount: -5 }),
    ).rejects.toThrow("Invalid amount");
    await expect(
      createPaymentAtomic(dbStub, { ...validInput, amount: NaN }),
    ).rejects.toThrow("Invalid amount");
  });

  it("rejects unsupported currencies", async () => {
    await expect(
      createPaymentAtomic(dbStub, { ...validInput, currency: "EUR" }),
    ).rejects.toThrow("Invalid currency");
  });

  it("rejects malformed payment dates", async () => {
    await expect(
      createPaymentAtomic(dbStub, { ...validInput, paymentDate: "19/07/2026" }),
    ).rejects.toThrow("Invalid payment date");
  });

  it("does not touch the database on invalid input", async () => {
    await expect(
      createPaymentAtomic(dbStub, { ...validInput, currency: "EUR" }),
    ).rejects.toThrow();
    expect(dbStub.transaction).not.toHaveBeenCalled();
  });
});
