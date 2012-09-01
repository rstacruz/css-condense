css-condense
============

Compresses CSS, and isn't conservative about it.

Usage
----

    $ cssc file.css > file.min.css

Or via NodeJS:

    require('css-condense').compress("div {color: red}")

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
span { margin: 0px !important; }
h1 { background: none; }
a { padding: 0.30em; }
p { font-family: "Lucida Grande", sans-serif; }
abbr { background: url("tile.jpg") }
```

Can be: (newlines added for readability)

``` css
div{color:#f00}
span{margin:0!important}
h1{background:0}
a{padding:.3em}
p{font-family: Lucida Grande,sans-serif}
abbr{background:url(tile.jpg)}
```

The dangerous things it does
----------------------------

But that's not all! Here's where things get exciting!

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

But you'll risk breaking things!
--------------------------------

Well, yes. You want safe? Go with [YUI 
Compressor](http://developer.yahoo.com/yui/compressor/).

But hey, css-condense tries its best to make assumptions to ensure no
(or the least amount of) breakage.

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

Options
-------

Okay these aren't implemented yet, but they'll be:

    --no-consolidate-via-definition
    --no-consolidate-via-selector
    --no-consolidate-media-queries
    --conservative-consolidation
