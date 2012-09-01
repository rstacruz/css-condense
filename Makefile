LIDOC ?= lidoc

docs: \
	README.md \
	lib/compress.js
	$(LIDOC) $^ -o $@

test: test/*.in.css
	node test/test.js $^

.PHONY: test
