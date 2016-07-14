const {Fragment, Slice} = require("../model")
const {TableRow, AddColumnStep, RemoveColumnStep} = require("../schema-table")
const {ReplaceStep} = require("../transform")
const {Selection} = require("../edit")

// Table-related command functions

function findRow($pos, pred) {
  for (let d = $pos.depth; d > 0; d--)
    if ($pos.node(d).type instanceof TableRow && (!pred || pred(d))) return d
  return -1
}

// :: (EditorState, ?bool) → ?EditorState
// Command function that adds a column before the column with the
// selection.
function addColumnBefore(state, apply) {
  let $from = state.selection.$from, cellFrom
  let rowDepth = findRow($from, d => cellFrom = d == $from.depth ? $from.nodeBefore : $from.node(d + 1))
  if (rowDepth == -1) return null
  if (apply === false) return state
  return state.tr.step(AddColumnStep.create(state.doc, $from.before(rowDepth - 1), $from.index(rowDepth),
                                            cellFrom.type, cellFrom.attrs)).apply()
}
exports.addColumnBefore = addColumnBefore

// :: (EditorState, ?bool) → ?EditorState
// Command function that adds a column after the column with the
// selection.
function addColumnAfter(state, apply) {
  let $from = state.selection.$from, cellFrom
  let rowDepth = findRow($from, d => cellFrom = d == $from.depth ? $from.nodeAfter : $from.node(d + 1))
  if (rowDepth == -1) return null
  if (apply === false) return state
  return state.tr.step(AddColumnStep.create(state.doc, $from.before(rowDepth - 1),
                                            $from.indexAfter(rowDepth) + (rowDepth == $from.depth ? 1 : 0),
                                            cellFrom.type, cellFrom.attrs)).apply()
}
exports.addColumnAfter = addColumnAfter

// :: (EditorState, ?bool) → ?EditorState
// Command function that removes the column with the selection.
function removeColumn(state, apply) {
  let $from = state.selection.$from
  let rowDepth = findRow($from, d => $from.node(d).childCount > 1)
  if (rowDepth == -1) return null
  if (apply === false) return state
  return state.tr.step(RemoveColumnStep.create(state.doc, $from.before(rowDepth - 1), $from.index(rowDepth))).apply()
}
exports.removeColumn = removeColumn

function addRow(state, apply, side) {
  let $from = state.selection.$from
  let rowDepth = findRow($from)
  if (rowDepth == -1) return null
  if (apply === false) return state
  let exampleRow = $from.node(rowDepth)
  let cells = [], pos = side < 0 ? $from.before(rowDepth) : $from.after(rowDepth)
  exampleRow.forEach(cell => cells.push(cell.type.createAndFill(cell.attrs)))
  let row = exampleRow.copy(Fragment.from(cells))
  return state.tr.step(new ReplaceStep(pos, pos, new Slice(Fragment.from(row), 0, 0))).apply()
}

// :: (EditorState, ?bool) → ?EditorState
// Command function that adds a row after the row with the
// selection.
function addRowBefore(state, apply) {
  return addRow(state, apply, -1)
}
exports.addRowBefore = addRowBefore

// :: (EditorState, ?bool) → ?EditorState
// Command function that adds a row before the row with the
// selection.
function addRowAfter(state, apply) {
  return addRow(state, apply, 1)
}
exports.addRowAfter = addRowAfter

// :: (EditorState, ?bool) → ?EditorState
// Command function that removes the row with the selection.
function removeRow(state, apply) {
  let $from = state.selection.$from
  let rowDepth = findRow($from, d => $from.node(d - 1).childCount > 1)
  if (rowDepth == -1) return null
  if (apply === false) return state
  return state.tr.step(new ReplaceStep($from.before(rowDepth), $from.after(rowDepth), Slice.empty)).apply()
}
exports.removeRow = removeRow

function moveCell(state, dir, apply) {
  let {$from} = state.selection
  let rowDepth = findRow($from)
  if (rowDepth == -1) return null
  let row = $from.node(rowDepth), newIndex = $from.index(rowDepth) + dir
  if (newIndex >= 0 && newIndex < row.childCount) {
    let $cellStart = state.doc.resolve(row.content.offsetAt(newIndex) + $from.start(rowDepth))
    let sel = Selection.findFrom($cellStart, 1)
    if (!sel || sel.from >= $cellStart.end()) return null
    return apply === false ? state : state.applySelection(sel)
  } else {
    let rowIndex = $from.index(rowDepth - 1) + dir, table = $from.node(rowDepth - 1)
    if (rowIndex < 0 || rowIndex >= table.childCount) return null
    let cellStart = dir > 0 ? $from.after(rowDepth) + 2 : $from.before(rowDepth) - 2 - table.child(rowIndex).lastChild.content.size
    let $cellStart = state.doc.resolve(cellStart), sel = Selection.findFrom($cellStart, 1)
    if (!sel || sel.from >= $cellStart.end()) return null
    return apply === false ? state : state.applySelection(sel)
  }
}

// :: (EditorState, ?bool) → ?EditorState
// Move to the next cell in the current table, if there is one.
function selectNextCell(state, apply) { return moveCell(state, 1, apply) }
exports.selectNextCell = selectNextCell

// :: (EditorState, ?bool) → ?EditorState
// Move to the previous cell in the current table, if there is one.
function selectPreviousCell(state, apply) { return moveCell(state, -1, apply) }
exports.selectPreviousCell = selectPreviousCell
