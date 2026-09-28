FROM apify/actor-node:20
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY rpc-probe.mjs probe-results.json main.mjs ./
CMD ["node", "main.mjs"]