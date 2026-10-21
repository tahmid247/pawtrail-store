/** Empties every table of a TEST database (name must end in _test or _e2e). Never use on real data. */
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL ?? "";
const dbName = new URL(url).pathname.slice(1);
if (!/_(test|e2e)$/.test(dbName)) {
  console.error(`Refusing to truncate database "${dbName}" — only *_test or *_e2e databases are allowed.`);
  process.exit(1);
}
const prisma = new PrismaClient();
async function main() {
const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`;
await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"public"."${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
await prisma.$disconnect();
console.log(`Truncated ${tables.length} tables in ${dbName}.`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
