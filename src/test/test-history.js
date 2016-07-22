const {history} = require("../history")
const {baseConfig} = require("../state")
const {schema} = require("../schema-basic")
const {sinkListItem, liftListItem, splitListItem} = require("../commands-list")
const {liftEmptyBlock} = require("../commands")

const {doc, p, ul, li} = require("./build")
const {TestState} = require("./state")
const {is, cmp, cmpNode} = require("./cmp")
const {defTest} = require("./tests")

let plugin = history(), pluginPreserve = history({preserveItems: true})

function test(name, f, doc, preserve) {
  defTest("history_" + name, () => f(new TestState({doc, schema, plugins: [preserve ? pluginPreserve : plugin]})))
}

function compress(state) {
  // NOTE: This is mutating stuff that shouldn't be mutated. Not safe
  // to do outside of these tests.
  state.state.history.done = state.state.history.done.compress()
}

test("undo", state => {
  state.type("a")
  state.type("b")
  cmpNode(state.doc, doc(p("ab")))
  state.undo()
  cmpNode(state.doc, doc(p()))
})

test("redo", state => {
  state.type("a")
  state.type("b")
  state.undo()
  cmpNode(state.doc, doc(p()))
  state.redo()
  cmpNode(state.doc, doc(p("ab")))
})

test("multiple", state => {
  state.type("a")
  state.type("b")
  state.apply(state.tr.insertText("c", 1))
  cmpNode(state.doc, doc(p("cab")))
  state.undo()
  cmpNode(state.doc, doc(p("ab")))
  state.undo()
  cmpNode(state.doc, doc(p()))
  state.redo()
  cmpNode(state.doc, doc(p("ab")))
  state.redo()
  cmpNode(state.doc, doc(p("cab")))
  state.undo()
  cmpNode(state.doc, doc(p("ab")))
})

test("unsynced", state => {
  state.type("hello")
  state.apply(state.tr.insertText("oops", 1).action({addToHistory: false}))
  state.apply(state.tr.insertText("!", 10).action({addToHistory: false}))
  state.undo()
  cmpNode(state.doc, doc(p("oops!")))
})

function unsyncedComplex(state, doCompress) {
  state.type("hello")
  state.apply({type: "historyClose"})
  state.type("!")
  state.apply(state.tr.insertText("....", 1).action({addToHistory: false}))
  state.apply(state.tr.split(3))
  cmpNode(state.doc, doc(p(".."), p("..hello!")))
  state.apply(state.tr.split(2).action({addToHistory: false}))
  if (doCompress) compress(state)
  state.undo()
  cmpNode(state.doc, doc(p("."), p("...hello")))
  state.undo()
  cmpNode(state.doc, doc(p("."), p("...")))
}

test("unsynced_complex", state => unsyncedComplex(state, false))

test("unsynced_complex_compress", state => unsyncedComplex(state, true))

test("overlapping", state => {
  state.type("hello")
  state.apply({type: "historyClose"})
  state.apply(state.tr.delete(1, 6))
  cmpNode(state.doc, doc(p()))
  state.undo()
  cmpNode(state.doc, doc(p("hello")))
  state.undo()
  cmpNode(state.doc, doc(p()))
})

test("overlapping_no_collapse", state => {
  state.apply(state.tr.insertText("h", 1).action({addToHistory: false}))
  state.type("ello")
  state.apply({type: "historyClose"})
  state.apply(state.tr.delete(1, 6))
  cmpNode(state.doc, doc(p()))
  state.undo()
  cmpNode(state.doc, doc(p("hello")))
  state.undo()
  cmpNode(state.doc, doc(p("h")))
})

test("overlapping_unsynced_delete", state => {
  state.type("hi")
  state.apply({type: "historyClose"})
  state.type("hello")
  state.apply(state.tr.delete(1, 8).action({addToHistory: false}))
  cmpNode(state.doc, doc(p()))
  state.undo()
  cmpNode(state.doc, doc(p()))
})

test("ping_pong", state => {
  state.type("one")
  state.type(" two")
  state.apply({type: "historyClose"})
  state.type(" three")
  state.apply(state.tr.insertText("zero ", 1))
  state.apply({type: "historyClose"})
  state.apply(state.tr.split(1))
  state.textSel(1)
  state.type("top")
  for (let i = 0; i < 6; i++) {
    let re = i % 2
    for (let j = 0; j < 4; j++) state[re ? "redo" : "undo"]()
    cmpNode(state.doc, re ? doc(p("top"), p("zero one two three")) : doc(p()))
  }
})

test("eat_neighboring", state => {
  state.type("o")
  state.apply(state.tr.split(1))
  state.apply(state.tr.insertText("zzz", 3).action({addToHistory: false}))
  state.undo()
  cmpNode(state.doc, doc(p("zzz")))
})

test("ping_pong_unsynced", state => {
  state.type("one")
  state.type(" two")
  state.apply({type: "historyClose"})
  state.apply(state.tr.insertText("xxx", state.selection.head).action({addToHistory: false}))
  state.type(" three")
  state.apply(state.tr.insertText("zero ", 1))
  state.apply({type: "historyClose"})
  state.apply(state.tr.split(1))
  state.textSel(1)
  state.type("top")
  state.apply(state.tr.insertText("yyy", 1).action({addToHistory: false}))
  state.apply(state.tr.insertText("zzz", 7).action({addToHistory: false}))
  for (let i = 0; i < 3; i++) {
    if (i == 2) compress(state)
    for (let j = 0; j < 4; j++) state.undo()
    cmpNode(state.doc, doc(p("yyyzzzxxx")), i + " undo")
    for (let j = 0; j < 4; j++) state.redo()
    cmpNode(state.doc, doc(p("yyytopzzz"), p("zero one twoxxx three")), i + " redo")
  }
})

test("setSelectionOnUndo", state => {
  state.type("hi")
  state.apply({type: "historyClose"})
  state.textSel(1, 3)
  let selection = state.selection
  state.apply(state.tr.replaceWith(selection.from, selection.to, schema.text("hello")))
  let selection2 = state.selection
  state.undo()
  is(state.selection.eq(selection), "failed restoring selection after undo")
  state.redo()
  is(state.selection.eq(selection2), "failed restoring selection after redo")
})

test("rebaseSelectionOnUndo", state => {
  state.type("hi")
  state.apply({type: "historyClose"})
  state.textSel(1, 3)
  state.apply(state.tr.insert(1, schema.text("hello")))
  state.apply(state.tr.insert(1, schema.text("---")).action({addToHistory: false}))
  state.undo()
  cmp(state.selection.head, 6)
})

test("unsynced_overwrite", state => {
  state.type("a")
  state.type("b")
  state.apply({type: "historyClose"})
  state.textSel(1, 3)
  state.type("c")
  state.undo()
  state.undo()
  cmpNode(state.doc, doc(p()))
}, null, true)

test("unsynced_list_manip", state => {
  state.command(splitListItem(schema.nodes.list_item))
  state.command(sinkListItem(schema.nodes.list_item))
  state.type("abc")
  state.apply({type: "historyClose"})
  state.command(splitListItem(schema.nodes.list_item))
  state.command(liftEmptyBlock)
  cmpNode(state.doc, doc(ul(li(p("hello"), ul(li(p("abc"))), p()))))
  state.undo()
  cmpNode(state.doc, doc(ul(li(p("hello"), ul(li(p("abc")))))))
  state.undo()
  state.undo()
  cmpNode(state.doc, doc(ul(li(p("hello")))))
}, doc(ul(li(p("hello<a>")))), true)

test("unsynced_list_indent", state => {
  state.command(splitListItem(schema.nodes.list_item))
  state.command(sinkListItem(schema.nodes.list_item))
  state.type("abc")
  state.apply({type: "historyClose"})
  state.command(splitListItem(schema.nodes.list_item))
  state.command(sinkListItem(schema.nodes.list_item))
  state.type("def")
  state.apply({type: "historyClose"})
  state.textSel(12)
  state.command(liftListItem(schema.nodes.list_item))
  cmpNode(state.doc, doc(ul(li(p("hello")), li(p("abc"), ul(li(p("def")))))))
  state.undo()
  cmpNode(state.doc, doc(ul(li(p("hello"), ul(li(p("abc"), ul(li(p("def")))))))))
  state.undo()
  state.undo()
  cmpNode(state.doc, doc(ul(li(p("hello"), ul(li(p("abc")))))))
  state.undo()
  state.undo()
  cmpNode(state.doc, doc(ul(li(p("hello")))))
  state.redo()
  state.redo()
  cmpNode(state.doc, doc(ul(li(p("hello"), ul(li(p("abc")))))))
  state.redo()
  state.redo()
  cmpNode(state.doc, doc(ul(li(p("hello"), ul(li(p("abc"), ul(li(p("def")))))))))
  state.redo()
  cmpNode(state.doc, doc(ul(li(p("hello")), li(p("abc"), ul(li(p("def")))))))
}, doc(ul(li(p("hello<a>")))), true)
