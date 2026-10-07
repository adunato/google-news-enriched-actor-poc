FROM apify/actor-node:20

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY . ./

RUN node -e 'console.log("ISSUE41_R4_RUNTIME_PROBE " + JSON.stringify({ node: process.version, undici: process.versions.undici ?? null }))'

CMD ["npm", "start"]
