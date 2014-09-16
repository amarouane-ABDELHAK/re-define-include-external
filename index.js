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
        end(externalLocation)
        return
      }

      async.detect(likelyLocations(), fs.exists, function(p) {
        if(_.some(descriptors, function(d) { return (p && p.indexOf(d) > -1) })) {
          fs.readFile(p, function(err, content) {
            var main = JSON.parse(content).main

            if(!path.extname(main) && main) main = main + '.js' 

            !!main ? end(path.resolve(path.dirname(p), main))
                   : end(p)
          })
        } else end(p)
      })

      function end(loc) {
        if(!loc) {
          debug("Not found:", file.requiredAs)
          self.push(file)
          next()
          return
        }

        debug("Found it:", file.requiredAs, loc)

        file.path = loc
        file.base = path.dirname(loc)

        file.stopProcessing = false
        file.exists = true
        file.pending = true

        writer.write(file)

        next()
      }

      function likelyLocations() {
        return _(discoverable)
          .map(function(d) {
            var _descriptors 
              , _locations
              , _ref = file.requiredAs

            _descriptors = _(descriptors)
              .map(function(desc) {
                return [ path.resolve(d, _ref, desc)
                       , path.resolve(file.base, _ref, desc) ]
              })
              .flatten()
              .compact()
              .value()

            _locations = [ path.resolve(d, appendJS(_ref))
                         , path.resolve(d, _ref, appendJS(_ref)) 
                         , path.resolve(file.base, d, appendJS(_ref))
                         , path.resolve(file.base, d, _ref, appendJS(_ref)) 
            ]

            return _.compact((_descriptors || []).concat(_locations || []))

            function appendJS(name) { return name + '.js' }
          })
          .flatten()
          .value()
      }
    })
  }
}
