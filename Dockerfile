FROM node:20-slim

RUN apt-get update && \
    apt-get install -y chromium && \
    apt-get clean

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["node", "app.js"]
