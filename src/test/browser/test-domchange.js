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

test("add_text", pm => {
  findTextNode(pm.view.content, "hello").nodeValue = "heLllo"
  readInputChange(pm.view)
  cmpNode(pm.doc, doc(p("heLllo")))
})

test("remove_text", pm => {
  findTextNode(pm.view.content, "hello").nodeValue = "heo"
  readInputChange(pm.view)
  cmpNode(pm.doc, doc(p("heo")))
})

test("remove_ambiguous_text", pm => {
  findTextNode(pm.view.content, "hello").nodeValue = "helo"
  readInputChange(pm.view)
  cmpNode(pm.doc, doc(p("helo")))
})

test("active_marks", pm => {
  pm.addActiveMark(pm.schema.marks.em.create())
  findTextNode(pm.view.content, "hello").nodeValue = "helloo"
  readInputChange(pm.view)
  cmpNode(pm.doc, doc(p("hello", em("o"))))
})

test("add_node", pm => {
  let txt = findTextNode(pm.view.content, "hello")
  txt.parentNode.appendChild(document.createTextNode("!"))
  readInputChange(pm.view)
  cmpNode(pm.doc, doc(p("hello!")))
})

test("kill_node", pm => {
  let txt = findTextNode(pm.view.content, "hello")
  txt.parentNode.removeChild(txt)
  readInputChange(pm.view)
  cmpNode(pm.doc, doc(p()))
})

test("add_paragraph", pm => {
  pm.view.content.insertBefore(document.createElement("p"), pm.view.content.firstChild)
    .appendChild(document.createTextNode("hey"))
  readInputChange(pm.view)
  cmpNode(pm.doc, doc(p("hey"), p("hello")))
})

test("add_duplicate_paragraph", pm => {
  pm.view.content.insertBefore(document.createElement("p"), pm.view.content.firstChild)
    .appendChild(document.createTextNode("hello"))
  readInputChange(pm.view)
  cmpNode(pm.doc, doc(p("hello"), p("hello")))
})

test("add_repeated_text", pm => {
  findTextNode(pm.view.content, "hello").nodeValue = "helhello"
  readInputChange(pm.view)
  cmpNode(pm.doc, doc(p("helhello")))
})

test("detect_enter", pm => {
  pm.updateView()
  let bq = pm.view.content.querySelector("blockquote")
  bq.appendChild(document.createElement("p"))
  readInputChange(pm.view)
  cmpNode(pm.doc, doc(blockquote(p("foo")), p()))
}, {doc: doc(blockquote(p("foo"), p("<a>")))})

test("composition_simple", pm => {
  findTextNode(pm.view.content, "hello").nodeValue = "hellox"
  readCompositionChange(pm.view, 0)
  cmpNode(pm.doc, doc(p("hellox")))
})

test("composition_del_inside_markup", pm => {
  pm.updateView()
  findTextNode(pm.view.content, "cd").nodeValue = "c"
  readCompositionChange(pm.view, 0)
  cmpNode(pm.doc, doc(p("a", em("b", img, strong("c")), "e")))
}, {doc: doc(p("a", em("b", img, strong("cd<a>")), "e"))})

test("composition_type_inside_markup", pm => {
  pm.updateView()
  findTextNode(pm.view.content, "cd").nodeValue = "cdxy"
  readCompositionChange(pm.view, 0)
  cmpNode(pm.doc, doc(p("a", em("b", img, strong("cdxy")), "e")))
}, {doc: doc(p("a", em("b", img, strong("cd<a>")), "e"))})

test("composition_type_ambiguous", pm => {
  pm.updateView()
  pm.addActiveMark(pm.schema.marks.strong.create())
  findTextNode(pm.view.content, "foo").nodeValue = "fooo"
  readCompositionChange(pm.view, 0)
  cmpNode(pm.doc, doc(p("fo", strong("o"), "o")))
}, {doc: doc(p("fo<a>o"))})

test("get_selection", pm => {
  let textNode = findTextNode(pm.view.content, "abc")
  textNode.nodeValue = "abcd"
  setSel(textNode, 3)
  readInputChange(pm.view)
  cmpNode(pm.doc, doc(p("abcd")))
  cmp(pm.selection.anchor, 4)
  cmp(pm.selection.head, 4)
}, {doc: doc(p("abc<a>"))})

test("crude_split", pm => {
  pm.updateView()
  let para = pm.view.content.querySelector("p")
  let split = para.parentNode.appendChild(para.cloneNode())
  split.innerHTML = "fg"
  findTextNode(para, "defg").nodeValue = "dexy"
  setSel(split.firstChild, 1)
  readInputChange(pm.view)
  cmpNode(pm.doc, doc(h1("abc"), p("dexy"), p("fg")))
  cmp(pm.selection.anchor, 13)
}, {doc: doc(h1("abc"), p("defg<a>"))})

test("deep_split", pm => {
  pm.updateView()
  let quote = pm.view.content.querySelector("blockquote")
  let quote2 = pm.view.content.appendChild(quote.cloneNode(true))
  findTextNode(quote, "abcd").nodeValue = "abx"
  let text2 = findTextNode(quote2, "abcd")
  text2.nodeValue = "cd"
  setSel(text2.parentNode, 0)
  readInputChange(pm.view)
  cmpNode(pm.doc, doc(blockquote(p("abx")), blockquote(p("cd"))))
  cmp(pm.selection.anchor, 9)
}, {doc: doc(blockquote(p("ab<a>cd")))})
