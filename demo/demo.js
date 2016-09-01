const {Schema} = require("./src/model")
const {EditorState} = require("./src/state")
const {schema} = require("./src/schema-basic")
const {addListNodes} = require("./src/schema-list")
const {addTableNodes} = require("./src/schema-table")
const {MenuBarEditorView} = require("./src/menu")
const {baseKeymap} = require("./src/commands")
const {keymap} = require("./src/keymap")
const {exampleSetup} = require("./src/example-setup")

const demoSchema = new Schema({
  nodes: addListNodes(addTableNodes(schema.nodeSpec, "block+", "block"), "paragraph block*", "block"),
  marks: schema.markSpec
})

let state = EditorState.create({doc: demoSchema.parseDOM(document.querySelector("#content")),
                                plugins: [exampleSetup({schema: demoSchema})]})

function onAction(action) {
  view.updateState(view.editor.state.applyAction(action))
}

let view = window.view = new MenuBarEditorView(document.querySelector(".full"), {state, onAction})
