import { Driver } from "kysely";
import { FirebirdConnection } from "./connection";
import { defaultLogger, Logger } from "./logger";
import { FirebirdDialectConfig } from "./dialect";
import { FirebirdDb } from "./firebird";

export class FirebirdDriver implements Driver {
  readonly #config: FirebirdDialectConfig;
  readonly #connections = new Map<string, FirebirdConnection>();
  readonly #log: Logger;

  constructor(config: FirebirdDialectConfig) {
    this.#config = config;
    this.#log = config.logger ? config.logger : defaultLogger;
  }

  async init(): Promise<void> {}

  async acquireConnection(): Promise<FirebirdConnection> {
    this.#log.debug("Acquiring connection");
    const db = await new Promise<FirebirdDb>((resolve, reject) => {
      this.#config.pool.get((err, db) => {
        if (err || !db) return reject(err);
        resolve(db);
      });
    });

    const connection = new FirebirdConnection(db, this.#log);
    this.#connections.set(connection.identifier, connection);
    this.#log.debug({ id: connection.identifier }, "Connection acquired");
    return connection;
  }

  async beginTransaction(connection: FirebirdConnection): Promise<void> {
    this.#log.debug({ id: connection.identifier }, "Beginning transaction");
  }

  async commitTransaction(connection: FirebirdConnection): Promise<void> {
    this.#log.debug({ id: connection.identifier }, "Transaction committed");
  }

  async rollbackTransaction(connection: FirebirdConnection): Promise<void> {
    this.#log.debug({ id: connection.identifier }, "Transaction rolled back");
  }

  async releaseConnection(connection: FirebirdConnection): Promise<void> {
    this.#log.debug({ id: connection.identifier }, "Releasing connection");
    try {
      await new Promise<void>((resolve, reject) => {
        this.#connections
          .get(connection.identifier)
          ?.connection.detach((err) => {
            if (err) return reject(err);
            resolve();
          });
      });
      this.#connections.delete(connection.identifier);
      this.#log.debug({ id: connection.identifier }, "Connection released");
    } catch (err) {
      this.#log.error(
        { id: connection.identifier, err },
        "Error closing connection",
      );
    }
  }

  async destroy(): Promise<void> {
    for (const connection of this.#connections.values()) {
      await this.releaseConnection(connection);
    }
    this.#config.pool?.destroy();
  }

  getConnection(id: string) {
    return this.#connections.get(id.toString());
  }
}
