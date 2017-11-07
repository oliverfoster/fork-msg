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
    if (!this.find(process.pid)) this.identify();
  }

  identify() {
    this.broadcast(null, {
      "type": "identify"
    });
  }

  broadcast(fromProcessId, data) {

    var isSingleRoute = (process.pid === fromProcessId);
    var fromProc = this.find(fromProcessId) || { pid: null };

    for (var i = 0, l = this.length; i < l; i++) {

      var toProc = this[i];
      if (!isSingleRoute && toProc.pid === fromProc.pid) continue;

      toProc.send({
        "type": "broadcast",
        "toProcessId": toProc.pid,
        "fromProcessId": fromProc.pid,
        "data": data
      });

    }

  }

  unicast(fromProcessId, toProcessId, data) {


    var isSingleRoute = (process.pid === fromProcessId);

    var fromProc = this.find(fromProcessId) || { pid: null };
    if (!fromProc) return;
    if (isSingleRoute) {

      fromProc.send({
        "type": "unicast",
        "toProcessId": toProcessId,
        "fromProcessId": fromProc.pid,
        "data": data
      });

      return;
    }

    var toProc = this.find(toProcessId);
    if (!toProc) return;

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
    
    this.onRegistereds = [];
    this.onBroadcasts = [];
    this.onUnicasts = [];
    this.currentOn = null;

    this.proc.on("message", (msg)=>{
      this.emit(msg.type, new Msg(this.proc, msg));
    });

    
    this.on("registered", ()=>{
      this.onRegistereds.forEach((then)=>{
        if (then instanceof Function) then();
      });
    });

    this.on("broadcast", (msg)=>{

      this.onBroadcasts.forEach((item)=>{

        var whens = _.result(item, "when");
        if (!(whens instanceof Array)) whens = [whens];

        var isMatch = false;
        for (var i = 0, l = whens.length; i < l; i++) {
          var when = whens[i];
          isMatch = isMatch || _.isMatch(msg.data, when);
          if (isMatch) break;
        }
        if (!isMatch) return;

        item.then.forEach((then)=>{

          var values = then.data;
          if (then.data instanceof Function) {
            values = then.data(msg.data, msg);
          }
          if (!(values instanceof Array)) values = [values];

          values.forEach((value)=>{
            switch (then.type) {
              case "reply":
                msg.reply(value);
                break;
              case "broadcast":
                msg.broadcast(value);
                break;
            }
          });

        });

      });

    });
    this.on("unicast", (msg)=>{

      this.onUnicasts.forEach((item)=>{

        var whens = _.result(item, "when");
        if (!(whens instanceof Array)) whens = [whens];

        var isMatch = false;
        for (var i = 0, l = whens.length; i < l; i++) {
          var when = whens[i];
          isMatch = isMatch || _.isMatch(msg.data, when);
          if (isMatch) break;
        }
        if (!isMatch) return;

        item.then.forEach((then)=>{

          var values = then.data;
          if (then.data instanceof Function) {
            values = then.data(msg.data, msg);
          }
          if (!(values instanceof Array)) values = [values];

          values.forEach((value)=>{
            switch (then.type) {
              case "reply":
                msg.reply(value);
                break;
              case "broadcast":
                msg.broadcast(value);
                break;
            }
          });

        });

      });

    });


  }

  broadcast(data) {
    registry.broadcast(this.proc.pid, data);
    return this;
  }

  unicast(toProcessId, data) {
    registry.unicast(this.proc.pid, toProcessId, data);
    return this;
  }

  onRegistered(then) {
    this.onRegistereds.push(then);
    return this;
  }

  onBroadcast(when) {
    var item = {
      when,
      then: []
    };
    this.onBroadcasts.push(item);
    this.currentOn = item;
    return this;
  }

  onUnicast(when) {
    var item = {
      when,
      then: []
    };
    this.onUnicasts.push(item);
    this.currentOn = item;
    return this;
  }

  thenReply(data) {
    if (!this.currentOn) return this;
    this.currentOn.then.push({
      type: "reply",
      data
    });
    return this;
  }

  thenBroadcast(data) {
    if (!this.currentOn) return this;
    this.currentOn.then.push({
      type: "broadcast",
      data
    });
    return this;
  }

  then(data) {
    if (!this.currentOn) return this;
    this.currentOn.then.push({
      data
    });
    return this;
  }

}

module.exports = function(proc) {

  registry.register(proc);
  proc.on("exit", ()=>{
    registry.unregister(proc);
  });

  return new ForkMsg(proc);

};