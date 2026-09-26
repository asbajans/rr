#!/bin/sh
# Klasik minio image davranışıyla uyumlu entrypoint:
# compose `command: server /data ...` verir → başına `minio` eklenir.
set -e
if [ "$1" != "minio" ]; then
  set -- minio "$@"
fi
exec "$@"
