# Node.js backend Dockerfile for task-tracker-backend
FROM node:20-alpine

WORKDIR /app

# Install dependencies first
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Expose backend port (matches PORT in .env)
EXPOSE 7000

# Default environment
ENV NODE_ENV=development
ENV CHOKIDAR_USEPOLLING=true

# Start the server (uses nodemon in dev)
CMD ["npm", "run", "dev"]
