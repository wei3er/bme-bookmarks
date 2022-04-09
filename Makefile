.DEFAULT_GOAL := dist

.PHONY: all dist clean

all: clean dist

clean:
	@rm -rf dist

dist:
	$(shell mkdir -p dist)
	@cd source; zip -r ../dist/bme-bookmarks.zip *

