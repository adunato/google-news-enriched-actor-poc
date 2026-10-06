FROM apify/actor-node:20

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY . ./

CMD ["npm", "start"]
