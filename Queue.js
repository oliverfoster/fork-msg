const _ = require("underscore");
const EventEmitter = require('events');
const Msg = require("./Msg");

class Queue extends EventEmitter {

  constructor(proc, registry) {
    super()
    this.process = proc;
    this.registry = registry;
    
    this.onBroadcasts = [];
    this.onUnicasts = [];
    this._thenSubject = null;

    this.process.on("message", (msg)=>{
      
      msg = this.registry.receive(msg);

      //if (msg.data && msg.data.type && msg.data.type.substr(0,7) === "stream:") {
      // if (msg.type === "unicast") {
      //   if (msg.toProcessId !== process.pid && msg.fromProcessId !== process.pid) {
      //     console.log("through", process.pid, msg);
      //   } else {
      //     console.log("at", process.pid, msg);
      //   }
      // }
      //}

      this.emit(msg.type, new Msg(this, msg));
    });

    this.on("broadcast", this._handleBroadcast);
    this.on("unicast", this._handleUnicast);


  }

  _handleBroadcast(msg) {
    this.onBroadcasts.forEach((item)=>{

      var whens = _.result(item, "whens");

      var isMatch = false;
      for (var i = 0, l = whens.length; i < l; i++) {
        var when = whens[i];
        isMatch = isMatch || _.isMatch(msg.data, when);
        if (isMatch) break;
      }
      if (!isMatch) return;

      item.thens.forEach((then)=>{

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

    for (var i = this.onBroadcasts.length-1; i >= 0; i--) {
      var item = this.onBroadcasts[i];
      if (item.once) this.onBroadcasts.splice(i, 1);
    }

  }

  _handleUnicast(msg) {
    this.onUnicasts.forEach((item)=>{

      var whens = _.result(item, "whens");

      var isMatch = false;
      for (var i = 0, l = whens.length; i < l; i++) {
        var when = whens[i];
        isMatch = isMatch || _.isMatch(msg.data, when);
        if (isMatch) break;
      }
      if (!isMatch) return;

      item.thens.forEach((then)=>{

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

    for (var i = this.onUnicasts.length-1; i >= 0; i--) {
      var item = this.onUnicasts[i];
      if (item.once) this.onUnicasts.splice(i, 1);
    }

  }

  broadcast(data) {
    this.registry.broadcast(this.process.pid, data);
    return this;
  }

  unicast(toProcessId, data) {
    this.registry.unicast(this.process.pid, toProcessId, data);
    return this;
  }

  onBroadcast(whens) {

    if (!(whens instanceof Array)) whens = [whens];

    var item = {
      whens,
      thens: []
    };

    this.onBroadcasts.push(item);
    this._thenSubject = item;
    return this;
  }

  onceBroadcast(whens) {

    if (!(whens instanceof Array)) whens = [whens];

    var item = {
      whens,
      thens: [],
      once: true
    };
    this.onBroadcasts.push(item);
    this._thenSubject = item;
    return this;
  }

  offBroadcast(whens) {
    console.log("offBroadcast", whens);
  }

  onUnicast(whens) {

    if (!(whens instanceof Array)) whens = [whens];

    var item = {
      whens,
      thens: []
    };

    this.onUnicasts.push(item);
    this._thenSubject = item;
    return this;

  }

  onceUnicast(whens) {

    if (!(whens instanceof Array)) whens = [whens];

    var item = {
      whens,
      thens: [],
      once: true
    };

    this.onUnicasts.push(item);
    this._thenSubject = item;
    return this;

  }

  offUnicast(whens) {
    console.log("offUnicast", whens);
  }

  thenReply(data) {
    if (!this._thenSubject) return this;
    this._thenSubject.thens.push({
      type: "reply",
      data
    });
    return this;
  }

  thenBroadcast(data) {
    if (!this._thenSubject) return this;
    this._thenSubject.thens.push({
      type: "broadcast",
      data
    });
    return this;
  }

  then(data) {
    if (!this._thenSubject) return this;
    this._thenSubject.thens.push({
      data
    });
    return this;
  }

}

module.exports = Queue;