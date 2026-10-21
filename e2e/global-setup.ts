import { execSync } from "node:child_process";

export default function globalSetup() {
  const run = (cmd: string) => execSync(`npx dotenv -e .env.e2e -- ${cmd}`, { stdio: "inherit" });
  run("prisma migrate deploy");
  run("tsx scripts/reset-test-db.ts");
  run("tsx prisma/seed.ts");
  run("tsx e2e/fixtures.ts");
  run('tsx scripts/create-admin.ts e2e-admin@wanderpaw.test "E2E-admin-password-1" "E2E Admin"');
}
