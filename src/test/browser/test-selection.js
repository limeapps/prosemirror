const {namespace} = require("./def")
const {doc, blockquote, p, em, img, strong, code, br, hr, ul, li} = require("../build")
const {cmp, gt} = require("../cmp")
const {NodeSelection} = require("../../state")

function allPositions(doc) {
  let found = []
  function scan(node, start) {
    if (node.isTextblock) {
      for (let i = 0; i <= node.content.size; i++) found.push(start + i)
    } else {
      node.forEach((child, offset) => scan(child, start + offset + 1))
    }
  }
  scan(doc, 0)
  return found
}

const test = namespace("view_selection")

function findTextNode(node, text) {
  if (node.nodeType == 3) {
    if (node.nodeValue == text) return node
  } else if (node.nodeType == 1) {
    for (let ch = node.firstChild; ch; ch = ch.nextSibling) {
      let found = findTextNode(ch, text)
      if (found) return found
    }
  }
}
exports.findTextNode = findTextNode

function setSel(node, offset) {
  let range = document.createRange()
  range.setEnd(node, offset)
  range.setStart(node, offset)
  let sel = window.getSelection()
  sel.removeAllRanges()
  sel.addRange(range)
}

test("read", view => {
  // disabled when the document doesn't have focus, since that causes this to fail
  if (!document.hasFocus()) return
  function test(node, offset, expected, comment) {
    setSel(node, offset)
    view.selectionReader.readFromDOM()
    let sel = view.state.selection
    cmp(sel.head == null ? sel.from : sel.head, expected, comment)
  }
  let one = findTextNode(view.content, "one")
  let two = findTextNode(view.content, "two")
  test(one, 0, 1, "force 0:0")
  test(one, 1, 2, "force 0:1")
  test(one, 3, 4, "force 0:3")
  test(one.parentNode, 0, 1, "force :0 from one")
  test(one.parentNode, 1, 4, "force :1 from one")
  test(two, 0, 8, "force 1:0")
  test(two, 3, 11, "force 1:3")
  test(two.parentNode, 1, 11, "force :1 from two")
  test(view.content, 1, 4, "force :1")
  test(view.content, 1, 5, "force :1")
  test(view.content, 2, 8, "force :2")
  test(view.content, 3, 11, "force :3")
}, {
  doc: doc(p("one"), hr, blockquote(p("two")))
})

function getSel() {
  let sel = window.getSelection()
  let node = sel.focusNode, offset = sel.focusOffset
  while (node && node.nodeType != 3) {
    let after = offset < node.childNodes.length && node.childNodes[offset]
    let before = offset > 0 && node.childNodes[offset - 1]
    if (after) { node = after; offset = 0 }
    else if (before) { node = before; offset = node.nodeType == 3 ? node.nodeValue.length : node.childNodes.length }
    else break
  }
  return {node: node, offset: offset}
}

test("set", view => {
  // disabled when the document doesn't have focus, since that causes this to fail
  if (!document.hasFocus()) return
  function test(pos, node, offset) {
    view.update(view.state.applySelection(pos))
    let sel = getSel()
    cmp(sel.node, node, pos)
    cmp(sel.offset, offset, pos)
  }
  let one = findTextNode(view.content, "one")
  let two = findTextNode(view.content, "two")
  view.focus()
  test(1, one, 0)
  test(2, one, 1)
  test(4, one, 3)
  test(8, two, 0)
  test(10, two, 2)
}, {
  doc: doc(p("one"), hr, blockquote(p("two")))
})

test("coords_order", view => {
  let p00 = view.coordsAtPos(1)
  let p01 = view.coordsAtPos(2)
  let p03 = view.coordsAtPos(4)
  let p10 = view.coordsAtPos(6)
  let p13 = view.coordsAtPos(9)

  gt(p00.bottom, p00.top)
  gt(p13.bottom, p13.top)

  cmp(p00.top, p01.top)
  cmp(p01.top, p03.top)
  cmp(p00.bottom, p03.bottom)
  cmp(p10.top, p13.top)

  gt(p01.left, p00.left)
  gt(p03.left, p01.left)
  gt(p10.top, p00.top)
  gt(p13.left, p10.left)
}, {
  doc: doc(p("one"), p("two"))
})

test("coords_cornercases", view => {
  allPositions(view.state.doc).forEach(pos => {
    let coords = view.coordsAtPos(pos)
    let found = view.posAtCoords(coords).pos
    cmp(found, pos)
    view.update(view.state.applySelection(pos))
  })
}, {
  doc: doc(p("one", em("two", strong("three"), img), br, code("foo")), p())
})

test("coords_round_trip", view => {
  ;[1, 2, 4, 7, 14, 15].forEach(pos => {
    let coords = view.coordsAtPos(pos)
    let found = view.posAtCoords(coords).pos
    cmp(found, pos)
  })
}, {
  doc: doc(p("one"), blockquote(p("two"), p("three")))
})

test("pos_at_coords_after_wrapped", view => {
  let top = view.coordsAtPos(1), pos = 1, end
  for (let i = 0; i < 100; i++) {
    view.update(view.state.tr.typeText("abc def ghi ").apply())
    pos += 12
    end = view.coordsAtPos(pos)
    if (end.bottom > top.bottom + 4) break
  }
  cmp(view.posAtCoords({left: end.left + 50, top: end.top + 5}).pos, pos)
})

function dispatch(view, key) {
  let updated = view.applyKey(key)
  if (updated) view.props.onChange(updated)
}

test("through_inline_node", view => {
  dispatch(view, "Right")
  cmp(view.state.selection.from, 4, "moved right onto image")
  dispatch(view, "Right")
  cmp(view.state.selection.head, 5, "moved right past")
  cmp(view.state.selection.anchor, 5, "moved right past'")
  dispatch(view, "Left")
  cmp(view.state.selection.from, 4, "moved left onto image")
  dispatch(view, "Left")
  cmp(view.state.selection.head, 4, "moved left past")
  cmp(view.state.selection.anchor, 4, "moved left past'")
}, {doc: doc(p("foo<a>", img, "bar"))})

test("onto_block", view => {
  dispatch(view, "Down")
  cmp(view.state.selection.from, 7, "moved down onto hr")
  view.update(view.state.applySelection(11))
  dispatch(view, "Up")
  cmp(view.state.selection.from, 7, "moved up onto hr")
}, {doc: doc(p("hello<a>"), hr, ul(li(p("there"))))})

test("through_double_block", view => {
  dispatch(view, "Down")
  cmp(view.state.selection.from, 9, "moved down onto hr")
  dispatch(view, "Down")
  cmp(view.state.selection.from, 10, "moved down onto second hr")
  view.update(view.state.applySelection(14))
  dispatch(view, "Up")
  cmp(view.state.selection.from, 10, "moved up onto second hr")
  dispatch(view, "Up")
  cmp(view.state.selection.from, 9, "moved up onto hr")
}, {doc: doc(blockquote(p("hello<a>")), hr, hr, p("there"))})

test("horizontally_through_block", view => {
  dispatch(view, "Right")
  cmp(view.state.selection.from, 5, "right into first hr")
  dispatch(view, "Right")
  cmp(view.state.selection.from, 6, "right into second hr")
  dispatch(view, "Right")
  cmp(view.state.selection.head, 8, "right out of hr")
  dispatch(view, "Left")
  cmp(view.state.selection.from, 6, "left into second hr")
  dispatch(view, "Left")
  cmp(view.state.selection.from, 5, "left into first hr")
  dispatch(view, "Left")
  cmp(view.state.selection.head, 4, "left out of hr")
}, {doc: doc(p("foo<a>"), hr, hr, p("bar"))})

test("block_out_of_image", view => {
  view.update(view.state.applySelection(new NodeSelection(view.state.doc.resolve(4))))
  dispatch(view, "Down")
  cmp(view.state.selection.from, 6, "down into hr")
  view.update(view.state.applySelection(new NodeSelection(view.state.doc.resolve(8))))
  dispatch(view, "Up")
  cmp(view.state.selection.from, 6, "up into hr")
}, {doc: doc(p("foo", img), hr, p(img, "bar"))})
