FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build the application
RUN npm run build

# Remove dev dependencies and source files to reduce image size
RUN npm prune --production && \
    rm -rf src/ tsconfig.json

# Create non-root user for security
RUN addgroup -g 1001 -S mcp && \
    adduser -S mcp -u 1001 -G mcp

# Change ownership of app directory
RUN chown -R mcp:mcp /app

# Switch to non-root user
USER mcp

# Expose port (for health checks or future HTTP endpoints)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('MCP Server Health Check: OK')" || exit 1

# Start the MCP server
CMD ["node", "dist/index.js"]
