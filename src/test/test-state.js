const {EditorState, TextSelection, Plugin} = require("../state")

const {schema, doc, p} = require("./build")
const {is, cmp, cmpNode} = require("./cmp")
const {defTest} = require("./tests")

const messageCountPlugin = new Plugin({
  stateFields: {
    messageCount: {
      init() { return 0 },
      applyAction(state) { return state.messageCount + 1 },
      toJSON(count) { return count },
      fromJSON(_, count) { return count }
    }
  }
})

function test(name, conf, f) {
  defTest("state_" + name, () => {
    f(EditorState.create(conf))
  })
}

test("default_doc", {schema}, state => {
  cmpNode(state.doc, doc(p()))
})

test("default_sel", {doc: doc(p("foo"))}, state => {
  cmp(state.schema, schema)
  cmp(state.selection.from, 1)
  cmp(state.selection.to, 1)
})

test("apply_transform", {schema}, state => {
  let newState = state.applyAction(state.tr.insertText("hi").action())
  cmpNode(state.doc, doc(p()), "old state preserved")
  cmpNode(newState.doc, doc(p("hi")), "new state updated")
  cmp(newState.selection.from, 3)
})

test("plugin_field", {plugins: [messageCountPlugin], schema}, state => {
  let newState = state.applyAction({type: "foo"}).applyAction({type: "bar"})
  cmp(state.messageCount, 0)
  cmp(newState.messageCount, 2)
})

test("json", {plugins: [messageCountPlugin], doc: doc(p("ok"))}, state => {
  state = state.applyAction(new TextSelection(state.doc.resolve(3)).action())
  cmp(JSON.stringify(state.toJSON()),
      JSON.stringify({doc: {type: "doc", content: [{type: "paragraph", content: [
                       {type: "text", text: "ok"}]}]},
                      selection: {head: 3, anchor: 3},
                      messageCount: 1}))
  let copy = EditorState.fromJSON({plugins: [messageCountPlugin], schema}, state.toJSON())
  cmpNode(copy.doc, state.doc)
  cmp(copy.selection.from, 3)

  let limitedJSON = state.toJSON({ignore: ["messageCount"]})
  is(limitedJSON.doc)
  cmp(limitedJSON.messageCount, undefined)
  cmp(EditorState.fromJSON({plugins: [messageCountPlugin], schema}, limitedJSON).messageCount, 0)
})

test("reconfigure", {plugins: [messageCountPlugin], schema}, state => {
  cmp(state.messageCount, 0)
  let without = state.reconfigure({})
  cmp(without.messageCount, undefined)
  cmp(without.plugins.length, 0)
  cmpNode(without.doc, doc(p()))
  let reAdd = without.reconfigure({plugins: [messageCountPlugin]})
  cmp(reAdd.messageCount, 0)
  cmp(reAdd.plugins.length, 1)
})
