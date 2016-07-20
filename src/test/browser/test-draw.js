const {namespace} = require("./def")
const {doc, pre, h1, p} = require("../build")
const {cmp, cmpStr} = require("../cmp")

const test = namespace("draw")

test("update", view => {
  view.update(view.state.tr.typeText("bar").apply())
  cmpStr(view.content.textContent, "barfoo")
}, {doc: doc(p("foo"))})

test("minimal_at_end", view => {
  let oldP = view.content.querySelector("p")
  view.update(view.state.tr.typeText("!").apply())
  cmp(view.content.querySelector("p"), oldP)
}, {doc: doc(h1("foo<a>"), p("bar"))})

test("minimal_at_start", view => {
  let oldP = view.content.querySelector("p")
  view.update(view.state.tr.insertText(2, "!").apply())
  cmp(view.content.querySelector("p"), oldP)
}, {doc: doc(p("foo"), h1("bar"))})

test("minimal_around", view => {
  let oldP = view.content.querySelector("p")
  let oldPre = view.content.querySelector("pre")
  view.update(view.state.tr.insertText(2, "!").apply())
  cmp(view.content.querySelector("p"), oldP)
  cmp(view.content.querySelector("pre"), oldPre)
}, {doc: doc(p("foo"), h1("bar"), pre("baz"))})

test("minimal_on_split", view => {
  let oldP = view.content.querySelector("p")
  let oldPre = view.content.querySelector("pre")
  view.update(view.state.tr.split(8).apply())
  cmp(view.content.querySelector("p"), oldP)
  cmp(view.content.querySelector("pre"), oldPre)
}, {doc: doc(p("foo"), h1("bar"), pre("baz"))})

test("minimal_on_join", view => {
  let oldP = view.content.querySelector("p")
  let oldPre = view.content.querySelector("pre")
  view.update(view.state.tr.join(10).apply())
  cmp(view.content.querySelector("p"), oldP)
  cmp(view.content.querySelector("pre"), oldPre)
}, {doc: doc(p("foo"), h1("bar"), h1("x"), pre("baz"))})
