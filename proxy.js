'use strict';
/**
 * The Redis Proxy service works by using a redis sentinel
 * and constantly query it for changes in the redis status
 * Environment variable configuration:
 *
 *  - SENTINEL_HOST -> the sentinel host:port to work with. It should be a hostname.
 *  - SENTINEL_NAME -> the name of the sentinel cluster
 *  - SENTINEL_CHECK -> the number of milliseconds between checks
 *  - PORT -> the port to expose (defaults to 6379)
 *  - HEALTH_PORT -> the port to bind to expose a HTTP health-check
 * */
let PORT = parseInt(process.env.PORT || '6379', 10),
  SENTINEL_CHECK = process.env.SENTINEL_CHECK || 800,
  HEALTH_PORT = process.env.HEALTH_PORT || 8080,
  SENTINEL_HOST = process.env.SENTINEL_HOST,
  SENTINEL_NAME = process.env.SENTINEL_NAME,
  SENTINEL_PORT = 26379;


/* Look into the argv */
process.argv.forEach((k) => {
  if (k.substr(0, 2) !== '--') return;
  k = k.substr(2);
  let key = k.split('=')[0].toLowerCase(),
    val = k.split('=')[1];
  if (key === 'sentinel-host') {
    SENTINEL_HOST = val;
  } else if (key === 'sentinel-name') {
    SENTINEL_NAME = val;
  } else if (key === 'sentinel-check') {
    SENTINEL_CHECK = parseInt(val);
  } else if (key === 'port') {
    PORT = val;
  }
});
process.env.SENTINEL_CHECK = SENTINEL_CHECK;

if (!SENTINEL_HOST) {
  console.error(`Required environment variable ${SENTINEL_HOST} missing`);
  process.exit(1);
}
if (SENTINEL_HOST.indexOf(':') !== -1) {
  SENTINEL_PORT = SENTINEL_HOST.split(':')[1];
  SENTINEL_HOST = SENTINEL_HOST.split(':')[0];
}
const util = require('./lib/util'),
  http = require('http'),
  initServer = require('./lib/server'),
  initPool = require('./lib/pool');
(async () => {
  let resolvedSentinelIp = await util.getHostnameIp(SENTINEL_HOST);
  if (!resolvedSentinelIp) {
    console.error(`Could not resolve sentinel host: ${SENTINEL_HOST}`);
    return process.exit(1);
  }
  console.log(`*********************************************`);
  console.log(`* Proxy working with sentinel: ${SENTINEL_HOST}:${SENTINEL_PORT}`);
  if (resolvedSentinelIp !== SENTINEL_HOST) {
    console.log(`* Proxy sentinel resolved to: ${resolvedSentinelIp}`);
  }
  try {
    let poolObj = initPool(SENTINEL_HOST, SENTINEL_PORT, SENTINEL_NAME);
    let serverObj = await initServer(PORT, poolObj);
    console.log(`* Sentinel checker starting`);
    poolObj.check();
    console.log(`* Proxy listening on port ${PORT}`);
    console.log(`* Health check listening on port ${HEALTH_PORT}`);
  } catch (e) {
    console.error(`Could not start server on port ${PORT}`);
    console.error(e);
    return process.exit(1);
  }
  console.log(`*********************************************`);
  http.createServer(function (req, res) {
    res.write('{}');
    res.end();
  }).listen(parseInt(HEALTH_PORT));
})();
