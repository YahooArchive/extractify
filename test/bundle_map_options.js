/* Copyright 2016, Yahoo Inc.
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

var browserify = require('browserify');
var test = require('tap').test;
var vm = require('vm');
var xtend = require('xtend');
var config = {
    lazy: [
        {
            entries: [
                './files/dep4.js'
            ],
            outfile: './lazy_bundle/lazy_bundle_dep4_map.js'
        }
    ]
};

function getBrowserifyInstance(conf) {
    var b = browserify([], {
        basedir:__dirname
    });

    // this is required to test the bundle
    b.require('./files/main.js',  { expose: 'main' });
    b.plugin(require('../'), conf);

    return b;
}

test('bundle map soft inject', function (t) {
    var c = vm.createContext({});
    var mainBundleSrc = '';
    var lazyBundleSrc = {};
    var pending = 2;
    var b = getBrowserifyInstance(xtend(config, {
        bundleMapOption: {
            dest: 'files/dep2.js'
        }
    }));

    t.plan(4);

    b.on('lazyStream', function(src) {
        src.on('data', function(chunk) {
            if (lazyBundleSrc[src.file] === undefined) {
                lazyBundleSrc[src.file] = [];
            }
            lazyBundleSrc[src.file].push(chunk);
        }).on('end', function() {
            pending--;
            done();
        });
    });

    b.bundle(function (err, src) {
        mainBundleSrc = src;
        pending--;
        done();
    });

    function done () {
        if (pending !== 0) {
            return;
        }

        vm.runInContext(mainBundleSrc, c);
        Object.keys(lazyBundleSrc).forEach(function(key) {
            vm.runInContext(lazyBundleSrc[key].join(''), c);
        });

        t.equal(c.require('main').dep3().loadDep4(), 'dep5');
        t.equal(c.require('main').dep2.dep2, 'dep2');
        t.equal(c.require('main').dep2['./dep4'], '/lazy_bundle/lazy_bundle_dep4_map.js');
        t.equal(c.require('main').dep2['/files/dep4.js'], '/lazy_bundle/lazy_bundle_dep4_map.js');

    }
});

test('bundle map hard inject', function (t) {
    var c = vm.createContext({});
    var mainBundleSrc = '';
    var lazyBundleSrc = {};
    var pending = 2;
    var b = getBrowserifyInstance(xtend(config, {
        bundleMapOption: {
            injectSoft: false,
            dest: 'lazy_bundle/map.json'
        }
    }));

    t.plan(3);

    b.on('lazyStream', function(src) {
        src.on('data', function(chunk) {
            if (lazyBundleSrc[src.file] === undefined) {
                lazyBundleSrc[src.file] = [];
            }
            lazyBundleSrc[src.file].push(chunk);
        }).on('end', function() {
            pending--;
            done();
        });
    });

    b.bundle(function (err, src) {
        mainBundleSrc = src;
        pending--;
        done();
    });

    function done () {
        if (pending !== 0) {
            return;
        }

        vm.runInContext(mainBundleSrc, c);
        Object.keys(lazyBundleSrc).forEach(function(key) {
            vm.runInContext(lazyBundleSrc[key].join(''), c);
        });

        t.equal(c.require('main').dep3().loadDep4(), 'dep5');
        t.equal(require('./lazy_bundle/map.json')['./dep4'], '/lazy_bundle/lazy_bundle_dep4_map.js');
        t.equal(require('./lazy_bundle/map.json')['/files/dep4.js'], '/lazy_bundle/lazy_bundle_dep4_map.js');

    }
});
