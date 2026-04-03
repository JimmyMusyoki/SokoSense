import { useState, useRef, useEffect, Component, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Mic, TrendingUp, ShoppingBag, Loader2, Info, ChevronRight, LayoutDashboard, ShoppingCart, MessageSquare, Bell, User, LogOut } from "lucide-react";
import Markdown from "react-markdown";
import { extractMarketInfo, generateAdvice } from "./services/geminiService";
import { getPrice, predictPrice } from "./services/marketService";
import { cn } from "./lib/utils";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Login } from "./components/Login";
import { Marketplace } from "./components/Marketplace";
import { ChatBox } from "./components/ChatBox";
import { Notifications } from "./components/Notifications";
import { Profile } from "./components/Profile";
import KilimoStats from "./components/KilimoStats";
import { auth } from "./firebase";
import { signOut } from "firebase/auth";
import { CROPS } from "./constants";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  data?: {
    crop: string;
    todayPrice: number;
    tomorrowPrice: number;
    diff: number;
  };
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center bg-white min-h-screen flex flex-col items-center justify-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h1>
          <div className="bg-gray-100 p-4 rounded text-left overflow-auto max-w-full inline-block border border-gray-200 shadow-sm">
            <p className="font-mono text-sm text-red-500 mb-2 font-bold">{this.state.error?.name}: {this.state.error?.message}</p>
            <pre className="text-xs text-gray-600 whitespace-pre-wrap">
              {this.state.error?.stack}
            </pre>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-6 py-2 bg-[#2E7D32] text-white rounded-full font-bold shadow-lg hover:bg-[#1B5E20] transition-colors"
          >
            Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  console.log("SokoSense AI App rendering...");
  
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error("Global error caught:", event.error);
    };
    window.addEventListener("error", handleError);
    return () => window.removeEventListener("error", handleError);
  }, []);

  return (
    <AuthProvider>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </AuthProvider>
  );
}

type View = "ai" | "market" | "chat" | "notifications" | "login" | "stats" | "profile";

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [activeView, setActiveView] = useState<View>("ai");
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  useEffect(() => {
    const handleOpenChat = (e: any) => {
      setSelectedChatId(e.detail);
      setActiveView("chat");
    };
    const handleChangeView = (e: any) => {
      setActiveView(e.detail);
    };
    window.addEventListener('openChat', handleOpenChat);
    window.addEventListener('changeView', handleChangeView);
    return () => {
      window.removeEventListener('openChat', handleOpenChat);
      window.removeEventListener('changeView', handleChangeView);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#2E7D32]" />
      </div>
    );
  }

  const renderView = () => {
    switch (activeView) {
      case "ai":
        return <MainApp setActiveView={setActiveView} />;
      case "market":
        return user ? <Marketplace /> : <Login />;
      case "chat":
        return user ? <ChatBox initialChatId={selectedChatId} /> : <Login />;
      case "notifications":
        return user ? <Notifications /> : <Login />;
      case "profile":
        return user ? <Profile onClose={() => setActiveView("ai")} /> : <Login />;
      case "stats":
        return <KilimoStats />;
      case "login":
        return <Login />;
      default:
        return <MainApp setActiveView={setActiveView} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col font-sans text-[#1A1A1A] pb-24">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#2E7D32] rounded-xl flex items-center justify-center shadow-lg shadow-green-100">
            <ShoppingBag className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#2E7D32]">SokoSense AI</h1>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">The Farmer's Market Negotiator</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-xs font-bold text-gray-800">{profile?.displayName || 'Farmer'}</p>
                <p className="text-[10px] text-gray-500 font-medium">{profile?.phoneNumber || user.email}</p>
                <button 
                  onClick={() => signOut(auth)}
                  className="text-[10px] text-red-500 font-bold uppercase hover:underline mt-1 block w-full"
                >
                  Logout
                </button>
              </div>
              <div 
                onClick={() => setActiveView("profile")}
                className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center text-[#2E7D32] border border-green-100 cursor-pointer overflow-hidden"
              >
                {profile?.photoURL ? (
                  <img 
                    src={profile.photoURL} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <User className="w-5 h-5" />
                )}
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setActiveView("login")}
              className="px-4 py-2 bg-[#2E7D32] text-white rounded-full text-sm font-bold shadow-lg shadow-green-100 hover:bg-[#1B5E20] transition-all"
            >
              Login
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full w-full"
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-white/80 backdrop-blur-xl border border-gray-100 rounded-3xl shadow-2xl p-2 flex items-center justify-between z-50">
        <NavButton 
          active={activeView === "ai"} 
          onClick={() => setActiveView("ai")} 
          icon={<LayoutDashboard className="w-5 h-5" />} 
          label="AI Soko" 
        />
        <NavButton 
          active={activeView === "market"} 
          onClick={() => setActiveView("market")} 
          icon={<ShoppingCart className="w-5 h-5" />} 
          label="Market" 
        />
        <NavButton 
          active={activeView === "stats"} 
          onClick={() => setActiveView("stats")} 
          icon={<TrendingUp className="w-5 h-5" />} 
          label="Stats" 
        />
        <NavButton 
          active={activeView === "chat"} 
          onClick={() => setActiveView("chat")} 
          icon={<MessageSquare className="w-5 h-5" />} 
          label="Chat" 
        />
        <NavButton 
          active={activeView === "notifications"} 
          onClick={() => setActiveView("notifications")} 
          icon={<Bell className="w-5 h-5" />} 
          label="Alerts" 
        />
      </nav>

      {/* Footer */}
      <footer className="p-4 text-center text-xs text-gray-400 font-medium">
        &copy; 2026 SokoSense AI &bull; Empowering Kenyan Farmers
      </footer>
    </div>
  );
}

function MainApp({ setActiveView }: { setActiveView: (view: View) => void }) {
  console.log("MainApp rendering...");
  console.log("API Key present:", !!process.env.GEMINI_API_KEY);

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hujambo! Mimi ni SokoSense AI. Niko hapa kukusaidia kupata bei bora ya mazao yako. \n\nUnaweza pia kutumia **Marketplace** yetu kupata wanunuzi ama wauzaji wa mazao yako moja kwa moja! \n\nSema ama uandike kile uko nacho leo, kwa mfano: 'Niko na gunia 5 za nyanya Leo.'",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAllCrops, setShowAllCrops] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // 1. Extract info from user input
      const info = await extractMarketInfo(input);
      
      // 2. Get prices
      const todayPrice = getPrice(info.crop, info.date, info.market) || 70; // Fallback for demo
      const tomorrowPrice = predictPrice(info.crop, info.date, info.market) || 95; // Fallback for demo
      
      // 3. Generate advice
      const advice = await generateAdvice(input, info.crop, todayPrice, tomorrowPrice, info.market || "Wakulima");

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: advice,
        data: {
          crop: info.crop,
          todayPrice,
          tomorrowPrice,
          diff: tomorrowPrice - todayPrice,
        },
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error processing request:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Pole sana, nimepata shida kidogo. Hebu jaribu tena baadaye.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Get a subset of crops for quick tips
  const featuredCrops = CROPS.slice(0, 6);
  const otherCrops = CROPS.slice(6, 24); // Show some more but not all 127 at once

  return (
    <div className="max-w-4xl w-full mx-auto p-4 md:p-6 flex flex-col gap-6 h-full overflow-hidden">
      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-6 scrollbar-thin scrollbar-thumb-gray-200">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex flex-col max-w-[85%] md:max-w-[75%]",
                msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
              )}
            >
              <div
                className={cn(
                  "px-4 py-3 rounded-2xl shadow-sm",
                  msg.role === "user"
                    ? "bg-[#2E7D32] text-white rounded-tr-none"
                    : "bg-white border border-gray-200 text-[#1A1A1A] rounded-tl-none"
                )}
              >
                <div className="prose prose-sm max-w-none">
                  <Markdown>{msg.content}</Markdown>
                </div>
              </div>

              {/* Data Card for Assistant Advice */}
              {msg.data && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-3 w-full bg-white border border-gray-200 rounded-2xl p-4 shadow-md overflow-hidden relative"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-green-50 rounded-full -mr-12 -mt-12 opacity-50" />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp className={cn("w-5 h-5", msg.data.diff > 0 ? "text-green-600" : "text-orange-600")} />
                        <span className="text-sm font-bold uppercase tracking-wide text-gray-400">Price Prediction</span>
                      </div>
                      <span className="text-xs font-bold bg-gray-100 px-2 py-1 rounded text-gray-600 uppercase">{msg.data.crop}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500 font-medium">Today's Price</p>
                        <p className="text-2xl font-bold text-gray-800">KES {msg.data.todayPrice}<span className="text-sm font-normal text-gray-400">/kg</span></p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500 font-medium">Tomorrow's Prediction</p>
                        <p className={cn("text-2xl font-bold", msg.data.diff > 0 ? "text-green-600" : "text-orange-600")}>
                          KES {msg.data.tomorrowPrice}
                          <span className="text-sm font-normal opacity-60">/kg</span>
                        </p>
                      </div>
                    </div>

                    <div className={cn(
                      "mt-4 p-3 rounded-xl flex items-center justify-between",
                      msg.data.diff > 0 ? "bg-green-50 border border-green-100" : "bg-orange-50 border border-orange-100"
                    )}>
                      <div className="flex items-center gap-3">
                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", msg.data.diff > 0 ? "bg-green-100" : "bg-orange-100")}>
                          <Info className={cn("w-4 h-4", msg.data.diff > 0 ? "text-green-600" : "text-orange-600")} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-700">Potential {msg.data.diff > 0 ? "Gain" : "Loss"}</p>
                          <p className={cn("text-sm font-bold", msg.data.diff > 0 ? "text-green-700" : "text-orange-700")}>
                            {msg.data.diff > 0 ? "+" : ""}KES {msg.data.diff}/kg
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </div>
                    
                    <button
                      onClick={() => setActiveView("stats")}
                      className="mt-4 w-full py-2 bg-green-50 text-green-700 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-green-100 transition-colors flex items-center justify-center gap-2"
                    >
                      <TrendingUp className="w-3 h-3" />
                      View Market Trends & Stats
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {isLoading && (
          <div className="flex items-center gap-2 text-gray-500 text-sm italic ml-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>SokoSense inachanganua bei...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Produce Grid (The "Boxes") */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Market Produce</h3>
          <button 
            onClick={() => setShowAllCrops(!showAllCrops)}
            className="text-xs font-bold text-[#2E7D32] hover:underline"
          >
            {showAllCrops ? "Show Less" : "View All"}
          </button>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {(showAllCrops ? [...featuredCrops, ...otherCrops] : featuredCrops).map((crop) => (
            <motion.button
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              key={crop}
              onClick={() => setInput(`Niko na gunia 3 za ${crop.split(' (')[0].toLowerCase()} leo`)}
              className="bg-white border border-gray-200 rounded-2xl p-3 text-left hover:border-[#2E7D32] hover:bg-green-50 transition-all group shadow-sm"
            >
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Check Price</p>
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-700 text-sm truncate pr-2">{crop}</span>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#2E7D32] transition-colors shrink-0" />
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white border border-gray-200 rounded-3xl p-2 shadow-xl shadow-gray-100 flex items-center gap-2">
        <button className="w-12 h-12 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-[#2E7D32] transition-colors">
          <Mic className="w-6 h-6" />
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Niko na gunia 5 za nyanya Leo..."
          className="flex-1 bg-transparent border-none focus:ring-0 text-lg py-3 px-2 placeholder:text-gray-300"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center transition-all",
            input.trim() && !isLoading
              ? "bg-[#2E7D32] text-white shadow-lg shadow-green-100"
              : "bg-gray-100 text-gray-300"
          )}
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all",
        active ? "bg-[#2E7D32] text-white shadow-lg shadow-green-100" : "text-gray-400 hover:text-gray-600"
      )}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
    </button>
  );
}
