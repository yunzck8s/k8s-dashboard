import {
  UserIcon,
  WrenchScrewdriverIcon,
  CheckCircleIcon,
  XCircleIcon,
  SparklesIcon
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

  return (
    <div
      className={clsx(
        'flex gap-3 p-4 rounded-lg',
        isUser && 'bg-blue-50',
        isAssistant && 'bg-white border',
        isTool && 'bg-gray-50 border border-gray-200'
      )}
    >
      {/* 头像 */}
      <div className="flex-shrink-0">
        {isUser && (
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
            <UserIcon className="w-5 h-5 text-white" />
          </div>
        )}
        {isAssistant && (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <SparklesIcon className="w-5 h-5 text-white" />
          </div>
        )}
        {isTool && (
          <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center">
            <WrenchScrewdriverIcon className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      {/* 消息内容 */}
      <div className="flex-1 space-y-2">
        {/* 角色标签 */}
        <div className="text-xs font-medium text-gray-500">
          {isUser && '用户'}
          {isAssistant && 'AI 助手'}
          {isTool && '工具执行'}
        </div>

        {/* 消息文本 */}
        <div className="prose prose-sm max-w-none">
          {isAssistant ? (
            <ReactMarkdown
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={vscDarkPlus}
                      language={match[1]}
                      PreTag="div"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          ) : (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {message.content}
            </p>
          )}
        </div>

        {/* 工具调用 */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="space-y-2">
            {message.toolCalls.map((toolCall) => (
              <div
                key={toolCall.id}
                className="bg-gray-100 rounded p-3 text-sm space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <WrenchScrewdriverIcon className="w-4 h-4 text-gray-600" />
                    <span className="font-medium text-gray-700">
                      {toolCall.name}
                    </span>
                  </div>
                  {toolCall.status && (
                    <div className="flex items-center gap-1">
                      {toolCall.status === 'completed' ? (
                        <>
                          <CheckCircleIcon className="w-4 h-4 text-green-600" />
                          <span className="text-xs text-green-600">完成</span>
                        </>
                      ) : toolCall.status === 'failed' ? (
                        <>
                          <XCircleIcon className="w-4 h-4 text-red-600" />
                          <span className="text-xs text-red-600">失败</span>
                        </>
                      ) : (
                        <span className="text-xs text-gray-500">
                          {toolCall.status}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* 参数 */}
                {toolCall.arguments &&
                  Object.keys(toolCall.arguments).length > 0 && (
                    <div className="text-xs text-gray-600">
                      <code className="bg-white px-2 py-1 rounded">
                        {JSON.stringify(toolCall.arguments)}
                      </code>
                    </div>
                  )}

                {/* 结果或错误 */}
                {toolCall.result && (
                  <div className="text-xs text-green-700 bg-green-50 p-2 rounded">
                    {toolCall.result}
                  </div>
                )}
                {toolCall.error && (
                  <div className="text-xs text-red-700 bg-red-50 p-2 rounded">
                    {toolCall.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 时间戳 */}
        <div className="text-xs text-gray-400">
          {new Date(message.createdAt).toLocaleString('zh-CN')}
        </div>
      </div>
    </div>
  );
}
