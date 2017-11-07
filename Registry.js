var _ = require("underscore");
var Queue = require("./Queue");

class Registry extends Array {

  constructor() {
    super();
    this.identify = _.debounce(this.identify, 500);
  }

  register(thisProcess) {

    var findQueue = this.find(thisProcess.pid);
    if (findQueue) {
      return findQueue;
    }

    var queue = new Queue(thisProcess, this);
    this.push(queue);

    queue.unicast(thisProcess.pid, {
      "type": "registered",
      "processId": thisProcess.pid
    });

    queue.broadcast({
      "type": "registered",
      "processId": thisProcess.pid
    });

    thisProcess.on("exit", ()=>{
      this.unregister(thisProcess);
    });

    if (!this.find(process.pid)) {
      this.identify();
    }

    return queue;
  }

  identify() {
    this.broadcast(null, {
      "type": "identify"
    });
  }

  broadcast(fromProcessId, data) {

    var isSingleRoute = (process.pid === fromProcessId);
    var fromProc = this.find(fromProcessId);

    for (var i = 0, l = this.length; i < l; i++) {

      var toProc = this[i];
      if (!isSingleRoute && fromProc && toProc.process.pid === fromProc.process.pid) continue;

      this.send(toProc.process, {
        "type": "broadcast",
        "toProcessId": toProc.process.pid,
        "fromProcessId": fromProc && fromProc.process.pid,
        "data": data
      });

    }

  }

  unicast(fromProcessId, toProcessId, data) {

    var isSingleRoute = (process.pid === fromProcessId);

    var fromProc = this.find(fromProcessId) || { pid: null };
    if (!fromProc) return;
    if (isSingleRoute) {

      var msg = {
        "type": "unicast",
        "toProcessId": toProcessId,
        "fromProcessId": fromProc.process.pid,
        "data": data
      };

      // if (msg.data && msg.data.type && msg.data.type.substr(0,11) === "msg:stream:") {
      //   console.log("from", process.pid, msg)
      // }

      this.send(fromProc.process, msg);

      return;
    }

    var toProc = this.find(toProcessId);
    if (!toProc) return;

    var msg = {
      "type": "unicast",
      "toProcessId": toProcessId,
      "fromProcessId": fromProc.process.pid,
      "data": data
    };

    //if (msg.data && msg.data.type && msg.data.type.substr(0,7) === "stream:") {
      //console.log("routing", process.pid, msg)
    //}

    this.send(toProc.process, msg);

  }

  send(process, msg) {
    process.send(msg);
  }

  receive(msg) {
    return msg;
  }

  find(id) {
    for (var i = 0, l = this.length; i < l; i++) {
      var queue = this[i];
      if (id === queue.process.pid) {
        return queue;
      }
    }
  }

  unregister(proc) {
    for (var i = 0, l = this.length; i < l; i++) {
      var queue = this[i];
      if (queue.process.pid !== proc.pid) continue;
      this.unicast(queue.process.pid, {
        "type": "unregistered",
        "processId": queue.process.pid
      });
      this.broadcast({
        "type": "unregistered",
        "processId": queue.process.pid
      });
      return this.splice(i,1);
    }
  }

}

module.exports = Registry;