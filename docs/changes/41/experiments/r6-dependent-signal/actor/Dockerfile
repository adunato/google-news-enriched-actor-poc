FROM apify/actor-node:20

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY . ./

RUN node -e 'const runtime = { node: process.version, undici: process.versions.undici ?? null }; if (runtime.node !== "v20.20.2" || runtime.undici !== "6.24.1") { throw new Error("R6 exact runtime gate failed: " + JSON.stringify(runtime)); } console.log("ISSUE41_R6_RUNTIME_PROBE " + JSON.stringify(runtime));'
RUN node r6-offline-check.mjs

CMD ["npm", "start"]
