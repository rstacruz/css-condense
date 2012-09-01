# css-condense

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
```

Can be: (added newlines for readability)

``` css
div{color:#f00}
span{margin:0!important}
h1{background:0}
a{padding:.3em}
p{font-family: Lucida Grande,sans-serif}
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

Rules with same definitions will be consolidated too. Great if you use `@extend`
in your favorite CSS preprocessor across many files.

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

Objections
----------

#### That's dangerous! You run the risk of things breaking!

True. You want safe? Go with [YUI 
Compressor](http://developer.yahoo.com/yui/compressor/).

But css-condense tries its best to make assumptions to ensure no
(or the least amount of) breakage.

For instance, consolidating media queries can go wrong in this case:

``` css
/* Restrict height on phones */
@media screen and (max-width: 480px) {
  .box { max-height: 10px; }
}
.box {
  padding: 20px;
}
/* Small screens = less spacing */
@media screen and (max-width: 480px) {
  .box { padding: 10px; }
}
div { color: blue; }
```

The two media queries have the same query, and will be subject to consolidation.
However, if the `padding: 10px` rule is consolidated to the `max-height` rule,
You will not get the effecty ou want.

The assumption is that media queries are usually used to override "normal"
rules, so in cases like these, consolidated things placed at its last
appearance:

``` css
.box{padding:20px}
@media screen and (max-width:480px){.box{max-height:10px;padding:10px}}
div{color:blue}
```

However, it indeed isn't perfectly safe: if you have a `max-height` rule on the
regular `.box`, you're gonna have a bad time.

Options
-------

Okay these aren't implemented yet, but they'll be:

    --no-consolidate-via-definition
    --no-consolidate-via-selector
    --no-consolidate-media-queries
    --conservative-consolidation
