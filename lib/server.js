'use strict';
const net = require('net');
/**
 * This is our proxy server listening on the given port.
 * */

module.exports = async (port, poolObj) => {
  let isResolved = false;

  let clients = {};
  let clientId = 0;

  poolObj
    .on('change', (master) => {
      let clientIds = Object.keys(clients);
      if (clientIds.length === 0) {
        console.log(`Redis master changed to: ${master.host}:${master.port}. No clients connected`);
        return;
      }
      console.log(`Redis master changed to: ${master.host}:${master.port}. Disconnecting ${clientIds} clients`);
      for (let i = 0, len = clientIds.length; i < len; i++) {
        removeSocket(clients[clientIds[i]]);
      }
      clients = {};
    });

  function isSocketRemoved(socketObj) {
    if (socketObj._client_destroyed) return true;
    return false;
  }

  function removeSocket(socketObj, masterSocketObj) {
    if (socketObj) {
      if (socketObj._client_destroyed) return;
      socketObj._client_destroyed = true;
      let client = socketObj._client_id;
      if (typeof clients[client] !== 'undefined') {
        delete clients[client];
      }
      try {
        socketObj.destroy();
      } catch (e) {
      }
    }
    if (masterSocketObj) {
      masterSocketObj._client_destroyed = true;
      try {
        masterSocketObj.destroy();
      } catch (e) {
      }
    }
  }

  async function handleSocket(socketObj) {
    try {
      clientId++;
      let client = `${clientId}`;
      socketObj._client_id = client + ':local';
      console.log(`Client connected [${socketObj.remoteAddress}#${clientId}]`);
      // Fetch any available redis master. If none available, stop connection. Client should be able to re-connect.
      let master = poolObj.master;
      if (!master) throw new Error('No master instance available');
      clients[socketObj._client_id] = socketObj;
      // Initiate the socket towards the redis master ip/host. This will have a 3sec timeout to connect to it.
      let masterSocketObj = new net.Socket();
      masterSocketObj._client_id = client + ':remote';
      let masterTimer = setTimeout(() => {
        console.warn(`Client connection to redis master connect timeout`);
        removeSocket(socketObj, masterSocketObj);
      }, 3000);
      masterSocketObj.connect(master.port, master.host);
      masterSocketObj.once('connect', function () {
        clearTimeout(masterTimer);
      });
      masterSocketObj.once('error', function (e) {
        console.warn(`Received error from redis master: ${e.message}`);
        removeSocket(socketObj, masterSocketObj);
      });
      masterSocketObj.once('close', function () {
        removeSocket(socketObj, masterSocketObj);
      });
      masterSocketObj.on('data', function (data) {
        if (isSocketRemoved(socketObj)) {
          return removeSocket(null, masterSocketObj);
        }
        try {
          let flushed = socketObj.write(data);
          if (!flushed) {
            masterSocketObj.pause();
          }
        } catch (e) {
        }
      });
      masterSocketObj.on('drain', function () {
        if (isSocketRemoved(socketObj)) {
          return removeSocket(masterSocketObj);
        }
        try {
          socketObj.resume();
        } catch (e) {
        }
      });
      masterSocketObj.once('close', function () {
        removeSocket(socketObj, masterSocketObj);
      });


      socketObj.on('data', function (d) {
        if (isSocketRemoved(masterSocketObj)) {
          return removeSocket(socketObj);
        }
        try {
          let flushed = masterSocketObj.write(d);
          if (!flushed) {
            socketObj.pause();
          }
        } catch (e) {
        }
      });

      socketObj.on('drain', function () {
        if (isSocketRemoved(masterSocketObj)) {
          return removeSocket(socketObj);
        }
        try {
          masterSocketObj.resume();
        } catch (e) {
        }
      });

      socketObj.once('close', function () {
        removeSocket(socketObj, masterSocketObj);
      });
    } catch (e) {
      console.warn(`Could not initiate connection: ${e.message}`);
      try {
        socketObj.destroy();
      } catch (e) {
      }
    }
  }

  const serverObj = net.createServer(handleSocket);

  return new Promise((resolve, reject) => {
    serverObj.on('error', (err) => {
      if (isResolved) {
        console.warn(`Proxy server got an error: ${err.message}`);
        return;
      }
      isResolved = true;
      reject(err);
    });
    serverObj.listen(parseInt(port, 10), (err) => {
      if (isResolved) return;
      isResolved = true;
      if (err) return reject(err);
      resolve(serverObj);
    });
  });

};