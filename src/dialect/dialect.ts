import { Dialect, Kysely } from "kysely";
import { FirebirdPool } from "./firebird.js";
import { Logger } from "./logger.js";
import { FirebirdDriver } from "./driver.js";
import { FirebirdAdapter } from "./adapter.js";
import { FirebirdIntrospector, IntrospectorDB } from "./introspector.js";
import { FirebirdQueryCompiler } from "./query-compiler.js";
import { Options as PrettierOptions } from "prettier";

export interface FirebirdDialectConfig {
  pool: FirebirdPool;
  logger?: Logger;
  generator?: {
    type?: "tables" | "views" | "all";
    tables?: string[]; // restrict tables/views to those listed
    checkDiff?: boolean;
    metadata?: boolean;
    filePath?: string;
    metadataFilePath?: string;
    prettierOptions?: PrettierOptions;
  };
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
