const Streams = require('stream');

class Stream extends Streams.Duplex {

  constructor(msg, fromStreamJSON) {
    super();

    this.msg = msg;
    this.queue = this.msg.queue;
    this.process = this.msg.process;

    if (!fromStreamJSON) {
      // stream for writing to
      this.isEndPoint = false;

      this.pid = this.process.pid;
      this.sid = Stream.id++;

      this._receiveReadRequest = this._receiveReadRequest.bind(this);
      
      this._writes = [];
      this.queue.onUnicast({
        "type": "msg:stream:read",
        "pid": this.pid,
        "sid": this.sid
      }).then(this._receiveReadRequest);

      return;
    }

    // stream for reading from
    this.isEndPoint = true;

    if (fromStreamJSON.type !== "Stream") {
      throw new Error("Not a stream json object");
    }

    this.pid = fromStreamJSON.pid;
    this.sid = fromStreamJSON.sid;

    this._receiveWriteRequest = this._receiveWriteRequest.bind(this)
    
    this.queue.onUnicast({
      "type": "msg:stream:write",
      "pid": this.pid,
      "sid": this.sid
    }).then(this._receiveWriteRequest);   

  }

  _receiveReadRequest(data, msg) {

    if (this._writes.length === 0) {
      this.queue.offUnicast({
        "type": "msg:stream:read",
        "pid": this.pid,
        "sid": this.sid
      });
      msg.reply({
        "type": "msg:stream:write",
        "pid": this.pid,
        "sid": this.sid,
        "chunk": null
      });
      return;
    }

    var write = this._writes.shift();

    msg.reply({
      "type": "msg:stream:write",
      "pid": this.pid,
      "sid": this.sid,
      "chunk": write.chunk
    });

    if (write.callback) {
      write.callback();
    }

  }

  _receiveWriteRequest(data, msg) {

    if (!data.chunk) {
      this.queue.offUnicast({
        "type": "msg:stream:write",
        "pid": this.pid,
        "sid": this.sid
      });
      return this.push(null);
    }

    this.push(new Buffer(data.chunk));

  }

  _write(chunk, encoding, callback) {

    this._writes.push({
      chunk,
      encoding,
      callback
    });

  }

  _read(size) {

    this.queue.unicast(this.pid, {
      "type": "msg:stream:read",
      "pid": this.pid,
      "sid": this.sid,
      "size": size
    });

  }

  toString() {
    return JSON.stringify(this.toJSON());
  }

  toJSON() {
    return {
      type: "Stream",
      pid: this.pid,
      sid: this.sid
    };
  }

}
Stream.id = 0;

module.exports = Stream;