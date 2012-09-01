LIDOC ?= lidoc

docs: \
	lib/compress.js
	$(LIDOC) $^ -o $@

test: test/*.in.css
	node test/test.js $^

.PHONY: test
