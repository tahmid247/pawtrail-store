import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createFirstAdmin } from "@/app/actions/setup";
import { resetDb } from "./helpers";

beforeEach(resetDb);

const fd = (email: string) => {
  const f = new FormData();
  Object.entries({ name: "Owner", email, password: "a-very-long-password", confirm: "a-very-long-password" }).forEach(([k, v]) => f.set(k, v));
  return f;
};

describe("first-run admin setup", () => {
  it("creates exactly one admin, even when two requests race, then locks itself", async () => {
    const [a, b] = await Promise.all([createFirstAdmin(null, fd("one@test.dev")), createFirstAdmin(null, fd("two@test.dev"))]);
    expect([a?.ok, b?.ok].filter(Boolean)).toHaveLength(1);
    expect(await prisma.user.count({ where: { role: "ADMIN" } })).toBe(1);
    const again = await createFirstAdmin(null, fd("three@test.dev"));
    expect(again?.error).toMatch(/already been completed/);
  });

  it("rejects short passwords", async () => {
    const f = fd("x@test.dev");
    f.set("password", "short");
    f.set("confirm", "short");
    expect((await createFirstAdmin(null, f))?.error).toBeTruthy();
    expect(await prisma.user.count()).toBe(0);
  });
});
