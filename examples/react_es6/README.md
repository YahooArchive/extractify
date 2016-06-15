## Simple react & es6 with browserify extractify plugin example

### Install & run
- `cd` to the directory to this example resides
- `npm install`
- `grunt`

### Notes
- Once you `grunt`, it should open `http://localhost:3334` in your default browser.
- Take a look at Gruntfile.js for how `extractify` was configured
- There are two lazy modules: `src/deps/lazy/child3.js` and `src/deps/lazy/child5.js`. Nothing specialy about them.
- `src/deps/child2.js` is a simple module which loads lazy modules.
- `src/lib/loader.js` laods bundles by utulizing `window._extractedModuleBundleMap` which was injected by `extractify`
