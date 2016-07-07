const {Mark} = require("../model")
const {Selection} = require("../selection")
const {Remapping} = require("../transform")

const {EditorTransform} = require("./transform")

class ViewState {
  constructor(mappings, requestedFocus, requestedScroll, storedMarks) {
    this.mappings = mappings
    this.requestedFocus = requestedFocus
    this.requestedScroll = requestedScroll
    this.storedMarks = storedMarks || Mark.empty
  }

  apply(action, doc, selection) {
    if (action.type == "transform")
      return this.applyTransform(action, selection)
    if (action.type == "selection")
      return this.applySelection(action, selection)
    if (action.type == "addActiveStyle" && selection.empty)
      return new ViewState(this.mappings, this.requestedFocus, this.requestedScroll,
                           action.mark.addToSet(this.storedMarks || currentMarks(doc, selection)))
    if (action.type == "removeActiveStyle" && selection.empty)
      return new ViewState(this.mappings, this.requestedFocus, this.requestedScroll,
                           action.type.removeFroMSet(this.storedMarks || currentMarks(doc, selection)))
    return this
  }

  applyTransform({transform, scrollIntoView}, selection) {
    return new ViewState(this.mappings.concat(transform.mapping), this.requestedFocus,
                         scrollIntoView
                          ? scrollPoint(selection)
                          : this.requestedScroll == null ? null : transform.mapping.map(this.requestedScroll),
                         selection ? Mark.empty : this.storedMarks)
  }

  applySelection({scrollIntoView, focus}, selection) {
    return new ViewState(this.mappings,
                         focus || this.requestedFocus,
                         scrollIntoView ? scrollPoint(selection) : this.requestedScroll,
                         Mark.empty)
  }

  clean() {
    return new ViewState([], false, null, this.storedMarks)
  }
}
ViewState.initial = new ViewState([], false, null, null)

exports.ViewState = ViewState

function currentMarks(doc, selection) {
  return selection.head == null ? Mark.none : doc.marksAt(selection.head)
}

function scrollPoint(selection) {
  return selection.head == null ? selection.from : selection.head
}

class EditorState {
  constructor(doc, selection, view) {
    this.doc = doc
    this.selection = selection
    this.view = view
  }

  // :: Schema
  get schema() {
    return this.doc.type.schema
  }

  apply(action) {
    let {doc, selection} = this
    if (action.type == "transform") {
      action = this.mapTransformForward(action)
      if (!action.transform.docs[0].eq(this.doc))
        throw new RangeError("Applying a transform that does not start with the current document")
      doc = action.transform.doc
      selection = action.selection || this.selection.map(action.transform.doc, action.transform.mapping)
    } else if (action.type == "selection") {
      action = this.mapSelectionForward(action)
      selection = action.selection
    }
    return new EditorState(doc, selection, this.view.apply(action, doc, selection))
  }

  mapTransformForward(action) {
    if (this.view.mappings.length == 0) return action
    let copy = {}
    for (let prop in action) copy[prop] = action[prop]
    let remapping = new Remapping(action.transform.mapping.maps.map(m => m.invert()).reverse().concat(this.view.mappings))
    let newTransform = copy.transform = this.tr
    for (let i = 0; i < action.transform.steps.length; i++) {
      let step = action.transform.steps[i].map(remapping.slice(i + 1))
      if (step && newTransform.maybeStep(step).doc)
        remapping.appendMap(step.posMap(), i)
    }
    if (action.selection) copy.selection = action.selection.map(this.doc, remapping)
    return copy
  }

  mapSelectionForward(action) {
    if (this.view.mappings.length == 0) return action
    let copy = {}
    for (let prop in action) copy[prop] = action[prop]
    copy.selection = action.selection.map(this.doc, new Remapping(this.view.mappings))
    return copy
  }

  // :: EditorTransform
  // Create a selection-aware `Transform` object.
  get tr() { return new EditorTransform(this) }

  update(fields) {
    return new EditorState(fields.doc || this.doc,
                           fields.selection || this.selection,
                           fields.view || this.view)
  }

  static fromDoc(doc, selection) {
    return new EditorState(doc, selection || Selection.atStart(doc), ViewState.initial)
  }

  static fromSchema(schema) {
    return this.fromDoc(schema.nodes.doc.createAndFill())
  }
}
exports.EditorState = EditorState
