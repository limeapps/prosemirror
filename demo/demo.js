const {makeStateClass} = require("../src/state")
const {schema} = require("../src/schema-basic")
const {EditorView} = require("../src/view")
const {baseKeymap} = require("../src/commands")
const {history} = require("../src/history")

const plugins = [
  {keymaps: [baseKeymap]},
  history()
]

const EditorState = makeStateClass(plugins)

let state = EditorState.fromDoc(schema.parseDOM(document.querySelector("#content")))
let view = new EditorView(document.querySelector(".full"), state, {
  plugins,
  onChange(state) { view.update(window.pmState = state) },
})
