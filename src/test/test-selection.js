const {doc, blockquote, pre, p, li, ul, img, br, hr} = require("./build")
const {cmp, cmpNode, is} = require("./cmp")
const {defTest} = require("./tests")

const {baseConfig, TextSelection, NodeSelection} = require("../state")
const {schema} = require("../schema-basic")
const {selectParentNode, lift, joinDown, joinUp, deleteSelection} = require("../commands")

function test(name, f, options) {
  defTest("selection_" + name, () => {
    f(baseConfig.createState({doc: options.doc, schema}))
  })
}

function textSel(state, n) {
  return state.applySelection(new TextSelection(state.doc.resolve(n)))
}
function nodeSel(state, n) {
  return state.applySelection(new NodeSelection(state.doc.resolve(n)))
}

test("follow_change", state => {
  state = state.tr.insertText(1, "xy").apply()
  cmp(state.selection.head, 3)
  cmp(state.selection.anchor, 3)
  state = state.tr.insertText(1, "zq").apply()
  cmp(state.selection.head, 5)
  cmp(state.selection.anchor, 5)
  state = state.tr.insertText(7, "uv").apply()
  cmp(state.selection.head, 5)
  cmp(state.selection.anchor, 5)
}, {doc: doc(p("hi"))})

test("replace_with_block", state => {
  state = textSel(state, 4).tr.replaceSelection(state.schema.node("horizontal_rule")).apply()
  cmpNode(state.doc, doc(p("foo"), hr, p("bar")), "split paragraph")
  cmp(state.selection.head, 7, "moved after rule")
  state = textSel(state, 10).tr.replaceSelection(state.schema.node("horizontal_rule")).apply()
  cmpNode(state.doc, doc(p("foo"), hr, p("bar"), hr), "inserted after")
  cmp(state.selection.from, 11, "selected hr")
}, {doc: doc(p("foobar"))})

test("type_over_hr", state => {
  state = nodeSel(state, 3).tr.replaceSelection(state.schema.text("x")).apply()
  cmpNode(state.doc, doc(p("a"), p("x"), p("b")))
  cmp(state.selection.head, 5)
  cmp(state.selection.anchor, 5)
}, {doc: doc(p("a"), "<a>", hr, p("b"))})

test("parent_block", state => {
  state = selectParentNode(textSel(state, 9))
  cmp(state.selection.from, 7, "to paragraph")
  state = selectParentNode(state)
  cmp(state.selection.from, 1, "to list item")
  state = selectParentNode(state)
  cmp(state.selection.from, 0, "to list")
  state = selectParentNode(state)
  cmp(state, null, "stop at toplevel")
}, {doc: doc(ul(li(p("foo"), p("bar")), li(p("baz"))))})

test("lift_preserves", state => {
  state = lift(nodeSel(state, 3))
  cmpNode(state.doc, doc(ul(li(p("hi")))), "lifted")
  cmp(state.selection.from, 2, "preserved selection")
  state = lift(state)
  cmpNode(state.doc, doc(p("hi")), "lifted again")
  cmp(state.selection.from, 0, "preserved selection again")
}, {doc: doc(ul(li(blockquote(p("hi")))))})

test("lift_at_selection_level", state => {
  state = lift(nodeSel(state, 1))
  cmpNode(state.doc, doc(ul(li(p("a")), li(p("b")))), "lifted list")
  cmp(state.selection.from, 0, "preserved selection")
}, {doc: doc(blockquote(ul(li(p("a")), li(p("b")))))})

test("join_precisely_down", state => {
  state = nodeSel(state, 1)
  cmp(joinDown(state), null, "don't join parent")
  state = joinDown(nodeSel(state, 0))
  cmpNode(state.doc, doc(blockquote(p("foo"), p("bar"))), "joined")
  cmp(state.selection.from, 0, "selected joined node")
}, {doc: doc(blockquote(p("foo")), blockquote(p("bar")))})

test("join_precisely_up", state => {
  state = nodeSel(state, 8)
  cmp(joinUp(state), null, "don't join parent")
  state = joinUp(nodeSel(state, 7))
  cmpNode(state.doc, doc(blockquote(p("foo"), p("bar"))), "joined")
  cmp(state.selection.from, 0, "selected joined node")
}, {doc: doc(blockquote(p("foo")), blockquote(p("bar")))})

test("delete_block", state => {
  state = deleteSelection(nodeSel(state, 0))
  cmpNode(state.doc, doc(ul(li(p("bar")), li(p("baz")), li(p("quux")))), "paragraph vanished")
  cmp(state.selection.head, 3, "moved to list")
  state = deleteSelection(nodeSel(state, 2))
  cmpNode(state.doc, doc(ul(li(p("baz")), li(p("quux")))), "delete whole item")
  cmp(state.selection.head, 3, "to next item")
  state = deleteSelection(nodeSel(state, 9))
  cmpNode(state.doc, doc(ul(li(p("baz")))), "delete last item")
  cmp(state.selection.head, 6, "back to paragraph above")
  state = deleteSelection(nodeSel(state, 0))
  cmpNode(state.doc, doc(p()), "delete list")
}, {doc: doc(p("foo"), ul(li(p("bar")), li(p("baz")), li(p("quux"))))})

test("delete_hr", state => {
  state = deleteSelection(nodeSel(state, 3))
  cmpNode(state.doc, doc(p("a"), hr, p("b")), "deleted first hr")
  cmp(state.selection.from, 3, "moved to second hr")
  state = deleteSelection(state)
  cmpNode(state.doc, doc(p("a"), p("b")), "deleted second hr")
  cmp(state.selection.head, 4, "moved to paragraph")
}, {doc: doc(p("a"), hr, hr, p("b"))})

test("delete_selection", state => {
  state = nodeSel(state, 4).tr.replaceSelection(null).apply()
  cmpNode(state.doc, doc(p("foobar"), blockquote(p("hi")), p("ay")), "deleted img")
  cmp(state.selection.head, 4, "cursor at img")
  state = nodeSel(state, 9).tr.deleteSelection().apply()
  cmpNode(state.doc, doc(p("foobar"), p("ay")), "deleted blockquote")
  cmp(state.selection.from, 9, "cursor moved past")
  state = nodeSel(state, 8).tr.deleteSelection().apply()
  cmpNode(state.doc, doc(p("foobar")), "deleted paragraph")
  cmp(state.selection.from, 7, "cursor moved back")
}, {doc: doc(p("foo", img, "bar"), blockquote(p("hi")), p("ay"))})

test("replace_selection_inline", state => {
  state = nodeSel(state, 4).tr.replaceSelection(state.schema.node("hard_break")).apply()
  cmpNode(state.doc, doc(p("foo", br, "bar", img, "baz")), "replaced with br")
  cmp(state.selection.head, 5, "after inserted node")
  is(state.selection.empty, "empty selection")
  state = nodeSel(state, 8).tr.replaceSelection(state.schema.text("abc")).apply()
  cmpNode(state.doc, doc(p("foo", br, "barabcbaz")), "replaced with text")
  cmp(state.selection.head, 11, "after text")
  is(state.selection.empty, "again empty selection")
  state = nodeSel(state, 0).tr.replaceSelection(state.schema.text("xyz")).apply()
  cmpNode(state.doc, doc(p("xyz")), "replaced all of paragraph")
}, {doc: doc(p("foo", img, "bar", img, "baz"))})

test("replace_selection_block", state => {
  state = nodeSel(state, 5).tr.replaceSelection(state.schema.node("code_block")).apply()
  cmpNode(state.doc, doc(p("abc"), pre(), hr, blockquote(p("ow"))), "replace with code block")
  cmp(state.selection.from, 7, "selection after")
  state = nodeSel(state, 8).tr.replaceSelection(state.schema.node("paragraph")).apply()
  cmpNode(state.doc, doc(p("abc"), pre(), hr, p()), "replace with paragraph")
  cmp(state.selection.from, 9)
}, {doc: doc(p("abc"), hr, hr, blockquote(p("ow")))})
