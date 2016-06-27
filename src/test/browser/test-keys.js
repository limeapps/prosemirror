const {namespace, dispatch} = require("./def")
const {doc, p} = require("../build")
const {cmp, is} = require("../cmp")
const {defTest} = require("../tests")

const Keymap = require("browserkeymap")

function trace(prop) { return pm => pm.plugin[prop] = (pm.plugin[prop] || 0) + 1 }

const extraMap = new Keymap({
  "'B'": trace("b"),
  "Ctrl-X C": trace("c"),
  "Ctrl-A": trace("a")
})

const test = namespace("keys", {
  doc: doc(p("foo"))
})

test("basic", pm => {
  pm.addKeymap(extraMap)
  dispatch(pm, "'B'")
  dispatch(pm, "'B'")
  cmp(pm.plugin.b, 2)
})

test("multi", pm => {
  pm.addKeymap(extraMap)
  dispatch(pm, "Ctrl-X")
  dispatch(pm, "Ctrl-X C")
  dispatch(pm, "Ctrl-X")
  dispatch(pm, "Ctrl-X C")
  cmp(pm.plugin.c, 2)
})

test("addKeymap", pm => {
  pm.addKeymap(extraMap)
  let map = new Keymap({"Ctrl-A": trace("a2")})
  pm.addKeymap(map, 60)
  dispatch(pm, "Ctrl-A")
  cmp(pm.plugin.a, undefined)
  cmp(pm.plugin.a2, 1)
  pm.removeKeymap(map)
  dispatch(pm, "Ctrl-A")
  cmp(pm.plugin.a, 1)
  cmp(pm.plugin.a2, 1)
})

test("addKeymap_bottom", pm => {
  pm.addKeymap(extraMap)
  let mapTop = new Keymap({"Ctrl-A": trace("a2")})
  let mapBot = new Keymap({"Ctrl-A": trace("a3"), "Ctrl-D": trace("d")})
  pm.addKeymap(mapTop, 60)
  pm.addKeymap(mapBot, 40)
  dispatch(pm, "Ctrl-A")
  cmp(pm.plugin.a2, 1)
  cmp(pm.plugin.a3, undefined)
  dispatch(pm, "Ctrl-D")
  cmp(pm.plugin.d, 1)
  pm.removeKeymap(mapBot)
  dispatch(pm, "Ctrl-D")
  cmp(pm.plugin.d, 1)
})

defTest("keys_add_inconsistent", () => {
  let map = new Keymap({"Ctrl-A": "foo", "Ctrl-B Ctrl-C": "quux"})
  try {
    map.update({"Ctrl-A Ctrl-X": "baz"})
    is(false, "overwrote single with multi")
  } catch (e) { if (!/Inconsistent/.test(e.toString())) throw e }
  try {
    map.update({"Ctrl-B": "bak"})
    is(false, "overwrote prefix")
  } catch (e) { if (!/Inconsistent/.test(e.toString())) throw e }
})

defTest("keys_add_consistent", () => {
  let map = new Keymap({"Ctrl-A Ctrl-B": "foo", "Ctrl-A Ctrl-C": "bar"}).update({
    "Ctrl-A Ctrl-B": null,
    "Ctrl-A Ctrl-C": null
  })
  map.update({"Ctrl-A": "quux"})
})
