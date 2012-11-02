v0.0.6 - Nov 02, 2012
---------------------

### Fixed:
  * font-face wrongly identifying duplicates.

### Changed:
  * Handle @charset.
  * Implement --debug.
  * Reorder the document to put keyframes and @font-faces on top.
  * Update distribution.
  * Update stringify.

v0.0.5 - Sep 05, 2012
---------------------

  * Fixed `@font-face` being consolidated wrong. [#2]
  * Fixed wrongly compressing `background:none scroll` to `background:0 scroll`.
  * Compress border-left (et al) none to 0.
  * Compress rgb() to hex code syntax.
  * Compress uppercase colors property (`#FFFFFF` => `#fff`).
  * Handle parentheses in values more effectively.
  * Improve selector compression.
  * Support minifying identifiers with the `pc` and `ex` property.
  * Trim off whitespaces in properties (`color : blue`).
  * Strip whitespaces from commas and parentheses in values better.

[#2]: https://github.com/rstacruz/css-condense/issues/2

v0.0.4 - Sep 03, 2012
---------------------

  * Fix `--safe` not turning off consolidation properly.

v0.0.3 - Sep 02, 2012
---------------------

  * Compress margin/padding values (`10px 10px` => `10px`).
  * Allow calling `compress()` without options.
  * Always sort `font-face` after `font`.
  * Added a browser-compatible distribution.
  * Implemented many command options:
    - `--no-consolidate-via-declarations`
    - `--no-consolidate-via-selectors`
    - `--no-consolidate-media-queries`
    - `--no-sort-selectors`
    - `--no-sort-declarations`
    - `--no-compress`
    - `--no-sort`
    - `--line-breaks`
    - `--sort`

v0.0.2 - Sep 2, 2012
--------------------

Initial release.
