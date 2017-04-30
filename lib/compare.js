const type = require('./node_types');
const Collector = require('./collector');

/**
 * Compare nodes
 */
module.exports = function compareNodes(a, b, options) {
  const collector = new Collector(options);
  const comparator = new Comparator(options, collector);
  comparator.compareNode(a, b);
  return collector;
};

/**
 * Comparator construction function
 * @param {*} options: {
 *  compareComments,
 *  stripSpaces,
 * } 
 * @param {*} collector 
 */
function Comparator(options, collector) {
  this._options = options || {};
  if (!collector) throw new Error('Collector instance must be specified');
  this._collector = collector;
}

/**
 * Filters the nodes in list
 */
Comparator.prototype._filterNodes = function(list) {
  const ret = [];
  for (let i = 0, l = list.length; i < l; i++) {
    let item = list.item(i);
    if (shouldCompare(item, this._options.compareComments)) {
      ret.push(item);
    }
  }
  return ret;

  function shouldCompare(node, compareComments) {
    return (
      !(node.nodeType === type.COMMENT_NODE && !compareComments) &&
      !(node.nodeType === type.TEXT_NODE && ('' + node.nodeValue).trim() === '')
    );
  }
};

/**
 * Compare two node lists
 */
Comparator.prototype._compareNodeList = function(left, right) {
  const lLeft = this._filterNodes(left);
  const lRight = this._filterNodes(right);

  for (let i = 0, l = Math.max(lLeft.length, lRight.length); i < l; i++) {
    if (lLeft[i] && lRight[i]) {
      if (!this.compareNode(lLeft[i], lRight[i])) return false;
    } else {
      return this._collector.collectFailure(lLeft[i], lRight[i]);
    }
  }
  return true;
};

/**
 * Compare two attributes
 */
Comparator.prototype._compareAttributes = function(expected, actual) {
  let aExpected = {}, aActual = {};

  if (!expected && !actual) return true;

  for (let i = 0, l = expected.length; i < l; i++) {
    aExpected[expected[i].nodeName] = expected[i];
  }

  for (let i = 0, l = actual.length; i < l; i++) {
    aActual[actual[i].nodeName] = actual[i];
  }

  for (let i in aExpected) {
    if (!aExpected.hasOwnProperty(i) || !aActual.hasOwnProperty(i)) {
      continue;
    }
    // both nodes has an attribute
    // but values is differ
    let vExpected = aExpected[i].nodeValue;
    let vActual = aActual[i].nodeValue;
    if (
      this._options.stripSpaces &&
      aExpected[i].nodeType != type.CDATA_SECTION_NODE
    ) {
      vExpected = vExpected.trim();
      vActual = vActual.trim();
    }
    if (
      vExpected !== vActual &&
      !this._collector.collectFailure(aExpected[i], aActual[i])
    ) {
      return false;
    }
    // remove to check for extra/missed attributes;
    delete aActual[i];
    delete aExpected[i];
  }

  // report all missed attributes
  for (let i in aExpected) {
    if (
      aExpected.hasOwnProperty(i) &&
      !this._collector.collectFailure(aExpected[i], null)
    )
      return false;
  }

  // report all extra attributes
  for (let i in aActual) {
    if (
      aActual.hasOwnProperty(i) &&
      !this._collector.collectFailure(null, aActual[i])
    )
      return false;
  }

  return true;
};

Comparator.prototype.compareNode = function(left, right) {
  if (left.nodeName === right.nodeName && left.nodeType === right.nodeType) {
    switch (left.nodeType) {
    case type.DOCUMENT_NODE:
      return this.compareNode(left.documentElement, right.documentElement);
    case type.ELEMENT_NODE:
      return (
          this._compareAttributes(left.attributes, right.attributes) &&
          this._compareNodeList(left.childNodes, right.childNodes)
      );
    case type.TEXT_NODE:
      // fallthrough
    case type.CDATA_SECTION_NODE:
      // fallthrough
    case type.COMMENT_NODE:
      if (
          left.nodeType === type.COMMENT_NODE && !this._options.compareComments
        )
        return true;
      let vLeft = '' + left.nodeValue;
      let vRight = '' + right.nodeValue;
      if (
          this._options.stripSpaces && left.nodeType !== type.CDATA_SECTION_NODE
        ) {
        vLeft = vLeft.trim();
        vRight = vRight.trim();
      }
      const r = vLeft === vRight;
      return !r ? this._collector.collectFailure(left, right) : r;
    default:
      throw Error(
          'Node type ' + left.nodeType + ' comparison is not implemented'
        );
    }
  } else return this._collector.collectFailure(left, right);
};
