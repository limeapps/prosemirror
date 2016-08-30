const {collab} = require("../collab")
const {EditorState, Selection} = require("../state")
const {history} = require("../history")

const {schema, doc, p} = require("./build")
const {defTest} = require("./tests")
const {cmpNode, cmp} = require("./cmp")

const histPlugin = history({preserveItems: true})

class DummyServer {
  constructor(doc, n) {
    this.states = []
    this.collab = []
    for (let i = 0; i < n; i++) {
      let plugin = collab()
      this.collab.push(plugin)
      this.states.push(EditorState.create({doc, schema, plugins: [histPlugin, plugin]}))
    }
    this.steps = []
    this.clientIDs = []
    this.delayed = []
  }

  sync(n) {
    let state = this.states[n], version = state.collab.version
    if (version != this.steps.length)
      this.states[n] = state.applyAction(this.collab[n].receiveAction(state, this.steps.slice(version), this.clientIDs.slice(version)))
  }

  send(n) {
    let sendable = this.collab[n].sendableSteps(this.states[n])
    if (sendable && sendable.version == this.steps.length) {
      this.steps = this.steps.concat(sendable.steps)
      for (let i = 0; i < sendable.steps.length; i++) this.clientIDs.push(sendable.clientID)
    }
  }

  broadcast(n) {
    if (this.delayed.indexOf(n) > -1) return
    this.sync(n)
    this.send(n)
    for (let i = 0; i < this.states.length; i++) if (i != n) this.sync(i)
  }

  update(n, f) {
    this.states[n] = this.states[n].applyAction(f(this.states[n]))
    this.broadcast(n)
  }

  type(n, text, pos) {
    this.update(n, s => s.tr.insertText(text, pos || s.selection.head).action())
  }

  undo(n) {
    histPlugin.undo(this.states[n], a => this.update(n, () => a))
  }

  redo(n) {
    histPlugin.redo(this.states[n], a => this.update(n, () => a))
  }

  conv(d) {
    if (typeof d == "string") d = doc(p(d))
    this.states.forEach((state, i) => cmpNode(state.doc, d, "state " + i))
  }

  delay(n, f) {
    this.delayed.push(n)
    f()
    this.delayed.pop()
    this.broadcast(n)
  }
}

function sel(near) {
  return s => Selection.near(s.doc.resolve(near)).action()
}
function closeHist() { return {type: "historyClose"} }

function test(name, f, doc, n = 2) {
  defTest("collab_" + name, () => {
    f(new DummyServer(doc, n))
  })
}

test("converge_easy", s => {
  s.type(0, "hi")
  s.type(1, "ok", 3)
  s.type(0, "!", 5)
  s.type(1, "...", 1)
  s.conv("...hiok!")
})

test("converge_rebased", s => {
  s.type(0, "hi")
  s.delay(0, () => {
    s.type(0, "A")
    s.type(1, "X")
    s.type(0, "B")
    s.type(1, "Y")
  })
  s.conv("hiXYAB")
})

test("converge_three", s => {
  s.type(0, "A")
  s.type(1, "U")
  s.type(2, "X")
  s.type(0, "B")
  s.type(1, "V")
  s.type(2, "C")
  s.conv("AUXBVC")
}, null, 3)

test("converge_three_rebased", s => {
  s.type(0, "A")
  s.delay(1, () => {
    s.type(1, "U")
    s.type(2, "X")
    s.type(0, "B")
    s.type(1, "V")
    s.type(2, "C")
  })
  s.conv("AXBCUV")
}, null, 3)

test("undo_basic", s => {
  s.type(0, "A")
  s.type(1, "B")
  s.type(0, "C")
  s.undo(1)
  s.conv("AC")
  s.type(1, "D")
  s.type(0, "E")
  s.conv("ACDE")
})

test("redo_basic", s => {
  s.type(0, "A")
  s.type(1, "B")
  s.type(0, "C")
  s.undo(1)
  s.redo(1)
  s.type(1, "D")
  s.type(0, "E")
  s.conv("ABCDE")
})

test("undo_deep", s => {
  s.update(0, sel(6))
  s.update(1, sel(11))
  s.type(0, "!")
  s.type(1, "!")
  s.update(0, closeHist)
  s.delay(0, () => {
    s.type(0, " ...")
    s.type(1, " ,,,")
  })
  s.update(0, closeHist)
  s.type(0, "*")
  s.type(1, "*")
  s.undo(0)
  s.conv(doc(p("hello! ..."), p("bye! ,,,*")))
  s.undo(0)
  s.undo(0)
  s.conv(doc(p("hello"), p("bye! ,,,*")))
  s.redo(0)
  s.redo(0)
  s.redo(0)
  s.conv(doc(p("hello! ...*"), p("bye! ,,,*")))
  s.undo(0)
  s.undo(0)
  s.conv(doc(p("hello!"), p("bye! ,,,*")))
  s.undo(1)
  s.conv(doc(p("hello!"), p("bye")))
}, doc(p("hello"), p("bye")))

test("undo_deleted_event", s => {
  s.update(0, sel(6))
  s.type(0, "A")
  s.delay(0, () => {
    s.type(0, "B", 4)
    s.type(0, "C", 5)
    s.type(0, "D", 1)
    s.update(1, s => s.tr.delete(2, 5).action())
  })
  s.conv("DhoA")
  s.undo(0)
  s.undo(0)
  s.conv("ho")
  cmp(s.states[0].selection.head, 3)
}, doc(p("hello")))

/* This is related to the TP_2 condition often referenced in OT
   literature -- if you insert at two points but then pull out the
   content between those points, are the inserts still ordered
   properly. Our algorithm does not guarantee this.

test("tp_2", s => {
  s.delay(0, () => {
    s.delay(2, () => {
      s.type(0, "x", 2)
      s.type(2, "y", 3)
      s.update(1, s => s.tr.delete(2, 3).apply())
    })
  })
  s.conv(doc(p("axyc")))
}, {doc: doc(p("abc"))}, 3)
*/
