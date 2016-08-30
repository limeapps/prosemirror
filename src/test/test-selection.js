const {schema, doc, blockquote, pre, p, li, ul, img, br, hr} = require("./build")
const {cmp, cmpNode, is} = require("./cmp")
const {defTest} = require("./tests")
const {TestState} = require("./state")

const {selectParentNode, lift, joinDown, joinUp, deleteSelection} = require("../commands")

function test(name, f, options) {
  defTest("selection_" + name, () => {
    f(new TestState({doc: options.doc, schema}))
  })
}

test("follow_change", state => {
  state.apply(state.tr.insertText("xy", 1))
  cmp(state.selection.head, 3)
  cmp(state.selection.anchor, 3)
  state.apply(state.tr.insertText("zq", 1))
  cmp(state.selection.head, 5)
  cmp(state.selection.anchor, 5)
  state.apply(state.tr.insertText("uv", 7))
  cmp(state.selection.head, 5)
  cmp(state.selection.anchor, 5)
}, {doc: doc(p("hi"))})

test("after_replace", state => {
  state.textSel(2, 3)
  state.apply(state.tr.insertText("o"))
  cmp(state.selection.head, 3)
  cmp(state.selection.anchor, 3)
}, {doc: doc(p("hi"))})

test("replace_with_block", state => {
  state.textSel(4)
  state.apply(state.tr.replaceSelection(schema.node("horizontal_rule")))
  cmpNode(state.doc, doc(p("foo"), hr, p("bar")), "split paragraph")
  cmp(state.selection.head, 7, "moved after rule")
  state.textSel(10)
  state.apply(state.tr.replaceSelection(schema.node("horizontal_rule")))
  cmpNode(state.doc, doc(p("foo"), hr, p("bar"), hr), "inserted after")
  cmp(state.selection.from, 11, "selected hr")
}, {doc: doc(p("foobar"))})

test("type_over_hr", state => {
  state.nodeSel(3)
  state.apply(state.tr.replaceSelection(schema.text("x")))
  cmpNode(state.doc, doc(p("a"), p("x"), p("b")))
  cmp(state.selection.head, 5)
  cmp(state.selection.anchor, 5)
}, {doc: doc(p("a"), "<a>", hr, p("b"))})

test("parent_block", state => {
  state.textSel(9)
  state.command(selectParentNode)
  cmp(state.selection.from, 7, "to paragraph")
  state.command(selectParentNode)
  cmp(state.selection.from, 1, "to list item")
  state.command(selectParentNode)
  cmp(state.selection.from, 0, "to list")
  state.command(selectParentNode)
  cmp(state.selection.from, 0, "stop at toplevel")
}, {doc: doc(ul(li(p("foo"), p("bar")), li(p("baz"))))})

test("lift_preserves", state => {
  state.nodeSel(3)
  state.command(lift)
  cmpNode(state.doc, doc(ul(li(p("hi")))), "lifted")
  cmp(state.selection.from, 2, "preserved selection")
  state.command(lift)
  cmpNode(state.doc, doc(p("hi")), "lifted again")
  cmp(state.selection.from, 0, "preserved selection again")
}, {doc: doc(ul(li(blockquote(p("hi")))))})

test("lift_at_selection_level", state => {
  state.nodeSel(1)
  state.command(lift)
  cmpNode(state.doc, doc(ul(li(p("a")), li(p("b")))), "lifted list")
  cmp(state.selection.from, 0, "preserved selection")
}, {doc: doc(blockquote(ul(li(p("a")), li(p("b")))))})

test("join_precisely_down", state => {
  state.nodeSel(1)
  state.command(joinDown)
  cmpNode(state.doc, doc(blockquote(p("foo")), blockquote(p("bar"))), "don't join parent")
  state.nodeSel(0)
  state.command(joinDown)
  cmpNode(state.doc, doc(blockquote(p("foo"), p("bar"))), "joined")
  cmp(state.selection.from, 0, "selected joined node")
}, {doc: doc(blockquote(p("foo")), blockquote(p("bar")))})

test("join_precisely_up", state => {
  state.nodeSel(8)
  state.command(joinUp)
  cmpNode(state.doc, doc(blockquote(p("foo")), blockquote(p("bar"))), "don't join parent")
  state.nodeSel(7)
  state.command(joinUp)
  cmpNode(state.doc, doc(blockquote(p("foo"), p("bar"))), "joined")
  cmp(state.selection.from, 0, "selected joined node")
}, {doc: doc(blockquote(p("foo")), blockquote(p("bar")))})

test("delete_block", state => {
  state.nodeSel(0)
  state.command(deleteSelection)
  cmpNode(state.doc, doc(ul(li(p("bar")), li(p("baz")), li(p("quux")))), "paragraph vanished")
  cmp(state.selection.head, 3, "moved to list")
  state.nodeSel(2)
  state.command(deleteSelection)
  cmpNode(state.doc, doc(ul(li(p("baz")), li(p("quux")))), "delete whole item")
  cmp(state.selection.head, 3, "to next item")
  state.nodeSel(9)
  state.command(deleteSelection)
  cmpNode(state.doc, doc(ul(li(p("baz")))), "delete last item")
  cmp(state.selection.head, 6, "back to paragraph above")
  state.nodeSel(0)
  state.command(deleteSelection)
  cmpNode(state.doc, doc(p()), "delete list")
}, {doc: doc(p("foo"), ul(li(p("bar")), li(p("baz")), li(p("quux"))))})

test("delete_hr", state => {
  state.nodeSel(3)
  state.command(deleteSelection)
  cmpNode(state.doc, doc(p("a"), hr, p("b")), "deleted first hr")
  cmp(state.selection.from, 3, "moved to second hr")
  state.command(deleteSelection)
  cmpNode(state.doc, doc(p("a"), p("b")), "deleted second hr")
  cmp(state.selection.head, 4, "moved to paragraph")
}, {doc: doc(p("a"), hr, hr, p("b"))})

test("delete_selection", state => {
  state.nodeSel(4)
  state.apply(state.tr.replaceSelection(null))
  cmpNode(state.doc, doc(p("foobar"), blockquote(p("hi")), p("ay")), "deleted img")
  cmp(state.selection.head, 4, "cursor at img")
  state.nodeSel(9)
  state.apply(state.tr.deleteSelection())
  cmpNode(state.doc, doc(p("foobar"), p("ay")), "deleted blockquote")
  cmp(state.selection.from, 9, "cursor moved past")
  state.nodeSel(8)
  state.apply(state.tr.deleteSelection())
  cmpNode(state.doc, doc(p("foobar")), "deleted paragraph")
  cmp(state.selection.from, 7, "cursor moved back")
}, {doc: doc(p("foo", img, "bar"), blockquote(p("hi")), p("ay"))})

test("replace_selection_inline", state => {
  state.nodeSel(4)
  state.apply(state.tr.replaceSelection(schema.node("hard_break")))
  cmpNode(state.doc, doc(p("foo", br, "bar", img, "baz")), "replaced with br")
  cmp(state.selection.head, 5, "after inserted node")
  is(state.selection.empty, "empty selection")
  state.nodeSel(8)
  state.apply(state.tr.replaceSelection(schema.text("abc")))
  cmpNode(state.doc, doc(p("foo", br, "barabcbaz")), "replaced with text")
  cmp(state.selection.head, 11, "after text")
  is(state.selection.empty, "again empty selection")
  state.nodeSel(0)
  state.apply(state.tr.replaceSelection(schema.text("xyz")))
  cmpNode(state.doc, doc(p("xyz")), "replaced all of paragraph")
}, {doc: doc(p("foo", img, "bar", img, "baz"))})

test("replace_selection_block", state => {
  state.nodeSel(5)
  state.apply(state.tr.replaceSelection(schema.node("code_block")))
  cmpNode(state.doc, doc(p("abc"), pre(), hr, blockquote(p("ow"))), "replace with code block")
  cmp(state.selection.from, 7, "selection after")
  state.nodeSel(8)
  state.apply(state.tr.replaceSelection(schema.node("paragraph")))
  cmpNode(state.doc, doc(p("abc"), pre(), hr, p()), "replace with paragraph")
  cmp(state.selection.from, 9)
}, {doc: doc(p("abc"), hr, hr, blockquote(p("ow")))})
