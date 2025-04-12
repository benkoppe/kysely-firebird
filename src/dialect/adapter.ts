import { DialectAdapterBase, Kysely, MigrationLockOptions } from "kysely";

export class FirebirdAdapter extends DialectAdapterBase {
  #supportsCreateIfNotExists = false;
  #supportsReturning = true;
  #supportsTransactionalDdl = true;

  override get supportsCreateIfNotExists(): boolean {
    return this.#supportsCreateIfNotExists;
  }

  override get supportsReturning(): boolean {
    return this.#supportsReturning;
  }

  override get supportsTransactionalDdl(): boolean {
    return this.#supportsTransactionalDdl;
  }

  async acquireMigrationLock(
    db: Kysely<any>,
    options: MigrationLockOptions,
  ): Promise<void> {
    const queryDb = options.lockTableSchema
      ? db.withSchema(options.lockTableSchema)
      : db;

    await queryDb
      .selectFrom(options.lockTable)
      .selectAll()
      .where("id", "=", options.lockRowId)
      .forUpdate()
      .execute();
  }

  async releaseMigrationLock(_: Kysely<any>): Promise<void> {
    return;
  }
}
