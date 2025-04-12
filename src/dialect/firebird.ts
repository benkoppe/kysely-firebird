import { EventEmitter } from "events";

export interface FirebirdConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  lowercase_keys: boolean;
}

export interface FirebirdDb extends EventEmitter {
  query(
    sql: string,
    callback: (err: Error | null, result: any[]) => void,
  ): void;
  query(
    sql: string,
    params: any[],
    callback: (err: Error | null, result: any[]) => void,
  ): void;

  execute(
    sql: string,
    callback: (err: Error | null, result: any[][]) => void,
  ): void;
  execute(
    sql: string,
    params: any[],
    callback: (err: Error | null, result: any[][]) => void,
  ): void;

  sequentially(
    sql: string,
    rowCallback: (row: any, index: number) => void,
    done: (err: Error | null) => void,
  ): void;
  sequentially(
    sql: string,
    params: any[],
    rowCallback: (row: any, index: number) => void,
    done: (err: Error | null) => void,
  ): void;

  detach(callback?: (err: Error | null) => void): void;

  transaction(
    isolation: number,
    callback: (err: Error | null, transaction?: FirebirdTransaction) => void,
  ): void;

  escape?(value: any): string;
}

export interface FirebirdTransaction {
  query(
    sql: string,
    callback: (err: Error | null, result: any[]) => void,
  ): void;
  query(
    sql: string,
    params: any[],
    callback: (err: Error | null, result: any[]) => void,
  ): void;

  execute(
    sql: string,
    callback: (err: Error | null, result: any[][]) => void,
  ): void;
  execute(
    sql: string,
    params: any[],
    callback: (err: Error | null, result: any[][]) => void,
  ): void;

  commit(callback: (err: Error | null) => void): void;
  rollback(callback: (err: Error | null) => void): void;
}
