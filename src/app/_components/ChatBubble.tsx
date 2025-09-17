"use client";

import { useState } from "react";
import { Response } from '@/components/ai-elements/response'; 
import { ChatMessage } from "../types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function ChatBubble({ message }: { message: ChatMessage }) {
  const [isOpen, setIsOpen] = useState(false);

  const formatTime = (milliseconds: number) => {
    if (milliseconds < 1000) return `${milliseconds}ms`;
    return `${(milliseconds / 1000).toFixed(2)}s`;
  };

  const formatCost = (cost: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cost);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <div className="p-3 bg-gray-100 border rounded cursor-pointer hover:bg-gray-200 transition-colors">
          <div className="flex justify-between items-start">
            <strong className="capitalize">{message.role}</strong>
            {message.analytics && (
              <div className="text-xs text-gray-500 ml-2">
                {message.analytics.responseTime && formatTime(message.analytics.responseTime)}
              </div>
            )}
          </div>
          <div className="mt-1">
            <Response
              parseIncompleteMarkdown
              shikiTheme={["github-light", "github-dark"]}
            >
              {message.content}
            </Response>
          </div>
        </div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Message Analytics</DialogTitle>
          <DialogDescription>
            Detailed information about this {message.role} message
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {message.analytics ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Role</label>
                  <p className="text-sm text-muted-foreground capitalize">{message.role}</p>
                </div>
                {message.analytics.timestamp && (
                  <div>
                    <label className="text-sm font-medium">Timestamp</label>
                    <p className="text-sm text-muted-foreground">
                      {new Date(message.analytics.timestamp).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {message.analytics.responseTime && (
                <div>
                  <label className="text-sm font-medium">Response Time</label>
                  <p className="text-sm text-muted-foreground">
                    {formatTime(message.analytics.responseTime)}
                  </p>
                </div>
              )}

              {message.analytics.model && (
                <div>
                  <label className="text-sm font-medium">Model</label>
                  <p className="text-sm text-muted-foreground">{message.analytics.model}</p>
                </div>
              )}

              {message.analytics.tokenUsage && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Token Usage</label>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    {message.analytics.tokenUsage.promptTokens !== undefined && (
                      <div>
                        <p className="text-muted-foreground">Prompt</p>
                        <p className="font-mono">{message.analytics.tokenUsage.promptTokens}</p>
                      </div>
                    )}
                    {message.analytics.tokenUsage.completionTokens !== undefined && (
                      <div>
                        <p className="text-muted-foreground">Completion</p>
                        <p className="font-mono">{message.analytics.tokenUsage.completionTokens}</p>
                      </div>
                    )}
                    {message.analytics.tokenUsage.totalTokens !== undefined && (
                      <div>
                        <p className="text-muted-foreground">Total</p>
                        <p className="font-mono">{message.analytics.tokenUsage.totalTokens}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {message.analytics.cost !== undefined && (
                <div>
                  <label className="text-sm font-medium">Estimated Cost</label>
                  <p className="text-sm text-muted-foreground">{formatCost(message.analytics.cost)}</p>
                </div>
              )}

              {message.analytics.toolsUsed && message.analytics.toolsUsed.length > 0 && (
                <div>
                  <label className="text-sm font-medium">Tools Used</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {message.analytics.toolsUsed.map((tool, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No analytics data available for this message.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
