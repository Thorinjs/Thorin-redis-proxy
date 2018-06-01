'use strict';
const fs = require('fs'),
  dns = require('dns');
let isResolverWarned = false;

let DNS_RESOLVER_IP = null,
  DNS_DEFAULT_RESOLVER_IP = '172.17.0.1';
setInterval(() => {     // Clear the resolver IP once every few seconds
  DNS_RESOLVER_IP = null;
}, 2000);
const util = {};
/**
 * Verify if the given host is an IP address.
 * */
util.isIp = function isIp(d) {
  if (typeof d !== 'string' || !d) return false;
  let tmp = d.split('.');
  if (tmp.length !== 4) return false;
  for (let i = 0, len = tmp.length; i < len; i++) {
    let p = parseInt(tmp[i], 10);
    if (isNaN(p)) return false;
    if (p < 0 || p > 255) return false;
  }
  return true;
};

/**
 * Returns the configured resolver IP address
 * */
util.getResolverIp = function getResolverIp() {
  if (DNS_RESOLVER_IP) return DNS_RESOLVER_IP;
  try {
    let t = fs.readFileSync('/etc/resolv.conf', {encoding: 'utf8'});
    t = t.split('\n');
    for (let i = 0, len = t.length; i < len; i++) {
      let a = t[i].trim();
      if (a.indexOf('nameserver ') !== -1) {
        DNS_RESOLVER_IP = a.split('nameserver ')[1];
        break;
      }
    }
  } catch (e) {
    if (!isResolverWarned) {
      console.error(`-> Could not read /etc/resolv.conf for resolver information`);
      console.error(e);
      isResolverWarned = true;
    }
  }
  if (!DNS_RESOLVER_IP) {
    DNS_RESOLVER_IP = DNS_DEFAULT_RESOLVER_IP;
  }
  return DNS_RESOLVER_IP;
}

/**
 * Given a hostname (or ip) it will return the IP Address attached to it,
 * or null if it could not be resolved.
 * */
util.getHostnameIp = async function getHostnameIp(host) {
  if (util.isIp(host)) return host;
  let resolverIp = util.getResolverIp();
  dns.setServers([resolverIp, '127.0.0.1']);
  return new Promise((resolve) => {
    dns.resolve4(host, (err, address) => {
      if (err) {
        console.warn(`Could not resolve: ${host}`);
        console.log(err);
        return resolve(null);
      }
      if (!address || address.length === 0) return resolve(null);
      resolve(address[0]);
    });
  });
};
module.exports = util;