# Simple Node.js Dockerfile for React Native/Expo/Node projects
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy the rest of the project
COPY . .

# Default command (adjust as needed for your app)
CMD ["npm", "start"]
