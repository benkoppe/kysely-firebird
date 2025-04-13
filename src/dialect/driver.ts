import { Driver, TransactionSettings } from "kysely";
import { FirebirdConnection } from "./connection.js";
import { defaultLogger, Logger } from "./logger.js";
import { FirebirdDialectConfig } from "./dialect.js";
import { FirebirdDb, FirebirdTransaction } from "./firebird.js";
import Firebird from "node-firebird";

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

  async beginTransaction(
    connection: FirebirdConnection,
    settings: TransactionSettings,
  ): Promise<void> {
    this.#log.debug({ id: connection.identifier }, "Beginning transaction");

    if (connection.hasActiveTransaction()) {
      throw new Error("Transaction already active");
    }

    let isolationLevel: number[];
    if (settings.isolationLevel) {
      switch (settings.isolationLevel) {
        case "snapshot":
          isolationLevel = Firebird.ISOLATION_REPEATABLE_READ;
        case "serializable":
          isolationLevel = Firebird.ISOLATION_SERIALIZABLE;
        case "read committed":
          isolationLevel = Firebird.ISOLATION_READ_COMMITTED;
        case "read uncommitted":
          isolationLevel = Firebird.ISOLATION_READ_UNCOMMITTED;
        case "repeatable read":
          isolationLevel = Firebird.ISOLATION_REPEATABLE_READ;
      }
    } else {
      isolationLevel = Firebird.ISOLATION_READ_COMMITTED;
    }

    const tx = await new Promise<FirebirdTransaction>((resolve, reject) => {
      connection.connection.transaction(isolationLevel, (err, tx) => {
        if (err || !tx) return reject(err);
        resolve(tx);
      });
    });

    connection.setActiveTransaction(tx);
  }

  async commitTransaction(connection: FirebirdConnection): Promise<void> {
    this.#log.debug({ id: connection.identifier }, "Transaction committed");

    if (!connection.hasActiveTransaction()) {
      throw new Error("Transaction not active");
    }

    await new Promise<void>((resolve, reject) => {
      connection.transaction!.commit((err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    connection.resetActiveTransaction();
  }

  async rollbackTransaction(connection: FirebirdConnection): Promise<void> {
    this.#log.debug({ id: connection.identifier }, "Transaction rolled back");

    if (!connection.hasActiveTransaction()) {
      throw new Error("Transaction not active");
    }

    await new Promise<void>((resolve, reject) => {
      connection.transaction!.rollback((err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    connection.resetActiveTransaction();
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
