#!/usr/bin/env bash
set -euo pipefail

# Only creates new OS-temporary clusters; never accepts an existing database URL.
pg_bin="${EVE_TEST_PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
case "${1:-start}" in
  start)
    "$pg_bin/postgres" --version
    cluster_root="$(mktemp -d "${TMPDIR:-/tmp}/chatjs-retirement-pg.XXXXXX")"
    chmod 700 "$cluster_root"
    printf 'chatjs-retirement-disposable-v1\n' > "$cluster_root/ownership"
    "$pg_bin/initdb" -D "$cluster_root/data" -U retirement --auth=trust --no-locale > "$cluster_root/initdb.log"
    port="$(bun -e 'const server=Bun.serve({hostname:"127.0.0.1",port:0,fetch:()=>new Response()}); console.log(server.port); await server.stop(true);')"
    "$pg_bin/pg_ctl" -D "$cluster_root/data" -l "$cluster_root/server.log" -o "-h 127.0.0.1 -p $port -k $cluster_root" -w start
    for database in lane_a lane_b lane_c lane_d; do
      "$pg_bin/createdb" -h 127.0.0.1 -p "$port" -U retirement "$database"
    done
    bun -e 'const [root,port,bin]=process.argv.slice(1); await Bun.write(`${root}/connection.json`, JSON.stringify({root,port:Number(port),pgBin:bin,postgresVersion:"17.11",databases:Object.fromEntries(["lane_a","lane_b","lane_c","lane_d"].map(name=>[name,`postgresql://retirement@127.0.0.1:${port}/${name}`]))},null,2));' "$cluster_root" "$port" "$pg_bin"
    printf 'Disposable connection handoff: %s/connection.json\n' "$cluster_root"
    ;;
  stop)
    cluster_root="${2:?Supply the cluster root printed by start}"
    case "$(basename "$cluster_root")" in chatjs-retirement-pg.*) ;; *) echo 'Not a retirement cluster' >&2; exit 1 ;; esac
    test "$(cat "$cluster_root/ownership")" = chatjs-retirement-disposable-v1
    "$pg_bin/pg_ctl" -D "$cluster_root/data" -m fast -w stop
    printf 'Stopped. Evidence retained at %s\n' "$cluster_root"
    ;;
  *) echo 'Usage: cluster.sh start | stop <cluster-root>' >&2; exit 1 ;;
esac
