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
