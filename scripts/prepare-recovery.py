"""Prepare a guarded, atomic public-data recovery from a Lovable archive.

Reads custom dumps through pg_restore; never opens a database connection.
Only accepts a target consisting of identical partial source rows and known
bootstrap records created by handle_new_user / initial schema seeding.
"""
import collections
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'migration-package'
PG = '/opt/homebrew/opt/postgresql@18/bin/pg_restore'
SOURCE = OUT / 'makao-360-hub_260907.backup'
TARGET = OUT / 'target-before-recovery.backup'


def blocks(archive, schema):
    data = subprocess.check_output([PG, '--data-only', '--no-owner',
        '--no-privileges', '--schema=' + schema, '-f', '-', str(archive)], text=True)
    result = {}
    lines = iter(data.splitlines())
    for line in lines:
        m = re.fullmatch(r'COPY (\w+)\.(\w+) \((.+)\) FROM stdin;', line)
        if not m:
            continue
        rows = []
        for row in lines:
            if row == r'\.':
                break
            rows.append(row)
        result[m[2]] = (m[3].split(', '), rows)
    return result


def keyed(block, key):
    cols, rows = block
    idx = [cols.index(k) for k in key]
    return {tuple(r.split('\t')[i] for i in idx): r.split('\t') for r in rows}


def q(name):
    if not re.fullmatch(r'[a-z_][a-z_0-9]*', name):
        raise ValueError('Unexpected identifier')
    return '"' + name + '"'


def stage(f, schema, name, block, prefix):
    cols, rows = block
    temp = q(prefix + name)
    f.write(f'CREATE TEMP TABLE {temp} ON COMMIT DROP AS SELECT * FROM {q(schema)}.{q(name)} WITH NO DATA;\n')
    f.write(f'COPY {temp} ({", ".join(map(q, cols))}) FROM stdin;\n')
    f.write('\n'.join(rows) + ('\n' if rows else '') + '\\.\n')


def main():
    source, target = blocks(SOURCE, 'public'), blocks(TARGET, 'public')
    if len(source) != 47 or set(source) != set(target):
        raise ValueError('Unexpected public table inventory')
    report = {}
    for table, (cols, rows) in target.items():
        if cols != source[table][0]:
            raise ValueError('Column mismatch: ' + table)
        original = set(source[table][1])
        differences = [r.split('\t') for r in rows if r not in original]
        if differences:
            if table == 'profiles':
                by_user = keyed(source[table], ['user_id'])
                for r in differences:
                    d = dict(zip(cols, r))
                    if (d['user_id'],) not in by_user or d['kyc_status'] != 'unverified' or d['preferred_role'] != r'\N' or d['avatar_url'] != r'\N':
                        raise ValueError('Unexpected target profile; manual review needed')
            elif table == 'user_roles':
                src_users = set(keyed(source['profiles'], ['user_id']))
                for r in differences:
                    d = dict(zip(cols, r))
                    if d['role'] != 'tenant' or (d['user_id'],) not in src_users:
                        raise ValueError('Unexpected target role; manual review needed')
            elif table == 'audit_log':
                role_ids = set(keyed(target['user_roles'], ['id']))
                for r in differences:
                    d = dict(zip(cols, r))
                    if d['actor_id'] != r'\N' or d['action'] != 'role.insert' or d['entity_table'] != 'user_roles' or (d['entity_id'],) not in role_ids or json.loads(d['meta']) != {'op': 'INSERT', 'role': 'tenant'}:
                        raise ValueError('Unexpected target audit event; manual review needed')
            elif table == 'gl_accounts':
                by_code = keyed(source[table], ['code'])
                for r in differences:
                    original = by_code.get((r[cols.index('code')],))
                    if original is None or any(a != b for c,a,b in zip(cols,r,original) if c not in ['id', 'created_at', 'updated_at']):
                        raise ValueError('Unexpected target GL seed; manual review needed')
            else:
                raise ValueError(f'Non-export target rows in {table}: {len(differences)}; manual review needed')
        report[table] = {'source': len(source[table][1]), 'target_before': len(rows), 'bootstrap_rows': len(differences)}

    auth = blocks(SOURCE, 'auth')
    for table in ['users', 'identities']:
        if len(auth[table][1]) != 7818:
            raise ValueError('Unexpected Auth count')

    path = OUT / 'public-recovery.sql'
    os.umask(0o077)
    with path.open('w') as f:
        f.write('\\set ON_ERROR_STOP on\nBEGIN;\nSET LOCAL lock_timeout = \'15s\';\nSET LOCAL statement_timeout = \'5min\';\n')
        f.write('SET LOCAL session_replication_role = replica;\n')
        f.write('LOCK TABLE ' + ', '.join('public.' + q(t) for t in source) + ' IN ACCESS EXCLUSIVE MODE;\n')
        f.write('LOCK TABLE auth.users, auth.identities IN SHARE MODE;\n')
        for table in ['users', 'identities']:
            stage(f, 'auth', table, auth[table], 'source_auth_')
        f.write("DO $$ BEGIN IF (SELECT count(*) FROM auth.users) <> 7818 OR (SELECT count(*) FROM auth.identities) <> 7818 THEN RAISE EXCEPTION 'Unexpected live Auth count'; END IF;\n")
        f.write("IF EXISTS (SELECT 1 FROM source_auth_users s LEFT JOIN auth.users t ON t.id=s.id WHERE t.id IS NULL OR t.encrypted_password IS DISTINCT FROM s.encrypted_password OR t.email IS DISTINCT FROM s.email) THEN RAISE EXCEPTION 'Auth UUID/email/password mismatch'; END IF;\n")
        f.write("IF EXISTS (SELECT 1 FROM source_auth_identities s LEFT JOIN auth.identities t ON t.id=s.id WHERE t.id IS NULL OR t.user_id IS DISTINCT FROM s.user_id OR t.provider IS DISTINCT FROM s.provider OR t.identity_data IS DISTINCT FROM s.identity_data) THEN RAISE EXCEPTION 'Auth identity mismatch'; END IF; END $$;\n")
        for table in source:
            stage(f, 'public', table, source[table], 'source_')
            stage(f, 'public', table, target[table], 'before_')
            f.write(f"DO $$ BEGIN IF EXISTS ((SELECT * FROM public.{q(table)} EXCEPT ALL SELECT * FROM {q('before_' + table)}) UNION ALL (SELECT * FROM {q('before_' + table)} EXCEPT ALL SELECT * FROM public.{q(table)})) THEN RAISE EXCEPTION 'Target changed since backup: {table}'; END IF; END $$;\n")
        for table, (cols, rows) in source.items():
            colsql = ', '.join(map(q, cols))
            f.write(f'DELETE FROM public.{q(table)};\nINSERT INTO public.{q(table)} ({colsql}) SELECT {colsql} FROM {q("source_" + table)};\n')
        for table, (cols, rows) in source.items():
            f.write(f"DO $$ BEGIN IF EXISTS ((SELECT * FROM public.{q(table)} EXCEPT ALL SELECT * FROM {q('source_' + table)}) UNION ALL (SELECT * FROM {q('source_' + table)} EXCEPT ALL SELECT * FROM public.{q(table)})) THEN RAISE EXCEPTION 'Restore mismatch: {table}'; END IF; END $$;\n")
        f.write('''DO $verify$
DECLARE c record; joins text; present text; bad boolean;
BEGIN
  FOR c IN SELECT oid, conrelid, confrelid, conkey, confkey, conname
    FROM pg_constraint WHERE contype='f' AND conrelid IN
    (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace)
  LOOP
    SELECT string_agg(format('s.%I = p.%I', a.attname, b.attname), ' AND '),
           string_agg(format('s.%I IS NOT NULL', a.attname), ' AND ')
    INTO joins, present
    FROM unnest(c.conkey, c.confkey) AS k(src,dst)
    JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.src
    JOIN pg_attribute b ON b.attrelid=c.confrelid AND b.attnum=k.dst;
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s s WHERE %s AND NOT EXISTS (SELECT 1 FROM %s p WHERE %s))', c.conrelid::regclass, present, c.confrelid::regclass, joins) INTO bad;
    IF bad THEN RAISE EXCEPTION 'Foreign key validation failed: %', c.conname; END IF;
  END LOOP;
END $verify$;
SET LOCAL session_replication_role = origin;
COMMIT;
SELECT (SELECT count(*) FROM auth.users) AS users,
       (SELECT count(*) FROM auth.identities) AS identities,
       (SELECT count(*) FROM public.profiles) AS profiles,
       (SELECT count(*) FROM public.bank_transactions) AS bank_transactions,
       (SELECT count(*) FROM public.contributions) AS contributions;
''')
    (OUT / 'public-recovery-report.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
    print('Prepared:', path)


if __name__ == '__main__':
    main()
