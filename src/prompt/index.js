const {elt, insertCSS} = require("../util/dom")

const prefix = "ProseMirror-prompt"

function editorPrompt() {
  return {
    stateFields: {
      currentPrompt: {
        init() { return null },
        applyAction(state, action) {
          if (action.type == "setPrompt") return action.prompt
          return action.interaction === false ? state.currentPrompt : null
        }
      }
    },

    createView(editorView, state) {
      return new PromptView(editorView, state)
    },

    updateView(view, oldState, newState, props) {
      view.update(oldState, newState, props)
    },

    destroyView(view) {
      view.destroy()
    }
  }
}
exports.editorPrompt = editorPrompt

function openPrompt(options) {
  return {type: "setPrompt", prompt: options}
}
exports.openPrompt = openPrompt

class PromptView {
  constructor(editorView, state) {
    this.editorView = editorView
    this.props = editorView.props
    this.wrapper = editorView.wrapper.appendChild(elt("div", {class: prefix}))

    if (state.currentPrompt) this.drawPrompt(state.currentPrompt)
  }

  update(oldState, newState, props) {
    this.props = props
    if (oldState.currentPrompt != newState.currentPrompt) {
      this.wrapper.textContent = ""
      if (newState.currentPrompt) this.drawPrompt(newState.currentPrompt)
    }
  }

  destroy() {
    this.wrapper.parentNode.removeChild(this.wrapper)
  }

  drawPrompt(options) {
    let domFields = []
    for (let name in options.fields)
      domFields.push(options.fields[name].render(this.props))

    let close = () => this.props.onAction({type: "setPrompt"})

    let promptTitle = options.title && elt("h5", {}, translate(this.props, options.title))
    let submitButton = elt("button", {type: "submit", class: prefix + "-submit"}, "Ok")
    let cancelButton = elt("button", {type: "button", class: prefix + "-cancel"}, "Cancel")
    cancelButton.addEventListener("click", close)
    // : DOMNode
    // An HTML form wrapping the fields.
    let form = elt("form", null, promptTitle, domFields.map(f => elt("div", null, f)),
                   elt("div", {class: prefix + "-buttons"}, submitButton, " ", cancelButton))

    this.wrapper.appendChild(form)
    let outerBox = this.editorView.wrapper.getBoundingClientRect()
    let blockBox = this.wrapper.getBoundingClientRect()
    let cX = Math.max(0, outerBox.left) + Math.min(window.innerWidth, outerBox.right) - blockBox.width
    let cY = Math.max(0, outerBox.top) + Math.min(window.innerHeight, outerBox.bottom) - blockBox.height
    this.wrapper.style.left = (cX / 2 - outerBox.left) + "px"
    this.wrapper.style.top = (cY / 2 - outerBox.top) + "px"

    let hadFocus = this.editorView.hasFocus()

    let submit = () => {
      let params = getValues(options.fields, domFields, this.props)
      if (params) {
        if (hadFocus) this.editorView.focus()
        options.onSubmit(params, this.editorView.state, this.props.onAction) || close()
      }
    }

    form.addEventListener("submit", e => {
      e.preventDefault()
      submit()
    })

    form.addEventListener("keydown", e => {
      if (e.keyCode == 27) {
        e.preventDefault()
        close()
      } else if (e.keyCode == 13 && !(e.ctrlKey || e.metaKey || e.shiftKey)) {
        e.preventDefault()
        submit()
      }
    })

    let input = form.elements[0]
    if (input) input.focus()
  }
}

function getValues(fields, domFields, props) {
  let result = Object.create(null), i = 0
  for (let name in fields) {
    let field = fields[name], dom = domFields[i++]
    let value = field.read(dom), bad = field.validate(value)
    if (bad) {
      reportInvalid(dom, translate(props, bad))
      return null
    }
    result[name] = field.clean(value)
  }
  return result
}

function reportInvalid(dom, message) {
  // FIXME this is awful and needs a lot more work
  let parent = dom.parentNode
  let style = "left: " + (dom.offsetLeft + dom.offsetWidth + 2) + "px; top: " + (dom.offsetTop - 5) + "px"
  let msg = parent.appendChild(elt("div", {class: "ProseMirror-invalid", style}, message))
  setTimeout(() => parent.removeChild(msg), 1500)
}

// ;; The type of field that `FieldPrompt` expects to be passed to it.
class Field {
  // :: (Object)
  // Create a field with the given options. Options support by all
  // field types are:
  //
  // **`value`**`: ?any`
  //   : The starting value for the field.
  //
  // **`label`**`: string`
  //   : The label for the field.
  //
  // **`required`**`: ?bool`
  //   : Whether the field is required.
  //
  // **`validate`**`: ?(any) → ?string`
  //   : A function to validate the given value. Should return an
  //     error message if it is not valid.
  constructor(options) { this.options = options }

  // :: (state: EditorState, props: Object) → DOMNode #path=Field.prototype.render
  // Render the field to the DOM. Should be implemented by all subclasses.

  // :: (DOMNode) → any
  // Read the field's value from its DOM node.
  read(dom) { return dom.value }

  // :: (any) → ?string
  // A field-type-specific validation function.
  validateType(_value) {}

  validate(value) {
    if (!value && this.options.required)
      return "Required field"
    return this.validateType(value) || (this.options.validate && this.options.validate(value))
  }

  clean(value) {
    return this.options.clean ? this.options.clean(value) : value
  }
}
exports.Field = Field

function translate(props, string) {
  let f = props && props.translate
  return f ? f(string) : string
}

// ;; A field class for single-line text fields.
class TextField extends Field {
  render(props) {
    return elt("input", {type: "text",
                         placeholder: translate(props, this.options.label),
                         value: this.options.value || "",
                         autocomplete: "off"})
  }
}
exports.TextField = TextField


// ;; A field class for dropdown fields based on a plain `<select>`
// tag. Expects an option `options`, which should be an array of
// `{value: string, label: string}` objects, or a function taking a
// `ProseMirror` instance and returning such an array.
class SelectField extends Field {
  render(props) {
    let opts = this.options.options.map(o => elt("option", {value: o.value, selected: o.value == opts.value ? "true" : null},
                                                 translate(props, o.label)))
    return elt("select", null, opts)
  }
}
exports.SelectField = SelectField

insertCSS(`
.${prefix} {
  background: white;
  padding: 2px 6px 2px 15px;
  border: 1px solid silver;
  position: absolute;
  border-radius: 3px;
  z-index: 11;
}

.${prefix} h5 {
  margin: 0;
  font-weight: normal;
  font-size: 100%;
  color: #444;
}

.${prefix} input[type="text"],
.${prefix} textarea {
  background: #eee;
  border: none;
  outline: none;
}

.${prefix} input[type="text"] {
  padding: 0 4px;
}

.${prefix}-close {
  position: absolute;
  left: 2px; top: 1px;
  color: #666;
  border: none; background: transparent; padding: 0;
}

.${prefix}-close:after {
  content: "✕";
  font-size: 12px;
}

.ProseMirror-invalid {
  background: #ffc;
  border: 1px solid #cc7;
  border-radius: 4px;
  padding: 5px 10px;
  position: absolute;
  min-width: 10em;
}

.${prefix}-buttons {
  margin-top: 5px;
  display: none;
}

`)
