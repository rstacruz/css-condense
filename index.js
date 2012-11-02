// # CssCrunch
// Yes! This only has one entry point, `compress`:
//
//     var CC = require('css_crunch')
//
//     var output = CC.compress(string);
//

function compress(str, options) {
  options || (options = {});

  var css = { parse: require('css-parse'), stringify: require('css-stringify') };

  // Handle the `safe: true` preset.
  if (options.safe === true) {
    options.consolidateMediaQueries = false;
    options.consolidateViaSelectors = false;
    options.consolidateViaDeclarations = false;
  }

  // Handle the `sort: false` preset.
  if (options.sort === false) {
    options.sortSelectors = false;
    options.sortDeclarations = false;
  }

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
    var output;
    if (options.compress === false) {
      output = css.stringify(tree).trim();
    } else {
      output = css.stringify(tree, { compress: true });
    }

    //- Heh, replace back the sentinels we made
    output = output
      .replace(/\s*#x[0-9]+ie5machack\{start:1\}\s*/g, '/*\\*/')
      .replace(/\s*#x[0-9]+ie5machack\{end:1\}\s*/g, '/**/');

    //- Add line breaks if you want.
    if (options.lineBreaks === true) {
      output = output.replace(/\}/g, "}\n");
    }

    //- Combine the bang comments with the stringified output.
    output = parts.comments.join("") + output;

    //- Debug mode? Add comments at the beginning
    if (options.debug) {
      output = "/* Transformed AST:\n" + JSON.stringify(tree, null, 2) + "\n*/\n" + output;
    }

    return output;
  }

  // ### transform
  // Transforms a stylesheet.

  function transform(tree) {
    context(tree.stylesheet);
  }

  // ### isStyleRule
  // Helper to check if a rule is a normal style rule.

  function isStyleRule(rule) {
    return ((typeof rule.declarations !== 'undefined') &&
            (typeof rule.selectors !== 'undefined') &&
            (rule.selectors[0] !== '@font-face'));
  }

  function isMediaRule(rule) {
    return (typeof rule.media !== 'undefined');
  }

  function isFontfaceRule(rule) {
    return ((typeof rule.declarations !== 'undefined') &&
            (typeof rule.selectors !== 'undefined') &&
            (rule.selectors[0] === '@font-face'));
  }

  function isKeyframesRule(rule) {
    return (typeof rule.keyframes !== 'undefined');
  }

  function isCharsetRule(rule) {
    return (typeof rule.charset !== 'undefined');
  }


  function getFontID(rule) {
    function get(key) {
      var re;
      rule.declarations.forEach(function(declaration, i) {
        if (declaration.property.trim() === key) re = declaration.value.trim();
      });
      return re;
    }

    var id = [
      (get('font-family') || ""),
      (get('font-weight') || ""),
      (get('font-style') || "")
    ].join("");

    return (id === "") ? null : id;
  }

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

    // __Pass #0__

    var parts = { charsets: [], keyframes: [], fonts: [], other: [] };
    var fonts = {};

    tree.rules.forEach(function(rule, i) {
      //- Sort everything into `parts`...
      if (isCharsetRule(rule)) {
        parts.charsets = [rule];
      } else if (isKeyframesRule(rule)) {
        parts.keyframes.push(rule);
      } else if (isFontfaceRule(rule)) {
        var fontname = getFontID(rule);
        if (fontname && !fonts[fontname]) {
          parts.fonts.push(rule);
          fonts[fontname] = true;
        }
      } else {
        parts.other.push(rule);
      }
    });

    //- And put them back in this particular order.
    tree.rules = parts.charsets.concat(parts.keyframes).concat(parts.fonts).concat(parts.other);

    // __Pass #1__

    tree.rules.forEach(function(rule, i) {
      //- Consolidate media queries.
      if (isMediaRule(rule)) {
        consolidateMediaQueries(rule, tree.rules, i, mediaCache);
      }

      if (isFontfaceRule(rule) || isStyleRule(rule)) {
        styleRule(rule, tree.rules, i);
      }

      //- Compress selectors and declarations.
      //- Consolidate rules with same definitions.
      if (isStyleRule(rule)) {
        consolidateViaDeclarations(rule, tree.rules, i, valueCache);
      }
    });

    // __Pass #2__

    tree.rules.forEach(function(rule, i) {
      //- Consolidate rules with same selectors.
      if (isStyleRule(rule)) {
        consolidateViaSelectors(rule, tree.rules, i, selectorCache);
      }
    });

    // __Pass #3__

    valueCache = {};
    tree.rules.forEach(function(rule, i) {
      //- Consolidate rules with same definitions. Again, to account for the
      //  updated rules in Pass #2.
      if (isStyleRule(rule)) {
        consolidateViaDeclarations(rule, tree.rules, i, valueCache);
        rule.selectors = undupeSelectors(rule.selectors);
      }

      //- Recurse through media queries.
      if (isMediaRule(rule)) {
        rule = context(rule);
      }

      //- Recurse through at keyframes.
      if (isKeyframesRule(rule)) {
        rule.keyframes.forEach(function(keyframe, i) {
          styleRule(keyframe, rule.keyframes, i);
        });
      }
    });

    return tree;
  }

  // ### undupeSelectors
  // Removes duplicate selectors

  function undupeSelectors(selectors) {
    var cache = {}, output = [];

    selectors.forEach(function(selector) {
      if (!cache[selector]) {
        cache[selector] = true;
        output.push(selector);
      }
    });

    return output;
  }

  // ### sortSelectors
  // Sorts selectors.

  function sortSelectors(selectors) {
    if (options.sortSelectors === false) return selectors;
    if (selectors.length <= 1) return selectors;

    return selectors.sort();
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
    if (options.sortDeclarations === false) return declarations;
    if (declarations.length <= 1) return declarations;

    declarations.forEach(function(decl, i) {
      decl.index = i;
    });

    return declarations.sort(function(a, b) {
      function toIndex(decl) {
        var prop = unvendor(decl.property);
        return prop + "-" + (1000+decl.index); /* [2] */
      }

      return toIndex(a) > toIndex(b) ? 1 : -1;
    });
  }

  // ### consolidateViaDeclarations
  // Consolidate rules with same definitions.
  //
  // Takes a rule `rule` and checks if it's in `cache`. If it is, it consolidates
  // it and removes it from `context`/`i`.

  function consolidateViaDeclarations(rule, context, i, cache) {
    if (options.consolidateViaDeclarations === false) return;

    consolidate('selectors', 'declarations', 'last', rule, context, i, cache);
    rule.selectors = sortSelectors(rule.selectors);
  }

  // ### consolidateViaSelectors
  // Consolidate rules with same selectors. See `consalidateViaDeclarations` for description.

  function consolidateViaSelectors(rule, context, i, cache) {
    if (options.consolidateViaSelectors === false) return;

    consolidate('declarations', 'selectors', 'last', rule, context, i, cache);
    rule.declarations = sortDeclarations(rule.declarations);
  }

  // ### consolidateMediaQueries
  // Consolidate media queries

  function consolidateMediaQueries(rule, context, i, cache) {
    if (options.consolidateMediaQueries === false) return;
    consolidate('rules', 'media', 'last', rule, context, i, cache);
  }

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
  }

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
    if (isStyleRule(rule)) {
      rule.selectors = sortSelectors(rule.selectors.map(compressSelector));
    }

    //- Sort declarations.
    rule.declarations = sortDeclarations(rule.declarations);

    //- Compress its declarations.
    rule.declarations.forEach(function(declaration) {
      compressDeclaration(declaration);
    });

    return rule;
  }

  /*
    { property: 'color', value: '#ff0000' }
  */
  function compressDeclaration(declaration) {
    var self = this;
    var val = declaration.value;

    //- Trim off whitespace in property.
    declaration.property = declaration.property.trim();

    //- Naively strip whitespaces from commas and parentheses.
    //  Only do it if there's no quoted string in there.
    if ((val.indexOf("'") === -1) && (val.indexOf('"') === -1)) {
      val = val
        .replace(/\s*,\s*/g, ',')
        .replace(/(\(\s*)+/g, function(str) { return str.replace(/\s/g, ''); })
        .replace(/(\s*\))+/g, function(str) { return str.replace(/\s/g, ''); });
    }

    //- Split the values according to quotes, etc.
    var values = valueSplit(declaration.property, val);

    //- Compress each of the values if possible
    values = values.map(function(identifier) {
      return compressIdentifier(identifier, declaration.property, values.length);
    });

    //- Consolidate 10px 10px 10px 10px -> 10px.
    if ((declaration.property === 'margin') || (declaration.property === 'padding')) {
      values = compressPadding(values);
    }

    if (declaration.property === 'font-family') {
      val = values.join(',');
    } else {
      val = values.join(' ');
    }

    //- Strip whitespace on important
    val = val.replace(/\s*!important$/, '!important');
    declaration.value = val;

    return declaration;
  }

  // ### compressIdentifier
  // Compresses a given identifier.
  // Returns a string.

  function compressIdentifier(identifier, property, count) {
    var zeroableProperties = [
      'background', 'border', 'border-left', 'border-right', 'border-top', 'border-bottom',
      'outline', 'outline-left', 'outline-right', 'outline-top', 'outline-bottom'
    ];

    var m;
    //- Compress `none` to `0`.
    if ((identifier === 'none') && (zeroableProperties.indexOf(unvendor(property)) > -1) && (count === 1)) {
      return "0";
    }

    //- Remove quotes from urls.
    m = identifier.match(/^url\(["'](.*?)["']\)$/);

    if (m) {
      return "url(" + m[1] + ")";
    }

    //- Compress `0px` to `0`.
    m = identifier.match(/^(\.?[0-9]+|[0-9]+\.[0-9]+)?(%|em|ex|in|cm|mm|pt|pc|px)$/);
    if (m) {
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

    m = identifier.match(/^rgb\(([0-9]+),([0-9]+),([0-9]+)\)$/i);
    if (m) {
      identifier = rgbToHex([ m[1], m[2], m[3] ]);
    }

    //- Compress `#ff2288` to `#f28`. Also, lowercase all hex codes.
    if (identifier.match(/^#[0-9a-f]+$/i)) {
      identifier = identifier.toLowerCase();
      if (identifier[1] === identifier[2] && identifier[3] === identifier[4] && identifier[5] === identifier[6]) {
        return '#' + identifier[1] + identifier[3] + identifier[5];
      } else {
        return identifier;
      }
    }

    // Else, just return it.
    return identifier;
  }

  // ### unvendor()
  // Removes a vendor prefix from a property name.

  function unvendor(prop) {
    var m = prop.match(/^(?:_|\*|-[a-z]+-)(.*)$/);
    if (m) {
      return m[1];
    } else {
      return prop;
    }
  }

  // ### rgbToHex()
  // Converts a rgb triplet `rgb` to a hex string.

  function rgbToHex(rgb) {
    rgb = rgb.map(function(num) {
      //- "126" => "7e"
      var str = parseInt(num, 10).toString(16).toLowerCase();
      if (str.length === 1) str = "0" + str;

      return str;
    });

    return '#' + rgb.join("");
  }

  // ### compressPadding
  // Compresses padding values, eg, `10px 10px 10px 10px` => `10px`.

  function compressPadding(values) {
    //- Compress `10px 3px 10px 3px` => `10px 3px`.
    if ((values.length === 4) && (values[0] === values[2]) && (values[1] === values[3])) {
      values = [values[0], values[1]];
    }

    //- Compress `10px 10px` => `10px`.
    if ((values.length === 2) && (values[0] === values[1])) {
      values = [values[0]];
    }

    return values;
  }

  // ### compressSelector
  // Compresses a selector string.
  // Returns the compressed string.

  function compressSelector(selector) {
    var re = selector;

    re = re.replace(/\s+/g, ' ');
    re = re.replace(/ ?([\+>~]) ?/g, '$1');

    return re;
  }

  // ### valueSplit
  // Split a value into an array. Takes a string `values`, along with the property name `prop`.
  //
  // Returns an array.

  function valueSplit(prop, values) {
    var re;

    //- Split accordingly. Fonts are parsed differently from others.
    if (prop === 'font-family') {
      re = values.split(',');
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
}

module.exports = {
  compress: compress
};
