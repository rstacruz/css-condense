function Builder() {
  return this;
}

// Builds a set of cssRules.
// Applies to stylesheets, or contexts like @media.
Builder.prototype.build = function(tree) {
  var self = this;
  var values = {};
  var medias = {};

  // Collect @media rules and `values`
  tree.cssRules.forEach(function(rule) {
    if (rule.media) {
      var context = self.mediaContext(rule);
      if (medias[context]) { medias[context].cssRules = medias[context].cssRules.concat(rule.cssRules); }
      else { medias[context] = rule; }

    } else if (rule.selectorText) {
      var parts = self.ruleParts(rule);
      var selector = parts[0];
      var value = parts[1];

      if (value.trim().length > 0) {
        if (values[value]) {
          values[value] += "," + selector;
        } else {
          values[value] = selector;
        }
      }
    }
  });

  var output = "";

  // Add each values to the output.
  for (var value in values) {
    if (values.hasOwnProperty(value)) {
      var key = values[value];
      output += "" + key + "{" + value + "}";
    }
  }

  // Add medias at the end
  for (var context in medias) {
    if (medias.hasOwnProperty(context)) {
      output += "@media " + context + "{" + this.build(medias[context]) + "}";
    }
  }

  return output;
};


/*
  media:
    '0': 'screen'
  cssRules: [ ... ]
 */

Builder.prototype.mediaContext = function(node) {
  var self = this;

  // Build the context (`screen and (min-width: 900px)`)
  var context = [];
  for (var i=0, len=node.media.length; i < len; ++i) {
    var media = node.media[i];
    context.push(media);
  }

  return context.join(" ");
};

Builder.prototype.media = function(node) {
  var self = this;
  var output = "@media";

  for (var i=0, len=node.media.length; i < len; ++i) {
    var media = node.media[i];
    output += " " + media;
  }
  output += "{";
  output += this.build(node);
  output += "}";
  return output;
};

/*
 // h1 { color: red '1px'; display: none !important }
 cssRules[2]:
   selectorText: 'h1'
   style:
     color: "red '1px'"
     display: 'none'
     _importants: { color: '', display: 'important' }

     '0': 'color'
     '1': 'display'

     length: 2
*/

Builder.prototype.ruleParts = function(node) {
  return [
    this.selector(node.selectorText),
    this.style(node.style)
  ];
};

// Compresses selector text.
Builder.prototype.selector = function(selector) {
  return selector
    .replace(/[ \r\n\t]/g, ' ')
    .replace(/ *, */g, ',');
};

Builder.prototype.style = function(styles) {
  var self = this;
  var output = [];
  for (var i=0, len=styles.length; i < len; ++i) {
    var str = "";
    var style = styles[i];
    str += style;
    str += ':';
    str += this.values(styles[style]);
    if (styles._importants[style].toString() != '') {
      str += "!" + styles._importants[style];
    }
    output.push(str);
  };
  return output.sort().join(";");
};

Builder.prototype.values = function(values) {
  // Split into values
  var matches = values.match(/"[^"]+"|'[^']+'|[^ ]+/g);
  return matches.map(this.value).join(' ');
};

Builder.prototype.value = function(value) {
  // Compress "0px" to "0".
  if (value.match(/^0(\.0*)?(?:em|px|%)$/)) {
    return "0";
  }
  // Compress "#ff2288" to "#f28". Also, lowercase all hex codes.
  else if (value.match(/^#[0-9a-f]+$/)) {
    value = value.toLowerCase();
    if (value[1] === value[2] && value[3] === value[4] && value[5] === value[6]) {
      return '#' + value[1] + value[3] + value[5];
    } else {
      return value;
    }
  }

  return value;
}

function compress(string, options) {
  var CSSOM = require('cssom');
  var tree = CSSOM.parse(string);

  var builder = new Builder(options);
  var output = builder.build(tree);

  return output;

};

module.exports = {
  compress: compress
};
