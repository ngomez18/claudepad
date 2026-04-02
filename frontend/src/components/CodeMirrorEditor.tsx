import CodeMirror from '@uiw/react-codemirror'
import { oneDark } from '@codemirror/theme-one-dark'
import type { Extension } from '@codemirror/state'

export default function CodeMirrorEditor({
  value,
  onChange,
  extensions,
}: {
  value: string
  onChange: (value: string) => void
  extensions: Extension[]
}) {
  return (
    <div className="flex-1 min-h-0 rounded-xl overflow-hidden border border-white/5">
      <CodeMirror
        value={value}
        height="100%"
        extensions={extensions}
        theme={oneDark}
        basicSetup={{ lineNumbers: true, bracketMatching: true }}
        onChange={onChange}
        style={{ height: '100%' }}
      />
    </div>
  )
}
