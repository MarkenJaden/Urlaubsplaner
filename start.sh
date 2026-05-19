#!/bin/sh
set -e
node node_modules/prisma/build/index.js db push --skip-generate
exec node server.js
