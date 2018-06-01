'use strict';
const EventEmitter = require('events').EventEmitter,
  exec = require('child_process').exec,
  util = require('./util');

/**
 * This is the redis master connection pool.
 * It will always have the master IP/PORT information
 * */
const CHECK_TIMER = parseInt(process.env.SENTINEL_CHECK);
let wasWarned = false;

class RedisPool extends EventEmitter {

  constructor(sentinelHost, sentinelPort, name) {
    super();
    this.sentinel = {
      host: sentinelHost,
      port: parseInt(sentinelPort, 10),
      name
    };
    this.master = null;
  }

  check() {
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(async () => {
      await this.getMaster();
      this.check();
    }, CHECK_TIMER);
  }

  /**
   * Tries to return the master redis {host,port}
   * */
  getMaster(firstRun) {
    return new Promise(async (resolve) => {
      let ip = await util.getHostnameIp(this.sentinel.host) || this.sentinel.host;
      const cmd = `redis-cli -h ${ip} -p ${this.sentinel.port} SENTINEL get-master-addr-by-name ${this.sentinel.name}`;
      exec(cmd, (err, res) => {
        if (err) {
          if (!wasWarned) {
            wasWarned = true;
            console.warn(`Could not reach sentinel: ${err.message}`);
          }
          this.master = null; // reset the master.
          return resolve(null);
        }
        res = res.split('\n');
        let host = res[0],
          port = res[1];
        if (!host || !port) return resolve(null);
        if (wasWarned) {
          console.log(`Redis sentinel back online`);
          wasWarned = false;
        }
        let master = {
          host: host,
          port: parseInt(port, 10)
        };
        if (!this.master) {
          console.log(`Redis master host set to: ${master.host}:${master.port}`);
          this.master = master;
        } else if (this.master.host !== master.host || this.master.port !== master.port) {
          console.log(`Redis master host changed to: ${master.host}:${master.port}`);
          this.master = master;
          this.emit('change', master);
        }
        resolve(master);
      });
    });
  }

}

module.exports = (host, port, name) => {
  return new RedisPool(host, port, name);
};