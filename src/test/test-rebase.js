const {Transform} = require("../transform")
const {rebaseSteps} = require("../collab/rebase")

const {doc, blockquote, p, li, ul, em} = require("./build")
const {Failure} = require("./failure")
const {defTest} = require("./tests")
const {cmpNode, cmpStr} = require("./cmp")
const {tr} = require("./trans")

function runRebase(transforms, expected) {
  let start = transforms[0].before, full = new Transform(start)
  transforms.forEach(transform => {
    let rebased = new Transform(transform.doc)
    let start = rebaseSteps(rebased, transform.steps,
                            transform.steps.map((s, i) => s.invert(transform.docs[i])),
                            full.steps)
    for (let i = start; i < rebased.steps.length; i++) full.step(rebased.steps[i])
  })
  cmpNode(full.doc, expected)

  for (let tag in start.tag) {
    let mapped = full.mapping.mapResult(start.tag[tag])

    let exp = expected.tag[tag]
    if (mapped.deleted) {
      if (exp) throw new Failure("Tag " + tag + " was unexpectedly deleted")
    } else {
      if (!exp) throw new Failure("Tag " + tag + " is not actually deleted")
      cmpStr(mapped.pos, exp, tag)
    }
  }
}

function rebase(name, doc, ...clients) {
  let expected = clients.pop()
  defTest("rebase_" + name, () => runRebase(clients.map(tr => tr.get(doc)), expected))
}

function permute(array) {
  if (array.length < 2) return [array]
  let result = []
  for (let i = 0; i < array.length; i++) {
    let others = permute(array.slice(0, i).concat(array.slice(i + 1)))
    for (let j = 0; j < others.length; j++)
      result.push([array[i]].concat(others[j]))
  }
  return result
}

function rebase$(name, doc, ...clients) {
  let expected = clients.pop()
  defTest("rebase_" + name, () => {
    permute(clients.map(tr => tr.get(doc))).forEach(transforms => runRebase(transforms, expected))
  })
}

rebase$("type_simple",
        doc(p("h<1>ell<2>o")),
        tr.txt("X", 1),
        tr.txt("Y", 2),
        doc(p("hX<1>ellY<2>o")))

rebase$("type_simple_multiple",
        doc(p("h<1>ell<2>o")),
        tr.txt("X", 1).txt("Y", 1).txt("Z", 1),
        tr.txt("U", 2).txt("V", 2),
        doc(p("hXYZ<1>ellUV<2>o")))

rebase$("type_three",
        doc(p("h<1>ell<2>o th<3>ere")),
        tr.txt("X", 1),
        tr.txt("Y", 2),
        tr.txt("Z", 3),
        doc(p("hX<1>ellY<2>o thZ<3>ere")))

rebase$("wrap",
        doc(p("<1>hell<2>o<3>")),
        tr.txt("X", 2),
        tr.wrap("blockquote", null, 1, 3),
        doc(blockquote(p("<1>hellX<2>o<3>"))))

rebase$("delete",
        doc(p("hello<1> wo<2>rld<3>!")),
        tr.del(1, 3),
        tr.txt("X", 2),
        doc(p("hello<1><3>!")))

rebase("delete_twice",
       doc(p("hello<1> wo<2>rld<3>!")),
       tr.del(1, 3),
       tr.del(1, 3),
       doc(p("hello<1><3>!")))

rebase$("join",
        doc(ul(li(p("one")), "<1>", li(p("tw<2>o")))),
        tr.txt("A", 2),
        tr.join(1),
        doc(ul(li(p("one"), p("twA<2>o")))))

rebase("mark",
       doc(p("hello <1>wo<2>rld<3>")),
       tr.addMark("em", 1, 3),
       tr.txt("_", 2),
       doc(p("hello <1>", em("wo"), "_<2>", em("rld<3>"))))

rebase("mark_unmark",
       doc(p(em("<1>hello"), " world<2>")),
       tr.addMark("em", 1, 2),
       tr.rmMark("em", 1, 2),
       doc(p("<1>hello", em(" world<2>"))))

rebase("unmark_mark",
       doc(p("<1>hello ", em("world<2>"))),
       tr.rmMark("em", 1, 2),
       tr.addMark("em", 1, 2),
       doc(p(em("<1>hello "), "world<2>")))

rebase("replace_nested",
       doc(p("b<before>efore"), blockquote(ul(li(p("o<1>ne")), li(p("t<2>wo")), li(p("thr<3>ee")))), p("a<after>fter")),
       tr.repl(doc(p("a<a>"), blockquote(p("b")), p("<b>c")), 1, 3),
       tr.txt("ayay", 2),
       doc(p("b<before>efore"), blockquote(ul(li(p("o<1>"), blockquote(p("b")), p("<3>ee")))), p("a<after>fter")))

rebase$("map_through_insert",
        doc(p("X<1>X<2>X")),
        tr.txt("hello", 1),
        tr.txt("goodbye", 2).del("2-6", "2-3"),
        doc(p("Xhello<1>Xgbye<2>X")))

rebase("double_remove",
       doc(p("a"), "<1>", p("b"), "<2>", p("c")),
       tr.del(1, 2),
       tr.del(1, 2),
       doc(p("a"), "<1><2>", p("c")))

rebase$("edit_in_removed",
        doc(p("a"), "<1>", p("b<2>"), "<3>", p("c")),
        tr.del(1, 3),
        tr.txt("ay", 2),
        doc(p("a"), "<1><3>", p("c")))

rebase("double_insert",
       doc(p("a"), "<1>", p("b")),
       tr.ins("paragraph", 1),
       tr.ins("paragraph", 1),
       doc(p("a"), p(), p(), "<1>", p("b")))
