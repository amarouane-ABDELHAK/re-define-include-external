var _ = require('lodash')
  , Module = require('re-define-module')
  , mock = require('mock-fs')
  , through = require('through2')
  , path = require('path')
  , mockery = require('mockery')

var transform

exports['include-external'] = {
  setUp: function(cb) {
    mockery.enable({
      warnOnReplace: false,
      warnOnUnregistered: false,
    })

    cb()
  },
  tearDown: function(cb) {
    mockery.deregisterAll()
    mockery.resetCache()
    mockery.disable()
    mock.restore()
    cb()
  },
  'find external dep descriptor file': function(test) {

    transform = requireUncached('./index')

    mock({
      './external_folder/d3/descriptor.json': '{"name": "_d3_", "main":"d3.min.js"}'
    ,  './external_folder/d3/d3.min.js': ''
    })

    var m = createModule('d3', true)
    m.requiredAs = 'd3'

    convert(m, function(f) {
    }, function(f) {
      test.equal(f.pkgName, '_d3_')
      test.equal(f.path, path.resolve(process.cwd(), 'external_folder/d3/d3.min.js'))
      test.done()
    })
  },
  'file does not exists': function(test) {
    mockery.registerMock('async', { 
      detect: function(paths, func, cb) { cb(null) }
    })

    transform = requireUncached('./index')

    var m = createModule('jquery', true)
    m.requiredAs = 'jquery'

    convert(m, function(f) {
      test.equal(f.path, 'jquery.js') //unchanged
      test.done()
    })
  }
}

function createModule(name, empty) {
  var m = Module({path: name + ".js", name: name});
  !empty && (m.contents = new Buffer(""))
  return m
}

function convert(file, done, write) {
  var writer = through.obj(function(chunk, enc, next) {
    write && write(chunk)
    next()
  })

  var stream = transform({ discoverable: ['external_folder']
                         , descriptors: ['descriptor.json']
                        })({cwd: '.'}, writer)
                        .on('data', function(f) {
                          done(f)
                        })

  stream.write(file)
}

function requireUncached(module){
    delete require.cache[require.resolve(module)]
    return require(module)
}
