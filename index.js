var _ = require("underscore");
const EventEmitter = require('events');

class Registry extends Array {

  constructor() {
    super();
    this.identify = _.debounce(this.identify, 500);
  }

  register(proc) {
    this.push(proc);
    proc.send({
      "type": "register",
      "fromProcessId": proc.pid
    });
    this.identify();
  }

  identify() {
    this.broadcast(null, {
      "type": "identify"
    });
  }

  broadcast(fromProcessId, data) {

    var fromProc = this.find(fromProcessId) || { pid: null };

    for (var i = 0, l = this.length; i < l; i++) {

      var toProc = this[i];
      if (toProc.pid === fromProc.pid) continue;

      console.log("broadcasting from", fromProc.pid, "to", toProc.pid);

      toProc.send({
        "type": "broadcast",
        "toProcessId": toProc.pid,
        "fromProcessId": fromProc.pid,
        "data": data
      });

    }

  }

  unicast(fromProcessId, toProcessId, data) {
    
    var fromProc = this.find(fromProcessId) || { pid: null };
    var toProc = this.find(toProcessId);

    if (!fromProc) return;
    if (!toProc) return;

    console.log("unicasting from", fromProc.pid, "to", toProc.pid);

    toProc.send({
      "type": "unicast",
      "toProcessId": toProcessId,
      "fromProcessId": fromProc.pid,
      "data": data
    });

  }

  registered(toProcessId) {
    
    var toProc = this.find(toProcessId) || { pid: null };

    if (!toProc) return;

    console.log("registered to", toProc.pid);

    toProc.send({
      "type": "registered",
      "fromProcessId": process.pid,
      "toProcessId": toProc.pid
    });

  }

  find(id) {
    for (var i = 0, l = this.length; i < l; i++) {
      var item = this[i];
      if (id === item.pid) {
        return item;
      }
    }
  }

  unregister(proc) {
    //console.log(proc.pid, "unregistering");
    for (var i = 0, l = this.length; i < l; i++) {
      var item = this[i];
      if (item.pid === proc.pid) {
        return this.splice(i,1);
      }
    }
  }

}

var registry = new Registry();

class Msg {

  constructor(proc, msg) {
    this.proc = proc;
    this.type = msg.type;
    this.fromProcessId = msg.fromProcessId;
    this.toProcessId = msg.toProcessId;
    this.data = msg.data;
  }

  reply(data) {
    this.unicast(this.fromProcessId, data);
  }

  broadcast(data) {
    registry.broadcast(this.proc.pid, data);
  }

  unicast(toProcessId, data) {
    registry.unicast(this.proc.pid, toProcessId, data);
  }

  registered() {
    registry.registered(this.proc.pid, this.fromProcessId);
  }

}

class ForkMsg extends EventEmitter {

  constructor(proc) {
    super()
    this.proc = proc;
  }

  broadcast(data) {
    registry.broadcast(this.proc.id, data);
  }

  unicast(toProcessId, data) {
    registry.unicast(this.proc.id, toProcessId, data);
  }

}

module.exports = function(proc) {

  registry.register(proc);
  proc.on("exit", function() {
    registry.unregister(proc);
  });

  var emitter = new ForkMsg(proc);
  proc.on("message", function(msg) {
    msg.fromProcessId = proc.pid;
    emitter.emit(msg.type, new Msg(proc, msg));
  });

  return emitter;

};