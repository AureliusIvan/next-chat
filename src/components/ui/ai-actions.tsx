import Image from "next/image"
import {
  CopyIcon,
  RefreshCcwIcon,
  ShareIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from "lucide-react"

import { Action, Actions } from "@/components/ui/actions"
import {
  Conversation,
  ConversationContent,
} from "@/components/ui/conversation"
import { Message, MessageContent } from "@/components/ui/message"
import { ChatMessage } from "@/app/types"

const ChatActions = ({ messages }: { messages: ChatMessage[] }) => {
  const actions = [
    {
      icon: RefreshCcwIcon,
      label: "Retry",
    },
    {
      icon: ThumbsUpIcon,
      label: "Like",
    },
    {
      icon: ThumbsDownIcon,
      label: "Dislike",
    },
    {
      icon: CopyIcon,
      label: "Copy",
    },
    {
      icon: ShareIcon,
      label: "Share",
    },
  ]
  return (
    <div className="flex h-full w-full max-w-lg items-center justify-center">
      <Conversation className="relative w-full">
        <ConversationContent>
          {messages.map((message) => (
            <Message
              className={`flex flex-col gap-2 ${message.role === "assistant" ? "items-start" : "items-end"}`}
              from={message.role}
              key={message.role}
            >
              <Image
                src={message.role === "assistant" ? "https://github.com/openai.png" : "https://github.com/evilrabbit.png"}
                alt={message.role === "assistant" ? "OpenAI" : "Ali Imam"}
                width={32}
                height={32}
                className="h-8 w-8 rounded-full"
              />
              <MessageContent>{message.content}</MessageContent>
              {message.role === "assistant" && (
                <Actions className="mt-2">
                  {actions.map((action) => (
                    <Action key={action.label} label={action.label}>
                      <action.icon className="size-4" />
                    </Action>
                  ))}
                </Actions>
              )}
            </Message>
          ))}
        </ConversationContent>
      </Conversation>
    </div>
  )
}

export { ChatActions }
