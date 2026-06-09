// src/config/logger.js
const C = { reset:"\x1b[0m", cyan:"\x1b[36m", green:"\x1b[32m", yellow:"\x1b[33m", red:"\x1b[31m", gray:"\x1b[90m", magenta:"\x1b[35m" };
const ts = () => new Date().toISOString().replace("T"," ").slice(0,19);
const l = (lv, col, ...a) => console.log(`${C.gray}[${ts()}]${C.reset} ${col}${lv}${C.reset}`, ...a);
module.exports = {
  info:  (...a) => l("[INFO] ", C.cyan,    ...a),
  ok:    (...a) => l("[OK]   ", C.green,   ...a),
  warn:  (...a) => l("[WARN] ", C.yellow,  ...a),
  error: (...a) => l("[ERR]  ", C.red,     ...a),
  order: (...a) => l("[ORDER]", C.magenta, ...a),
};
