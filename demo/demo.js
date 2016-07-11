const {EditorState} = require("../src/state")
const {schema} = require("../src/schema-basic")
const {EditorView} = require("../src/view")
const {baseKeymap} = require("../src/commands")
const {Configuration, createPluginIdentity} = require("../src/config")

const config = new Configuration([
  {keymaps: [baseKeymap]}
])

let state = config.stateFromDoc(schema.parseDOM(document.querySelector("#content")))
let view = new EditorView(document.querySelector(".full"), state, config.props({
  onChange(state) { view.update(window.pmState = state) },
}))
