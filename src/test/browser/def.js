const {defTest} = require("../tests")
const {selFor} = require("../build")
const {EditorView} = require("../../view")
const {baseConfig} = require("../../state")
const {schema} = require("../../schema-basic")
const {baseKeymap} = require("../../commands")

let tempViews = null

function tempEditors(conf, props) {
  let space = document.querySelector("#workspace")
  if (tempViews) {
    tempViews.forEach(tempView => space.removeChild(tempView.wrapper))
    tempViews = null
  }

  return tempViews = props.map(inProps => {
    let props = {}
    for (let n in inProps) props[n] = inProps[n]
    if (!props.keymaps) props.keymaps = [baseKeymap]
    let state = conf.createState({doc: props.doc, schema, selection: props.doc && selFor(props.doc)})
    return new EditorView(space, state, props)
  })
}
exports.tempEditors = tempEditors

function tempEditor(conf = baseConfig, props = {}) {
  return tempEditors(conf, [props])[0]
}
exports.tempEditor = tempEditor

function namespace(space, defaults) {
  return (name, f, props) => {
    if (!props) props = {}
    if (defaults) for (let prop in defaults)
      if (!props.hasOwnProperty(prop)) props[prop] = defaults[prop]
    defTest(space + "_" + name, () => f(tempEditor(props.conf, props)))
  }
}
exports.namespace = namespace
