css-condense
============

Compresses CSS, and isn't conservative about it.

Installation
------------

Install [NodeJS](http://nodejs.org/), and:

    $ npm install -g css-condense

Usage
-----

    $ cssc file.css > file.min.css

Or via NodeJS:

``` js
require('css-condense').compress("div {color: red}")
```

What it does
------------

Well, it does a lot of things. The most common of which is:

#### Whitespace removal

It strips whitespaces. Yeah, well, every CSS compressor out there does that,
right?

``` css
div {
  color: red;
  width: 100%;
}
```

Becomes:

``` css
div{color:red;width:100%}
```

#### Identifier compression

Some identifiers, like pixel values or colors, can be trimmed to save on space.

``` css
div { color: #ff0000; }
span { margin: 1px !important; }
h1 { background: none; }
a { padding: 0.30em; }
p { font-family: "Arial Black", sans-serif; }
abbr { background: url("tile.jpg"); }
```

Can be: (newlines added for readability)

``` css
div{color:#f00}                           /* Collapsing 6-digit hex colors to 3 */
span{margin:1px!important}                /* Strip space before !important */
h1{background:0}                          /* Change border/background/outline 'none' to '0' */
a{padding:.3em}                           /* Removing trailing zeroes from numbers */
p{font-family: Arial Black,sans-serif}    /* Font family unquoting */
abbr{background:url(tile.jpg)}            /* URL unquoting */
```

#### More compressions

``` css
ul { padding: 30px 30px 30px 30px; }
li { margin: 0 auto 0 auto; }
.zero { outline: 0px; }
a + .b { color: blue; }
.color { background: rgb(51,51,51); }
```

Output:

``` css
ul{padding:30px}                          /* Collapsing border/padding values */
li{margin:0 auto}                         /* Same as above */,
.zero{outline:0}                          /* Removing units from zeros */
a+.b{color:blue}                          /* Collapse + and > in selectors */
.color{background:#333}                   /* Converting rgb() values to hex */
```

#### Selector/declaration sorting

Each rule has its selectors and declarations sorted. This may not seem like it
will net any effect, but (1) it increases the likelihood that consecutive
properties will be gzipped, and (2) it will help consolidation (more on that
later).

``` css
div, a { z-index: 10; background: green; }
```

becomes:

``` css
a,div{background:green;z-index:10}
```

The dangerous things it does
----------------------------

But that's not all! Here's where things get exciting!
(Don't worry, you can turn these off with the `--safe` flag.)

#### Consolidation via selectors

Rules with same selectors can be consolidated.

``` css
div { color: blue; }
div { cursor: pointer; }
```

Can be consolidated into:

``` css
div{color:blue;cursor:pointer}
```

#### Consolidation via definitions

Rules with same definitions will be consolidated too. Great if you use
mixins in your favorite CSS preprocessor mercilessly. (Those clearfixes will
totally add up like crazy)

``` css
div { color: blue; }
p { color: blue; }
```

Becomes:

``` css
div,p{color:blue}
```

#### Media query consolidation

Rules with the same media query will be merged into one. Say:

``` css
@media screen and (min-width: 780px) {
  div { width: 100%; }
}
@media screen and (min-width: 780px) {
  p { width: 50%; }
}
```

Becomes:

``` css
@media screen and (min-width:780px){div{width:100%}p{width:50%}}
```

Command line usage
------------------

```
$ cssc --help

  Usage: cssc [<sourcefile ...>] [options]

  Options:

    -h, --help                         output usage information
    -V, --version                      output the version number
    --no-consolidate-via-declarations  Don't consolidate rules via declarations
    --no-consolidate-via-selectors     Don't consolidate rules via selectors
    --no-consolidate-media-queries     Don't consolidate media queries together
    --no-sort-selectors                Don't sort selectors in a rule
    --no-sort-declarations             Don't sort declarations in a rule
    --no-compress                      Don't strip whitespaces from output
    --no-sort                          Turn off sorting
    --line-breaks                      Add linebreaks
    -S, --safe                         Don't do unsafe operations

  The --no-sort switch turns off all sorting (ie, it implies --no-sort-*).
  The --safe switch turns off all consolidation behavior (ie, it implies --no-consolidate-*).

  If a <sourcefile> is not specified, input from stdin is read instead.
  Examples:

    $ cssc style.css > style.min.css
    $ cat style.css | cssc > style.min.css
```

Programatic usage
-----------------

You can use the `css-condense` NodeJS package, or you can use
`dist/css-condense.js` for the browser.

NodeJS:

``` javascript
var cssc = require('css-condense');
var str = "div { color: blue; }";

cssc.compress(str);
cssc.compress(str, {
  sortSelectors: false,
  lineBreaks: true
});
```

Or with `css-condense.js`:

``` javascript
CssCondense.compress(str);
```

But you'll risk breaking things!
--------------------------------

Well, yes. You want a safe approach? Use `--safe` or go with [YUI 
Compressor](http://developer.yahoo.com/yui/compressor/).

But hey, css-condense tries its best to make assumptions to ensure that no
breakage (or at least minimal breakage) will happen.

For instance, consolidating media queries can go wrong in this case:

``` css
/* Restrict height on phones */
@media screen and (max-width: 480px) {
  .box { max-height: 10px; } /* [1] */
}
.box {
  padding: 20px; /* [2] */
}
/* Small screens = less spacing */
@media screen and (max-width: 480px) {
  .box { padding: 10px; } /* [3] */
}
div { color: blue; }
```

The two media queries have the same query, and will be subject to consolidation.
However, if the `[3]` is to be consolidated into `[1]`, you will not get the
effect you want.

``` css
/* Bad :( */
@media screen and (max-width:480px){.box{max-height:10px;padding:10px}}
.box{padding:20px}
div{color:blue}
```

`.box`'s padding is supposed to be overridden to `10px`, which in this case,
doesn't happen anymore.

css-condense then makes the assumption is that media queries are usually used to
override "normal" rules. The effect is that in cases like these, consolidated
rels are placed at its last appearance:

``` css
/* Good -- css-condense does things this way! */
.box{padding:20px}
@media screen and (max-width:480px){.box{max-height:10px;padding:10px}}
div{color:blue}
```

However, it indeed isn't perfectly safe: if you have a `max-height` rule on the
regular `.box`, you're gonna have a bad time.

What about with CSS rules?
--------------------------

css-condense also goes by the assumption that most people put their least
specific things on top (like resets).

``` css
body, div, h1, p { margin: 0; padding: 0; }
.listing h1 { padding: 10px; }
.item h1 { margin: 0; padding: 0; }
```

Now if `.item` is inside `.listing`, all of these rules affect `.listing h1`.
The final effect is that the `h1` will have a padding of `0`.

If the consolidation puts things on top, `h1` will get a padding of `10px`. Not
good.

``` css
/* Bad :( */
body,div,h1,p,.item h1 { margin: 0; padding: 0; }
.listing h1 { padding: 10px; }
```

...which is why css-condense assumes that the more specific things are usually
at the bottom. This then compresses nicely to:

``` css
/* Good -- css-condense knows what's good for you. */
.listing h1 { padding: 10px; }
body,div,h1,p,.item h1 { margin: 0; padding: 0; }
```

...giving your H1 the right padding: `0`.

How's the real-world performance?
---------------------------------

I ran it through some real-world CSS files that have already been compressed,
and usually get around 5% to 25% more compression out of it.

Example: https://gist.github.com/3583505

But gzip will compress that for you anyway!
-------------------------------------------

Yes, but css-condense will also reduce the number of rules (usually around 10%
to 40% less rules!), which can hypothetically make page rendering faster :)

Acknowledgements
----------------

Special thanks to [TJ Holowaychuk] for
[css-parse] which this project uses to parse CSS, and [css-stringify] which is
used to build the final output.

[TJ Holowaychuk]: https://github.com/visionmedia
[css-parse]: https://github.com/visionmedia/node-css-parse
[css-stringify]: https://github.com/visionmedia/node-css-stringify

© 2012, Rico Sta. Cruz. Released under the [MIT 
License](http://www.opensource.org/licenses/mit-license.php).

**css-condense** is authored and maintained by [Rico Sta. Cruz][rsc] with help 
from its [contributors][c]. It is sponsored by my startup, [Nadarei, Inc][nd].

 * [My website](http://ricostacruz.com) (ricostacruz.com)
 * [Nadarei, Inc.](http://nadarei.co) (nadarei.co)
 * [Github](http://github.com/rstacruz) (@rstacruz)
 * [Twitter](http://twitter.com/rstacruz) (@rstacruz)

[rsc]: http://ricostacruz.com
[c]:   http://github.com/rstacruz/lidoc/contributors
[nd]:  http://nadarei.co
