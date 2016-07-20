const {baseConfig} = require("../src/state")
const {schema} = require("../src/schema-basic")
const {EditorView} = require("../src/view")
const {baseKeymap} = require("../src/commands")
const {history} = require("../src/history")
const {inputRules, allInputRules} = require("../src/inputrules")
const {MenuBar, liftItem, selectParentNodeItem, undoItem, redoItem} = require("../src/menu")

const config = baseConfig.extend([history(), inputRules({rules: allInputRules})])
let state = config.createState({doc: schema.parseDOM(document.querySelector("#content"))})
let place = document.querySelector(".full")

function onChange(state) {
  view.update(state)
  menuBar.update(state)
}

let menuBar = new MenuBar(place, state, {
  content: [[liftItem, selectParentNodeItem], [undoItem, redoItem]],
  onChange
})
let view = new EditorView(place, state, {
  keymaps: [baseKeymap],
  onChange,
  config
})
