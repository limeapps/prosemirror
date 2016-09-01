const {defTest} = require("../tests")
const {selFor} = require("../state")
const {EditorView} = require("../../view")
const {EditorState} = require("../../state")
const {schema} = require("../build")

let tempViews = null

function tempEditors(props) {
  let space = document.querySelector("#workspace")
  if (tempViews) {
    tempViews.forEach(tempView => space.removeChild(tempView.wrapper))
    tempViews = null
  }

  return tempViews = props.map(inProps => {
    let props = {}, view
    for (let n in inProps) props[n] = inProps[n]
    if (!props.onAction) props.onAction = action => view.updateState(view.state.applyAction(action))
    props.state = EditorState.create({doc: props.doc, schema,
                                      selection: props.doc && selFor(props.doc),
                                      plugins: props.plugins})
    view = new EditorView(space, props)
    return view
  })
}
exports.tempEditors = tempEditors

function tempEditor(props = {}) {
  return tempEditors([props])[0]
}
exports.tempEditor = tempEditor

function namespace(space, defaults) {
  return (name, f, props) => {
    if (!props) props = {}
    if (defaults) for (let prop in defaults)
      if (!props.hasOwnProperty(prop)) props[prop] = defaults[prop]
    defTest(space + "_" + name, () => f(tempEditor(props)))
  }
}
exports.namespace = namespace
