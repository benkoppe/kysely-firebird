import { Dialect, Kysely } from "kysely";
import { FirebirdPool } from "./firebird";
import { Logger } from "./logger";
import { FirebirdDriver } from "./driver";
import { FirebirdAdapter } from "./adapter";
import { FirebirdIntrospector, IntrospectorDB } from "./introspector";
import { FirebirdQueryCompiler } from "./query-compiler";

export interface FirebirdDialectConfig {
  pool: FirebirdPool;
  logger?: Logger;
}

export class FirebirdDialect implements Dialect {
  readonly #config: FirebirdDialectConfig;

  constructor(config: FirebirdDialectConfig) {
    this.#config = config;
  }

  createDriver(): FirebirdDriver {
    return new FirebirdDriver(this.#config);
  }

  createAdapter(): FirebirdAdapter {
    return new FirebirdAdapter();
  }

  createIntrospector(db: Kysely<IntrospectorDB>): FirebirdIntrospector {
    return new FirebirdIntrospector(db);
  }

  createQueryCompiler(): FirebirdQueryCompiler {
    return new FirebirdQueryCompiler();
  }
}
