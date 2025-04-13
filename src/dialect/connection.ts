import { CompiledQuery, DatabaseConnection, QueryResult } from "kysely";
import { v4 as uuid } from "uuid";
import { FirebirdDb, FirebirdTransaction } from "./firebird.js";
import { Logger } from "./logger.js";

export class FirebirdConnection implements DatabaseConnection {
  #connection: FirebirdDb;
  #identifier: string;
  #log: Logger;

  constructor(connection: FirebirdDb, logger: Logger) {
    this.#connection = connection;
    this.#log = logger;
    this.#identifier = uuid();
  }

  async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    const { sql, bindParams } = this.formatQuery(compiledQuery);
    const startTime = new Date();
    this.#log.debug(
      { sql: this.formatQueryForLogging(compiledQuery), id: this.#identifier },
      "Executing query",
    );

    try {
      const rows: R[] = await new Promise((resolve, reject) => {
        this.#connection.query(sql, bindParams, (err, result) => {
          if (err) return reject(err);

          resolve(result as R[]);
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

  formatQuery(query: CompiledQuery) {
    const expectedParams: number[] = [];
    const seenParams = new Set<number>();

    // Collect all parameter indices in order of appearance
    query.sql.replace(/\$(\d+)/g, (_match, p1) => {
      const index = parseInt(p1, 10);
      expectedParams.push(index);
      seenParams.add(index);
      return ""; // return value doesn't matter here
    });

    // Ensure parameters are in order: $1, $2, ..., $N without gaps or duplicates
    expectedParams.sort((a, b) => a - b);
    for (let i = 0; i < expectedParams.length; i++) {
      if (expectedParams[i] !== i + 1) {
        throw new Error(
          `Invalid parameter ordering. Expected $${i + 1} but found $${expectedParams[i]}`,
        );
      }
    }

    return {
      sql: query.sql.replace(/\$(\d+)/g, "?"), // Replace all $<num> with ?
      bindParams: query.parameters as unknown[],
    };
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
}
