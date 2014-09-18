var _ = require('lodash')
  , through = require('through2')
  , fs = require('fs')
  , path = require('path')
  , async = require('async')
  , Module = require('re-define-module')
  , debug = require('debug')('re-define:custom:include-external')

module.exports = function(config) {
  return function(globalConfig, writer) {
    return through.obj(function(file, enc, next){
      if(!file.isNull()) {
        this.push(file)
        next()
        return
      }

      var self = this
        , discoverable = config.discoverable || ['node_modules', 'bower_components']
        , descriptors = config.descriptors || ['package.json', 'bower.json']
        , externalLocation

      var external = config.external && config.external[ file.requiredAs ]

      if(_.isString(external)) externalLocation = external

      if(config.skip && config.skip.indexOf(file.name) > -1) {
        this.push(file)
        next()
        return
      }

      if(!!externalLocation) {
        debug("Reading file from external location:", file.requiredAs, externalLocation)
        fs.exists(externalLocation, function(d) {
          end(d ? externalLocation : null)
        })
        return
      }

      var found = false

      async.detect(getDescriptors(), fs.exists, function(p) {
        if(!p) return

        fs.readFile(p, function(err, content) {
          var main = JSON.parse(content).main
          if(main && !path.extname(main)) main = main + '.js'
          if(!main) return

          var libPath = path.resolve(path.dirname(p), main)

          fs.exists(libPath, function(e) {
            if(e) {
              found = true
              end(libPath)
              debug("Reading main from descriptor.", libPath)
            } else {
              debug("Main from descriptor does not exists, FIX IT!", p, libPath)
            }
          })
        })
      })

      if(!found) async.detect(likelyLocations(), fs.exists, end)

      function end(loc) {
        console.log(loc)
        if(!loc) {
          debug("Not found:", file.requiredAs)
          file.stopProcessing = true
          self.push(file)
          next()
          return
        }

        debug("Found it:", file.requiredAs, loc)

        file.path = loc
        file.base = path.dirname(loc)

        file.stopProcessing = false

        writer.write(file)

        next()
      }

      function getDescriptors() {
        return _(descriptors)
                  .map(function(desc) {
                    var  _ref = file.requiredAs
                    return [ _.map(discoverable, function(d) { path.resolve(d, _ref, desc) })
                           , path.resolve(file.base, _ref, desc) ]
                  })
                  .flatten()
                  .compact()
                  .value()
      }

      function likelyLocations() {
        return _(discoverable)
          .map(function(d, i) {
            var _ref = file.requiredAs

            return  [ path.resolve(d, appendJS(_ref))
                    , path.resolve(d, 'index.js')
                    , path.resolve(d, _ref, appendJS(_ref)) 
                    , path.resolve(d, _ref, 'index.js')
                    , path.resolve(file.base, d, appendJS(_ref))
                    , path.resolve(file.base, d, 'index.js')
                    , path.resolve(file.base, d, _ref, appendJS(_ref)) 
                    , path.resolve(file.base, d, _ref, 'index.js')
            ]

            function appendJS(name) { return name + '.js' }
          })
          .flatten()
          .value()
      }
    })
  }
}
