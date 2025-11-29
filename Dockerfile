FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install -g nodemon && npm install

# Only copy source after dependencies to optimize cache
COPY . .

EXPOSE 7000

ENV NODE_ENV=development

CMD ["nodemon", "app.js"]
