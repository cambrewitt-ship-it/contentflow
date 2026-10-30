// Reads a caption response from /api/ai sent with `stream: true`. The server sends NDJSON:
// `partial` events with the captions written so far, then one `done` event with the final
// (cleaned-up) captions or an error. Non-streamed JSON responses are handled too.
//
// Call this only once response.ok is true — auth and credit errors come back as plain JSON
// before any streaming starts, so callers keep their existing handling for those.
export async function readCaptionStream(
  response: Response,
  onPartial: (captions: string[]) => void
): Promise<string[]> {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/x-ndjson') || !response.body) {
    const data = await response.json().catch(() => ({}))
    if (data.success === false) throw new Error(errorMessage(data.error))
    return data.captions || []
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let newline: number
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newline).trim()
      buffer = buffer.slice(newline + 1)
      if (!line) continue

      const event = JSON.parse(line)
      if (event.type === 'partial') {
        onPartial(event.captions || [])
      } else if (event.type === 'done') {
        if (event.success === false || (event.status && event.status !== 200)) {
          throw new Error(errorMessage(event.error))
        }
        return event.captions || []
      }
    }
  }

  throw new Error('Caption generation was interrupted. Please try again.')
}

function errorMessage(error: unknown): string {
  if (typeof error === 'string' && error) return error
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return 'Failed to generate captions'
}
