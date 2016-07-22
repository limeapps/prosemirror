const {namespace} = require("./def")
const {doc, pre, h1, p} = require("../build")
const {cmp, cmpStr} = require("../cmp")

const test = namespace("draw")

function apply(view, tr) {
  view.props.onAction(tr.action())
}

test("update", view => {
  apply(view, view.state.tr.insertText("bar"))
  cmpStr(view.content.textContent, "barfoo")
}, {doc: doc(p("foo"))})

test("minimal_at_end", view => {
  let oldP = view.content.querySelector("p")
  apply(view, view.state.tr.insertText("!"))
  cmp(view.content.querySelector("p"), oldP)
}, {doc: doc(h1("foo<a>"), p("bar"))})

test("minimal_at_start", view => {
  let oldP = view.content.querySelector("p")
  apply(view, view.state.tr.insertText("!", 2))
  cmp(view.content.querySelector("p"), oldP)
}, {doc: doc(p("foo"), h1("bar"))})

test("minimal_around", view => {
  let oldP = view.content.querySelector("p")
  let oldPre = view.content.querySelector("pre")
  apply(view, view.state.tr.insertText("!", 2))
  cmp(view.content.querySelector("p"), oldP)
  cmp(view.content.querySelector("pre"), oldPre)
}, {doc: doc(p("foo"), h1("bar"), pre("baz"))})

test("minimal_on_split", view => {
  let oldP = view.content.querySelector("p")
  let oldPre = view.content.querySelector("pre")
  apply(view, view.state.tr.split(8))
  cmp(view.content.querySelector("p"), oldP)
  cmp(view.content.querySelector("pre"), oldPre)
}, {doc: doc(p("foo"), h1("bar"), pre("baz"))})

test("minimal_on_join", view => {
  let oldP = view.content.querySelector("p")
  let oldPre = view.content.querySelector("pre")
  apply(view, view.state.tr.join(10))
  cmp(view.content.querySelector("p"), oldP)
  cmp(view.content.querySelector("pre"), oldPre)
}, {doc: doc(p("foo"), h1("bar"), h1("x"), pre("baz"))})
