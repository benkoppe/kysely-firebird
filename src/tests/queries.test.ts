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

interface Post {
  id: Generated<number>;
  author_id: number;
  title: string;
}

interface Database {
  person: Person;
  post: Post;
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

  testQuery({
    name: "where with and conditions",
    buildQuery: () =>
      db
        .selectFrom("person")
        .selectAll()
        .where("first_name", "=", "John")
        .where("last_name", "=", "Smith")
        .compile(),
    expectedSql: `select * from person where first_name = ? and last_name = ?`,
    expectedParams: ["John", "Smith"],
  });

  testQuery({
    name: "where with or condition",
    buildQuery: () =>
      db
        .selectFrom("person")
        .selectAll()
        .where((eb) =>
          eb.or([
            eb("first_name", "=", "Alice"),
            eb("last_name", "=", "Smith"),
          ]),
        )
        .compile(),
    expectedSql: `select * from person where (first_name = ? or last_name = ?)`,
    expectedParams: ["Alice", "Smith"],
  });

  testQuery({
    name: "where in list",
    buildQuery: () =>
      db
        .selectFrom("person")
        .select(["id"])
        .where("id", "in", [1, 2, 3])
        .compile(),
    expectedSql: `select id from person where id in (?, ?, ?)`,
    expectedParams: [1, 2, 3],
  });

  testQuery({
    name: "where is null",
    buildQuery: () =>
      db
        .selectFrom("person")
        .selectAll()
        .where("last_name", "is", null)
        .compile(),
    expectedSql: `select * from person where last_name is null`,
  });

  testQuery({
    name: "where is not null",
    buildQuery: () =>
      db
        .selectFrom("person")
        .selectAll()
        .where("last_name", "is not", null)
        .compile(),
    expectedSql: `select * from person where last_name is not null`,
  });

  testQuery({
    name: "select distinct first_name",
    buildQuery: () =>
      db.selectFrom("person").distinct().select("first_name").compile(),
    expectedSql: `select distinct first_name from person`,
  });

  testQuery({
    name: "where with subquery",
    buildQuery: () =>
      db
        .selectFrom("person")
        .selectAll()
        .where("id", "=", (eb) =>
          eb.selectFrom("person").select("id").where("first_name", "=", "John"),
        )
        .compile(),
    expectedSql: `select * from person where id = (select id from person where first_name = ?)`,
    expectedParams: ["John"],
  });

  testQuery({
    name: "insert partial (only first_name)",
    buildQuery: () =>
      db.insertInto("person").values({ first_name: "Jane" }).compile(),
    expectedSql: `insert into person (first_name) values (?)`,
    expectedParams: ["Jane"],
  });

  testQuery({
    name: "update multiple columns",
    buildQuery: () =>
      db
        .updateTable("person")
        .set({ first_name: "Anna", last_name: "Brown" })
        .where("id", "=", 7)
        .compile(),
    expectedSql: `update person set first_name = ?, last_name = ? where id = ?`,
    expectedParams: ["Anna", "Brown", 7],
  });

  testQuery({
    name: "delete with subquery condition",
    buildQuery: () =>
      db
        .deleteFrom("person")
        .where("id", "in", (eb) =>
          eb
            .selectFrom("person")
            .select("id")
            .where("first_name", "=", "Ghost"),
        )
        .compile(),
    expectedSql: `delete from person where id in (select id from person where first_name = ?)`,
    expectedParams: ["Ghost"],
  });

  testQuery({
    name: "count posts per person with join, group by, and having",
    buildQuery: () =>
      db
        .selectFrom("person")
        .innerJoin("post", "post.author_id", "person.id")
        .select([
          "person.first_name",
          (eb) => eb.fn.count("post.id").as("post_count"),
        ])
        .groupBy("person.first_name")
        .having((eb) => eb.fn.count("post.id"), ">", 5)
        .orderBy("post_count", "desc")
        .compile(),
    expectedSql:
      "select person.first_name, count(post.id) as post_count from person " +
      "inner join post on post.author_id = person.id " +
      "group by person.first_name having count(post.id) > ? order by post_count desc",
    expectedParams: [5],
  });
});
