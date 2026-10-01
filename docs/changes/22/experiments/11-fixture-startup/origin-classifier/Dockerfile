FROM apify/actor-node@sha256:c475bc63b3e70488dfb574147d8e63e7f410480bb0a3ef5b7ccad54635299a63

WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY . .
CMD ["node", "src/main.mjs"]
