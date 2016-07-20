const {history} = require("../history")
const {baseConfig, TextSelection} = require("../state")
const {schema} = require("../schema-basic")
const {sinkListItem, liftListItem, splitListItem} = require("../commands-list")
const {liftEmptyBlock} = require("../commands")

const {selFor, doc, p, ul, li} = require("./build")
const {is, cmpStr, cmpNode} = require("./cmp")
const {defTest} = require("./tests")

let conf = baseConfig.extend([history()])
let confPreserve = baseConfig.extend([history({preserveItems: true})])

function test(name, f, doc, testConf = conf) {
  defTest("history_" + name, () => {
    f(testConf.createState({doc, schema, selection: doc && selFor(doc)}))
  })
}

function type(state, text) { return state.tr.replaceSelection(state.schema.text(text)).apply() }
function undo(state) { return state.undo() }
function redo(state) { return state.redo() }
function cut(state) { return state.update({history: state.history.cut()}) }
function compress(state) { return state.update({history: state.history.forceCompress()}) }

test("undo", state => {
  state = type(type(state, "a"), "b")
  cmpNode(state.doc, doc(p("ab")))
  cmpNode(undo(state).doc, doc(p()))
})

test("redo", state => {
  state = undo(type(type(state, "a"), "b"))
  cmpNode(state.doc, doc(p()))
  state = redo(state)
  cmpNode(state.doc, doc(p("ab")))
})

test("multiple", state => {
  state = type(cut(type(state, "a")), "b")
  cmpNode(state.doc, doc(p("ab")))
  state = undo(state)
  cmpNode(state.doc, doc(p("a")))
  state = undo(state)
  cmpNode(state.doc, doc(p()))
  state = redo(state)
  cmpNode(state.doc, doc(p("a")))
  state = redo(state)
  cmpNode(state.doc, doc(p("ab")))
  state = undo(state)
  cmpNode(state.doc, doc(p("a")))
})

test("unsynced", state => {
  state = type(state, "hello")
    .tr.insertText(1, "oops").apply({addToHistory: false})
    .tr.insertText(10, "!").apply({addToHistory: false})
  cmpNode(undo(state).doc, doc(p("oops!")))
})

function unsyncedComplex(state, doCompress) {
  state = type(cut(type(state, "hello")), "!")
    .tr.insertText(1, "....").apply({addToHistory: false})
    .tr.split(3).apply()
  cmpNode(state.doc, doc(p(".."), p("..hello!")))
  state = state.tr.split(2).apply({addToHistory: false})
  if (doCompress) state = compress(state)
  state = undo(state)
  cmpNode(state.doc, doc(p("."), p("...hello")))
  state = undo(state)
  cmpNode(state.doc, doc(p("."), p("...")))
}

test("unsynced_complex", state => unsyncedComplex(state, false))

test("unsynced_complex_compress", state => unsyncedComplex(state, true))

test("overlapping", state => {
  state = cut(type(state, "hello"))
    .tr.delete(1, 6).apply()
  cmpNode(state.doc, doc(p()))
  state = undo(state)
  cmpNode(state.doc, doc(p("hello")))
  state = undo(state)
  cmpNode(state.doc, doc(p()))
})

test("overlapping_no_collapse", state => {
  state = cut(type(state.tr.insertText(1, "h").apply({addToHistory: false}), "ello"))
    .tr.delete(1, 6).apply()
  cmpNode(state.doc, doc(p()))
  state = undo(state)
  cmpNode(state.doc, doc(p("hello")))
  state = undo(state)
  cmpNode(state.doc, doc(p("h")))
})

test("overlapping_unsynced_delete", state => {
  state = type(cut(type(state, "hi")), "hello")
    .tr.delete(1, 8).apply({addToHistory: false})
  cmpNode(state.doc, doc(p()))
  state = undo(state)
  cmpNode(state.doc, doc(p()))
})

test("ping_pong", state => {
  state = type(cut(type(type(state, "one"), " two")), " three")
    .tr.insertText(1, "zero ").apply()
  state = cut(state).tr.split(1).apply()
  state = type(state.applySelection(1), "top")
  for (let i = 0; i < 6; i++) {
    let re = i % 2
    for (let j = 0; j < 4; j++)
      state = (re ? redo : undo)(state)
    cmpNode(state.doc, re ? doc(p("top"), p("zero one two three")) : doc(p()))
  }
})

test("eat_neighboring", state => {
  state = type(state, "o")
    .tr.split(1).apply()
    .tr.insertText(3, "zzz").apply({addToHistory: false})
  cmpNode(undo(state).doc, doc(p("zzz")))
})

test("ping_pong_unsynced", state => {
  state = cut(type(type(state, "one"), " two"))
  state = state.tr.insertText(state.selection.head, "xxx").apply({addToHistory: false})
  state = type(state, " three")
    .tr.insertText(1, "zero ").apply()
  state = cut(state).tr.split(1).apply()
  state = type(state.applySelection(1), "top")
    .tr.insertText(1, "yyy").apply({addToHistory: false})
    .tr.insertText(7, "zzz").apply({addToHistory: false})
  for (let i = 0; i < 3; i++) {
    if (i == 2) state = compress(state)
    for (let j = 0; j < 3; j++) state = undo(state)
    cmpNode(state.doc, doc(p("yyyzzzxxx")), i + " undo")
    for (let j = 0; j < 3; j++) state = redo(state)
    cmpNode(state.doc, doc(p("yyytopzzz"), p("zero one twoxxx three")), i + " redo")
  }
})

test("setSelectionOnUndo", state => {
  state = cut(type(state, "hi"))
  state = state.applySelection(new TextSelection(state.doc.resolve(1), state.doc.resolve(3)))
  let selection = state.selection
  state = state.tr.replaceWith(selection.from, selection.to, state.schema.text("hello")).apply()
  let selection2 = state.selection
  state = undo(state)
  is(state.selection.eq(selection), "failed restoring selection after undo")
  state = redo(state)
  is(state.selection.eq(selection2), "failed restoring selection after redo")
})

test("rebaseSelectionOnUndo", state => {
  state = cut(type(state, "hi"))
  state = state.applySelection(new TextSelection(state.doc.resolve(1), state.doc.resolve(3)))
  state = state
    .tr.insert(1, state.schema.text("hello")).apply()
    .tr.insert(1, state.schema.text("---")).apply({addToHistory: false})
  state = undo(state)
  cmpStr(state.selection.head, 6)
})

test("unsynced_overwrite", state => {
  state = cut(type(type(state, "a"), "b"))
  state = state.applySelection(new TextSelection(state.doc.resolve(1), state.doc.resolve(3)))
  state = undo(undo(type(state, "c")))
  cmpNode(state.doc, doc(p()))
}, null, confPreserve)

test("unsynced_list_manip", state => {
  state = splitListItem(state.schema.nodes.list_item)(state)
  state = sinkListItem(state.schema.nodes.list_item)(state)
  state = cut(type(state, "abc"))
  state = splitListItem(state.schema.nodes.list_item)(state)
  state = liftEmptyBlock(state)
  cmpNode(state.doc, doc(ul(li(p("hello"), ul(li(p("abc"))), p()))))
  state = undo(state)
  cmpNode(state.doc, doc(ul(li(p("hello"), ul(li(p("abc")))))))
  state = undo(state)
  cmpNode(state.doc, doc(ul(li(p("hello")))))
}, doc(ul(li(p("hello<a>")))), confPreserve)

test("unsynced_list_indent", state => {
  state = splitListItem(state.schema.nodes.list_item)(state)
  state = sinkListItem(state.schema.nodes.list_item)(state)
  state = cut(type(state, "abc"))
  state = splitListItem(state.schema.nodes.list_item)(state)
  state = sinkListItem(state.schema.nodes.list_item)(state)
  state = cut(type(state, "def"))
  state = state.applySelection(12)
  state = liftListItem(state.schema.nodes.list_item)(state)
  cmpNode(state.doc, doc(ul(li(p("hello")), li(p("abc"), ul(li(p("def")))))))
  state = undo(state)
  cmpNode(state.doc, doc(ul(li(p("hello"), ul(li(p("abc"), ul(li(p("def")))))))))
  state = undo(state)
  cmpNode(state.doc, doc(ul(li(p("hello"), ul(li(p("abc")))))))
  state = undo(state)
  cmpNode(state.doc, doc(ul(li(p("hello")))))
  state = redo(state)
  cmpNode(state.doc, doc(ul(li(p("hello"), ul(li(p("abc")))))))
  state = redo(state)
  cmpNode(state.doc, doc(ul(li(p("hello"), ul(li(p("abc"), ul(li(p("def")))))))))
  state = redo(state)
  cmpNode(state.doc, doc(ul(li(p("hello")), li(p("abc"), ul(li(p("def")))))))
}, doc(ul(li(p("hello<a>")))), confPreserve)
