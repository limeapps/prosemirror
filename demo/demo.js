const {EditorState} = require("../src/edit")
const {schema} = require("../src/schema-basic")
const {EditorView} = require("../src/view")
const {baseKeymap} = require("../src/commands")

let scheduled = null, actions = []
let state = EditorState.fromDoc(schema.parseDOM(document.querySelector("#content")))
let view = new EditorView(document.querySelector(".full"), state, {
  onAction(action) {
    actions.push(action)
    if (scheduled == null)
      scheduled = requestAnimationFrame(() => {
        scheduled = null
        window.state = state = view.update(actions.reduce((state, action) => state.apply(action), state))
        actions.length = 0
      })
  },
  keymaps: [baseKeymap]
})
