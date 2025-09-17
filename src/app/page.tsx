import ChatInterface from "./_components/ChatInterface";

export default async function ChatPage() {

  return (
    <div className="min-h-screen bg-background">
      <h1 className="text-3xl font-bold text-center mb-8 text-foreground">
        Chat Interface
      </h1>
      <p className="text-center mb-8 text-foreground">
        Agent initialized and ready to help!
      </p>
      <ChatInterface />
    </div>
  );
}
