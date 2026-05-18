#!/bin/sh
node node_modules/prisma/build/index.js db push --skip-generate
exec node server.js
