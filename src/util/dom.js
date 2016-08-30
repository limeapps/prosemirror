function elt(tag, attrs, ...args) {
  let result = document.createElement(tag)
  if (attrs) for (let name in attrs) {
    if (name == "style")
      result.style.cssText = attrs[name]
    else if (attrs[name] != null)
      result.setAttribute(name, attrs[name])
  }
  for (let i = 0; i < args.length; i++) add(args[i], result)
  return result
}
exports.elt = elt

function add(value, target) {
  if (typeof value == "string")
    value = document.createTextNode(value)

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) add(value[i], target)
  } else if (value) {
    target.appendChild(value)
  }
}


let accumulatedCSS = "", cssNode = null

function insertCSS(css) {
  if (cssNode) cssNode.textContent += css
  else accumulatedCSS += css
}
exports.insertCSS = insertCSS

// This is called when a ProseMirror instance is created, to ensure
// the CSS is in the DOM.
function ensureCSSAdded() {
  if (!cssNode) {
    cssNode = document.createElement("style")
    cssNode.textContent = "/* ProseMirror CSS */\n" + accumulatedCSS
    document.head.insertBefore(cssNode, document.head.firstChild)
  }
}
exports.ensureCSSAdded = ensureCSSAdded
