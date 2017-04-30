var libPrefix = process.env.COVER ? './lib-cov' : './lib';

module.exports = process.browser
  ? {
    compare: require('./lib/compare'),
    XMLSerializer: require('./lib/canonizer'),
    revXPath: require('./lib/revxpath'),
    GroupingReporter: require('./lib/reporters/groupingReporter.js'),
    DIFF_TYPES: require('./lib/diff_types'),
    NODE_TYPES: require('./lib/node_types'),
  }
  : {
    compare: require(libPrefix + '/compare'),
    XMLSerializer: require(libPrefix + '/canonizer'),
    revXPath: require(libPrefix + '/revxpath'),
    GroupingReporter: require(libPrefix + '/reporters/groupingReporter.js'),
  };
