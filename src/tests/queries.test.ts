import { DummyDriver, Generated, Kysely } from "kysely";
import { describe, expect, test } from "vitest";
import { FirebirdAdapter } from "../dialect/adapter";
import { FirebirdIntrospector } from "../dialect/introspector";
import { FirebirdQueryCompiler } from "../dialect/query-compiler";

// create a "cold" instance and test its generated queries
// docs on cold instances: https://kysely.dev/docs/recipes/splitting-query-building-and-execution

interface Person {
  id: Generated<number>;
  first_name: string;
  last_name: string | null;
}

interface Database {
  person: Person;
}

const db = new Kysely<Database>({
  dialect: {
    createAdapter: () => new FirebirdAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (db) => new FirebirdIntrospector(db),
    createQueryCompiler: () => new FirebirdQueryCompiler(),
  },
});

function testQuery({
  name,
  buildQuery,
  expectedSql,
  expectedParams = [],
}: {
  name: string;
  buildQuery: () => ReturnType<typeof db.selectFrom>["compile"];
  expectedSql: string;
  expectedParams?: unknown[];
}) {
  test(name, () => {
    const compiled = buildQuery();
    expect(compiled.sql).toBe(expectedSql);
    expect(compiled.parameters).toEqual(expectedParams);
  });
}

describe("cold queries", () => {
  testQuery({
    name: "simple select",
    buildQuery: () => db.selectFrom("person").select("first_name").compile(),
    expectedSql: "select first_name from person",
  });
  testQuery({
    name: "select all",
    buildQuery: () => db.selectFrom("person").selectAll().compile(),
    expectedSql: "select * from person",
  });
  testQuery({
    name: "select all where",
    buildQuery: () =>
      db.selectFrom("person").selectAll().where("id", "=", 1).compile(),
    expectedSql: "select * from person where id = ?",
    expectedParams: [1],
  });
  testQuery({
    name: "select with alias",
    buildQuery: () =>
      db.selectFrom("person").select(["first_name as fname"]).compile(),
    expectedSql: `select first_name as fname from person`,
  });
  testQuery({
    name: "select with alias",
    buildQuery: () =>
      db.selectFrom("person").select(["first_name as fname"]).compile(),
    expectedSql: `select first_name as fname from person`,
  });

  testQuery({
    name: "select with order and pagination",
    buildQuery: () =>
      db
        .selectFrom("person")
        .select(["id", "first_name"])
        .orderBy("id", "asc")
        .limit(10)
        .offset(5)
        .compile(),
    expectedSql: `select first ? skip ? id, first_name from person order by id asc`,
    expectedParams: [10, 5],
  });

  testQuery({
    name: "insert person",
    buildQuery: () =>
      db
        .insertInto("person")
        .values({ first_name: "John", last_name: "Doe" })
        .compile(),
    expectedSql: `insert into person (first_name, last_name) values (?, ?)`,
    expectedParams: ["John", "Doe"],
  });

  testQuery({
    name: "update person",
    buildQuery: () =>
      db
        .updateTable("person")
        .set({ last_name: "Smith" })
        .where("id", "=", 1)
        .compile(),
    expectedSql: `update person set last_name = ? where id = ?`,
    expectedParams: ["Smith", 1],
  });

  testQuery({
    name: "delete person",
    buildQuery: () => db.deleteFrom("person").where("id", "=", 2).compile(),
    expectedSql: `delete from person where id = ?`,
    expectedParams: [2],
  });

  testQuery({
    name: "select with join",
    buildQuery: () =>
      db
        .selectFrom("person")
        .innerJoin("person as p2", "p2.id", "person.id")
        .select(["person.first_name", "p2.last_name"])
        .compile(),
    expectedSql: `select person.first_name, p2.last_name from person inner join person as p2 on p2.id = person.id`,
  });

  testQuery({
    name: "select with aggregation",
    buildQuery: () =>
      db
        .selectFrom("person")
        .select((eb) => [eb.fn.count("id").as("count")])
        .compile(),
    expectedSql: `select count(id) as count from person`,
  });

  testQuery({
    name: "case-insensitive search with containing",
    buildQuery: () =>
      db
        .selectFrom("person")
        .selectAll()
        .where("first_name", "ilike", "john")
        .compile(),
    expectedSql: `select * from person where first_name containing ?`,
    expectedParams: ["john"],
  });
});
