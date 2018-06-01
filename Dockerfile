FROM snupa/node-redis:latest

# Node.js user is: app
# Environment vars
ENV NODE_ENV production
ENV SENTINEL_HOST ''
ENV SENTINEL_NAME 'redis'
ENV SENTINEL_CHECK 800
ENV PORT 6379
ENV HEALTH_PORT 8080
# Create app directory
WORKDIR /proxy
COPY . /proxy
USER node

ENTRYPOINT [ "node", "proxy.js" ]
