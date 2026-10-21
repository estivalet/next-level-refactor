import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { migrate } from './migrate.ts';

const V1 = {
  version: 1,
  sql: 'create table a (x integer);\n--> statement-breakpoint\ninsert into a values (1);',
};
const V2 = { version: 2, sql: 'create table b (y integer);' };
const BROKEN = {
  version: 2,
  sql: 'create table c (z integer);\n--> statement-breakpoint\nnot sql;',
};

let client: Database.Database;
afterEach(() => {
  client.close();
});

const version = () =>
  client.prepare("select value from meta where key = 'schema_version'").pluck().get();

describe('migrate', () => {
  it('NFR-REL-1: a fresh database runs every migration without a backup', () => {
    client = new Database(':memory:');
    const backups: number[] = [];
    expect(migrate(client, [V1, V2], (from) => backups.push(from))).toEqual({ from: 0, to: 2 });
    expect(version()).toBe('2');
    expect(client.prepare('select x from a').pluck().get()).toBe(1);
    expect(backups).toEqual([]);
  });

  it('NFR-REL-1: migrating an existing library backs it up first', () => {
    client = new Database(':memory:');
    migrate(client, [V1], () => undefined);
    const backups: Array<{ from: number; rows: unknown }> = [];
    migrate(client, [V1, V2], (from) =>
      backups.push({ from, rows: client.prepare('select x from a').pluck().all() }),
    );
    expect(backups).toEqual([{ from: 1, rows: [1] }]);
    expect(version()).toBe('2');
  });

  it('NFR-REL-1: a failing migration rolls back and keeps the old version', () => {
    client = new Database(':memory:');
    migrate(client, [V1], () => undefined);
    expect(() => migrate(client, [V1, BROKEN], () => undefined)).toThrow();
    expect(version()).toBe('1');
    expect(
      client.prepare("select count(*) from sqlite_master where name = 'c'").pluck().get(),
    ).toBe(0);
  });

  it('NFR-REL-1: an up-to-date library is not backed up', () => {
    client = new Database(':memory:');
    migrate(client, [V1], () => undefined);
    const backups: number[] = [];
    expect(migrate(client, [V1], (from) => backups.push(from))).toEqual({ from: 1, to: 1 });
    expect(backups).toEqual([]);
  });
});
