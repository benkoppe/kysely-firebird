# kysely-firebird

[Kysely](https://github.com/koskimas/kysely) Dialect and Type Generator for [Firebird DB](https://firebirdsql.org/). Utilizes [node-firebird](https://github.com/petersirka/node-firebirdsql) for database connectivity.

Implementation guided by [kysely-oracledb](https://github.com/griffiths-waite/kysely-oracledb).

## Installation

```bash
npm install kysely node-firebird kysely-firebird
```

> [!IMPORTANT]
> This project currently uses `node-firebird` version 1.2.x, which isn't yet released on npm.
> Install the library with `npm install hgourvest/node-firebird#e1c4dd9` to avoid any issues.

## Usage

### Firebird DB Dialect

To use the Dialect with Kysely, you must pass in a node-firebird `Pool` to the `FirebirdDialect` constructor.

Type-casting to unknown is required to satisfy TypeScript.

```typescript
// See the section below for more information on generating types.
import type { DB } from "./types.ts";

import Firebird from "node-firebird";
import { Kysely } from "kysely";
import { FirebirdDialect, FirebirdPool } from "kysely-firebird";

const options = {
  host: "host",
  port: 3050,
  database: "/path/to/database.fdb",
  user: "SYSDBA",
  password: "pass",
};

const pool = Firebird.pool(5, options);

const db = new Kysely<DB>({
  dialect: new FirebirdDialect({
    pool: pool as unknown as FirebirdPool,
  }),
});
```

You can now use the `db` instance to query your Firebird database.

```typescript
const users = await db
  .from("USERS")
  .select("ID", "NAME")
  .where("ID", "=", 1)
  .execute();
```

### Dialect Configuration

The dialect can be configured with the following options:

| Option   | Type            | Description                         | Required |
| -------- | --------------- | ----------------------------------- | -------- |
| `pool`   | `oracledb.Pool` | `node-firebird` DB connection pool. | Yes      |
| `logger` | `Logger`        | Logger instance for debug messages. | No       |

### Type Generation

Kysely requires you to define the types for your database schema. You can define these manually, or generate them using the `generate` function:

```typescript
import Firebird from "node-firebird";
import { generate } from "kysely-firebird";

const options = {
  host: "host",
  port: 3050,
  database: "/path/to/database.fdb",
  user: "SYSDBA",
  password: "pass",
};

const pool = Firebird.pool(5, options);

await generate({
  pool: pool as unknown as FirebirdPool,
});
```

This will generate a types file with the following structure:

```typescript
import type { Insertable, Selectable, Updateable } from "kysely";

interface UserTable {
  id: number;
  name: string;
}

export type User = Selectable<UserTable>;
export type NewUser = Insertable<UserTable>;
export type UserUpdate = Updateable<UserTable>;

export interface DB {
  user: UserTable;
}
```

### Generator Configuration

The generator can be configured with the same options as the dialect, plus the following options:

| Option             | Type                           | Description                                                     | Required |
| ------------------ | ------------------------------ | --------------------------------------------------------------- | -------- |
| `type`             | `"tables" \| "views" \| "all"` | Type of generation to perform.                                  | No       |
| `tables`           | `string[]`                     | List of tables to scope type generation.                        | No       |
| `checkDiff`        | `boolean`                      | Check for differences against existing types before generating. | No       |
| `metadata`         | `boolean`                      | Generate table metadata json file.                              | No       |
| `filePath`         | `string`                       | File path to write the types to.                                | No       |
| `metadataFilePath` | `string`                       | File path to write the metadata (json) to.                      | No       |
| `prettierOptions`  | `prettier.Options`             | Prettier options for formatting.                                | No       |
