const {Schema} = require("../src/model")
const {EditorState} = require("../src/state")
const {schema} = require("../src/schema-basic")
const {MenuBarEditorView} = require("../src/menu")
const {baseKeymap} = require("../src/commands")
const {keymap} = require("../src/keymap")
const {exampleSetup} = require("../src/example-setup")
const {addTableNodes} = require("../src/schema-table")

const demoSchema = new Schema({
  nodes: addTableNodes(schema.nodeSpec, "block+", "block"),
  marks: schema.markSpec
})

let plugins = exampleSetup({schema: demoSchema})
let state = EditorState.create({doc: demoSchema.parseDOM(document.querySelector("#content")),
                                plugins})

function onAction(action) {
  view.update(view.editor.state.applyAction(action))
}

let view = window.view = new MenuBarEditorView(document.querySelector(".full"), state, {onAction, plugins})
