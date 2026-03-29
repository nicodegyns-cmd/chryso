const original = require('./db.orig.js.real.bak');
function factory(){
  if (typeof original === 'function') return original();
  if (original && typeof original.default === 'function') return original.default();
  return original;
}
const exported = factory;
exported.default = factory;
exported.getPool = (original && original.getPool) || undefined;
exported.query = async (...args) => {
  const inst = factory();
  return inst.query(...args);
};
module.exports = exported;
