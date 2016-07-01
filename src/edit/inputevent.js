const {Remapping} = require("../transform")
const Keymap = require("browserkeymap")
const {Selection} = require("../selection")

const {captureKeys} = require("./capturekeys")

function viewChannel(pm) {
  let result = {}
  for (let event in handlers) {
    let handler = handlers[event]
    result[event] = function(args) {
      if (pm.docSetSinceViewUpdate) return null
      pm.on.interaction.dispatch()
      return handler(pm, args, pm.mappingSinceViewUpdate)
    }
  }
  return result
}
exports.viewChannel = viewChannel

const handled = {}

const handlers = {
  selection(pm, {selection}, map) {
    if (map) selection = selection.map(pm.doc, map)
    pm.setSelection(selection)
    return handled
  },

  key(pm, {keyName}) {
    let keymaps = pm.keymaps
    for (let i = 0; i <= keymaps.length; i++) {
      let map = i == keymaps.length ? captureKeys : keymaps[i].map
      let bound = map.lookup(keyName, pm)

      if (bound === false) {
        return null
      } else if (bound == Keymap.unfinished) {
        return {prefix: keyName}
      } else if (bound && bound(pm) !== false) {
        return handled
      }
    }
  },

  insertText(pm, {from, to, text, newSelection}, map) {
    if (from == null) {
      ;({from, to} = pm.selection)
    } else if (map) {
      from = map.map(from, 1)
      to = map.map(to, -1)
      if (from > to) return null
    }
    let marks = pm.storedMarks || pm.doc.marksAt(from)
    let tr = pm.tr.replaceWith(from, to, text ? pm.schema.text(text, marks) : null)
    tr.setSelection(Selection.near(tr.doc.resolve(tr.mapping.map(to)), -1))
    if (newSelection) applyNewSelection(tr, newSelection, map)
    tr.applyAndScroll()
    if (text) pm.on.textInput.dispatch(text)
    return handled
  },

  cut(pm, {from, to}, map) {
    if (map) {
      from = map.map(from, 1)
      to = map.map(to, -1)
      if (from >= to) return null
    }
    pm.tr.delete(from, to).applyAndScroll()
    return handled
  },

  paste(pm, data, map) {
    return doReplace(pm, data, map)
  },

  drop(pm, data, map) {
    return doReplace(pm, data, map, true)
  },

  replace(pm, data, map) {
    return doReplace(pm, data, map)
  },

  singleClick(pm, {pos, inside, ctrl}, map) {
    if (map) { ;({pos, inside} = mapMousePos(pm, map, pos, inside)) }

    if (ctrl) {
      if (selectClickedNode(pm, pos, inside)) return handled
      else return null
    }

    if (runHandlerOnContext(pm.doc, pm.on.clickOn, pos, inside) ||
        pm.on.click.dispatch(pos) ||
        inside != null && selectClickedLeaf(pm, inside))
      return handled
  },

  doubleClick(pm, {pos, inside}, map) {
    if (map) { ;({pos, inside} = mapMousePos(pm, map, pos, inside)) }

    if (runHandlerOnContext(pm.doc, pm.on.doubleClickOn, pos, inside) ||
        pm.on.doubleClick.dispatch(pos))
      return handled
  },

  tripleClick(pm, {pos, inside}, map) {
    if (map) { ;({pos, inside} = mapMousePos(pm, map, pos, inside)) }

    if (runHandlerOnContext(pm.doc, pm.on.tripleClickOn, pos, inside) ||
        pm.on.tripleClick.dispatch(pos) ||
        handleTripleClick(pm, pos, inside))
      return handled

  },

  contextMenu(pm, {pos}, map) {
    if (map) pos = map.map(pos)

    if (pm.on.contextMenu.dispatch(pos)) return handled
  },

  forceUpdate(pm) {
    pm.updateView()
  },

  focus(pm) {
    pm.on.focus.dispatch()
  },

  blur(pm) {
    pm.on.blur.dispatch()
  }
}

function doReplace(pm, {from, to, slice, newSelection}, map, selectContent) {
  if (map) {
    from = map.map(from, 1)
    to = Math.max(from, map.map(to, -1))
  }
  let tr = pm.tr.replace(from, to, pm.on.transformPasted.dispatch(slice))
  tr.setSelection(Selection.near(tr.doc.resolve(tr.mapping.map(to)), -1))
  if (newSelection) applyNewSelection(tr, newSelection, map)
  tr.applyAndScroll()

  if (selectContent)
    pm.setSelection(Selection.between(from, tr.mapping.map(to)))

  return handled
}

function applyNewSelection(tr, {anchor, head}, map) {
  if (map) {
    let maps = tr.mapping.maps
    let remap = new Remapping(maps.slice().reverse().concat(map))
    for (let i = 0; i < maps.length; i++)
      remap.appendMap(maps[i], maps.length - 1 - i)
    anchor = remap.map(anchor)
    head = remap.map(head)
  }

  tr.setSelection(Selection.between(tr.doc.resolve(anchor), tr.doc.resolve(head)))
}

function mapMousePos(pm, map, pos, inside) {
  pos = map.map(pos)
  if (inside != null) {
    let after = map.map(inside + 1, -1), node
    inside = map.map(inside, 1)
    if (after != inside + 1 || !(node = pm.doc.nodeAt(inside)) || !node.type.isLeaf)
      inside = null
  }
  return {pos, inside}
}

function selectClickedNode(pm, pos, inside) {
  let {node: selectedNode, $from} = pm.selection, selectAt

  let $pos = pm.doc.resolve(inside == null ? pos : inside)
  for (let i = $pos.depth + (inside == null ? 0 : 1); i > 0; i--) {
    let node = i > $pos.depth ? $pos.nodeAfter : $pos.node(i)
    if (node.type.selectable) {
      if (selectedNode && $from.depth > 0 &&
          i >= $from.depth && $pos.before($from.depth + 1) == $from.pos)
        selectAt = $pos.before($from.depth)
      else
        selectAt = $pos.before(i)
      break
    }
  }

  if (selectAt != null) {
    pm.setNodeSelection(selectAt)
    pm.focus()
    return true
  } else {
    return false
  }
}

function selectClickedLeaf(pm, inside) {
  let leaf = pm.doc.nodeAt(inside)
  if (leaf && leaf.type.isLeaf && leaf.type.selectable) {
    pm.setNodeSelection(inside)
    pm.focus()
    return true
  }
}

function runHandlerOnContext(doc, handler, pos, inside) {
  let $pos = doc.resolve(inside == null ? pos : inside)
  for (let i = $pos.depth + (inside == null ? 0 : 1); i > 0; i--) {
    let node = i > $pos.depth ? $pos.nodeAfter : $pos.node(i)
    if (handler.dispatch(pos, node, $pos.before(i))) return true
  }
}

function handleTripleClick(pm, pos, inside) {
  let $pos = pm.doc.resolve(inside == null ? pos : inside)
  for (let i = $pos.depth + (inside == null ? 0 : 1); i > 0; i--) {
    let node = i > $pos.depth ? $pos.nodeAfter : $pos.node(i)
    let nodePos = $pos.before(i)
    if (node.isTextblock)
      pm.setTextSelection(nodePos + 1, nodePos + 1 + node.content.size)
    else if (node.type.selectable)
      pm.setNodeSelection(nodePos)
    else
      continue
    pm.focus()
    return true
  }
}
