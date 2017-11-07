var Registry = require("./Registry");

var registry = new Registry();

module.exports = function(thisProcess) {
  return registry.register(thisProcess);;
};