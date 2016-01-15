var JXON = require("jxon");

function togpx( geojson, options ) {
  options = (function (defaults, options) {
    for (var k in defaults) {
      if (options.hasOwnProperty(k))
        defaults[k] = options[k];
    }
    return defaults;
  })({
    creator: "togpx",
    metadata: undefined,
    featureTitle: get_feature_title,
    featureDescription: get_feature_description,
    featureLink: undefined
  }, options || {});

  function get_feature_title(props) {
    // a simple default heuristic to determine a title for a given feature
    // uses a nested `tags` object or the feature's `properties` if present
    // and then searchs for the following properties to construct a title:
    // `name`, `ref`, `id`
    if (typeof props.tags === "object") {
      var tags_title = get_feature_title(props.tags);
      if (tags_title !== "")
        return tags_title;
    }
    if (props.name)
      return props.name;
    if (props.ref)
      return props.ref;
    if (props.id)
      return props.id;
    return "";
  }
  function get_feature_description(props) {
    // constructs a description for a given feature
    // uses a nested `tags` object or the feature's `properties` if present
    // and then concatenates all properties to construct a description.
    if (typeof props.tags === "object")
      return get_feature_description(props.tags);
    var res = "";
    for (var k in props) {
      if (typeof props[k] === "object")
        continue;
      res += k+"="+props[k]+"\n";
    }
    return res.substr(0,res.length-1);
  }
  function add_feature_link(o, f) {
    if (options.featureLink)
      o.link = { "@href": options.featureLink(f.properties) }
  }
  // make gpx object
  var gpx = {"gpx": {
    "@xmlns":"http://www.topografix.com/GPX/1/1",
    "@xmlns:xsi":"http://www.w3.org/2001/XMLSchema-instance",
    "@xsi:schemaLocation":"http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd",
    "@version":"1.1",
    "wpt": [],
    "trk": [],
  }};
  if (options.creator)
    gpx.gpx["@creator"] = options.creator;
  if (options.metadata)
    gpx.gpx["metadata"] = options.metadata;

  var features;
  if (geojson.type === "FeatureCollection")
    features = geojson.features;
  else if (geojson.type === "Feature")
    features = [geojson];
  else
    features = [{type:"Feature", properties: {}, geometry: geojson}];
  features.forEach(function mapFeature(f) {
    switch (f.geometry.type) {
    // POIs
    case "Point":
    case "MultiPoint":
      var coords = f.geometry.coordinates
        , times  = f.geometry.times || []
        ;

      if (f.geometry.type == "Point") coords = [coords];
      coords.forEach(function (coordinates, index) {
        o = {
          "@lat": coordinates[1],
          "@lon": coordinates[0],
          "name": options.featureTitle(f.properties),
          "desc": options.featureDescription(f.properties)
        };
        if (coordinates[2] !== undefined) {
          o.ele = coordinates[2];
        }
        if (times[index] !== undefined) {
          o.time = times[index];
        }
        add_feature_link(o,f);
        gpx.gpx.wpt.push(o);
      });
      break;
    // LineStrings
    case "LineString":
    case "MultiLineString":
      var coords = f.geometry.coordinates
        , times  = f.geometry.times || []
        ;

      if (f.geometry.type == "LineString") coords = [coords];
      o = {
        "name": options.featureTitle(f.properties),
        "desc": options.featureDescription(f.properties)
      };
      add_feature_link(o,f);
      o.trkseg = [];
      coords.forEach(function(coordinates) {
        var seg = {trkpt: []};
        coordinates.forEach(function(c, index) {
          var o = {
            "@lat": c[1],
            "@lon":c[0]
          };
          if (c[2] !== undefined) {
            o.ele = c[2];
          }
          if (times[index] !== undefined) {
            o.time = '' + times[index];
          }
          seg.trkpt.push(o);
        });
        o.trkseg.push(seg);
      });
      gpx.gpx.trk.push(o);
      break;
    // Polygons / Multipolygons
    case "Polygon":
    case "MultiPolygon":
      o = {
        "name": options.featureTitle(f.properties),
        "desc": options.featureDescription(f.properties)
      };
      add_feature_link(o,f);
      o.trkseg = [];
      var coords = f.geometry.coordinates
        , times  = f.geometry.times || []
        ;

      if (f.geometry.type == "Polygon") coords = [coords];
      coords.forEach(function(poly) {
        poly.forEach(function(ring) {
          var seg = {trkpt: []};
          ring.forEach(function(c, index) {
            var o = {
              "@lat": c[1],
              "@lon":c[0]
            };
            if (c[2] !== undefined) {
              o.ele = c[2];
            }
            if (times[index] !== undefined) {
              o.time = '' + times[index];
            }
            seg.trkpt.push(o);
          });
          o.trkseg.push(seg);
        });
      });
      gpx.gpx.trk.push(o);
      break;
    case "GeometryCollection":
      f.geometry.geometries.forEach(function (geometry) {
        var pseudo_feature = {
          "properties": f.properties,
          "geometry": geometry
        };
        mapFeature(pseudo_feature);
      });
      break;
    default:
      console.log("warning: unsupported geometry type: "+f.geometry.type);
    }
  });
  gpx_str = JXON.stringify(gpx);
  return gpx_str;
};

module.exports = togpx;
