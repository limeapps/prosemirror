const {readInputChange, readCompositionChange} = require("../../view/domchange")

const {namespace} = require("./def")
const {doc, p, h1, em, img, strong, blockquote} = require("../build")
const {cmpNode, cmp} = require("../cmp")
const {findTextNode} = require("./test-selection")

function setSel(aNode, aOff, fNode, fOff) {
  let r = document.createRange(), s = window.getSelection()
  r.setEnd(fNode || aNode, fNode ? fOff : aOff)
  r.setStart(aNode, aOff)
  s.removeAllRanges()
  s.addRange(r)
}

const test = namespace("domchange", {doc: doc(p("hello"))})

test("add_text", view => {
  findTextNode(view.content, "hello").nodeValue = "heLllo"
  readInputChange(view, view.state)
  cmpNode(view.state.doc, doc(p("heLllo")))
})

test("remove_text", view => {
  findTextNode(view.content, "hello").nodeValue = "heo"
  readInputChange(view, view.state)
  cmpNode(view.state.doc, doc(p("heo")))
})

test("remove_ambiguous_text", view => {
  findTextNode(view.content, "hello").nodeValue = "helo"
  readInputChange(view, view.state)
  cmpNode(view.state.doc, doc(p("helo")))
})

test("active_marks", view => {
  view.props.onAction({type: "addStoredMark", mark: view.state.schema.marks.em.create()})
  findTextNode(view.content, "hello").nodeValue = "helloo"
  readInputChange(view, view.state)
  cmpNode(view.state.doc, doc(p("hello", em("o"))))
})

test("add_node", view => {
  let txt = findTextNode(view.content, "hello")
  txt.parentNode.appendChild(document.createTextNode("!"))
  readInputChange(view, view.state)
  cmpNode(view.state.doc, doc(p("hello!")))
})

test("kill_node", view => {
  let txt = findTextNode(view.content, "hello")
  txt.parentNode.removeChild(txt)
  readInputChange(view, view.state)
  cmpNode(view.state.doc, doc(p()))
})

test("add_paragraph", view => {
  view.content.insertBefore(document.createElement("p"), view.content.firstChild)
    .appendChild(document.createTextNode("hey"))
  readInputChange(view, view.state)
  cmpNode(view.state.doc, doc(p("hey"), p("hello")))
})

test("add_duplicate_paragraph", view => {
  view.content.insertBefore(document.createElement("p"), view.content.firstChild)
    .appendChild(document.createTextNode("hello"))
  readInputChange(view, view.state)
  cmpNode(view.state.doc, doc(p("hello"), p("hello")))
})

test("add_repeated_text", view => {
  findTextNode(view.content, "hello").nodeValue = "helhello"
  readInputChange(view, view.state)
  cmpNode(view.state.doc, doc(p("helhello")))
})

test("detect_enter", view => {
  let bq = view.content.querySelector("blockquote")
  bq.appendChild(document.createElement("p"))
  readInputChange(view, view.state)
  cmp(view.enterPressed, true)
}, {doc: doc(blockquote(p("foo"), p("<a>"))),
    handleKeyDown: (view, event) => { if (event.keyCode == 13) return view.enterPressed = true }})

test("composition_simple", view => {
  findTextNode(view.content, "hello").nodeValue = "hellox"
  readCompositionChange(view, view.state, 0)
  cmpNode(view.state.doc, doc(p("hellox")))
})

test("composition_del_inside_markup", view => {
  findTextNode(view.content, "cd").nodeValue = "c"
  readCompositionChange(view, view.state, 0)
  cmpNode(view.state.doc, doc(p("a", em("b", img, strong("c")), "e")))
}, {doc: doc(p("a", em("b", img, strong("cd<a>")), "e"))})

test("composition_type_inside_markup", view => {
  findTextNode(view.content, "cd").nodeValue = "cdxy"
  readCompositionChange(view, view.state, 0)
  cmpNode(view.state.doc, doc(p("a", em("b", img, strong("cdxy")), "e")))
}, {doc: doc(p("a", em("b", img, strong("cd<a>")), "e"))})

test("composition_type_ambiguous", view => {
  view.props.onAction({type: "addStoredMark", mark: view.state.schema.marks.strong.create()})
  findTextNode(view.content, "foo").nodeValue = "fooo"
  readCompositionChange(view, view.state, 0)
  cmpNode(view.state.doc, doc(p("fo", strong("o"), "o")))
}, {doc: doc(p("fo<a>o"))})

test("get_selection", view => {
  let textNode = findTextNode(view.content, "abc")
  textNode.nodeValue = "abcd"
  setSel(textNode, 3)
  readInputChange(view, view.state)
  cmpNode(view.state.doc, doc(p("abcd")))
  cmp(view.state.selection.anchor, 4)
  cmp(view.state.selection.head, 4)
}, {doc: doc(p("abc<a>"))})

test("crude_split", view => {
  let para = view.content.querySelector("p")
  let split = para.parentNode.appendChild(para.cloneNode())
  split.innerHTML = "fg"
  findTextNode(para, "defg").nodeValue = "dexy"
  setSel(split.firstChild, 1)
  readInputChange(view, view.state)
  cmpNode(view.state.doc, doc(h1("abc"), p("dexy"), p("fg")))
  cmp(view.state.selection.anchor, 13)
}, {doc: doc(h1("abc"), p("defg<a>"))})

test("deep_split", view => {
  let quote = view.content.querySelector("blockquote")
  let quote2 = view.content.appendChild(quote.cloneNode(true))
  findTextNode(quote, "abcd").nodeValue = "abx"
  let text2 = findTextNode(quote2, "abcd")
  text2.nodeValue = "cd"
  setSel(text2.parentNode, 0)
  readInputChange(view, view.state)
  cmpNode(view.state.doc, doc(blockquote(p("abx")), blockquote(p("cd"))))
  cmp(view.state.selection.anchor, 9)
}, {doc: doc(blockquote(p("ab<a>cd")))})
