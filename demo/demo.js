const {EditorState} = require("../src/state")
const {schema} = require("../src/schema-basic")
const {EditorView} = require("../src/view")
const {baseKeymap} = require("../src/commands")

let state = EditorState.fromDoc(schema.parseDOM(document.querySelector("#content")))
let view = new EditorView(document.querySelector(".full"), state, {
  onChange(state) { view.update(state) },
  keymaps: [baseKeymap]
})
