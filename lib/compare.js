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

function getNodeValue(node, options) {
  return options.stripSpaces && node.nodeType !== type.CDATA_SECTION_NODE
    ? node.nodeValue.trim()
    : node.nodeValue;
}

/**
 * Compare two attributes
 */
Comparator.prototype._compareAttributes = function(expected, actual) {
  function createAttributeObject(nodesList) {
    let attr = {};
    for (let i = 0, l = nodesList.length; i < l; i++) {
      attr[nodesList[i].nodeName] = nodesList[i];
    }
    return attr;
  }

  if (!expected && !actual) return true;

  const aExpected = createAttributeObject(expected);
  const aActual = createAttributeObject(actual);

  for (let i in aExpected) {
    if (!aExpected.hasOwnProperty(i) || !aActual.hasOwnProperty(i)) {
      continue;
    }

    // both nodes has an attribute
    // but values is differ
    let vExpected = getNodeValue(aExpected[i], this._options);
    let vActual = getNodeValue(aActual[i], this._options);

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
  const map = {
    [type.DOCUMENT_NODE]: () =>
      this.compareNode(left.documentElement, right.documentElement),
    [type.ELEMENT_NODE]: () =>
      this._compareAttributes(left.attributes, right.attributes) &&
      this._compareNodeList(left.childNodes, right.childNodes),
    [type.TEXT_NODE]: () => this._compareTextTypeNodes(left, right),
    [type.CDATA_SECTION_NODE]: () => this._compareTextTypeNodes(left, right),
    [type.COMMENT_NODE]: () => this._compareComments(left, right),
  };

  if (!sameNodeName(left, right) || !sameNodeType(left, right)) {
    return this._collector.collectFailure(left, right);
  }

  if (!left.nodeType || !(left.nodeType in map)) {
    throw Error(
      'Node type ' + left.nodeType + ' comparison is not implemented'
    );
  }

  return map[left.nodeType]();
};

Comparator.prototype._compareComments = function compareComments(left, right) {
  if (!this._options.compareComments) return true;
  return this._compareTextTypeNodes(left, right);
};

Comparator.prototype._compareTextTypeNodes = function compareTextTypeNodes(
  left,
  right
) {
  let vLeft = getNodeValue(left, this._options);
  let vRight = getNodeValue(right, this._options);
  const r = vLeft === vRight;
  return !r ? this._collector.collectFailure(left, right) : r;
};

function sameNodeName(left, right) {
  return left.nodeName === right.nodeName;
}

function sameNodeType(left, right) {
  return left.nodeType === right.nodeType;
}
