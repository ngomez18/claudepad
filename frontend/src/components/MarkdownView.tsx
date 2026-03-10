import React from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'

const markdownComponents: Components = {
  h1: ({ children }) => <h1 className="text-xl font-semibold text-slate-100 mb-3 mt-6 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="text-[16px] font-semibold text-slate-100 mb-2 mt-5 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="text-[14px] font-semibold text-slate-200 mb-2 mt-4 first:mt-0">{children}</h3>,
  p:  ({ children }) => <p className="text-[14px] text-slate-300 leading-relaxed mb-3">{children}</p>,
  code: ({ children, className }) => {
    const isBlock = !!className
    if (isBlock) return <code className="text-slate-300 text-sm font-mono">{children}</code>
    return <code className="bg-white/8 text-blue-300 px-1.5 py-0.5 rounded text-[12px] font-mono">{children}</code>
  },
  pre: ({ children }) => <pre className="bg-white/5 rounded-lg p-4 mb-3 overflow-x-auto">{children}</pre>,
  ul: ({ children }) => <ul className="text-slate-300 pl-5 mb-3 space-y-1 list-disc">{children}</ul>,
  ol: ({ children }) => <ol className="text-slate-300 pl-5 mb-3 space-y-1 list-decimal">{children}</ol>,
  li: ({ children }) => {
    const childArr = Array.isArray(children) ? children : [children]
    const firstChild = childArr[0]
    if (
      firstChild &&
      typeof firstChild === 'object' &&
      'type' in firstChild &&
      firstChild.type === 'input'
    ) {
      const checked = (firstChild as React.ReactElement<{ checked?: boolean }>).props.checked
      return (
        <li className="text-[14px] leading-relaxed list-none flex items-start gap-2 -ml-1">
          <span className={`mt-0.75 size-3.5 shrink-0 rounded-[3px] border flex items-center justify-center ${
            checked ? 'bg-blue-500/30 border-blue-500/50' : 'border-white/20'
          }`}>
            {checked && <span className="block size-1.25 rounded-[1px] bg-blue-400" />}
          </span>
          <span>{childArr.slice(1)}</span>
        </li>
      )
    }
    return <li className="text-[14px] leading-relaxed">{children}</li>
  },
  blockquote: ({ children }) => <blockquote className="border-l-2 border-white/15 pl-4 text-slate-500 italic mb-3">{children}</blockquote>,
  a: ({ children, href }) => <a href={href} className="text-blue-400 hover:text-blue-300 underline">{children}</a>,
  hr: () => <hr className="border-white/10 my-4" />,
  strong: ({ children }) => <strong className="text-slate-100 font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
}

function stripFrontmatter(content: string): string {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
}

export default function MarkdownView({ content }: { content: string }) {
  return <ReactMarkdown components={markdownComponents}>{stripFrontmatter(content)}</ReactMarkdown>
}
