const {Slice, Fragment} = require("../model")
const {ReplaceStep, AddMarkStep, RemoveMarkStep} = require("../transform")

const {schema, doc, p} = require("./build")
const {defTest} = require("./tests")
const {cmpNode} = require("./cmp")
const {Failure} = require("./failure")

const testDoc = doc(p("foobar"))

function mkStep(from, to, val) {
  if (val == "+em")
    return new AddMarkStep(from, to, schema.marks.em.create())
  else if (val == "-em")
    return new RemoveMarkStep(from, to, schema.marks.em.create())
  else
    return new ReplaceStep(from, to, val == null ? Slice.empty : new Slice(Fragment.from(schema.text(val)), 0, 0))
}

function merge(name, canMerge, from1, to1, val1, from2, to2, val2) {
  defTest("step_merge_" + name, () => {
    let step1 = mkStep(from1, to1, val1), step2 = mkStep(from2, to2, val2)
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

merge("add_style_touch", true,
      1, 2, "+em", 2, 4, "+em")

merge("add_style_overlap", true,
      1, 3, "+em", 2, 4, "+em")

merge("add_style_separate", false,
      1, 2, "+em", 3, 4, "+em")

merge("rem_style_touch", true,
      1, 2, "-em", 2, 4, "-em")

merge("rem_style_overlap", true,
      1, 3, "-em", 2, 4, "-em")

merge("rem_style_separate", false,
      1, 2, "-em", 3, 4, "-em")
