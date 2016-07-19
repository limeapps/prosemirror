const {namespace} = require("./def")
const {doc, blockquote, p, em, img, strong, code, br, hr} = require("../build")
const {cmp, cmpNode, gt} = require("../cmp")

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

const test = namespace("selection")

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

test("read", pm => {
  // disabled when the document doesn't have focus, since that causes this to fail
  if (!document.hasFocus()) return
  function test(node, offset, expected, comment) {
    setSel(node, offset)
    pm.view.selectionReader.readFromDOM()
    let sel = pm.selection
    cmp(sel.head == null ? sel.from : sel.head, expected, comment)
    pm.updateView()
  }
  let one = findTextNode(pm.view.content, "one")
  let two = findTextNode(pm.view.content, "two")
  test(one, 0, 1, "force 0:0")
  test(one, 1, 2, "force 0:1")
  test(one, 3, 4, "force 0:3")
  test(one.parentNode, 0, 1, "force :0 from one")
  test(one.parentNode, 1, 4, "force :1 from one")
  test(two, 0, 8, "force 1:0")
  test(two, 3, 11, "force 1:3")
  test(two.parentNode, 1, 11, "force :1 from two")
  test(pm.view.content, 1, 4, "force :1")
  test(pm.view.content, 1, 5, "force :1")
  test(pm.view.content, 2, 8, "force :2")
  test(pm.view.content, 3, 11, "force :3")
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

test("set", pm => {
  // disabled when the document doesn't have focus, since that causes this to fail
  if (!document.hasFocus()) return
  function test(pos, node, offset) {
    pm.setTextSelection(pos)
    pm.updateView()
    let sel = getSel()
    cmp(sel.node, node, pos)
    cmp(sel.offset, offset, pos)
  }
  let one = findTextNode(pm.view.content, "one")
  let two = findTextNode(pm.view.content, "two")
  pm.focus()
  test(1, one, 0)
  test(2, one, 1)
  test(4, one, 3)
  test(8, two, 0)
  test(10, two, 2)
}, {
  doc: doc(p("one"), hr, blockquote(p("two")))
})

test("change_event", pm => {
  let received = 0
  pm.on.selectionChange.add(() => ++received)
  pm.setTextSelection(2)
  pm.setTextSelection(2)
  cmp(received, 1, "changed")
  pm.setTextSelection(1)
  cmp(received, 2, "changed back")
  pm.setDoc(doc(p("hi")))
  cmp(received, 3, "new doc")
  pm.tr.insertText(3, "you").apply()
  cmp(received, 4, "doc changed")
}, {doc: doc(p("one"))})

test("coords_order", pm => {
  let p00 = pm.coordsAtPos(1)
  let p01 = pm.coordsAtPos(2)
  let p03 = pm.coordsAtPos(4)
  let p10 = pm.coordsAtPos(6)
  let p13 = pm.coordsAtPos(9)

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

test("coords_cornercases", pm => {
  pm.markRange(2, 5, {className: "foo"})
  pm.markRange(7, 13, {className: "foo"})
  allPositions(pm.doc).forEach(pos => {
    let coords = pm.coordsAtPos(pos)
    let found = pm.posAtCoords(coords)
    cmp(found, pos)
    pm.setTextSelection(pos)
    pm.updateView()
  })
}, {
  doc: doc(p("one", em("two", strong("three"), img), br, code("foo")), p())
})

test("coords_round_trip", pm => {
  ;[1, 2, 4, 7, 14, 15].forEach(pos => {
    let coords = pm.coordsAtPos(pos)
    let found = pm.posAtCoords(coords)
    cmp(found, pos)
  })
}, {
  doc: doc(p("one"), blockquote(p("two"), p("three")))
})

test("pos_at_coords_after_wrapped", pm => {
  let top = pm.coordsAtPos(1), pos = 1, end
  for (let i = 0; i < 100; i++) {
    pm.tr.typeText("abc def ghi ").apply()
    pm.updateView()
    pos += 12
    end = pm.coordsAtPos(pos)
    if (end.bottom > top.bottom + 4) break
  }
  cmp(pm.posAtCoords({left: end.left + 50, top: end.top + 5}), pos)
})

/*
test("through_inline_node", state => {
  state = dispatch(textSel(state, 4), "Right")
  cmp(state.selection.from, 4, "moved right onto image")
  state = dispatch(state, "Right")
  cmp(state.selection.head, 5, "moved right past")
  cmp(state.selection.anchor, 5, "moved right past'")
  state = dispatch(state, "Left")
  cmp(state.selection.from, 4, "moved left onto image")
  state = dispatch(state, "Left")
  cmp(state.selection.head, 4, "moved left past")
  cmp(state.selection.anchor, 4, "moved left past'")
}, {doc: doc(p("foo", img, "bar"))})

test("onto_block", state => {
  state = textSel(state, 6)
  dispatch(state, "Down")
  cmp(state.selection.from, 7, "moved down onto hr")
  state = textSel(state, 11)
  dispatch(state, "Up")
  cmp(state.selection.from, 7, "moved up onto hr")
}, {doc: doc(p("hello"), hr, ul(li(p("there"))))})

test("through_double_block", state => {
  state = textSel(state, 7)
  dispatch(state, "Down")
  cmp(state.selection.from, 9, "moved down onto hr")
  dispatch(state, "Down")
  cmp(state.selection.from, 10, "moved down onto second hr")
  state = textSel(state, 14)
  dispatch(state, "Up")
  cmp(state.selection.from, 10, "moved up onto second hr")
  dispatch(state, "Up")
  cmp(state.selection.from, 9, "moved up onto hr")
}, {doc: doc(blockquote(p("hello")), hr, hr, p("there"))})

test("horizontally_through_block", state => {
  state = textSel(state, 4)
  dispatch(state, "Right")
  cmp(state.selection.from, 5, "right into first hr")
  dispatch(state, "Right")
  cmp(state.selection.from, 6, "right into second hr")
  dispatch(state, "Right")
  cmp(state.selection.head, 8, "right out of hr")
  dispatch(state, "Left")
  cmp(state.selection.from, 6, "left into second hr")
  dispatch(state, "Left")
  cmp(state.selection.from, 5, "left into first hr")
  dispatch(state, "Left")
  cmp(state.selection.head, 4, "left out of hr")
}, {doc: doc(p("foo"), hr, hr, p("bar"))})

test("block_out_of_image", state => {
  state = nodeSel(state, 4)
  dispatch(state, "Down")
  cmp(state.selection.from, 6, "down into hr")
  state = nodeSel(state, 8)
  dispatch(state, "Up")
  cmp(state.selection.from, 6, "up into hr")
}, {doc: doc(p("foo", img), hr, p(img, "bar"))})
*/
