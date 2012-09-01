CssCompress
===========

Compresses dangerously.

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
p { font-family: "Lucida Grande", sans-serif; }
```

Can be:

``` css
div{color:#f00}span{margin:0!important}p{font-family: Lucida Grande,sans-serif}
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

Options
-------

Okay these aren't implemented yet, but they'll be:

    --no-consolidate-via-definition
    --no-consolidate-via-selector
    --no-consolidate-media-queries
    --conservative-consolidation
