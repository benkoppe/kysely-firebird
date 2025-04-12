import {
  DatabaseIntrospector,
  DatabaseMetadata,
  DatabaseMetadataOptions,
  Kysely,
  SchemaMetadata,
  TableMetadata,
} from "kysely";

export interface RdbRelationsTable {
  RDB$RELATION_NAME: string;
  RDB$SYSTEM_FLAG: number | null;
  RDB$VIEW_SOURCE: string | null;
}

export interface RdbRelationFieldsTable {
  RDB$RELATION_NAME: string;
  RDB$FIELD_NAME: string;
  RDB$FIELD_TYPE: number;
  RDB$FIELD_LENGTH: number | null;
  RDB$FIELD_PRECISION: number | null;
  RDB$FIELD_SCALE: number | null;
  RDB$NULL_FLAG: number | null;
  RDB$DEFAULT_SOURCE: string | null;
}

export interface IntrospectorDB {
  RdbRelations: RdbRelationsTable;
  RdbRelationFields: RdbRelationFieldsTable;
}

export class FirebirdIntrospector implements DatabaseIntrospector {
  readonly #db: Kysely<IntrospectorDB>;

  constructor(db: Kysely<IntrospectorDB>) {
    this.#db = db;
  }

  async getSchemas(): Promise<SchemaMetadata[]> {
    return [{ name: "default" }];
  }

  async getTables(
    _options?: DatabaseMetadataOptions,
  ): Promise<TableMetadata[]> {
    const rawTables = await this.#db
      .selectFrom("RdbRelations")
      .select(["RDB$RELATION_NAME", "RDB$SYSTEM_FLAG", "RDB$VIEW_SOURCE"])
      .where("RDB$SYSTEM_FLAG", "=", 0)
      .where("RDB$VIEW_SOURCE", "is", null)
      .execute();

    const rawColumns = await this.#db
      .selectFrom("RdbRelationFields")
      .select([
        "RDB$RELATION_NAME",
        "RDB$FIELD_NAME",
        "RDB$FIELD_TYPE",
        "RDB$FIELD_LENGTH",
        "RDB$FIELD_PRECISION",
        "RDB$FIELD_SCALE",
        "RDB$NULL_FLAG",
        "RDB$DEFAULT_SOURCE",
      ])
      .execute();

    const tables = rawTables.map((table) => {
      // Trim trailing spaces from table names
      const tableName = table.RDB$RELATION_NAME.trim();
      const columns = rawColumns
        .filter((col) => col.RDB$RELATION_NAME.trim() === tableName)
        .map((col) => ({
          name: col.RDB$FIELD_NAME.trim(),
          // Map Firebird field type codes (or use a join with RDB$FIELDS for proper names)
          dataType: col.RDB$FIELD_TYPE.toString(),
          dataLength: col.RDB$FIELD_LENGTH,
          dataPrecision: col.RDB$FIELD_PRECISION,
          dataScale: col.RDB$FIELD_SCALE,
          // In Firebird a NOT NULL constraint is indicated by a non-null RDB$NULL_FLAG
          isNullable: col.RDB$NULL_FLAG !== 1,
          hasDefaultValue: col.RDB$DEFAULT_SOURCE !== null,
          isAutoIncrementing: false, // Adjust this if you detect generator-trigger patterns
        }));
      return {
        schema: "default",
        name: tableName,
        isView: false,
        columns,
      };
    });

    return tables;
  }

  async getViews(_options?: DatabaseMetadataOptions): Promise<TableMetadata[]> {
    // Views are identified in RDB$RELATIONS by a non-null RDB$VIEW_SOURCE.
    const rawViews = await this.#db
      .selectFrom("RdbRelations")
      .select(["RDB$RELATION_NAME", "RDB$VIEW_SOURCE"])
      .where("RDB$VIEW_SOURCE", "is not", null)
      .execute();

    const rawColumns = await this.#db
      .selectFrom("RdbRelationFields")
      .select([
        "RDB$RELATION_NAME",
        "RDB$FIELD_NAME",
        "RDB$FIELD_TYPE",
        "RDB$FIELD_LENGTH",
        "RDB$FIELD_PRECISION",
        "RDB$FIELD_SCALE",
        "RDB$NULL_FLAG",
        "RDB$DEFAULT_SOURCE",
      ])
      .execute();

    const views = rawViews.map((view) => {
      // Trim trailing spaces from the view name
      const viewName = view.RDB$RELATION_NAME.trim();
      const columns = rawColumns
        .filter((col) => col.RDB$RELATION_NAME.trim() === viewName)
        .map((col) => ({
          name: col.RDB$FIELD_NAME.trim(),
          // Convert the numeric type code to a string (consider mapping to more descriptive type names as needed)
          dataType: col.RDB$FIELD_TYPE.toString(),
          dataLength: col.RDB$FIELD_LENGTH,
          dataPrecision: col.RDB$FIELD_PRECISION,
          dataScale: col.RDB$FIELD_SCALE,
          // In Firebird, a non-null NULL_FLAG usually indicates a NOT NULL constraint
          isNullable: col.RDB$NULL_FLAG !== 1,
          hasDefaultValue: col.RDB$DEFAULT_SOURCE !== null,
          isAutoIncrementing: false, // Modify as necessary if detecting generator-trigger patterns
        }));
      return {
        schema: "default", // Adjust if using explicit schema support in Firebird 3.0+
        name: viewName,
        isView: true,
        columns,
      };
    });

    return views;
  }

  async getMetadata(
    _options?: DatabaseMetadataOptions,
  ): Promise<DatabaseMetadata> {
    const tables = await this.getTables();
    const views = await this.getViews();
    return {
      tables: [...tables, ...views],
    };
  }
}
