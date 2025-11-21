FROM node:18-slim

# 🔧 Instalar dependencias necesarias para Puppeteer / Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-common \
    chromium-driver \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libxshmfence1 \
    fonts-liberation \
    libappindicator3-1 \
    libnspr4 \
    xdg-utils \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Crear directorio de la app
WORKDIR /app

# Copiar package.json
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto
COPY . .

# Puerto del servidor
EXPOSE 3000

# Variable para usar Chromium del sistema
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Comando por defecto
CMD ["node", "app.js"]
