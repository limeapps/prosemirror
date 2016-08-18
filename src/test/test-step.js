const {Slice, Fragment} = require("../model")
const {Step, ReplaceStep} = require("../transform")
const {schema} = require("../schema-basic")

const {doc, blockquote, h1, p, ul, li} = require("./build")
const {defTest} = require("./tests")
const {cmpNode} = require("./cmp")
const {Failure} = require("./failure")

const testDoc = doc(p("foobar"))

function mkSlice(val) {
  return val == null ? Slice.empty : new Slice(Fragment.from(schema.text(val)), 0, 0)
}

function merge(name, canMerge, from1, to1, slice1, from2, to2, slice2) {
  defTest("step_merge_" + name, () => {
    let step1 = new ReplaceStep(from1, to1, mkSlice(slice1))
    let step2 = new ReplaceStep(from2, to2, mkSlice(slice2))
    let merged = step1.merge(step2)
    if (merged && !canMerge) throw new Failure("Merge unexpectedly allowed")
    else if (!merged && canMerge) throw new Failure("Merge unexpectedly failed")
    if (merged) cmpNode(merged.apply(testDoc).doc, step2.apply(step1.apply(testDoc).doc).doc)
  })
}

merge("typing", true,
      2, 2, "a", 3, 3, "b")

merge("typing_inverse", true,
      2, 2, "a", 2, 2, "b")

merge("typing_separated", false,
      2, 2, "a", 4, 4, "b")

merge("typing_separated_inverse", false,
      3, 3, "a", 2, 2, "b")

merge("backspace", true,
      3, 4, null, 2, 3, null)

merge("delete", true,
      2, 3, null, 2, 3, null)

merge("backspace_separate", false,
      1, 2, null, 2, 3, null)

merge("del_add", true,
      2, 3, null, 2, 2, "x")

merge("insert_longer", true,
      2, 2, "quux", 6, 6, "baz")

merge("insert_longer_inverse", true,
      2, 2, "quux", 2, 2, "baz")

merge("del_longer", true,
      2, 5, null, 2, 4, null)

merge("del_longer_inverse", true,
      4, 6, null, 2, 4, null)

merge("overwrite", true,
      3, 4, "x", 4, 5, "y")

merge("overwrite_inverse", true,
      4, 5, "x", 3, 4, "y")
