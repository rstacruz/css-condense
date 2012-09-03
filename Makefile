LIDOC ?= lidoc

JS_BEAUTIFIER ?= uglifyjs -b -i 2 -nm -ns
JS_COMPILER ?= uglifyjs

docs: \
	index.js
	$(LIDOC) $^ -o $@

test: test/cases/*.in.css
	node test/test.js $^

dist: \
	dist/css-condense.js \
	dist/css-condense.min.js

dist/css-condense.raw.js:
	mkdir -p dist
	echo '(function() {' > $@
	echo 'var modules = {};' >> $@
	echo 'function require(mod) { return modules[mod]; }' >> $@
	#
	echo 'modules["debug"] = function() {};' >> $@
	#
	echo 'modules["css-parse"] = (function() { var module = {};' >> $@
	cat node_modules/css-parse/index.js >> $@
	echo 'return module.exports; })();' >> $@
	#
	echo 'modules["css-stringify"] = (function() { var module = {};' >> $@
	cat node_modules/css-stringify/index.js >> $@
	echo 'return module.exports; })();' >> $@
	#
	echo 'modules["css-condense"] = (function() { var module = {};' >> $@
	cat index.js >> $@
	echo 'return module.exports; })();' >> $@
	#
	echo 'this.CssCondense = modules["css-condense"];' >> $@
	echo '})();' >> $@

dist/css-condense.js: dist/css-condense.raw.js

dist/css-condense.min.js: dist/css-condense.js

%.min.js: %.js
	cat $^ | $(JS_COMPILER) > $@

%.js: %.raw.js
	cat $^ | $(JS_BEAUTIFIER) > $@
	rm $^

clean:
	rm -rf dist

dist.commit: dist
	git add dist
	git commit -m "Update distribution." --author "Nobody <nobody@nadarei.co>"

.PHONY: test clean dist.commit
