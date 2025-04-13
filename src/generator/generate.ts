import fs from "fs";
import path from "path";
import { ColumnMetadata, Kysely, TableMetadata } from "kysely";
import { typeMap } from "./map.js";
import { pascalCase } from "./utils.js";
import { format, Options } from "prettier";
import { FirebirdDialect, FirebirdDialectConfig } from "../dialect/dialect.js";
import { defaultLogger } from "../dialect/logger.js";
import { IntrospectorDB } from "../dialect/introspector.js";

interface TableTypes {
  table: string;
  tableTypeName: string;
  types: string;
}

const warningComment = `// This file was generated automatically. Please don't edit it manually!`;
const kyselyImport = `import type { Insertable, Selectable, Updateable, Generated } from 'kysely'`;
const generationComment = (date: string) => `// Timestamp: ${date}`;

export const generateFieldTypes = (fields: ColumnMetadata[]): string => {
  const fieldStrings = fields.map((field) => {
    const typeNumber = Number(field.dataType);
    if (isNaN(typeNumber)) {
      throw new Error(`Invalid type number: "${typeNumber}"`);
    }
    const type = typeMap[typeNumber];
    if (!type) {
      throw new Error(`Unsupported data type: ${field.dataType}`);
    }

    const types = [type];
    if (field.isNullable) {
      types.push("null");
    }
    const typesString = field.isAutoIncrementing
      ? `Generated<${types.join(" | ")}>`
      : types.join(" | ");
    return `'${field.name}': ${typesString}`;
  });
  return fieldStrings.join("\n");
};

export const generateTableTypes = (tables: TableMetadata[]): TableTypes[] => {
  return tables.map((table) => {
    const originalTableName = table.name;
    const pascalCaseTable = pascalCase(table.name);
    const tableString = `interface ${pascalCaseTable}Table {\n${generateFieldTypes(table.columns)}\n}`;
    const selectString = `export type ${pascalCaseTable} = Selectable<${pascalCaseTable}Table>`;
    const insertString = `export type New${pascalCaseTable} = Insertable<${pascalCaseTable}Table>`;
    const updateString = `export type ${pascalCaseTable}Update = Updateable<${pascalCaseTable}Table>`;
    return {
      table: originalTableName,
      tableTypeName: pascalCaseTable,
      types: `${tableString}\n${selectString}\n${insertString}\n${updateString}`,
    };
  });
};

export const generateDatabaseTypes = (tableTypes: TableTypes[]): string => {
  const tableTypesString = tableTypes.map(({ types }) => types).join("\n\n");
  const exportString = ["export interface DB {"];
  exportString.push(
    ...tableTypes.map(
      ({ table, tableTypeName }) => `${table}: ${tableTypeName}Table`,
    ),
    "}",
  );
  const importString = `${warningComment}\n${generationComment(new Date().toISOString())}\n\n${kyselyImport}`;
  return `${importString}\n\n${tableTypesString}\n\n${exportString.join("\n")}`;
};

export const formatTypes = async (
  types: string,
  options?: Options,
): Promise<string> => {
  return await format(
    types,
    options || {
      parser: "typescript",
      singleQuote: true,
      trailingComma: "all",
      endOfLine: "auto",
      tabWidth: 4,
      printWidth: 120,
      semi: true,
    },
  );
};

export const writeToFile = (types: string, path: string) => {
  fs.writeFileSync(path, types);
};

export const readFromFile = (path: string) => {
  return fs.readFileSync(path, "utf8");
};

export const checkDiff = (existingContent: string, newContent: string) => {
  const existingLines = existingContent.split("\n").slice(2);
  const newLines = newContent.split("\n").slice(2);
  const diff = newLines.find((line, index) => line !== existingLines[index]);
  return !!diff || existingLines.length !== newLines.length;
};

const updateTypes = (
  types: string,
  filePath: string,
  metadata: TableMetadata[],
  metadataFilePath: string,
  config: FirebirdDialectConfig,
) => {
  writeToFile(types, filePath);
  if (config.generator?.metadata) {
    writeToFile(JSON.stringify(metadata, null, 2), metadataFilePath);
  }
};

export const generate = async (config: FirebirdDialectConfig) => {
  const log = config.logger ? config.logger : defaultLogger;
  const type = config.generator?.type ?? "tables";
  try {
    const dialect = new FirebirdDialect(config);
    const db = new Kysely<IntrospectorDB>({ dialect });
    const introspector = dialect.createIntrospector(db);

    let tables: TableMetadata[];

    switch (type) {
      case "tables":
        tables = await introspector.getTables();
        break;
      case "views":
        tables = await introspector.getViews();
        break;
      case "all":
        tables = [
          ...(await introspector.getTables()),
          ...(await introspector.getViews()),
        ];
        break;
    }

    let tableTypes = generateTableTypes(tables);
    if (config.generator?.tables) {
      tableTypes = tableTypes.filter(({ table }) =>
        config.generator?.tables?.includes(table),
      );
    }
    const databaseTypes = generateDatabaseTypes(tableTypes);

    const formattedTypes = await formatTypes(
      databaseTypes,
      config?.generator?.prettierOptions,
    );

    const filePath =
      config.generator?.filePath || path.join(process.cwd(), "types.ts");
    const metadataFilePath =
      config.generator?.metadataFilePath ||
      path.join(process.cwd(), "tables.json");

    if (config.generator?.checkDiff) {
      let diff = true;

      try {
        const existingTypes = readFromFile(filePath);

        diff = checkDiff(existingTypes, formattedTypes);

        if (diff) {
          log.warn("Types have changed. Updating types file...");
        }
      } catch (err) {
        log.warn("Type file not found. Creating a new one...");
      }

      if (diff) {
        updateTypes(formattedTypes, filePath, tables, metadataFilePath, config);

        log.info("Types updated successfully");
      } else {
        log.info("Types have not changed");
      }
    } else {
      updateTypes(formattedTypes, filePath, tables, metadataFilePath, config);

      log.info("Types updated successfully");
    }

    await db.destroy();
  } catch (err) {
    log.error({ err }, "Error generating types");
  }
};
