// Runs a local Postgres (no Docker) with data in ./.pgdata. Keep this process running.
import EmbeddedPostgres from "embedded-postgres";
import fs from "fs";

const dir = "./.pgdata";
const pg = new EmbeddedPostgres({ databaseDir: dir, user: "iip", password: "iip", port: 5433, persistent: true });

if (!fs.existsSync(`${dir}/PG_VERSION`)) await pg.initialise();
await pg.start();
try {
  await pg.createDatabase("iip");
} catch {
  // already exists
}
console.log("Postgres ready on localhost:5433 (db: iip)");

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
