const Stream = require("./Stream");

class Msg {

  constructor(queue, msg) {
    this.queue = queue;
    this.process = queue.process;
    this.registry = queue.registry;
    this.type = msg.type;
    this.fromProcessId = msg.fromProcessId;
    this.toProcessId = msg.toProcessId;
    this.data = msg.data;
  }

  createStream(fromStreamJSON) {
    return new Stream(this, fromStreamJSON);
  }

  reply(data) {
    this.unicast(this.fromProcessId, data);
  }

  broadcast(data) {
    this.registry.broadcast(this.process.pid, data);
  }

  unicast(toProcessId, data) {
    this.registry.unicast(this.process.pid, toProcessId, data);
  }
  
}

module.exports = Msg;