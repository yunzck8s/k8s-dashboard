import { useState } from 'react';
import {
  UserIcon,
  WrenchScrewdriverIcon,
  CheckCircleIcon,
  XCircleIcon,
  SparklesIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import type { Message } from '../../types/agent';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isTool = message.role === 'tool';
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={clsx(
        'flex gap-4 p-5 rounded-xl transition-all relative overflow-hidden border',
        isUser && 'bg-[#0a0e27]/80 backdrop-blur-sm border-[#00ff9f]/20',
        isAssistant && 'bg-[#0f1629]/80 backdrop-blur-sm border-[#ff006e]/20',
        isTool && 'bg-[#0a0e27]/60 backdrop-blur-sm border-gray-700/30'
      )}
    >
      {/* 装饰性光晕 */}
      {isUser && (
        <div className="absolute inset-0 bg-gradient-to-br from-[#00ff9f]/5 to-transparent opacity-50"></div>
      )}
      {isAssistant && (
        <div className="absolute inset-0 bg-gradient-to-br from-[#ff006e]/5 to-transparent opacity-50"></div>
      )}

      {/* 头像 */}
      <div className="flex-shrink-0 relative z-10">
        {isUser && (
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#00ff9f] to-[#00ff9f]/70 flex items-center justify-center shadow-lg">
            <UserIcon className="w-6 h-6 text-[#0a0e27]" />
            <div className="absolute inset-0 blur-xl bg-[#00ff9f] opacity-30"></div>
          </div>
        )}
        {isAssistant && (
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#ff006e] to-[#ff006e]/70 flex items-center justify-center shadow-lg relative">
            <SparklesIcon className="w-6 h-6 text-white relative z-10" />
            <div className="absolute inset-0 blur-xl bg-[#ff006e] opacity-40 animate-pulse"></div>
          </div>
        )}
        {isTool && (
          <div className="w-10 h-10 rounded-lg bg-gray-700/50 flex items-center justify-center border border-gray-600/30">
            <WrenchScrewdriverIcon className="w-5 h-5 text-gray-400" />
          </div>
        )}
      </div>

      {/* 消息内容 */}
      <div className="flex-1 space-y-3 relative z-10">
        {/* 角色标签 */}
        <div className="flex items-center gap-3">
          <div className={clsx(
            'text-xs font-bold font-mono tracking-wider',
            isUser && 'text-[#00ff9f]',
            isAssistant && 'text-[#ff006e]',
            isTool && 'text-gray-400'
          )}>
            {isUser && '> USER'}
            {isAssistant && '> ASSISTANT'}
            {isTool && '> TOOL_OUTPUT'}
          </div>
          <div className="h-px flex-1 bg-gradient-to-r from-current to-transparent opacity-20"></div>

          {/* 工具输出的展开/收起按钮 */}
          {isTool && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2 px-3 py-1 rounded-lg bg-gray-700/30 hover:bg-gray-700/50 border border-gray-600/30 hover:border-gray-500/50 transition-all text-xs font-mono text-gray-400 hover:text-gray-300"
            >
              {isExpanded ? (
                <>
                  <ChevronUpIcon className="w-4 h-4" />
                  <span>收起</span>
                </>
              ) : (
                <>
                  <ChevronDownIcon className="w-4 h-4" />
                  <span>展开</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* 消息文本 */}
        {(!isTool || isExpanded) && (
          <div className="prose prose-sm max-w-none prose-invert">
            {isAssistant ? (
              <div className="text-gray-300 font-mono text-sm leading-relaxed">
                <ReactMarkdown
                  components={{
                    code({ node, inline, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      return !inline && match ? (
                        <div className="my-4 rounded-lg overflow-hidden border border-[#00ff9f]/20">
                          <div className="bg-[#0a0e27] px-4 py-2 text-xs font-mono text-[#00ff9f] border-b border-[#00ff9f]/20">
                            {match[1]}
                          </div>
                          <SyntaxHighlighter
                            style={vscDarkPlus}
                            language={match[1]}
                            PreTag="div"
                            customStyle={{
                              margin: 0,
                              background: '#0a0e27',
                              padding: '1rem',
                            }}
                            {...props}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        </div>
                      ) : (
                        <code className="bg-[#0a0e27] px-2 py-1 rounded text-[#00ff9f] text-xs font-mono border border-[#00ff9f]/20" {...props}>
                          {children}
                        </code>
                      );
                    },
                    h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-[#00ff9f] mb-3 mt-6" {...props} />,
                    h2: ({node, ...props}) => <h2 className="text-xl font-bold text-[#00ff9f] mb-2 mt-5" {...props} />,
                    h3: ({node, ...props}) => <h3 className="text-lg font-bold text-[#00ff9f] mb-2 mt-4" {...props} />,
                    ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-1 text-gray-300" {...props} />,
                    ol: ({node, ...props}) => <ol className="list-decimal list-inside space-y-1 text-gray-300" {...props} />,
                    li: ({node, ...props}) => <li className="text-gray-300" {...props} />,
                    p: ({node, ...props}) => <p className="text-gray-300 leading-relaxed mb-3" {...props} />,
                    strong: ({node, ...props}) => <strong className="text-[#00ff9f] font-bold" {...props} />,
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                {message.content}
              </p>
            )}
          </div>
        )}

        {/* 工具调用 */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="space-y-3">
            {message.toolCalls.map((toolCall) => (
              <div
                key={toolCall.id}
                className="bg-[#0a0e27]/70 rounded-lg p-4 text-sm space-y-3 border border-[#00ff9f]/20 relative overflow-hidden"
              >
                {/* 装饰性光效 */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#00ff9f]/5 to-transparent"></div>

                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <WrenchScrewdriverIcon className="w-5 h-5 text-[#00ff9f]" />
                    <span className="font-bold text-[#00ff9f] font-mono">
                      {toolCall.name}
                    </span>
                  </div>
                  {toolCall.status && (
                    <div className="flex items-center gap-2">
                      {toolCall.status === 'completed' ? (
                        <>
                          <CheckCircleIcon className="w-5 h-5 text-[#00ff9f]" />
                          <span className="text-xs text-[#00ff9f] font-mono">COMPLETED</span>
                        </>
                      ) : toolCall.status === 'failed' ? (
                        <>
                          <XCircleIcon className="w-5 h-5 text-[#ff006e]" />
                          <span className="text-xs text-[#ff006e] font-mono">FAILED</span>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400 font-mono uppercase">
                          {toolCall.status}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* 参数 */}
                {toolCall.arguments &&
                  Object.keys(toolCall.arguments).length > 0 && (
                    <div className="text-xs text-gray-400 font-mono relative z-10">
                      <div className="bg-[#0a0e27] px-3 py-2 rounded border border-[#00ff9f]/10">
                        {JSON.stringify(toolCall.arguments, null, 2)}
                      </div>
                    </div>
                  )}

                {/* 结果或错误 */}
                {toolCall.result && (
                  <div className="text-xs text-[#00ff9f] bg-[#00ff9f]/10 p-3 rounded border border-[#00ff9f]/20 font-mono relative z-10">
                    {toolCall.result}
                  </div>
                )}
                {toolCall.error && (
                  <div className="text-xs text-[#ff006e] bg-[#ff006e]/10 p-3 rounded border border-[#ff006e]/20 font-mono relative z-10">
                    {toolCall.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 时间戳 */}
        <div className="text-xs text-gray-600 font-mono flex items-center gap-2">
          <span className="text-gray-700">»</span>
          {new Date(message.createdAt).toLocaleString('zh-CN')}
        </div>
      </div>
    </div>
  );
}
