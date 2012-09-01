LIDOC ?= lidoc

docs: \
	index.js
	$(LIDOC) $^ -o $@

test: test/*.in.css
	node test/test.js $^

.PHONY: test
