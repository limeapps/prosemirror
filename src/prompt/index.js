const {elt, insertCSS} = require("../util/dom")

const prefix = "ProseMirror-prompt"

function findPrompt(view) {
  for (let n = view.wrapper.firstChild; n; n = n.nextSibling)
    if (n.classList.contains(prefix)) return n
}

function editorPrompt() {
  return {
    stateFields: {
      currentPrompt: {
        init() { return null },
        applyAction(state, action) {
          if (action.type == "openPrompt") return action.props
          if (action.type == "closePrompt") return null
          return action.interaction === false ? state.currentPrompt : null
        }
      }
    },

    onUpdate(view, oldState, newState) {
      if (oldState.currentPrompt != newState.currentPrompt) {
        let dom = findPrompt(view)
        if (dom) dom.parentNode.removeChild(dom)
        if (newState.currentPrompt) new FieldPrompt(view, newState.currentPrompt).open()
      }
    }
  }
}
exports.editorPrompt = editorPrompt

function openPrompt(props) {
  props.onAction({type: "openPrompt", props})
}
exports.openPrompt = openPrompt

// This class represents a dialog that prompts for a set of fields.
class FieldPrompt {
  // : (EditorView, Object)
  // Construct a prompt. Note that this does not
  // [open](#FieldPrompt.open) it yet.
  constructor(view, props) {
    this.view = view
    this.props = props
    this.domFields = []
    for (let name in props.fields)
      this.domFields.push(props.fields[name].render(view.state, props))

    let promptTitle = props.title && elt("h5", {}, translate(props, props.title))
    let submitButton = elt("button", {type: "submit", class: prefix + "-submit"}, "Ok")
    let cancelButton = elt("button", {type: "button", class: prefix + "-cancel"}, "Cancel")
    cancelButton.addEventListener("click", () => this.close())
    // : DOMNode
    // An HTML form wrapping the fields.
    this.form = elt("form", null, promptTitle, this.domFields.map(f => elt("div", null, f)),
                    elt("div", {class: prefix + "-buttons"}, submitButton, " ", cancelButton))
    this.open()
  }

  close() {
    this.props.onAction({type: "closePrompt"})
  }

  // : ()
  // Open the prompt's dialog.
  open() {
    let prompt = this.prompt()
    let hadFocus = this.view.hasFocus()

    let submit = () => {
      let params = this.values()
      if (params) {
        this.close()
        if (hadFocus) this.view.focus()
        this.props.onSubmit(params, this.view.state, this.props.onAction)
      }
    }

    this.form.addEventListener("submit", e => {
      e.preventDefault()
      submit()
    })

    this.form.addEventListener("keydown", e => {
      if (e.keyCode == 27) {
        e.preventDefault()
        prompt.close()
      } else if (e.keyCode == 13 && !(e.ctrlKey || e.metaKey || e.shiftKey)) {
        e.preventDefault()
        submit()
      }
    })

    let input = this.form.elements[0]
    if (input) input.focus()
  }

  // : () → ?[any]
  // Read the values from the form's field. Validate them, and when
  // one isn't valid (either has a validate function that produced an
  // error message, or has no validate function, no value, and no
  // default value), show the problem to the user and return `null`.
  values() {
    let result = Object.create(null), i = 0
    for (let name in this.propsfields) {
      let field = this.props.fields[name], dom = this.domFields[i++]
      let value = field.read(dom), bad = field.validate(value)
      if (bad) {
        this.reportInvalid(dom, translate(this.props, bad))
        return null
      }
      result[name] = field.clean(value)
    }
    return result
  }

  // : () → {close: ()}
  // Open a prompt with the parameter form in it. The default
  // implementation calls `openPrompt`.
  prompt() {
    return doOpenPrompt(this.view, this.form, this.props)
  }

  // : (DOMNode, string)
  // Report a field as invalid, showing the given message to the user.
  reportInvalid(dom, message) {
    // FIXME this is awful and needs a lot more work
    let parent = dom.parentNode
    let style = "left: " + (dom.offsetLeft + dom.offsetWidth + 2) + "px; top: " + (dom.offsetTop - 5) + "px"
    let msg = parent.appendChild(elt("div", {class: "ProseMirror-invalid", style}, message))
    setTimeout(() => parent.removeChild(msg), 1500)
  }
}
exports.FieldPrompt = FieldPrompt

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
  render(_, props) {
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
  render(state, props) {
    let opts = this.options
    let options = opts.options.call ? opts.options(state, props) : opts.options
    return elt("select", null, options.map(o => elt("option", {value: o.value, selected: o.value == opts.value ? "true" : null},
                                                    translate(props, o.label))))
  }
}
exports.SelectField = SelectField

// : (ProseMirror, DOMNode, Object)
function doOpenPrompt(view, content, props) {
  let button = elt("button", {class: prefix + "-close"})
  let wrapper = elt("div", {class: prefix}, content, button)
  let outerBox = view.wrapper.getBoundingClientRect()

  view.wrapper.appendChild(wrapper)
  let blockBox = wrapper.getBoundingClientRect()
  let cX = Math.max(0, outerBox.left) + Math.min(window.innerWidth, outerBox.right) - blockBox.width
  let cY = Math.max(0, outerBox.top) + Math.min(window.innerHeight, outerBox.bottom) - blockBox.height
  wrapper.style.left = (cX / 2 - outerBox.left) + "px"
  wrapper.style.top = (cY / 2 - outerBox.top) + "px"

  button.addEventListener("click", () => props.onAction({type: "closePrompt"}))
}

insertCSS(`
${prefix} {
  background: white;
  padding: 2px 6px 2px 15px;
  border: 1px solid silver;
  position: absolute;
  border-radius: 3px;
  z-index: 11;
}

${prefix} h5 {
  margin: 0;
  font-weight: normal;
  font-size: 100%;
  color: #444;
}

${prefix} input[type="text"],
${prefix} textarea {
  background: #eee;
  border: none;
  outline: none;
}

${prefix} input[type="text"] {
  padding: 0 4px;
}

${prefix}-close {
  position: absolute;
  left: 2px; top: 1px;
  color: #666;
  border: none; background: transparent; padding: 0;
}

${prefix}-close:after {
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

${prefix}-buttons {
  margin-top: 5px;
  display: none;
}

`)
