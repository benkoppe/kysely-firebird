import Firebird from "node-firebird";
import { FirebirdPool } from "./dialect/firebird.js";
import { generate } from "./generator/generate.js";

const options = {
  host: "localhost",
  port: 3050,
  database: "/var/lib/firebird/data/test.fdb",
  user: "SYSDBA",
  password: "hello",
};

var pool = Firebird.pool(5, options);

(async () => {
  await generate({
    pool: pool as unknown as FirebirdPool,
    logger: console,
    generator: {
      metadata: true,
      tables: ["PERSON"],
    },
  });
})();
