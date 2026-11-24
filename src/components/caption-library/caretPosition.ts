// Pixel position of a caret inside a textarea, relative to the textarea's top-left
// border edge (scroll already applied). Uses the usual mirror-div technique: copy the
// textarea's text layout into a hidden div and measure where a marker lands.

const COPIED_STYLES = [
  'direction',
  'boxSizing',
  'width',
  'height',
  'overflowX',
  'overflowY',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontSizeAdjust',
  'lineHeight',
  'fontFamily',
  'textAlign',
  'textTransform',
  'textIndent',
  'textDecoration',
  'letterSpacing',
  'wordSpacing',
  'tabSize',
] as const

export function caretCoordinates(el: HTMLTextAreaElement, position: number): { top: number; left: number; height: number } {
  const div = document.createElement('div')
  document.body.appendChild(div)
  const style = div.style
  const computed = window.getComputedStyle(el)

  style.whiteSpace = 'pre-wrap'
  style.wordWrap = 'break-word'
  style.position = 'absolute'
  style.visibility = 'hidden'
  style.top = '0'
  style.left = '-9999px'
  for (const prop of COPIED_STYLES) {
    style[prop] = computed[prop]
  }
  style.overflow = 'hidden'

  div.textContent = el.value.slice(0, position)
  const span = document.createElement('span')
  // Rest of the text so wrapping matches; a zero-width char keeps the span measurable
  span.textContent = el.value.slice(position) || '​'
  div.appendChild(span)

  const lineHeight = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.4
  const top = span.offsetTop + parseFloat(computed.borderTopWidth) - el.scrollTop
  const left = span.offsetLeft + parseFloat(computed.borderLeftWidth) - el.scrollLeft
  document.body.removeChild(div)
  return { top, left, height: lineHeight }
}
