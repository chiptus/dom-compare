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
  this._options = options || {};
  /**
     * options: {
     *  comparators,
     *  stripSpaces
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

  const { msg, canContinue } = collectFailureWrapper(
    expected,
    actual,
    this._options
  );
  if (!msg) {
    return canContinue;
  }

  this._diff.push({
    node: revxpath(ref.ownerElement || ref.parentNode),
    message: msg,
    type: '',
    node1: actual,
    node2: expected,
    score: 0,
  });

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
  let msg;
  //expected value is different from actual value
  // const map = {
  //   [type.ATTRIBUTE_NODE]: attributeErrorMsg(
  //     expected,
  //     vExpected,
  //     vActual
  //   ),
  // };
  switch (expected.nodeType) {
  case type.ATTRIBUTE_NODE:
    msg = attributeErrorMsg(expected, vExpected, vActual);
    break;
  case type.COMMENT_NODE:
    msg = commentErrorMsg(vExpected, vActual);

    break;
  case type.CDATA_SECTION_NODE:
    msg = cdataErrorMsg(vExpected, vActual);

    break;
  case type.TEXT_NODE:
    msg = textErrorMsg(vExpected, vActual);
    break;
  default:
      //if they are the same class of objects and undefined nodeType, assumes attribute
      //TODO remove when jsdom fix this
    if (expected.constructor === actual.constructor) {
      msg = attributeErrorMsg(expected, vExpected, vActual);
      break;
    }
    throw new Error('nodeValue is not equal, but nodeType is unexpected');
  }
  return msg;
}

function collectFailureWrapper(expected, actual, { comparators, stripSpaces }) {
  function ans(msg = '', canContinue = true, ref) {
    return {
      canContinue,
      msg,
      ref,
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
      })} is missed`
    );
  } else if (!expected && actual) {
    return ans(
      `Extra ${typeMap[actual.nodeType]} ${describeNode(actual, {
        stripSpaces,
      })}`
    );
  } else {
    if (expected.nodeType === actual.nodeType) {
      if (expected.nodeName === actual.nodeName) {
        stripSpaces =
          stripSpaces && expected.nodeType !== type.CDATA_SECTION_NODE;
        let vExpected = stripSpacesIfNeeded(expected.nodeValue, stripSpaces);
        let vActual = stripSpacesIfNeeded(actual.nodeValue, stripSpaces);
        if (vExpected === vActual) {
          throw new Error('Nodes are considered equal but shouldn\'t');
        }
        return ans(handleUnequalValues(expected, actual, vExpected, vActual));
      } else {
        return ans(differentNodeNameMsg(expected, actual), false);
        //expected node name is different than actual node name
      }
    } else {
      return ans(differentNodeTypeMsg(expected, actual), false);
    }
  }
}

function customCompare(cmprtr, expected, actual) {
  if (!(cmprtr instanceof Array)) cmprtr = [cmprtr];
  const compared = cmprtr.map(c => c(expected, actual)).filter(r => r);
  if (compared.length) {
    const r = compared[0];
    // true -> ignore differences. Stop immediately, continue;
    if (r === true) {
      return { msg: '', canContinue: true };
    } else if (typeof r === 'string') {
      // string - treat as error message, continue;
      return { msg: r, canContinue: true };
    } else if (typeof r === 'object') {
      // object - .message = error message, .stop - stop flag
      return { msg: r.message, canContinue: !r.stop };
    }
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
