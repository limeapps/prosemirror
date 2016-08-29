const {defTest} = require("../tests")
const {tempEditor} = require("./def")
const {cmpNode} = require("../cmp")
const {doc, blockquote, pre, h1, h2, p, li, ul, em, strong, code, br, hr} = require("../build")

const {schema} = require("../../schema-basic")
const {history} = require("../../history")
const {buildKeymap} = require("../../example-setup")
const {keymap} = require("../../keymap")
const {mac} = require("../../util/browser")
const {baseKeymap} = require("../..//commands")
const keyCodes = require("w3c-keycode")

let hist = history(), plugins = [hist, keymap(buildKeymap(schema, null, hist)), keymap(baseKeymap)]

function test(key, before, after) {
  defTest("keymap_" + key, () => {
    let view = tempEditor({plugins, doc: before})
    view.dispatchKeyDown(event(key.split("_")[0]))
    cmpNode(view.state.doc, after)
  })
}

function event(keyname) {
  let event = document.createEvent("Event")
  event.initEvent("keydown", true, true)
  let parts = keyname.split("-")
  for (let i = 0; i < parts.length - 1; i++) {
    if ((mac && parts[i] == "Mod") || parts[i] == "Cmd") event.cmdKey = true
    if ((!mac && parts[i] == "Mod") || parts[i] == "Ctrl") event.ctrlKey = true
    if (parts[i] == "Shift") event.shiftKey = true
    if (parts[i] == "Alt") event.altKey = true
  }
  let last = parts[parts.length - 1]
  for (let code in keyCodes) if (keyCodes[code] == last) event.keyCode = code
  return event
}

test("Mod-Enter_simple",
     doc(p("fo<a>o")),
     doc(p("fo", br, "o")))
test("Mod-Enter_in_code",
     doc(pre("fo<a>o")),
     doc(pre("fo\no")))

test("Mod-KeyB_set",
     doc(p("f<a>o<b>o")),
     doc(p("f", strong("o"), "o")))
test("Mod-KeyB_no_selection",
     doc(p("f<a>oo")),
     doc(p("foo")))
test("Mod-KeyB_across_textblocks",
     doc(p("f<a>oo"), p("ba<b>r")),
     doc(p("f", strong("oo")), p(strong("ba"), "r")))
test("Mod-KeyB_unset",
     doc(p(strong("f<a>o<b>o"))),
     doc(p(strong("f"), "o", strong("o"))))
test("Mod-KeyB_unset_across_textblocks",
     doc(p("f<a>oo ", strong("ba<b>r"))),
     doc(p("foo ba", strong("r"))))

test("Mod-KeyI_set",
     doc(p("f<a>o<b>o")),
     doc(p("f", em("o"), "o")))
test("Mod-KeyI_unset",
     doc(p(em("f<a>o<b>o"))),
     doc(p(em("f"), "o", em("o"))))

test("Ctrl-Backquote_set",
     doc(p("f<a>o<b>o")),
     doc(p("f", code("o"), "o")))
test("Ctrl-Backquote_unset",
     doc(p(code("f<a>o<b>o"))),
     doc(p(code("f"), "o", code("o"))))

test("Backspace_join",
     doc(p("hi"), p("<a>there")),
     doc(p("hithere")))
test("Backspace_del_char",
     doc(p("hi<a>")),
     doc(p("h")))
test("Backspace_del_selection",
     doc(p("h<a>iaaa<b>c")),
     doc(p("hc")))

test("Mod-Backspace_join",
     doc(p("hi"), p("<a>there")),
     doc(p("hithere")))
test("Mod-Backspace_del_word",
     doc(p("one two<a> three")),
     doc(p("one  three")))
test("Mod-Backspace_del_selection",
     doc(p("h<a>iaaa<b>c")),
     doc(p("hc")))

test("Delete_join",
     doc(p("hi<a>"), p("there")),
     doc(p("hithere")))
test("Delete_del_char",
     doc(p("<a>hi")),
     doc(p("i")))
test("Delete_del_selection",
     doc(p("h<a>iaaa<b>c")),
     doc(p("hc")))

test("Alt-ArrowUp",
     doc(blockquote(p("foo")), blockquote(p("<a>bar"))),
     doc(blockquote(p("foo"), p("<a>bar"))))
test("Alt-ArrowDown",
     doc(blockquote(p("foo<a>")), blockquote(p("bar"))),
     doc(blockquote(p("foo"), p("<a>bar"))))

test("Shift-Ctrl-Minus_at_start",
     doc(p("<a>foo")),
     doc(hr, p("foo")))
test("Shift-Ctrl-Minus_before",
     doc(p("foo"), p("<a>bar")),
     doc(p("foo"), hr, p("bar")))
test("Shift-Ctrl-Minus_after",
     doc(p("foo<a>")),
     doc(p("foo"), hr))
test("Shift-Ctrl-Minus_inside",
     doc(p("foo"), p("b<a>ar")),
     doc(p("foo"), p("b"), hr, p("ar")))
test("Shift-Ctrl-Minus_overwrite",
     doc(p("fo<a>o"), p("b<b>ar")),
     doc(p("fo"), hr, p("ar")))
test("Shift-Ctrl-Minus_selected_node",
     doc("<a>", p("foo"), p("bar")),
     doc(hr, p("bar")))
test("Shift-Ctrl-Minus_only_selected_node",
     doc("<a>", p("bar")),
     doc(hr))

test("Mod-BracketRight",
     doc(ul(li(p("one")), li(p("t<a><b>wo")), li(p("three")))),
     doc(ul(li(p("one"), ul(li(p("two")))), li(p("three")))))
test("Mod-BracketLeft",
     doc(ul(li(p("hello"), ul(li(p("o<a><b>ne")), li(p("two")))))),
     doc(ul(li(p("hello")), li(p("one"), ul(li(p("two")))))))

test("Shift-Ctrl-Digit0",
     doc(h1("fo<a>o")),
     doc(p("foo")))
test("Shift-Ctrl-Digit1",
     doc(p("fo<a>o")),
     doc(h1("foo")))
test("Shift-Ctrl-Digit2",
     doc(pre("fo<a>o")),
     doc(h2("foo")))

test("Enter_split",
     doc(p("ab<a>c")),
     doc(p("ab"), p("c")))
test("Enter_split_delete",
     doc(p("ab<a>foo<b>c")),
     doc(p("ab"), p("c")))
test("Enter_lift",
     doc(blockquote(p("<a>"))),
     doc(p()))
test("Enter_code_newline",
     doc(pre("foo<a>bar")),
     doc(pre("foo\nbar")))
