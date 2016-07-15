const {EditorState} = require("../state")

class Configuration {
  constructor(plugins) {
    this.givenPlugins = plugins
    this.plugins = organizePlugins(plugins)
    this.stateClass = buildStateClass(this.plugins)
  }

  stateFromDoc(doc, selection) {
    return this.stateClass.fromDoc(doc, selection)
  }

  stateFromSchema(schema) {
    return this.stateClass.fromSchema(schema)
  }

  props(extraProps) {
    return propsFromPlugins(this.plugins, extraProps)
  }

  extend(plugins) {
    return new Configuration(this.givenPlugins.concat(plugins))
  }
}
exports.Configuration = Configuration

function organizePlugins(plugins) {
  let result = []
  function addPlugin(plugin) {
    if (plugin.dependencies) plugin.dependencies.forEach(addPlugin)
    if (plugin.identity) for (let i = 0; i < result.length; i++) {
      if (result[i].identity == plugin.identity) {
        let merged
        if (plugin.merge) merged = plugin.merge(result[i])
        if (merged) result[i] = merged
        else throw new RangeError("Multiple instances of plugin with identity " + plugin.identity + " conflict")
        return
      }
    }
    result.push(plugin)
  }
  plugins.forEach(addPlugin)
  return result
}

function hasProp(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop)
}

function buildStateClass(plugins) {
  let fields = {}, foundField = false
  plugins.forEach(plugin => {
    if (plugin.stateFields) for (let name in plugin.stateFields) if (hasProp(plugin.stateFields, name)) {
      if (hasProp(fields, name) || EditorState.hasField(name))
        throw new RangeError("Duplicate definition of state property " + name)
      fields[name] = plugin.stateFields[name]
      foundField = true
    }
  })
  return foundField ? EditorState.extend(fields) : EditorState
}

function propsFromPlugins(plugins, extraProps) {
  let props = {
    keymaps: buildKeymaps(plugins, extraProps),
    applyTextInput: combine(plugins, extraProps, "applyTextInput", or),
    handleClickOn: combine(plugins, extraProps, "handleClickOn", or),
    handleClick: combine(plugins, extraProps, "handleClick", or),
    handleDoubleClickOn: combine(plugins, extraProps, "handleDoubleClickOn", or),
    handleDoubleClick: combine(plugins, extraProps, "handleDoubleClick", or),
    handleTripleClickOn: combine(plugins, extraProps, "handleTripleClickOn", or),
    handleTripleClick: combine(plugins, extraProps, "handleTripleClick", or),
    handleContextMenu: combine(plugins, extraProps, "handleContextMenu", or),
    transformPasted: combine(plugins, extraProps, "transformPasted", compose),
    onFocus: combine(plugins, extraProps, "onFocus", both),
    onBlur: combine(plugins, extraProps, "onBlur", both)
  }
  for (let prop in extraProps) if (hasProp(extraProps, prop) && !props.hasOwnProperty(prop))
    props[prop] = extraProps[prop]
  return props
}

function buildKeymaps(plugins, extraProps) {
  let keymaps = extraProps.keymaps ? extraProps.keymaps.slice() : []
  for (let i = 0; i < plugins.length; i++) {
    let maps = plugins[i].keymaps
    if (maps) for (let j = 0; j < maps.length; j++) keymaps.push(maps[j])
  }
  return keymaps
}

function combine(plugins, extraProps, name, combiner) {
  let result = extraProps[name]
  for (let i = 0; i < plugins.length; i++) {
    let f = plugins[i][name]
    if (!f) continue
    if (result) result = combiner(result, f)
    else result = f
  }
  return result
}

function compose(f, g) {
  return val => g(f(val))
}

function or(f, g) {
  return function() { return f.apply(null, arguments) || g.apply(null, arguments) }
}

function both(f, g) {
  return function() { f.apply(null, arguments); g.apply(null, arguments) }
}
