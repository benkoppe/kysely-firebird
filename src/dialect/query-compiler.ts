import {
  CreateSchemaNode,
  CreateTableNode,
  CreateTypeNode,
  CreateViewNode,
  DefaultQueryCompiler,
  DropSchemaNode,
  DropTypeNode,
  InsertQueryNode,
  LimitNode,
  OffsetNode,
  OnConflictNode,
  ParensNode,
  SelectQueryNode,
  SetOperationNode,
} from "kysely";

const ID_WRAP_REGEX = /"/g;

export class FirebirdQueryCompiler extends DefaultQueryCompiler {
  protected override getLeftIdentifierWrapper(): string {
    return "";
  }

  protected override getRightIdentifierWrapper(): string {
    return "";
  }

  protected override sanitizeIdentifier(identifier: string): string {
    return identifier.replace(ID_WRAP_REGEX, '""');
  }

  protected override getCurrentParameterPlaceholder(): string {
    return "?";
  }

  protected override getAutoIncrement(): string {
    return "generated by default as identity";
  }

  protected override visitLimit(node: LimitNode): void {
    this.append("first ");
    this.visitNode(node.limit);
  }

  protected override visitOffset(node: OffsetNode): void {
    this.append("skip ");
    this.visitNode(node.offset);
  }

  protected override visitSelectQuery(node: SelectQueryNode): void {
    const wrapInParens =
      this.parentNode !== undefined &&
      !ParensNode.is(this.parentNode) &&
      !InsertQueryNode.is(this.parentNode) &&
      !CreateTableNode.is(this.parentNode) &&
      !CreateViewNode.is(this.parentNode) &&
      !SetOperationNode.is(this.parentNode);

    if (this.parentNode === undefined && node.explain) {
      this.visitNode(node.explain);
      this.append(" ");
    }

    if (wrapInParens) {
      this.append("(");
    }

    if (node.with) {
      this.visitNode(node.with);
      this.append(" ");
    }

    this.append("select");

    if (node.distinctOn) {
      this.append(" ");
      this.compileDistinctOn(node.distinctOn);
    }

    if (node.frontModifiers?.length) {
      this.append(" ");
      this.compileList(node.frontModifiers, " ");
    }

    if (node.top) {
      throw new Error("TOP not supported");
    }

    if (node.limit) {
      this.append(" ");
      this.visitNode(node.limit);
    }

    if (node.offset) {
      this.append(" ");
      this.visitNode(node.offset);
    }

    if (node.selections) {
      this.append(" ");
      this.compileList(node.selections);
    }

    if (node.from) {
      this.append(" ");
      this.visitNode(node.from);
    }

    if (node.joins) {
      this.append(" ");
      this.compileList(node.joins, " ");
    }

    if (node.where) {
      this.append(" ");
      this.visitNode(node.where);
    }

    if (node.groupBy) {
      this.append(" ");
      this.visitNode(node.groupBy);
    }

    if (node.having) {
      this.append(" ");
      this.visitNode(node.having);
    }

    if (node.setOperations) {
      this.append(" ");
      this.compileList(node.setOperations, " ");
    }

    if (node.orderBy) {
      this.append(" ");
      this.visitNode(node.orderBy);
    }

    if (node.fetch) {
      this.append(" ");
      this.visitNode(node.fetch);
    }

    if (node.endModifiers?.length) {
      this.append(" ");
      this.compileList(this.sortSelectModifiers([...node.endModifiers]), " ");
    }

    if (wrapInParens) {
      this.append(")");
    }
  }

  protected override visitOnConflict(_: OnConflictNode): void {
    throw new Error("ON CONFLICT is not supported in Firebird");
  }

  protected override visitCreateSchema(_: CreateSchemaNode): void {
    throw new Error("CREATE SCHEMA is not supported in Firebird");
  }

  protected override visitDropSchema(_: DropSchemaNode): void {
    throw new Error("DROP SCHEMA is not supported in Firebird");
  }

  protected override visitCreateType(_: CreateTypeNode): void {
    throw new Error("CREATE TYPE is not supported in Firebird");
  }

  protected override visitDropType(_: DropTypeNode): void {
    throw new Error("DROP TYPE is not supported in Firebird");
  }
}
