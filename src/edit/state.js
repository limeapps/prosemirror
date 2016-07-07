const {Mark} = require("../model")
const {Selection} = require("../selection")

const {EditorTransform} = require("./transform")

class ViewState {
  constructor(mappings, requestedFocus, requestedScroll, storedMarks) {
    this.mappings = mappings
    this.requestedFocus = requestedFocus
    this.requestedScroll = requestedScroll
    this.storedMarks = storedMarks || Mark.empty
  }

  applyTransform(transform, options) {
    return new ViewState(this.mappings.concat(transform.mapping), this.requestedFocus,
                         options.scrollIntoView ? true : this.requestedScroll,
                         options.selection ? Mark.empty : this.storedMarks)
  }

  clean() {
    return new ViewState([], false, null, this.storedMarks)
  }
}
ViewState.initial = new ViewState([], false, null, null)

exports.ViewState = ViewState

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

  applyTransform(transform, options) {
    if (!transform.docs[0].eq(this.doc))
      throw new RangeError("Applying a transform that does not start with the current document")
    let newSel = options.selection || this.selection.map(transform.doc, transform.mapping)
    return new EditorState(transform.doc, newSel,
                           this.view.applyTransform(transform, options))
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
