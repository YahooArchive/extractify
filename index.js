/* Copyright 2016, Yahoo Inc.
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

var fs = require('fs');
var through = require('through2');
var async = require('async');
var xtend = require('xtend');
var shasum = require('shasum');
var path = require('path');
var processOptions = require('./lib/process_options');

module.exports = Extractify;

function Extractify(b, opts) {
    if (!(this instanceof Extractify)) { 
        return new Extractify(b, opts);
    }
    var self = this;
   
    self.bopts = b._options;
    self.basedir = self.bopts.basedir || process.cwd();

    self.opts = processOptions(opts);
    self.mainExternals = [];
    self.moduleBundleMap = {};
    self.lazyBundleMapDestination = self.opts.bundleMapOption ? self.opts.bundleMapOption.dest : false;
    self.lazyBundleMapBaseDir = self.opts.bundleMapOption ? self.opts.bundleMapOption.basedir : false;
    self.lazyBundleMapInjectSoft = true;

    if (self.opts.bundleMapOption &&
        (self.opts.bundleMapOption.injectSoft === false || self.opts.bundleMapOption.injectSoft === 'false')) {
        self.lazyBundleMapInjectSoft = false;
    }

    self.lazyBrowserifies = {};
    self.onReset = false;

    b.on('reset', function() {
        self.onReset = true;
        addHooks();
    });

    addHooks();

    function addHooks() {
        self.moduleBundleMap = {};
        self.lazyBrowserifies = {};

        self.opts.lazy.forEach(function(lazyConf) {
            var outFile = path.resolve(self.basedir, lazyConf.outfile);
            var lazyOps = xtend(self.bopts, {
                extensions: ['/index.js'], // I have to do this. Why?
                hasExports: true
            });
            self.lazyBrowserifies[outFile] = getLazyBrowserify(b, lazyOps);
        });

        var records = [];
        var recordEntryFiles = [];
        var recordTransforms = [];

        self.handleModuleMapBundle(b);

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
            var that = this;
            var allMDs = {};
            var entryOptions = getEntryOptions(self.opts, self.basedir, records, recordEntryFiles, recordTransforms);

            if (!self.onReset) {
                b._external.forEach(function(vendor) {
                    self.mainExternals.push(vendor);
                });
            }

            async.each(entryOptions, function(xOptions, callback) {
                var x_md;
                var lazyB;
                var depsOpsX = xtend(self.bopts, {
                    postFilter: function(id, file) {
                        if (x_md._xExcludedDeps.indexOf(file) >= 0) {
                            if (x_md._ismain) {
                                self.updateModuleBundleMap(file, id, x_md._xEntryOutMap[file]);
                            }
                            return false;
                        }

                        if (x_md._xExcludedDeps.indexOf(id) >= 0) {
                            if (x_md._ismain) {
                                self.updateModuleBundleMap(file, id, x_md._xEntryOutMap[id]);
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
                    self.mainExternals.forEach(function(vendor) {
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
                            b.external(externalDep, self.bopts);
                        });

                        // expose dependencies
                        allMDs[key].mainDep._xExposedDeps.forEach(function(exposedDep) {
                            var exposedDepId = exposedDep.replace(self.basedir, '');

                            that.push({
                                expose: exposedDepId,
                                file: exposedDep,
                                id: exposedDepId,
                                entry: false
                            });
                        });

                        Object.keys(allMDs[key].lazyDeps).forEach(function(lazyKey) {
                            // Create the lazy bundle now
                            self.buildLazyBundle(allMDs[key].lazyDeps[lazyKey], b, recordTransforms, self);
                        });
                    });

                    // Now we can let go the pipeline to the next step (=> deps)
                    next();

                } else {
                    throw err;
                }
            });
        }));
    }

    return b;
}

Extractify.prototype.buildLazyBundle = function(dep, b, recordTransforms, self) {
    var lazyB;
    var wStream = fs.createWriteStream(dep._lazyOutfile);

    // get browserify instance from the cache
    lazyB = self.lazyBrowserifies[dep._lazyOutfile];

    // expose lazy module
    dep._entry.forEach(function(entry) {
        // remove entries from the _external if already exists
        if (lazyB._external.indexOf(entry) > -1) {
            lazyB._external.splice(lazyB._external.indexOf(entry), 1);
            lazyB._external.splice(lazyB._external.indexOf(entry.replace(self.basedir, '')), 1);
        }
        lazyB.require(entry, {
            expose: entry.replace(self.basedir, ''),
            entry: true
        });
    });

    // strip the modules are already in main bundle
    dep._xExternalDeps.forEach(function(file) {
        lazyB.external(file, lazyB._options);
    });

    // strip the main entries
    dep._xExcludedDeps.forEach(function(file) {
        lazyB.external(file);
    });

    // strip vendors
    self.mainExternals.forEach(function(vendor) {
        lazyB.external(vendor.replace('./', ''));
    });

    lazyB.pipeline.get('record').push(through.obj(function(row, enc, next) {
        next(null, row);
    }, function(next) {
        var me = this;

        recordTransforms.forEach(function(trRow) {
            me.push(trRow);
        });
        next();
    }));

    wStream.on('finish', function() {
        b.emit('lazyWritten', dep._lazyOutfile);
    });

    wStream.on('pipe', function(src) {
        src.file = dep._lazyOutfile;
        b.emit('lazyStream', src);
    });

    lazyB.bundle().pipe(wStream);
};

Extractify.prototype.handleModuleMapBundle = function(b) {
    var self = this;
    var injectOnce = true;
    var mapObject = {};

    b.pipeline.get('label').push(through.obj(function(row, enc, next) {
        if (!self.lazyBundleMapDestination) {
            if (row.entry && injectOnce && self.lazyBundleMapInjectSoft) {
                row.source = 'if (typeof window !== "undefined") { window._extractedModuleBundleMap=' +
                    JSON.stringify(self.moduleBundleMap) + ';}\n' + row.source;
                injectOnce = false;
            }
        } else {
            if (self.lazyBundleMapInjectSoft && path.resolve(self.basedir, self.lazyBundleMapDestination) === row.file) {
                mapObject = require(row.file);
                mapObject = xtend(mapObject, self.moduleBundleMap);
                row.source = 'module.exports=' + JSON.stringify(mapObject, null, 4);
            } else if (self.lazyBundleMapInjectSoft === false && injectOnce) {
                fs.writeFileSync(path.resolve(self.basedir, self.lazyBundleMapDestination),
                    JSON.stringify(self.moduleBundleMap, null, 4), {encoding: 'utf8'});
                injectOnce = false;
            }
        }

        this.push(row);
        next();
    }));
}

Extractify.prototype.updateModuleBundleMap = function(file, id, outfile) {
    outfile = outfile.replace(this.basedir, '');

    if (this.lazyBundleMapBaseDir) {
        outfile = outfile.replace(this.lazyBundleMapBaseDir, '/');
    }

    this.moduleBundleMap[id] = outfile;
    this.moduleBundleMap[file.replace(this.basedir, '')] = outfile;
}

function getEntryOptions(opts, basedir, records, recordEntryFiles, recordTransforms) {
    // get all lazy entry configs
    var entryOptions = [];
    var recordEntryFilesSha = shasum(recordEntryFiles);
    var lazyEntriesAll = [];
    var lazyEntriesOutfileAll = {};

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

            if (lazyEntriesAll.indexOf(lazyEntry) >= 0) {
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
            exclude: recordEntryFiles, // exclude main entry files
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

    return entryOptions;
}


function getLazyBrowserify(referenceBundle, opt) {
    var browserifyInstance;
    var browserify = referenceBundle.constructor;
    var pipeline = referenceBundle.pipeline.constructor;

    delete opt.entries;
    delete opt.require;
    delete opt.filter;

    opt.plugin = nonExtractifyPlugins(opt.plugin);

    browserifyInstance = browserify(opt);
    proxy(browserify, referenceBundle, browserifyInstance, {
        filters: [onlyPublicMethods],
        exclude: ['bundle']
    });

    proxy(pipeline, referenceBundle.pipeline, browserifyInstance.pipeline, {
        filters: [onlyPublicMethods]
    });

    return browserifyInstance;
}

function proxy(iface, src, dest, opts) {
    opts = opts || {};
    var filters = opts.filters || [];
    var exclude = opts.exclude || [];

    if (exclude.length) {
        filters.push(notIn(exclude));
    }

    filters.reduce(function (methods, fn) {
        return methods.filter(fn);
    }, Object.keys(iface.prototype))
    .forEach(function(method) {
        proxyMethod(method, src, dest);
    });
}

function proxyMethod(method, source, destination) {
    var oldMethod = source[method];
    source[method] = function() {
        var args = Array.prototype.slice.call(arguments);
        destination[method].apply(destination, args);
        return oldMethod.apply(source, args);
    }
}

function notIn(methods) {
    return function(method) {
        return methods.indexOf(method) === -1;
    };
}


function nonExtractifyPlugins(plugins) {
    return [].concat(plugins).filter(Boolean).filter(function(plugin) {
        if (Array.isArray(plugin)) plugin = plugin[0];
        if (typeof plugin === 'string') {
            return plugin !== 'extractify';
        } else if(Extractify.constructor === plugin.constructor) {
            return false;
        }
        return true;
    });
}

function onlyPublicMethods(method) {
    return method.indexOf('_') !== 0;
}

function checkExistInArr(file, arr) {
    return ~arr.indexOf(file);
}

