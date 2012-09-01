// # CssCrunch
// Yes! This only has one entry point, `compress`:
//
//     var CC = require('css_crunch')
//
//     var output = CC.compress(string);
//

function compress(str, options) {
  var css = { parse: require('css-parse'), stringify: require('css-stringify') };

  return compressCode(str);

  function compressCode(str) {
    // Get important comments before stripping.
    var parts = getBangComments(str);

    str = parts.code;

    // Crappy way of accounting for the IE5/Mac hack.
    var i=0;
    str = str.replace(/\/\*[\s\S]*?\\\*\/([\s\S]+?)\/\*[\s\S]*?\*\//g, function(content) {
      return '#x'+i+'ie5machack{start:1}' + content + '#x'+(++i)+'ie5machack{end:1}';
    });

    // Strip comments before compressing.
    str = stripComments(str);

    //- Get the AST.
    var tree = css.parse(str);

    //- Transform the AST.
    transform(tree);

    //- Stringify using node-css-stringify.
    var output = css.stringify(tree, { compress: true });

    //- Heh, replace back the sentinels we made
    output = output
      .replace(/\s*#x[0-9]+ie5machack{start:1}\s*/g, '/*\\*/')
      .replace(/\s*#x[0-9]+ie5machack{end:1}\s*/g, '/**/');

    //- Combine the bang comments with the stringified output.
    output = parts.comments.join("") + output;

    return output;
  }

  // ### transform
  // Transforms a stylesheet.

  function transform(tree) {
    context(tree.stylesheet);
  };

  // ### context
  // Transforms a given tree `context`. A `context` can usually be a media query
  // definition, or a stylesheet itself.
  //
  //     tree == {
  //       rules: [ { StyleRule, MediaRule, KeyframeRule, FontfaceRule, ? } ]
  //     }
  //
  function context(tree) {
    var mediaCache = {};
    var valueCache = {};
    var selectorCache = {};

    // __Pass #1__

    tree.rules.forEach(function(rule, i) {

      //- Consolidate media queries.
      if (typeof rule.media !== 'undefined') {
        consolidateMediaQueries(rule, tree.rules, i, mediaCache);
      }

      //- Compress selectors and declarations.
      //- Consolidate rules with same definitions.
      if (typeof rule.declarations !== 'undefined') {
        styleRule(rule, tree.rules, i);
        consolidateViaDeclarations(rule, tree.rules, i, valueCache);
      }

    });

    // __Pass #2__

    tree.rules.forEach(function(rule, i) {

      //- Consolidate rules with same selectors.
      if (typeof rule.declarations !== 'undefined') {
        consolidateViaSelectors(rule, tree.rules, i, selectorCache);
      }
    });

    // __Pass #3__

    valueCache = {};
    tree.rules.forEach(function(rule, i) {
      //- Consolidate rules with same definitions. Again, to account for the
      //  updated rules in Pass #2.
      if (typeof rule.declarations !== 'undefined') {
        consolidateViaDeclarations(rule, tree.rules, i, valueCache);
      }

      //- Recurse through media queries.
      if (typeof rule.media !== 'undefined') {
        rule = context(rule);
      }

      //- Recurse through at keyframes.
      if (typeof rule.keyframes !== 'undefined') {
        rule.keyframes.forEach(function(keyframe, i) {
          styleRule(keyframe, rule.keyframes, i);
        });
      }
    });

    return tree;
  }

  // ### sortDeclarations
  // Sorts a given list of declarations.
  //
  // This accounts for IE hacks and vendor prefixes *[1]* to make sure that
  // they're after the declarations it hacks. eg, it will ensure the order of
  // `border: 0; *border: 0;`.
  //
  // Also, this will preserve the order of declarations with the same property.
  // For instance, `background: -moz-linear-gradient(); background:
  // -linear-gradient()` will have its order preserved.

  function sortDeclarations(declarations) {
    if (declarations.length <= 1) return declarations;

    declarations.forEach(function(decl, i) {
      decl.index = i;
    });

    return declarations.sort(function(a, b) {
      function toIndex(decl) {
        var prop = decl.property;

        if (m = prop.match(/^(\-[a-z]+\-|\*|_)(.*)$/)) { /* [1] */
          prop = m[2];
        }

        return prop + "Z" + (1000+decl.index); /* [2] */
      }

      return toIndex(a) > toIndex(b) ? 1 : -1;
    });
  };

  // ### consolidateViaDeclarations
  // Consolidate rules with same definitions.
  //
  // Takes a rule `rule` and checks if it's in `cache`. If it is, it consolidates
  // it and removes it from `context`/`i`.

  function consolidateViaDeclarations(rule, context, i, cache) {
    consolidate('selectors', 'declarations', 'last', rule, context, i, cache);
    rule.selectors = rule.selectors.sort();
  };

  // ### consolidateViaSelectors
  // Consolidate rules with same selectors. See `consalidateViaDeclarations` for description.

  function consolidateViaSelectors(rule, context, i, cache) {
    consolidate('declarations', 'selectors', 'last', rule, context, i, cache);
    rule.declarations = sortDeclarations(rule.declarations);
  };

  // ### consolidateMediaQueries
  // Consolidate media queries

  function consolidateMediaQueries(rule, context, i, cache) {
    consolidate('rules', 'media', 'last', rule, context, i, cache);
  };

  // ### consolidate
  // What the other consolidate thingies use.
  // Consolidate the rule's `what` for the other rules that has the same `via`.

  function consolidate(what, via, direction, rule, context, i, cache) {
    var value = JSON.stringify(rule[via]);

    if (direction == 'first') {
      if (typeof cache[value] !== 'undefined') {
        cache[value][what] =
          cache[value][what].concat(rule[what]);

        delete context[i];
      } else {
        cache[value] = rule;
      }
    }

    else {
      if (typeof cache[value] !== 'undefined') {
        var last = cache[value];
        rule[what] = last.rule[what].concat(rule[what]);

        delete context[last.index];
      }
      cache[value] = { rule: rule, index: i };
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

  function styleRule(rule, context, i) {
    //- If the rule doesn't have anything, delete it.
    if (rule.declarations.length === 0) {
      delete(context[i]);
      return;
    }

    //- Compress its selectors.
    if (typeof rule.selectors !== 'undefined') {
      rule.selectors = rule.selectors.map(compressSelector).sort();
    }

    //- Sort declarations.
    rule.declarations = sortDeclarations(rule.declarations);

    //- Compress its declarations.
    rule.declarations.forEach(function(declaration) {
      compressDeclaration(declaration);
    });

    return rule;
  };

  /*
    { property: 'color', value: '#ff0000' }
  */
  function compressDeclaration(declaration) {
    var self = this;
    var val;

    //- Split the values according to quotes, etc.
    var values = valueSplit(declaration.property, declaration.value);

    //- Compress each of the values if possible
    values = values.map(function(identifier) {
      return compressIdentifier(identifier, declaration.property);
    });

    if (declaration.property === 'font-family') {
      val = values.join(',');
    } else {
      val = values.join(' ');
    }

    //- Strip whitespace on important
    val = val.replace(/\s*!important$/, '!important');
    declaration.value = val;

    return declaration;
  };

  // ### compressIdentifier
  // Compresses a given identifier.
  // Returns a string.

  function compressIdentifier(identifier, property) {
    var m;
    //- Compress `none` to `0`.
    if ((identifier === 'none') &&
        ((property === 'background') ||
         (property === 'border') ||
         (property === 'outline'))) {
      return "0";
    }

    //- Remove quotes from urls.
    if (m = identifier.match(/^url\(["'](.*?)["']\)$/)) {
      return "url(" + m[1] + ")";
    }

    //- Compress `0px` to `0`.
    if (m = identifier.match(/^(\.?[0-9]+|[0-9]+\.[0-9]+)?(em|px|%|in|cm|pt)$/)) {
      var num = m[1];
      var unit = m[2];

      if (num.match(/^0*\.?0*$/)) {
        return "0";
      } else {
        num = num.replace(/^0+/, '');
        if (num.indexOf('.') > -1) num = num.replace(/0+$/, '');
        return num + unit;
      }
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

  // ### compressSelector
  // Compresses a selector string.
  // Returns the compressed string.

  function compressSelector(selector) {
    var re = selector;

    re = re.replace(/\s+/, ' ');
    re = re.replace(/ ?([\+>~]) ?/, '$1');

    return re;

  };

  // ### valueSplit
  // Split a value into an array. Takes a string `values`, along with the property name `prop`.
  //
  // Returns an array.

  function valueSplit(prop, values) {
    var re;

    //- Split accordingly. Fonts are parsed differently from others.
    if (prop === 'font-family') {
      re = values.split(',')
    } else {
      re = values.match(/"(?:\\"|.)*?"|'(?:\\'|.)*?'|[^ ]+/g);
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

  // ### stripComments
  // Helper to remove the comments out of a string `str`.

  function stripComments(str) {
    return str.replace(/\/\*[\s\S]*?\*\//g, '');
  }

  // ### getBangComments
  // Returns an array of bang comments in `comments`, and the rest of the code
  // without the comments in `code`.

  function getBangComments(str) {
    var comments = [];
    var code = str.replace(/\/\*![\s\S]*?\*\//g, function(str) {
      comments.push(str.trim() + "\n");
      return '';
    });
    return { comments: comments, code: code };
  }
};

module.exports = {
  compress: compress
};
