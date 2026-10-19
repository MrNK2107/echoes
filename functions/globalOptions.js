// Must be the first require of index.js: firebase-functions reads the global options when each
// function is defined, so every module required afterwards inherits them.
// Bounds cost under abuse (spec "Plan 5 decisions").
const { setGlobalOptions } = require("firebase-functions/v2");

const MAX_INSTANCES = 50;

setGlobalOptions({ maxInstances: MAX_INSTANCES });

module.exports = { MAX_INSTANCES };
