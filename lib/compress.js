function compress(str, options) {
  var css = require('css');
  var tree = css.parse(str);

  var transformer = new Transformer();
  transformer.transform(tree);

  return css.stringify(tree, { compress: true });
}

// ## Transformer
// A class that transforms a tree, given some options. Which is usually not given.

function Transformer(options) {
  options || (options = {});
  this.options = options;
  return this;
}

// ### transform
// Transforms a stylesheet.

Transformer.prototype.transform = function(tree) {
  this.context(tree.stylesheet);
};

// ### context
// Transforms a given tree `context`. A `context` can usually be a media query
// definition, or a stylesheet itself.
//
//     tree == {
//       rules: [ { StyleRule, MediaRule, KeyframeRule, FontfaceRule, ? } ]
//     }
//
Transformer.prototype.context = function(tree) {
  var self = this;

  var mediaCache = {};
  var valueCache = {};
  var selectorCache = {};

  //- __Pass #1__

  tree.rules.forEach(function(rule, i) {

    //- Consolidate media queries.
    if (typeof rule.media !== 'undefined') {
      if (mediaCache[rule.media]) {
        mediaCache[rule.media].rules =
          mediaCache[rule.media].rules.concat(rule.rules);

        delete(tree.rules[i]);
      } else {
        mediaCache[rule.media] = rule;
      }
    }

    //- Compress selectors and declarations.
    //- Consolidate rules with same definitions.
    if (typeof rule.declarations !== 'undefined') {
      self.styleRule(rule, tree.rules, i);
      self.consolidateViaDeclarations(rule, tree.rules, i, valueCache);
    }

  });

  //- __Pass #2__

  tree.rules.forEach(function(rule, i) {

    //- Consolidate rules with same selectors.
    if (typeof rule.declarations !== 'undefined') {
      self.consolidateViaSelectors(rule, tree.rules, i, selectorCache);
    }
  });

  //- __Pass #3__

  valueCache = {};
  tree.rules.forEach(function(rule, i) {
    //- Consolidate rules with same definitions. Again, to account for the
    //  updated rules in Pass #2.
    if (typeof rule.declarations !== 'undefined') {
      self.consolidateViaDeclarations(rule, tree.rules, i, valueCache);
    }

    //- Recurse through media queries.
    if (typeof rule.media !== 'undefined') {
      rule = self.context(rule);
    }

    //- Recurse through at keyframes.
    if (typeof rule.keyframes !== 'undefined') {
      rule.keyframes.forEach(function(keyframe, i) {
        self.styleRule(keyframe, rule.keyframes, i);
      });
    }
  });

  return tree;
};

// ### consolidateViaDeclarations
// Consolidate rules with same definitions.
//
// Takes a rule `rule` and checks if it's in `cache`. If it is, it consolidates
// it and removes it from `context`/`i`.

Transformer.prototype.consolidateViaDeclarations = function(rule, context, i, cache) {
  var value = JSON.stringify(rule.declarations);

  if (typeof cache[value] !== 'undefined') {
    cache[value].selectors =
      cache[value].selectors.concat(rule.selectors);

    delete context[i];
  } else {
    cache[value] = rule;
  }
};

// ### consolidateViaSelectors
// Consolidate rules with same selectors. See `consalidateViaDeclarations` for description.

Transformer.prototype.consolidateViaSelectors = function(rule, context, i, cache) {
  var selector = JSON.stringify(rule.selectors);
  if (typeof cache[selector] !== 'undefined') {
    cache[selector].declarations =
      cache[selector].declarations.concat(rule.declarations);

    delete context[i];
  } else {
    cache[selector] = rule;
  }
};

// ### styleRule
//
// Transforms given `rule`, which is part of rules array `context` at index `i`.
//
// A `rule` can either be a CSS rule, or a keyframe.
//
//     /* Rule */
//     rule == {
//       selectors: [ '.red' ]
//       declarations: [ { Declaration } ]
//     }
//
//     /* Keyframe */
//     rule == {
//       values: [ '100%' ]
//       declarations: [ { Declaration } ]
//     }

Transformer.prototype.styleRule = function(rule, context, i) {
  var self = this;

  //- If the rule doesn't have anything, delete it.
  if (rule.declarations.length === 0) {
    delete(context[i]);
    return;
  }

  //- Compress its selectors.
  if (typeof rule.selectors !== 'undefined') {
    rule.selectors = rule.selectors.map(compressSelector);
  }

  //- Compress its declarations.
  rule.declarations.forEach(function(declaration) {
    self.declaration(declaration);
  });

  return rule;
};

/*
  { property: 'color', value: '#ff0000' }
*/
Transformer.prototype.declaration = function(declaration) {
  var self = this;

  // Split the values according to quotes, etc.
  var values = valueSplit(declaration.property, declaration.value);

  // Compress each of the values if possible
  values = values.map(function(identifier) {
    return self.identifier(identifier);
  });

  if (declaration.property === 'font-family') {
    declaration.value = values.join(',');
  } else {
    declaration.value = values.join(' ');
  }

  return declaration;
};

// ### identifier
// Compresses a given identifier.
// Returns a string.

Transformer.prototype.identifier = function(identifier) {
  //- Compress `0px` to `0`.
  if (identifier.match(/^0(\.0*)?(?:em|px|%)$/)) {
    return "0";
  }

  //- Compress `#ff2288` to `#f28`. Also, lowercase all hex codes.
  if (identifier.match(/^#[0-9a-f]+$/)) {
    identifier = identifier.toLowerCase();
    if (identifier[1] === identifier[2] && identifier[3] === identifier[4] && identifier[5] === identifier[6]) {
      return '#' + identifier[1] + identifier[3] + identifier[5];
    } else {
      return identifier;
    }
  }

  // Else, just return it.
  return identifier;
};

function compressSelector(selector) {
  var re = selector;

  re = re.replace(/\s+/, ' ');
  re = re.replace(/ ?(>) ?/, '$1');

  return re;

};

// Split a value into an array.
function valueSplit(prop, values) {
  var re;

  //- Split accordingly. Fonts are parsed differently from others.
  if (prop === 'font-family') {
    re = values.split(',')
  } else {
    re = values.match(/"[^"]+"|'[^']+'|[^ ]+/g);
  }

  //- Trim out surrounding whitespace.
  re = re.map(function(s) { return s.trim(); });

  // Remove the quotes from those that don't need it.
  if (prop === 'font-family') {
    re = re.map(function(value) {
      if ((value.charAt(0) === '"') || (value.charAt(0) === "'")) {
        value = value.substr(1, value.length - 2);
      }
      return value;
    });
  }

  return re;
}


module.exports = {
  compress: compress
};
