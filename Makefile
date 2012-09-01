LIDOC ?= lidoc

docs: \
	index.js
	$(LIDOC) $^ -o $@

test: test/cases/*.in.css
	node test/test.js $^

.PHONY: test
