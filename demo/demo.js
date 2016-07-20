const {baseConfig} = require("../src/state")
const {schema} = require("../src/schema-basic")
const {EditorView} = require("../src/view")
const {baseKeymap} = require("../src/commands")
const {history} = require("../src/history")
const {inputRules, allInputRules} = require("../src/inputrules")

const config = baseConfig.extend([history(), inputRules({rules: allInputRules})])
let state = config.createState({doc: schema.parseDOM(document.querySelector("#content"))})
let view = new EditorView(document.querySelector(".full"), state, {
  keymaps: [baseKeymap],
  onChange(state) { view.update(window.pmState = state) },
  config
})
