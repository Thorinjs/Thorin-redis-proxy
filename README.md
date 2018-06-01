# Redis proxy that handles redis-sentinel instance setups.
### This service is tuned to work in a docker/kubernetes environment.

##### Environment variables
- ```SENTINEL_HOST``` the redis-sentinel host to connect to (host:port). When using a hostname, we will try and resolve the hostname on each connect attempt.
- ```SENTINEL_NAME``` the redis-sentinel cluster name, configured in the sentinels
- ```SENTINEL_CHECK``` (default 800ms) how often do we query a sentinel for the master information, in milliseconds
- ```PORT``` (default 6379) the default port to run the proxy, defaults to 6379
- ```HEALTH_PORT``` (default 8080)  the HTTP health check server to return 200 ok

##### Notes: the same environment variables can be given in the node argv
```
node proxy.js --sentinel-host=localhost:26379 --sentinel-name=mycluster --port=32100 --sentinel-check=2000
```

##### Usage with docker:
```
docker run snupa/redis-proxy \
    -e SENTINEL_HOST=localhost \
    -e SENTINEL_NAME=redis \
    -e PORT=6379
```