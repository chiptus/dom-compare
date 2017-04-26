module.exports = Collector;

const type = require('./node_types');
const revxpath = require('./revxpath.js');

const typeMap = {}, comparatorTypeMap = {};

typeMap[type.ATTRIBUTE_NODE] = 'attribute';
typeMap[type.ELEMENT_NODE] = 'element';
typeMap[type.TEXT_NODE] = 'text node';
typeMap[type.COMMENT_NODE] = 'comment node';
typeMap[type.CDATA_SECTION_NODE] = 'CDATA node';
typeMap[type.DOCUMENT_NODE] = 'document';

Object.keys(type).forEach(function(k) {
  comparatorTypeMap[type[k]] = k;
});

function Collector(options) {
  this._diff = [];
  this._options = options || {
    score: () => 1,
  };
  /**
     * options: {
     *  comparators,
     *  stripSpaces,
     *  score
     * }
     */
}

Collector.prototype.getDifferences = function() {
  return this._diff;
};

Collector.prototype.getResult = function() {
  return this._diff.length === 0;
};

Collector.prototype.collectFailure = function(expected, actual) {
  let ref = expected || actual;

  const { msg, canContinue, type } = collectFailureWrapper(
    expected,
    actual,
    this._options
  );

  if (msg) {
    this._diff.push({
      node: revxpath(ref.ownerElement || ref.parentNode),
      message: msg,
      type,
      node1: actual,
      node2: expected,
      score: this._options(type),
    });
  }

  return canContinue;
};

function toTitleCase(str) {
  return str.charAt(0).toUpperCase() + str.substr(1);
}

function attributeErrorMsg(expected, vExpected, vActual) {
  return `Attribute '${expected.nodeName}': expected value '${vExpected}' instead of '${vActual}'`;
}

function commentErrorMsg(vExpected, vActual) {
  return `Expected comment value '${vExpected}' instead of '${vActual}'`;
}

function cdataErrorMsg(vExpected, vActual) {
  return `Expected CDATA value '${vExpected}' instead of '${vActual}'`;
}

function textErrorMsg(vExpected, vActual) {
  return `Expected text '${vExpected}' instead of '${vActual}'`;
}

function differentNodeNameMsg(expected, actual) {
  return `Expected ${typeMap[expected.nodeType]} '${expected.nodeName}' instead of '${actual.nodeName}'`;
}

function differentNodeTypeMsg(expected, actual) {
  return `Expected node of type ${expected.nodeType} (${typeMap[expected.nodeType]}) instead of ${actual.nodeType} (${typeMap[actual.nodeType]})`;
}

function stripSpacesIfNeeded(value, stripSpaces) {
  return stripSpaces ? value.trim() : value;
}

function handleUnequalValues(expected, actual, vExpected, vActual) {
  //expected value is different from actual value

  //if they are the same class of objects and undefined nodeType, assumes attribute
  if (expected.constructor === actual.constructor && !expected.nodeType) {
    expected.nodeType = type.ATTRIBUTE_NODE;
  }

  const map = {
    [type.ATTRIBUTE_NODE]: attributeErrorMsg(expected, vExpected, vActual),
    [type.COMMENT_NODE]: commentErrorMsg(vExpected, vActual),
    [type.CDATA_SECTION_NODE]: cdataErrorMsg(vExpected, vActual),
    [type.TEXT_NODE]: textErrorMsg(vExpected, vActual),
  };

  if (!expected.nodeType) {
    throw new Error('nodeValue is not equal, but nodeType is unexpected');
  }

  return map[expected.nodeType];
}

function collectFailureWrapper(expected, actual, { comparators, stripSpaces }) {
  function ans(msg = '', type = '', canContinue = true, ref) {
    return {
      canContinue,
      msg,
      ref,
      type,
    };
  }

  let ref = expected || actual;

  let cmprtr = comparators && comparators[comparatorTypeMap[ref.nodeType]];

  if (cmprtr) {
    let customCompareResult = customCompare(cmprtr, expected, actual);
    if (customCompareResult) {
      return customCompareResult;
    }
  }

  if (expected && !actual) {
    return ans(
      `${toTitleCase(typeMap[expected.nodeType])} ${describeNode(expected, {
        stripSpaces,
      })} is missed`,
      'MISSING_NODE'
    );
  }
  if (!expected && actual) {
    return ans(
      `Extra ${typeMap[actual.nodeType]} ${describeNode(actual, {
        stripSpaces,
      })}`,
      'MISSING_NODE'
    );
  }
  //expected and actual are defined

  if (expected.nodeType !== actual.nodeType) {
    return ans(differentNodeTypeMsg(expected, actual), 'DIFF_TYPE', false);
  }

  //same node type
  if (expected.nodeName !== actual.nodeName) {
    return ans(differentNodeNameMsg(expected, actual), 'DIFF_TAG', false);
  }

  //same node name
  const { vExpected, vActual } = getValues(expected, actual, stripSpaces);

  if (vExpected === vActual) {
    throw new Error('Nodes are considered equal but shouldn\'t');
  }

  return ans(
    handleUnequalValues(expected, actual, vExpected, vActual),
    'DIFF_NODE_VALUE'
  );
}

function customCompare(cmprtr, expected, actual) {
  if (!(cmprtr instanceof Array)) cmprtr = [cmprtr];
  const compared = cmprtr.map(c => c(expected, actual)).filter(r => r);
  if (!compared.length) {
    return;
  }
  const r = compared[0];
  // true -> ignore differences. Stop immediately, continue;
  if (r === true) {
    return { msg: '', canContinue: true };
  }
  if (typeof r === 'string') {
    // string - treat as error message, continue;
    return { msg: r, canContinue: true };
  }
  if (typeof r === 'object') {
    // object - .message = error message, .stop - stop flag
    return { msg: r.message, type: r.type, canContinue: !r.stop };
  }
}

function describeNode(node, { stripSpaces }) {
  if (
    node.nodeType === type.TEXT_NODE ||
    node.nodeType === type.CDATA_SECTION_NODE ||
    node.nodeType === type.COMMENT_NODE
  ) {
    return `'${stripSpaces ? node.nodeValue.trim() : node.nodeValue}'`;
  } else return `'${node.nodeName}'`;
}

function getValues(expected, actual, stripSpaces) {
  stripSpaces = stripSpaces && expected.nodeType !== type.CDATA_SECTION_NODE;
  let vExpected = stripSpacesIfNeeded(expected.nodeValue, stripSpaces);
  let vActual = stripSpacesIfNeeded(actual.nodeValue, stripSpaces);
  return { vActual, vExpected };
}
