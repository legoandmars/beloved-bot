import { createCanvas, type SKRSContext2D, GlobalFonts } from '@napi-rs/canvas'

// Most of this text stuff needs to be rewritten but it works enough I don't want to touch it right now

function getLines (ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines = []
  let currentLine = words[0]

  for (let i = 1; i < words.length; i++) {
    const word = words[i]
    const width = ctx.measureText(currentLine + ' ' + word).width
    if (width < maxWidth) {
      currentLine += ' ' + word
    } else {
      lines.push(currentLine)
      currentLine = word
    }
  }
  lines.push(currentLine)
  return lines
}

function resizeFontSizeToFit (inputText: string, ctx: SKRSContext2D, fontSize: number, idealWidth: number): number {
  // what
  let finishedResizing = false
  let timesResized = 0

  do {
    fontSize = fontSize - 0.5
    ctx.font = fontSize + 'px Arial'
    const lines = getLines(ctx, inputText, idealWidth)
    let anyBigger = false
    let totalHeight = 0
    for (let i = 0; i < lines.length; i++) {
      const measureText = ctx.measureText(lines[i])
      totalHeight += fontSize
      if (measureText.width > idealWidth) anyBigger = true
    }

    timesResized++
    if (totalHeight <= idealWidth * 3 / 4 && !anyBigger) finishedResizing = true
  } while (!finishedResizing && timesResized < 100)

  if (timesResized >= 100) {
    // not supposed to happen
    console.log(`Exit condition reached for the loop in resizeFontSizeToFit. Prompt: ${inputText}, Final Height: ${fontSize}, Ideal Width: ${idealWidth}`)
  }
  return fontSize
}

export function getImageOfText (inputText: string): Buffer {
  // this is pretty cursed and probably not efficent
  // but it looks damn good!
  // TODO: Rewrite this to be a bit less insane
  // Sometimes if the text is too long it'll make it unreadable and there's slight clipping issues

  const canvasSize = 512
  const idealWidth = 450
  const canvas = createCanvas(512, 512)
  const ctx = canvas.getContext('2d')
  const fontSize = resizeFontSizeToFit(inputText, ctx, 65.5, idealWidth)
  // this does not feel like how you are supposed to do this
  ctx.font = fontSize + 'px Arial, Apple Emoji, Noto Sans, Noto Sans CJK JP, Noto Sans SC, Noto Sans TC, Noto Sans HK, Noto Sans KR, Noto Sans Hebrew, Noto Sans Lao, Noto Sans Thai, Noto Sans Arabic, Noto Sans Bengali, Noto Sans Devanagari, Noto Sans Gurmukhi, Noto Sans Gujarati, Noto Sans Tibetan, Noto Sans Georgian, Noto Sans Armenian, Noto Sans Khmer'
  ctx.textAlign = 'center'

  const lines = getLines(ctx, inputText, idealWidth)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineHeight = (canvasSize / 2) + (fontSize / 4) + ((fontSize) * i) - (fontSize / 2) * (lines.length - 1)
    ctx.fillText(line, canvasSize / 2, lineHeight)
  }

  return canvas.toBuffer('image/png')
}

export function loadGlobalFonts (): void {
  try {
    GlobalFonts.registerFromPath('/app/resources/AppleColorEmoji@2x.ttf', 'Apple Emoji')
  } catch {
    console.log('Loading emoji font failed.')
  }
}
