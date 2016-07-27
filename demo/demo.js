const {Schema} = require("../src/model")
const {EditorState} = require("../src/state")
const {schema} = require("../src/schema-basic")
const {EditorView} = require("../src/view")
const {baseKeymap} = require("../src/commands")
const {keymap} = require("../src/keymap")
const {MenuBar, liftItem, selectParentNodeItem, undoItem, redoItem} = require("../src/menu")
const {exampleSetup} = require("../src/example-setup")
const {addTableNodes} = require("../src/schema-table")

const demoSchema = new Schema({
  nodes: addTableNodes(schema.nodeSpec, "block+", "block"),
  marks: schema.markSpec
})

let plugins = exampleSetup({schema: demoSchema})
let state = EditorState.create({doc: demoSchema.parseDOM(document.querySelector("#content")),
                                plugins})
let place = document.querySelector(".full")

function onAction(action) {
  let state = view.state.applyAction(action)
  view.update(state)
  menuBar.update(state)
}

let view = new EditorView(place, state, {onAction, plugins})
let menuBar = new MenuBar(view, state, {
  content: [[liftItem, selectParentNodeItem]],
  float: true,
  something: 22,
  onAction
})
