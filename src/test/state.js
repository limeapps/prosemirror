const {EditorState, Selection, TextSelection, NodeSelection} = require("../state")

function selFor(doc) {
  let a = doc.tag.a
  if (a != null) {
    let $a = doc.resolve(a)
    if ($a.parent.isTextblock) return new TextSelection($a, doc.tag.b != null ? doc.resolve(doc.tag.b) : undefined)
    else return new NodeSelection($a)
  }
  return Selection.atStart(doc)
}
exports.selFor = selFor

exports.TestState = class TestState {
  constructor(config) {
    if (!config.selection && config.doc) config.selection = selFor(config.doc)
    this.state = EditorState.create(config)
    this.plugins = config.plugins || []
  }

  apply(action) {
    this.state = this.state.applyAction(action.steps ? action.action() : action)
  }

  command(cmd) {
    cmd(this.state, action => this.state = this.state.applyAction(action))
  }

  type(text) {
    this.apply(this.tr.replaceSelection(this.state.schema.text(text)))
  }

  undo() {
    this.plugins.forEach(plugin => {
      if (plugin.undo)
        plugin.undo(this.state, action => this.state = this.state.applyAction(action))
    })
  }

  redo() {
    this.plugins.forEach(plugin => {
      if (plugin.redo)
        plugin.redo(this.state, action => this.state = this.state.applyAction(action))
    })
  }

  textSel(anchor, head) {
    let sel = new TextSelection(this.state.doc.resolve(anchor),
                                head == null ? undefined : this.state.doc.resolve(head))
    this.state = this.state.applyAction(sel.action())
  }

  nodeSel(pos) {
    let sel = new NodeSelection(this.state.doc.resolve(pos))
    this.state = this.state.applyAction(sel.action())
  }

  get doc() { return this.state.doc }
  get selection() { return this.state.selection }
  get tr() { return this.state.tr }
}
