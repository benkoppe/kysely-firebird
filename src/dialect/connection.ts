import { CompiledQuery, DatabaseConnection, QueryResult } from "kysely";
import { v4 as uuid } from "uuid";
import { FirebirdDb, FirebirdTransaction } from "./firebird.js";
import { Logger } from "./logger.js";

export class FirebirdConnection implements DatabaseConnection {
  #connection: FirebirdDb;
  #identifier: string;
  #log: Logger;

  #transaction: FirebirdTransaction | null;

  constructor(connection: FirebirdDb, logger: Logger) {
    this.#connection = connection;
    this.#log = logger;
    this.#identifier = uuid();
    this.#transaction = null;
  }

  async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    const { sql, parameters } = compiledQuery;
    const bindParams = parameters as unknown[];

    const startTime = new Date();
    this.#log.debug(
      { sql: this.formatQueryForLogging(compiledQuery), id: this.#identifier },
      "Executing query",
    );

    const queryMaker = this.#transaction ?? this.#connection;

    try {
      const rows: R[] = await new Promise((resolve, reject) => {
        queryMaker.query(sql, bindParams, (err, result) => {
          if (err) return reject(err);

          // ensure result is an array
          resolve(Array.isArray(result) ? (result as R[]) : [result as R]);
        });
      });

      const endTime = new Date();
      this.#log.debug(
        {
          durationMs: endTime.getTime() - startTime.getTime(),
          id: this.#identifier,
        },
        "Execution complete",
      );

      return {
        rows,
        numAffectedRows: undefined,
      };
    } catch (err) {
      const endTime = new Date();
      this.#log.error(
        {
          err,
          durationMs: endTime.getTime() - startTime.getTime(),
          id: this.#identifier,
        },
        "Error executing query",
      );
      throw err;
    }
  }

  formatQueryForLogging(query: CompiledQuery) {
    return query.sql.replace(/\$(\d+)/g, (_match, p1) => {
      const index = parseInt(p1, 10);
      const param = query.parameters[index - 1];
      return typeof param === "string"
        ? `'${param}'`
        : (param?.toString() ?? "null");
    });
  }

  streamQuery<R>(
    _compiledQuery: CompiledQuery,
  ): AsyncIterableIterator<QueryResult<R>> {
    throw new Error("Not implemented");
  }

  get identifier(): string {
    return this.#identifier;
  }

  get connection(): FirebirdDb {
    return this.#connection;
  }

  get transaction(): FirebirdTransaction | null {
    return this.#transaction;
  }

  hasActiveTransaction(): boolean {
    return this.#transaction !== null;
  }

  setActiveTransaction(newTransaction: FirebirdTransaction) {
    if (this.hasActiveTransaction()) {
      throw new Error(
        "You can't create a new transaction, one is already active",
      );
    }

    this.#transaction = newTransaction;
  }

  resetActiveTransaction() {
    if (!this.hasActiveTransaction()) {
      throw new Error("No transaction is active");
    }

    this.#transaction = null;
  }
}
