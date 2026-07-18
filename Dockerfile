# Build Stage
FROM node:22-slim AS builder

# Install pnpm (version specified in your package.json)
RUN npm install -g pnpm@10.4.1

WORKDIR /app

# Copy dependency definition files and patches
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# Install dependencies cleanly
RUN pnpm install --frozen-lockfile

# Copy the rest of the source code
COPY . .

# Run the project build (generates the /dist folder)
RUN pnpm run build

# Runner Stage
FROM node:22-slim AS runner

WORKDIR /app

# Set environment to production
ENV NODE_ENV=production

# Copy only necessary artifacts from the build stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

# Expose the default port (adjust if your application uses a different one)
EXPOSE 5000

# Command to start the application
CMD ["npm", "start"]
