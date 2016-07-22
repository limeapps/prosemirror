const {EditorState} = require("../src/state")
const {schema} = require("../src/schema-basic")
const {EditorView} = require("../src/view")
const {baseKeymap} = require("../src/commands")
const {keymap} = require("../src/keymap")
const {history} = require("../src/history")
const {inputRules, allInputRules} = require("../src/inputrules")
const {MenuBar, liftItem, selectParentNodeItem, undoItem, redoItem} = require("../src/menu")

const historyPlugin = history()
const plugins = [historyPlugin, inputRules({rules: allInputRules}), keymap(baseKeymap)]
let state = EditorState.create({doc: schema.parseDOM(document.querySelector("#content")),
                                plugins})
let place = document.querySelector(".full")

function onAction(action) {
  let state = view.state.applyAction(action)
  view.update(state)
  menuBar.update(state)
}

let view = new EditorView(place, state, {onAction, plugins})
let menuBar = new MenuBar(view, state, {
  content: [[liftItem, selectParentNodeItem], [undoItem(historyPlugin), redoItem(historyPlugin)]],
  float: true,
  something: 22,
  onAction
})
