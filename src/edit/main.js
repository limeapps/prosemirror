const {Subscription, PipelineSubscription, StoppableSubscription, DOMSubscription} = require("subscription")
const {mapThrough} = require("../transform")
const {Mark} = require("../model")
const {ProseMirrorView} = require("../view")
const {requestAnimationFrame, cancelAnimationFrame} = require("../util/dom") // FIXME only connection to the DOM we have -- move into view?
const {TextSelection, NodeSelection, Selection} = require("../selection")

const {parseOptions} = require("./options")
const {RangeStore, MarkedRange} = require("./range")
const {EditorTransform} = require("./transform")
const {UpdateScheduler} = require("./update")
const {viewChannel} = require("./inputevent")

// ;; This is the class used to represent instances of the editor. A
// ProseMirror editor holds a [document](#Node) and a
// [selection](#Selection), and displays an editable surface
// representing that document in the browser document.
class ProseMirror {
  // :: (Object)
  // Construct a new editor from a set of [options](#edit_options)
  // and, if it has a [`place`](#place) option, add it to the
  // document.
  constructor(opts) {
    opts = this.options = parseOptions(opts)
    // :: Schema
    // The schema for this editor's document.
    this.schema = opts.schema || (opts.doc && opts.doc.type.schema)
    if (!this.schema) throw new RangeError("You must specify a schema option")
    if (opts.doc == null) opts.doc = this.schema.nodes.doc.createAndFill()
    if (opts.doc.type.schema != this.schema)
      throw new RangeError("Schema option does not correspond to schema used in doc option")

    // :: Object<Subscription>
    // A wrapper object containing the various [event
    // subscriptions](https://github.com/marijnh/subscription#readme)
    // exposed by an editor instance.
    this.on = {
      // :: Subscription<()>
      // Dispatched when the document has changed. See
      // [`setDoc`](#ProseMirror.on.setDoc) and
      // [`transform`](#ProseMirror.on.transform) for more specific
      // change-related events.
      change: new Subscription,
      // :: Subscription<()>
      // Indicates that the editor's selection has changed.
      selectionChange: new Subscription,
      // :: Subscription<(text: string)>
      // Dispatched when the user types text into the editor.
      textInput: new Subscription,
      // :: Subscription<(doc: Node, selection: Selection)>
      // Dispatched when [`setDoc`](#ProseMirror.setDoc) is called, before
      // the document is actually updated.
      beforeSetDoc: new Subscription,
      // :: Subscription<(doc: Node, selection: Selection)>
      // Dispatched when [`setDoc`](#ProseMirror.setDoc) is called, after
      // the document is updated.
      setDoc: new Subscription,
      // :: Subscription<()>
      // Dispatched when the user interacts with the editor, for example by
      // clicking on it or pressing a key while it is focused. Mostly
      // useful for closing or resetting transient UI state such as open
      // menus.
      interaction: new Subscription,
      // :: Subscription<()>
      // Dispatched when the editor gains focus.
      focus: new Subscription,
      // :: Subscription<()>
      // Dispatched when the editor loses focus.
      blur: new Subscription,
      // :: StoppableSubscription<(pos: number)>
      // Dispatched when the editor is clicked. Return a truthy
      // value to indicate that the click was handled, and no further
      // action needs to be taken.
      click: new StoppableSubscription,
      // :: StoppableSubscription<(pos: number, node: Node, nodePos: number)>
      // Dispatched for every node around a click in the editor, before
      // `click` is dispatched, from inner to outer nodes. `pos` is
      // the position neares to the click, `nodePos` is the position
      // directly in front of `node`.
      clickOn: new StoppableSubscription,
      // :: StoppableSubscription<(pos: number)>
      // Dispatched when the editor is double-clicked.
      doubleClick: new StoppableSubscription,
      // :: StoppableSubscription<(pos: number, node: Node, nodePos: number)>
      // Dispatched for every node around a double click in the
      // editor, before `doubleClick` is dispatched.
      doubleClickOn: new StoppableSubscription,
      // :: StoppableSubscription<(pos: number)>
      // Dispatched when the editor is triple-clicked.
      tripleClick: new StoppableSubscription,
      // :: StoppableSubscription<(pos: number, node: Node, nodePos: number)>
      // Dispatched for every node around a triple click in the
      // editor, before `tripleClick` is dispatched.
      tripleClickOn: new StoppableSubscription,
      // :: StoppableSubscription<(pos: number, node: Node)>
      // Dispatched when the context menu is opened on the editor.
      // Return a truthy value to indicate that you handled the event.
      contextMenu: new StoppableSubscription,
      // :: PipelineSubscription<(slice: Slice) → Slice>
      // Dispatched when something is pasted or dragged into the editor. The
      // given slice represents the pasted content, and your handler can
      // return a modified version to manipulate it before it is inserted
      // into the document.
      transformPasted: new PipelineSubscription,
      // :: Subscription<(transform: Transform, selectionBeforeTransform: Selection, options: Object)>
      // Signals that a (non-empty) transformation has been aplied to
      // the editor. Passes the `Transform`, the selection before the
      // transform, and the options given to [`apply`](#ProseMirror.apply)
      // as arguments to the handler.
      transform: new Subscription,
      // :: Subscription<(transform: Transform, options: Object)>
      // Indicates that the given transform is about to be
      // [applied](#ProseMirror.apply). The handler may add additional
      // [steps](#Step) to the transform, but it it not allowed to
      // interfere with the editor's state.
      beforeTransform: new Subscription,
      // :: StoppableSubscription<(transform: Transform)>
      // Dispatched before a transform (applied without `filter: false`) is
      // applied. The handler can return a truthy value to cancel the
      // transform.
      filterTransform: new StoppableSubscription,
      // :: Subscription<()>
      // Dispatched when the editor has finished
      // [updating](#ProseMirror.updateView) its DOM view.
      updatedView: new Subscription,
      // :: Subscription<()>
      // Dispatched when the editor redrew its document in the DOM.
      draw: new Subscription,
      // :: Subscription<()>
      // Dispatched when the set of [active marks](#ProseMirror.activeMarks) changes.
      activeMarkChange: new Subscription,
      // :: StoppableSubscription<(DOMEvent)>
      // Dispatched when a DOM `drop` event happens on the editor.
      // Handlers may declare the event as being handled by calling
      // `preventDefault` on it or returning a truthy value.
      domDrop: new DOMSubscription
    }

    this.setDocInner(opts.doc)
    // :: Selection
    // The current selection.
    this.selection = Selection.findAtStart(this.doc)

    this.storedMarks = null
    this.on.selectionChange.add(() => this.storedMarks = null)

    // A namespace where plugins can store their state. See the `Plugin` class.
    this.plugin = Object.create(null)

    // :: History A property into which a [history
    // plugin](#historyPlugin) may put a history implementation.
    this.history = null

    this.view = new ProseMirrorView(opts.place, opts, this.doc, this.selection, viewChannel(this), this.ranges)
    this.mapsSinceViewUpdate = []
    this.docSetSinceViewUpdate = false
    this.updateScheduled = null
    this.scrollPosIntoView = null
    this.requestFocus = false

    this.keymaps = []
    this.options.keymaps.forEach(map => this.addKeymap(map, -100))

    this.options.plugins.forEach(plugin => plugin.attach(this))
  }

  // :: (string) → any
  // Get the value of the given [option](#edit_options).
  getOption(name) { return this.options[name] }

  // :: (number, ?number)
  // Set the selection to a [text selection](#TextSelection) from
  // `anchor` to `head`, or, if `head` is null, a cursor selection at
  // `anchor`.
  setTextSelection(anchor, head = anchor) {
    let $anchor = this.doc.resolve(anchor), $head = this.doc.resolve(head)
    if (!$anchor.parent.isTextblock || !$head.parent.isTextblock)
      throw new RangeError("Setting text selection with an end not in a textblock")
    this.setSelection(new TextSelection($anchor, $head))
  }

  // :: (number)
  // Set the selection to a node selection on the node after `pos`.
  setNodeSelection(pos) {
    let $pos = this.doc.resolve(pos), node = $pos.nodeAfter
    if (!node || !node.type.selectable)
      throw new RangeError("Trying to create a node selection that doesn't point at a selectable node")
    this.setSelection(new NodeSelection($pos))
  }

  // :: (Selection)
  // Set the selection to the given selection object.
  setSelection(selection) {
    if (!selection.eq(this.selection)) {
      this.scheduleViewUpdate()
      this.selection = selection
      this.on.selectionChange.dispatch()
    }
  }

  setDocInner(doc) {
    if (doc.type != this.schema.nodes.doc)
      throw new RangeError("Trying to set a document with a different schema")
    // :: Node The current document.
    this.doc = doc
    this.ranges = new RangeStore(this)
  }

  // :: (Node, ?Selection)
  // Set the editor's content, and optionally include a new selection.
  setDoc(doc, sel) {
    if (!sel) sel = Selection.findAtStart(doc)
    this.on.beforeSetDoc.dispatch(doc, sel)
    this.scheduleViewUpdate()
    this.setDocInner(doc)
    this.selection = sel
    this.docSetSinceViewUpdate = true
    this.on.setDoc.dispatch(doc, sel)
    this.on.selectionChange.dispatch()
  }

  updateDoc(doc, mapping, selection) {
    this.scheduleViewUpdate()
    this.ranges.transform(mapping)
    this.mapsSinceViewUpdate.push(mapping)
    this.doc = doc
    this.selection = selection || this.selection.map(doc, mapping)
    this.on.change.dispatch()
    this.on.selectionChange.dispatch()
  }

  // :: EditorTransform
  // Create an editor- and selection-aware `Transform` object for this
  // editor.
  get tr() { return new EditorTransform(this) }

  // :: (Transform, ?Object) → Transform
  // Apply a transformation (which you might want to create with the
  // [`tr` getter](#ProseMirror.tr)) to the document in the editor.
  // The following options are supported:
  //
  // **`scrollIntoView`**: ?bool
  //   : When true, scroll the selection into view on the next
  //     [update](#ProseMirror.updateView).
  //
  // **`selection`**`: ?Selection`
  //   : A new selection to set after the transformation is applied.
  //     If `transform` is an `EditorTransform`, this will default to
  //     that object's current selection. If no selection is provided,
  //     the new selection is determined by [mapping](#Selection.map)
  //     the existing selection through the transform.
  //
  // **`filter`**: ?bool
  //   : When set to false, suppresses the ability of the
  //     [`filterTransform` event](#ProseMirror.on.filterTransform)
  //     to cancel this transform.
  //
  // Returns the transform itself.
  apply(transform, options = nullOptions) {
    if (!transform.steps.length) return transform
    if (!transform.docs[0].eq(this.doc))
      throw new RangeError("Applying a transform that does not start with the current document")

    if (options.filter !== false && this.on.filterTransform.dispatch(transform))
      return transform

    let selectionBeforeTransform = this.selection

    this.on.beforeTransform.dispatch(transform, options)
    this.updateDoc(transform.doc, transform, options.selection || transform.selection)
    this.on.transform.dispatch(transform, selectionBeforeTransform, options)
    if (options.scrollIntoView) this.scrollIntoView()
    return transform
  }

  scheduleViewUpdate() {
    if (this.updateScheduled == null)
      this.updateScheduled = requestAnimationFrame(this.updateView.bind(this))
  }

  unscheduleViewUpdate() {
    if (this.updateScheduled != null) {
      cancelAnimationFrame(this.updateScheduled)
      this.updateScheduled = null
    }
  }

  // :: ()
  // Give the editor focus.
  focus() {
    this.scheduleViewUpdate()
    this.requestFocus = true
  }

  // :: () → bool
  hasFocus() {
    return this.view.hasFocus()
  }

  // :: () → bool
  // Flush any pending changes to the DOM. When the document,
  // selection, or marked ranges in an editor change, the DOM isn't
  // updated immediately, but rather scheduled to be updated the next
  // time the browser redraws the screen. This method can be used to
  // force this to happen immediately. It can be useful when you, for
  // example, want to measure where on the screen a part of the
  // document ends up, immediately after changing the document.
  //
  // Returns true when it updated the document DOM.
  updateView() {
    this.unscheduleViewUpdate()

    let result = this.view.update(this.doc, this.selection, this.ranges, this.requestFocus, this.scrollPosIntoView)
    if (result) {
      this.scrollPosIntoView = null
      this.mapsSinceViewUpdate.length = 0
      this.docSetSinceViewUpdate = this.requestFocus = false
      if (result.redrawn) this.on.draw.dispatch()
    }
    this.on.updatedView.dispatch()
    return !!result
  }

  // :: (Keymap, ?number)
  // Add a
  // [keymap](https://github.com/marijnh/browserkeymap#an-object-type-for-keymaps)
  // to the editor. Keymaps added in this way are queried before the
  // base keymap. The `priority` parameter can be used to
  // control when they are queried relative to other maps added like
  // this. Maps with a higher priority get queried first.
  addKeymap(map, priority = 0) {
    let i = 0, maps = this.keymaps
    for (; i < maps.length; i++) if (maps[i].priority < priority) break
    maps.splice(i, 0, {map, priority})
  }

  // :: (Keymap)
  // Remove the given keymap from the editor.
  removeKeymap(map) {
    let maps = this.keymaps
    for (let i = 0; i < maps.length; ++i) if (maps[i].map == map) {
      maps.splice(i, 1)
      return true
    }
  }

  // :: (number, number, ?Object) → MarkedRange
  // Create a marked range between the given positions. Marked ranges
  // “track” the part of the document they point to—as the document
  // changes, they are updated to move, grow, and shrink along with
  // their content.
  //
  // The `options` parameter may be an object containing these properties:
  //
  // **`inclusiveLeft`**`: bool = false`
  //   : Whether the left side of the range is inclusive. When it is,
  //     content inserted at that point will become part of the range.
  //     When not, it will be outside of the range.
  //
  // **`inclusiveRight`**`: bool = false`
  //   : Whether the right side of the range is inclusive.
  //
  // **`removeWhenEmpty`**`: bool = true`
  //   : Whether the range should be forgotten when it becomes empty
  //     (because all of its content was deleted).
  //
  // **`className`**`: string`
  //   : A CSS class to add to the inline content that is part of this
  //     range.
  //
  // **`onRemove`**`: fn(number, number)`
  //   : When given, this function will be called when the range is
  //     removed from the editor.
  markRange(from, to, options) {
    let range = new MarkedRange(from, to, options)
    this.ranges.addRange(range)
    return range
  }

  // :: (MarkedRange)
  // Remove the given range from the editor.
  removeRange(range) {
    this.ranges.removeRange(range)
  }

  // :: () → [Mark]
  // Get the marks at the cursor. By default, this yields the marks
  // associated with the content at the cursor, as per `Node.marksAt`.
  // But if the set of active marks was updated with
  // [`addActiveMark`](#ProseMirror.addActiveMark) or
  // [`removeActiveMark`](#ProseMirror.removeActiveMark), the updated
  // set is returned.
  activeMarks() {
    return this.storedMarks || currentMarks(this)
  }

  // :: (Mark)
  // Add a mark to the set of overridden active marks that will be
  // applied to subsequently typed text. Does not do anything when the
  // selection isn't collapsed.
  addActiveMark(mark) {
    if (this.selection.empty) {
      this.storedMarks = mark.addToSet(this.storedMarks || currentMarks(this))
      this.on.activeMarkChange.dispatch()
    }
  }

  // :: (MarkType)
  // Remove any mark of the given type from the set of overidden active marks.
  removeActiveMark(markType) {
    if (this.selection.empty) {
      this.storedMarks = markType.removeFromSet(this.storedMarks || currentMarks(this))
      this.on.activeMarkChange.dispatch()
    }
  }

  // :: ({top: number, left: number}) → ?number
  // If the given coordinates (which should be relative to the top
  // left corner of the window—not the page) fall within the editable
  // content, this method will return the document position that
  // corresponds to those coordinates.
  posAtCoords(coords) {
    let result = mappedPosAtCoords(this, coords)
    return result && result.pos
  }

  // :: (number) → {top: number, left: number, bottom: number}
  // Find the screen coordinates (relative to top left corner of the
  // window) of the given document position.
  coordsAtPos(pos) {
    // FIXME provide a variant that overrides compositions?
    if (this.view.composing) return null
    // If the DOM has been changed, update the view so that we have a
    // proper DOM to read
    if (this.docSetSinceViewUpdate || this.view.domTouched) this.updateView()
    return this.view.coordsAtPos(pos)
  }

  // :: (?number)
  // Scroll the given position, or the cursor position if `pos` isn't
  // given, into view.
  scrollIntoView(pos = null) {
    this.scheduleViewUpdate()
    this.scrollIntoPosView = pos == null ? this.selection.from : pos
  }

  // :: (string) → string
  // Return a translated string, if a [translate function](#translate)
  // has been supplied, or the original string.
  translate(string) {
    let trans = this.options.translate
    return trans ? trans(string) : string
  }

  // :: ([Subscription], () -> ?()) → UpdateScheduler
  // Creates an update scheduler for this editor. `subscriptions`
  // should be an array of subscriptions to listen for. `start` should
  // be a function as expected by
  // [`scheduleDOMUpdate`](#ProseMirror.scheduleDOMUpdate).
  updateScheduler(subscriptions, start) {
    return new UpdateScheduler(this, subscriptions, start)
  }
}
exports.ProseMirror = ProseMirror

function mappedPosAtCoords(pm, coords) {
  // FIXME provide a variant that overrides compositions?
  if (pm.view.composing) return null

  // If the DOM has been changed, update the view so that we have a
  // proper DOM to read
  if (pm.docSetSinceViewUpdate || pm.view.domTouched) pm.updateView()

  let result = pm.view.posAtCoords(coords)
  if (!result) return null

  // If there's an active operation, we need to map forward through
  // its changes to get a position that applies to the current
  // document
  if (pm.mapsSinceViewUpdate.length)
    return {pos: mapThrough(pm.mapsSinceViewUpdate, result.pos),
            inside: result.inside == null ? null : mapThrough(pm.mapsSinceViewUpdate, result.inside)}
  else
    return result
}

function currentMarks(pm) {
  let head = pm.selection.head
  return head == null ? Mark.none : pm.doc.marksAt(head)
}

const nullOptions = {}
