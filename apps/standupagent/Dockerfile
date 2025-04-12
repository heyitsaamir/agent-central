FROM --platform=linux/amd64 node:20-alpine
WORKDIR /app
COPY dist ./dist
COPY package*.json ./
RUN npm install --omit=dev
ENV NODE_ENV=production
ENV PORT=8080

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Start the application
CMD ["npm", "start"]
