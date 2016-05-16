/* Copyright 2016, Yahoo Inc.
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

var fs = require('fs');
var through = require('through2');
var async = require('async');
var xtend = require('xtend');
var shasum = require('shasum');
var path = require('path');
var browserify;
var pipeline;

function checkExistInArr(file, arr) {
    return ~arr.indexOf(file);
}

function proxyMethod(method, source, destination) {
    var oldMethod = source[method];

    source[method] = function() {
        var args = Array.prototype.slice.call(arguments);

        destination[method].apply(destination, args);

        return oldMethod.apply(source, args);
    };
}

function onlyPublicMethods(method) {
    return method.indexOf('_') !== 0;
}

function notBundle(method) {
    return method !== 'bundle';
}

function getLazyBrowserify(referenceBundle, opt) {
    var browserifyInstance;

    delete opt.entries;
    delete opt.require;
    delete opt.filter;

    browserifyInstance = browserify(opt);

    Object.keys(browserify.prototype)
        .filter(onlyPublicMethods)
        .filter(notBundle)
        .forEach(function(method) {
            proxyMethod(method, referenceBundle, browserifyInstance);
        }
    );

    Object.keys(pipeline.prototype)
        .filter(onlyPublicMethods)
        .forEach(function(method) {
            proxyMethod(method, referenceBundle.pipeline, browserifyInstance.pipeline);
        }
    );

    return browserifyInstance;
}

module.exports = function extractify(b, opts) {
    var bopts = b._options;
    var basedir = bopts.basedir || process.cwd();
    var mainExternals = [];
    var moduleBundleMap = {};
    var onReset = false;

    browserify = b.constructor;
    pipeline = b.pipeline.constructor;

    b.on('reset', function() {
        onReset = true;
        addHooks();
    });

    addHooks();

    function addHooks() {
        var records = [];
        var recordEntryFiles = [];
        var recordTransforms = [];
        var lazyBundleMapOption = opts.bundleMapOption;
        var lazyBundleMapDestination = lazyBundleMapOption ? lazyBundleMapOption.dest : false;
        var lazyBundleMapBaseDir = lazyBundleMapOption ? lazyBundleMapOption.basedir : false;
        var lazyBundleMapInjectSoft = true;
        var injectOnce = true;
        var mapObject = {};

        if (lazyBundleMapOption && lazyBundleMapOption.injectSoft === false) {
            lazyBundleMapInjectSoft = false;
        }

        function updateModuleBundleMap(file, id, outfile) {
            outfile = outfile.replace(basedir, '');

            if (lazyBundleMapBaseDir) {
                outfile = outfile.replace(lazyBundleMapBaseDir, '/');
            }

            moduleBundleMap[id] = outfile;
            moduleBundleMap[file.replace(basedir, '')] = outfile;
        }

        b.pipeline.get('label').push(through.obj(function(row, enc, next) {
            if (!lazyBundleMapDestination) {
                if (row.entry && injectOnce && lazyBundleMapInjectSoft) {
                    row.source = 'if (typeof window !== "undefined") { window._extractedModuleBundleMap=' +
                        JSON.stringify(moduleBundleMap) + ';}\n' + row.source;
                    injectOnce = false;
                }
            } else {
                if (lazyBundleMapInjectSoft && path.resolve(basedir, lazyBundleMapDestination) === row.file) {
                    mapObject = require(row.file);
                    mapObject = xtend(mapObject, moduleBundleMap);
                    row.source = 'module.exports=' + JSON.stringify(mapObject, null, 4);
                } else if (lazyBundleMapInjectSoft === false) {
                    fs.writeFileSync(path.resolve(basedir, lazyBundleMapDestination), 
                        JSON.stringify(moduleBundleMap, null, 4), {encoding: 'utf8'});
                }
            }

            this.push(row);
            next();
        }));


        b.pipeline.get('record').push(through.obj(function(row, enc, next) {
            records.push(row);

            if (row.file) {
                recordEntryFiles.push(row.file);
            } else {
                recordTransforms.push(xtend(row));
            }

            next(null, row);

        }, function(next) {
            // Stop the process for dependency detection
            var that = this; // eslint-disable-line
            var recordEntryFilesSha = shasum(recordEntryFiles);
            var lazyEntriesAll = [];
            var lazyEntriesOutfileAll = {};
            var entryOptions = [];
            var allMDs = {};

            if (!onReset) {
                b._external.forEach(function(vendor) {
                    mainExternals.push(vendor);
                });
            }

            // get all lazy entry configs
            opts.lazy.forEach(function(lazyConf) {
                var lazyEntryRecords = [];

                lazyConf.entries = lazyConf.entries.map(function(entry) {
                    return path.resolve(basedir, entry);
                });
                lazyConf.outfile = path.resolve(basedir, lazyConf.outfile);

                lazyConf.entries.forEach(function(lazyEntry) {
                    lazyEntryRecords.push({
                        entry: false,
                        expose: true,
                        file: lazyEntry,
                        id: lazyEntry,
                        order: 0
                    });

                    if (lazyEntriesAll.indexOf(lazyEntry) >=0) {
                        throw new Error('Duplicate lazy config entry');
                    }

                    lazyEntriesAll.push(lazyEntry);
                    lazyEntriesOutfileAll[lazyEntry] = lazyConf.outfile;
                });

                lazyEntryRecords = lazyEntryRecords.concat(recordTransforms);

                entryOptions.push({
                    entryRecords: lazyEntryRecords,
                    file: lazyConf.entries,
                    mainEntry: recordEntryFilesSha,
                    main: false,
                    lazyOutfile: lazyConf.outfile,
                    exclude: [],
                    entryOutMap: {}
                });

            });

            //finally get main config
            entryOptions.unshift({
                entryRecords: records,
                file: recordEntryFiles,
                mainEntry: recordEntryFilesSha,
                main: true,
                lazyOutfile: '',
                exclude: lazyEntriesAll,
                entryOutMap: lazyEntriesOutfileAll
            });

            async.each(entryOptions, function(xOptions, callback) {
                var x_md;
                var lazyB;
                var depsOpsX = xtend(bopts, {
                    postFilter: function(id, file) {
                        if (x_md._xExcludedDeps.indexOf(file) >= 0) {
                            if (x_md._ismain) {
                                updateModuleBundleMap(file, id, x_md._xEntryOutMap[file]);
                            }

                            return false;
                        }

                        if (x_md._xExcludedDeps.indexOf(id) >= 0) {
                            if (x_md._ismain) {
                                updateModuleBundleMap(file, id, x_md._xEntryOutMap[id]);
                            }

                            return false;
                        }

                        return true;
                    }
                });
                var keySha;
                var mainDep;

                if (xOptions.main) {
                    x_md = b._createDeps(depsOpsX);
                } else {
                    lazyB = getLazyBrowserify(b, depsOpsX);
                    // strip vendors
                    mainExternals.forEach(function(vendor) {
                        lazyB.external(vendor.replace('./', ''));
                    });
                    x_md = lazyB._createDeps(depsOpsX);
                }

                x_md._entry = xOptions.file;
                x_md._ismain = xOptions.main;
                x_md._xDeps = [];
                x_md._xExposedDeps = [];
                x_md._xExternalDeps = [];
                x_md._xExcludedDeps = xOptions.exclude;
                x_md._xEntryOutMap = xOptions.entryOutMap;
                x_md._lazyOutfile = xOptions.lazyOutfile;

                x_md.on('data', function(row) {
                    x_md._xDeps.push(row.file);
                });

                x_md.on('end', function() {
                    callback();
                });

                xOptions.entryRecords.forEach(function(record) {
                    x_md.write(record);
                });

                keySha = shasum(xOptions.file);

                if (xOptions.main) {
                    allMDs[keySha] = {
                        mainDep: x_md,
                        lazyDeps: {}
                    };
                } else {
                    mainDep = allMDs[xOptions.mainEntry];
                    mainDep.lazyDeps[keySha] = x_md;
                }

                x_md.end(); //starts module-dep

            }, function(err) {
                // All bundle deps calculated
                var depFile = '';
                var buildLazyBundle = function(dep) {
                    var lazyOps = xtend(bopts, {
                        extensions: ['/index.js'],
                        hasExports: true
                    });
                    var lazyB;
                    var wStream = fs.createWriteStream(dep._lazyOutfile);

                    delete lazyOps.entries;
                    delete lazyOps.require;
                    delete lazyOps.filter;

                    lazyB = getLazyBrowserify(b, lazyOps);

                    //expose lazy module
                    dep._entry.forEach(function(entry) {
                        lazyB.require(entry, {
                            expose: entry.replace(basedir, ''),
                            entry: true
                        });
                    });

                    // strip modules are already in main bundle
                    dep._xExternalDeps.forEach(function(file) {
                        lazyB.external(file, lazyOps);
                    });

                    // strip vendors
                    mainExternals.forEach(function(vendor) {
                        lazyB.external(vendor.replace('./', ''));
                    });

                    lazyB.pipeline.get('record').push(through.obj(function(row, enc, next) {
                        next(null, row);
                    }, function(next) {
                        var me = this; // eslint-disable-line

                        recordTransforms.forEach(function(trRow) {
                            me.push(trRow);
                        });
                        next();
                    }));

                    if (b._watcher && !lazyB._watcher) {
                        lazyB.plugin(require('watchify'));
                    }

                    lazyB.on('update', function(filename) {
                        b.emit('update', [filename]);
                    });

                    wStream.on('finish', function() {
                        b.emit('lazyWritten', dep._lazyOutfile);
                    });

                    wStream.on('pipe', function(src) {
                        src.file = dep._lazyOutfile;
                        b.emit('lazyStream', src);
                    });

                    lazyB.bundle().pipe(wStream);
                };

                if(!err) {
                    Object.keys(allMDs).forEach(function(key) {
                        Object.keys(allMDs[key].lazyDeps).forEach(function(lazyKey) {
                            var i;

                            // external -> for main bundle not to include lazy module
                            allMDs[key].mainDep._xExternalDeps = allMDs[key].mainDep._xExternalDeps.concat(allMDs[key]
                                .lazyDeps[lazyKey]._entry);

                            for (i = 0; i < allMDs[key].lazyDeps[lazyKey]._xDeps.length; i++) {
                                depFile = allMDs[key].lazyDeps[lazyKey]._xDeps[i];

                                if (!checkExistInArr(depFile, allMDs[key].lazyDeps[lazyKey]._entry)
                                    && checkExistInArr(depFile, allMDs[key].mainDep._xDeps)) {
                                    allMDs[key].mainDep._xExposedDeps.push(depFile);
                                    allMDs[key].lazyDeps[lazyKey]._xExternalDeps.push(depFile);
                                }
                            }

                        });
                    });

                    Object.keys(allMDs).forEach(function(key) {
                        // extract lazy modules
                        allMDs[key].mainDep._xExternalDeps.forEach(function(externalDep) {
                            b.external(externalDep, bopts);
                        });

                        // expose dependencies
                        allMDs[key].mainDep._xExposedDeps.forEach(function(exposedDep) {
                            var exposedDepId = exposedDep.replace(basedir, '');

                            that.push({
                                expose: exposedDepId,
                                file: exposedDep,
                                id: exposedDepId,
                                entry: false
                            });
                        });

                        Object.keys(allMDs[key].lazyDeps).forEach(function(lazyKey) {
                            // Create the lazy bundle now
                            buildLazyBundle(allMDs[key].lazyDeps[lazyKey]);
                        });
                    });

                    // Now we can let go the pipeline to the next step (=>deps)
                    next();

                } else {
                    throw err;
                }
            });
        }));
    }

    return b;
};
