const {collab} = require("../collab")
const {history} = require("../history")
const {makeStateClass, Selection} = require("../state")
const {schema} = require("../schema-basic")

const {doc, p} = require("./build")
const {defTest} = require("./tests")
const {cmpNode, cmp} = require("./cmp")

class DummyServer {
  constructor(states) {
    this.states = states
    this.steps = []
    this.clientIDs = []
    this.delayed = []
  }

  sync(state) {
    let version = state.collab.version
    if (version == this.steps.length) return state
    return state.collabReceive(this.steps.slice(version), this.clientIDs.slice(version))
  }

  send(state) {
    let sendable = state.collab.sendableSteps()
    if (sendable && sendable.version == this.steps.length) {
      this.steps = this.steps.concat(sendable.steps)
      for (let i = 0; i < sendable.steps.length; i++) this.clientIDs.push(sendable.clientID)
    }
  }

  broadcast(n) {
    if (this.delayed.indexOf(n) > -1) return
    this.states[n] = this.sync(this.states[n])
    this.send(this.states[n])
    for (let i = 0; i < this.states.length; i++) if (i != n)
      this.states[i] = this.sync(this.states[i])
  }

  update(n, f) {
    this.states[n] = f(this.states[n])
    this.broadcast(n)
  }

  type(n, text, pos) {
    this.update(n, s => s.tr.insertText(pos || s.selection.head, text).apply())
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
  return s => s.applySelection(Selection.near(s.doc.resolve(near)))
}
function cutHist(s) {
  return s.update({history: s.history.cut()})
}

let State = makeStateClass([collab(), history({preserveItems: true})])

function test(name, f, doc, n = 2) {
  defTest("collab_" + name, () => {
    let states = []
    for (let i = 0; i < n; i++)
      states.push(doc ? State.fromDoc(doc) : State.fromSchema(schema))
    f(new DummyServer(states))
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
  s.update(1, s => s.undo(s))
  s.conv("AC")
  s.type(1, "D")
  s.type(0, "E")
  s.conv("ACDE")
})

test("redo_basic", s => {
  s.type(0, "A")
  s.type(1, "B")
  s.type(0, "C")
  s.update(1, s => s.undo(s))
  s.update(1, s => s.redo(s))
  s.type(1, "D")
  s.type(0, "E")
  s.conv("ABCDE")
})

test("undo_deep", s => {
  s.update(0, sel(6))
  s.update(1, sel(11))
  s.type(0, "!")
  s.type(1, "!")
  s.update(0, cutHist)
  s.delay(0, () => {
    s.type(0, " ...")
    s.type(1, " ,,,")
  })
  s.update(0, cutHist)
  s.type(0, "*")
  s.type(1, "*")
  s.update(0, s => s.undo(s))
  s.conv(doc(p("hello! ..."), p("bye! ,,,*")))
  s.update(0, s => s.undo(s))
  s.update(0, s => s.undo(s))
  s.conv(doc(p("hello"), p("bye! ,,,*")))
  s.update(0, s => s.redo(s))
  s.update(0, s => s.redo(s))
  s.update(0, s => s.redo(s))
  s.conv(doc(p("hello! ...*"), p("bye! ,,,*")))
  s.update(0, s => s.undo(s))
  s.update(0, s => s.undo(s))
  s.conv(doc(p("hello!"), p("bye! ,,,*")))
  s.update(1, s => s.undo(s))
  s.conv(doc(p("hello!"), p("bye")))
}, doc(p("hello"), p("bye")))

test("undo_deleted_event", s => {
  s.update(0, sel(6))
  s.type(0, "A")
  s.delay(0, () => {
    s.type(0, "B", 4)
    s.type(0, "C", 5)
    s.type(0, "D", 1)
    s.update(1, s => s.tr.delete(2, 5).apply())
  })
  s.conv("DhoA")
  s.update(0, s => s.undo(s))
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
