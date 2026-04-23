#!/bin/sh
npx prisma db push --skip-generate
exec node server.js
