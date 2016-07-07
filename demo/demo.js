const {EditorState} = require("../src/edit")
const {schema} = require("../src/schema-basic")
const {EditorView} = require("../src/view")

function reduce(state, action) {
  if (action.type == "transform") return state.applyTransform(action.transform, action.options)
  if (action.type == "selection") return state.update({selection: action.selection}) // FIXME reset marks
  throw new RangeError("Unknown action: " + action.type)
}

let scheduled = null, actions = []
let state = EditorState.fromDoc(schema.parseDOM(document.querySelector("#content")))
let view = new EditorView(document.querySelector(".full"), state, {
  onAction(action) {
    actions.push(action)
    if (scheduled == null)
      scheduled = requestAnimationFrame(() => {
        scheduled = null
        window.state = state = view.update(actions.reduce(reduce, state))
        actions.length = 0
      })
  }
})
