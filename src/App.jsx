"use client"

import { useState, useEffect, useRef } from "react"
import Peer from "peerjs"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Copy, 
  Send, 
  Wifi, 
  WifiOff, 
  Loader2, 
  Upload, 
  ImageIcon, 
  FileText, 
  FileIcon,
  Sun,
  Moon
} from "lucide-react"
import "./index.css"
import { useLocalStorage } from "./hooks/use-local-storage"
import { useOnlineStatus } from "./hooks/use-online-status"

const emojis = [
  "😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉",
  "😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨",
  "🧐","🤓","😎","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️",
  "😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳",
  "🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤭","🤫","🤥","😶",
  "😐","😑","😬","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪",
  "😵","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕","🤑","🤠","😈","👿",
  "👹","👺","🤡","💩","👻","💀","☠️","👽","👾","🤖","🎃","😺","😸",
  "😹","😻","😼","😽","🙀","😿","😾",
]

function App() {
  const [peerId, setPeerId] = useState("")
  const [remoteId, setRemoteId] = useState("")
  const [messages, setMessages] = useLocalStorage("lantern-messages", [])
  const [messageInput, setMessageInput] = useState("")
  const [connectionStatus, setConnectionStatus] = useState("disconnected") // "disconnected", "connecting", "connected"
  const [copied, setCopied] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [peerIsTyping, setPeerIsTyping] = useState(false)
  const [fileToSend, setFileToSend] = useState(null)
  const [filePreview, setFilePreview] = useState(null)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [darkMode, setDarkMode] = useLocalStorage("lantern-dark-mode", false)

  const isOnline = useOnlineStatus()

  const peerInstance = useRef(null)
  const connRef = useRef(null)
  const messagesEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])


  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [darkMode])


  useEffect(() => {
    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        setNotificationsEnabled(true)
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((permission) => {
          setNotificationsEnabled(permission === "granted")
        })
      }
    }
  }, [])

  
  useEffect(() => {
    initializePeer()
    return () => {
      if (peerInstance.current) peerInstance.current.destroy()
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
    }
  }, [])

 
  useEffect(() => {
    if (!isOnline && connectionStatus === "connected") {
      setConnectionStatus("disconnected")
    } else if (isOnline && connectionStatus === "disconnected" && remoteId && reconnectAttempts < 5) {
      reconnectToPeer()
    }
  }, [isOnline, connectionStatus, remoteId, reconnectAttempts])

  const initializePeer = () => {
    const peer = new Peer()
    peer.on("open", (id) => {
      setPeerId(id)
      console.log("My Peer ID is:", id)
      setReconnectAttempts(0)
    })
    peer.on("connection", handleIncomingConnection)
    peer.on("error", (err) => {
      console.error("Peer error:", err)
      setConnectionStatus("disconnected")
      if (reconnectAttempts < 5) {
        reconnectTimeoutRef.current = setTimeout(() => {
          initializePeer()
          setReconnectAttempts((prev) => prev + 1)
        }, 5000)
      }
    })
    peer.on("disconnected", () => {
      console.log("Peer disconnected")
      setConnectionStatus("disconnected")
      if (reconnectAttempts < 5) {
        reconnectTimeoutRef.current = setTimeout(() => {
          peer.reconnect()
          setReconnectAttempts((prev) => prev + 1)
        }, 5000)
      }
    })
    peerInstance.current = peer
  }

  const handleIncomingConnection = (conn) => {
    setConnectionStatus("connected")
    setRemoteId(conn.peer)
    conn.on("data", handleIncomingData)
    conn.on("close", () => {
      setConnectionStatus("disconnected")
      setPeerIsTyping(false)
      if (reconnectAttempts < 5) {
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectToPeer()
          setReconnectAttempts((prev) => prev + 1)
        }, 5000)
      }
    })
    connRef.current = conn
  }

  const handleIncomingData = (data) => {
    console.log("Received data:", data)
    if (data.type === "message") {
      handleIncomingMessage(data)
    } else if (data.type === "typing") {
      setPeerIsTyping(data.isTyping)
    } else if (data.type === "file") {
      handleIncomingFile(data)
    }
  }

  const handleIncomingMessage = (data) => {
    setMessages((prev) => [
      ...prev,
      { sender: "peer", text: data.text, timestamp: new Date() },
    ])
    NEW_MESSAGE_SOUND.play().catch((err) => console.error("Error playing sound:", err))
    if (notificationsEnabled && document.visibilityState !== "visible") {
      new Notification("New Message from LANtern", {
        body: data.text,
        icon: "/lantern-icon.png", // Ensure this path is correct; you can update to "/Lantern.png"
      })
    }
    setPeerIsTyping(false)
  }

  const handleIncomingFile = (data) => {
    const { fileName, fileType, fileData } = data
    const blob = base64ToBlob(fileData, fileType)
    const url = URL.createObjectURL(blob)
    setMessages((prev) => [
      ...prev,
      {
        sender: "peer",
        text: `Sent a file: ${fileName}`,
        timestamp: new Date(),
        file: { name: fileName, type: fileType, url },
      },
    ])
    NEW_MESSAGE_SOUND.play().catch((err) => console.error("Error playing sound:", err))
    if (notificationsEnabled && document.visibilityState !== "visible") {
      new Notification("New File from LANtern", {
        body: `Received a file: ${fileName}`,
        icon: "/lantern-icon.png",
      })
    }
  }

  const reconnectToPeer = () => {
    if (!remoteId || !peerInstance.current) return
    setConnectionStatus("connecting")
    const conn = peerInstance.current.connect(remoteId)
    conn.on("open", () => {
      console.log("Reconnected to", remoteId)
      setConnectionStatus("connected")
      setReconnectAttempts(0)
      conn.on("data", handleIncomingData)
      conn.on("close", () => {
        setConnectionStatus("disconnected")
        setPeerIsTyping(false)
        if (reconnectAttempts < 5) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectToPeer()
            setReconnectAttempts((prev) => prev + 1)
          }, 5000)
        }
      })
      connRef.current = conn
    })
    conn.on("error", (err) => {
      console.error("Connection error:", err)
      setConnectionStatus("disconnected")
      if (reconnectAttempts < 5) {
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectToPeer()
          setReconnectAttempts((prev) => prev + 1)
        }, 5000)
      }
    })
  }

  const connectToPeer = () => {
    if (!remoteId || remoteId === peerId) return
    setConnectionStatus("connecting")
    const conn = peerInstance.current.connect(remoteId)
    conn.on("open", () => {
      console.log("Connected to", remoteId)
      setConnectionStatus("connected")
      setReconnectAttempts(0)
      conn.on("data", handleIncomingData)
      conn.on("close", () => {
        setConnectionStatus("disconnected")
        setPeerIsTyping(false)
        if (reconnectAttempts < 5) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectToPeer()
            setReconnectAttempts((prev) => prev + 1)
          }, 5000)
        }
      })
      connRef.current = conn
    })
    conn.on("error", (err) => {
      console.error("Connection error:", err)
      setConnectionStatus("disconnected")
    })
  }

  const disconnectFromPeer = () => {
    if (connRef.current) {
      connRef.current.close()
      setConnectionStatus("disconnected")
    }
  }

  const sendMessage = (e) => {
    e?.preventDefault()
    if (connRef.current && messageInput.trim() !== "") {
      connRef.current.send({ type: "message", text: messageInput })
      setMessages((prev) => [
        ...prev,
        { sender: "you", text: messageInput, timestamp: new Date() },
      ])
      setMessageInput("")
      sendTypingIndicator(false)
    }
    if (fileToSend) {
      sendFile()
    }
  }

  const handleTyping = (e) => {
    setMessageInput(e.target.value)
    if (!isTyping) {
      setIsTyping(true)
      sendTypingIndicator(true)
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false)
      sendTypingIndicator(false)
    }, 2000)
  }

  const sendTypingIndicator = (isTyping) => {
    if (connRef.current) {
      connRef.current.send({ type: "typing", isTyping })
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setFileToSend(file)
    if (file.type.startsWith("image/")) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setFilePreview({ url: e.target.result, type: file.type, name: file.name })
      }
      reader.readAsDataURL(file)
    } else {
      setFilePreview({ url: null, type: file.type, name: file.name })
    }
  }

  const cancelFileSelection = () => {
    setFileToSend(null)
    setFilePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const sendFile = () => {
    if (!connRef.current || !fileToSend) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const base64Data = e.target.result.split(",")[1]
      connRef.current.send({
        type: "file",
        fileName: fileToSend.name,
        fileType: fileToSend.type,
        fileData: base64Data,
      })
      setMessages((prev) => [
        ...prev,
        {
          sender: "you",
          text: `Sent a file: ${fileToSend.name}`,
          timestamp: new Date(),
          file: {
            name: fileToSend.name,
            type: fileToSend.type,
            url: URL.createObjectURL(fileToSend),
          },
        },
      ])
      cancelFileSelection()
    }
    reader.readAsDataURL(fileToSend)
  }

  const base64ToBlob = (base64, mimeType) => {
    const byteCharacters = atob(base64)
    const byteArrays = []
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512)
      const byteNumbers = new Array(slice.length)
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      byteArrays.push(byteArray)
    }
    return new Blob(byteArrays, { type: mimeType })
  }

  const copyPeerId = () => {
    navigator.clipboard.writeText(peerId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const clearChatHistory = () => {
    if (window.confirm("Are you sure you want to clear all messages? This cannot be undone.")) {
      setMessages([])
    }
  }

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  const renderFilePreview = (file) => {
    if (!file) return null
    if (file.type.startsWith("image/")) {
      return (
        <div className="relative">
          <img src={file.url || "/placeholder.svg"} alt={file.name} className="max-w-full max-h-48 rounded-lg object-contain" />
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{file.name}</div>
        </div>
      )
    } else if (file.type === "application/pdf") {
      return (
        <div className="flex items-center gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg">
          <FileText className="h-8 w-8 text-red-500" />
          <div className="overflow-hidden">
            <div className="truncate">{file.name}</div>
            <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">
              Open PDF
            </a>
          </div>
        </div>
      )
    } else {
      return (
        <div className="flex items-center gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg">
          <FileIcon className="h-8 w-8 text-gray-500" />
          <div className="overflow-hidden">
            <div className="truncate">{file.name}</div>
            <a href={file.url} download={file.name} className="text-xs text-blue-500 hover:underline">
              Download
            </a>
          </div>
        </div>
      )
    }
  }

  const getFileIcon = (fileType) => {
    if (fileType.startsWith("image/")) return <ImageIcon className="h-4 w-4" />
    if (fileType === "application/pdf") return <FileText className="h-4 w-4" />
    return <FileIcon className="h-4 w-4" />
  }

  const addEmoji = (emoji) => {
    setMessageInput((prev) => prev + emoji)
    setShowEmojiPicker(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 transition-colors duration-300 bg-gray-100 dark:bg-gray-900">
      <div className="w-full max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden flex flex-col relative z-10"
        >
          <header className="p-4 md:p-6 bg-gradient-to-r from-violet-500 to-purple-500 text-white">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                <img src="/Lantern.png" alt="LANtern Logo" className="h-8 md:h-10 w-auto" />
                <motion.h1
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="text-2xl md:text-3xl font-bold"
                >
                  LANtern Messenger
                </motion.h1>
              </div>
              <div className="flex items-center gap-3">
                {/* Inline dark/light mode toggle */}
                <button
                  type="button"
                  onClick={() => setDarkMode(!darkMode)}
                  className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                  aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                >
                  {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </button>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  className={`flex items-center ${connectionStatus === "connected" ? "text-green-300" : "text-yellow-300"}`}
                >
                  {connectionStatus === "connected" ? <Wifi className="mr-2" /> : <WifiOff className="mr-2" />}
                  <span className="capitalize">{connectionStatus}</span>
                </motion.div>
                {connectionStatus === "connected" && (
                  <button
                    type="button"
                    onClick={disconnectFromPeer}
                    className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full transition-colors"
                    aria-label="Disconnect"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="mt-4 flex items-center flex-wrap gap-2"
            >
              <div className="text-sm">Your Peer ID:</div>
              <div
                onClick={copyPeerId}
                className="font-mono bg-white/20 px-3 py-1 rounded-full text-sm cursor-pointer hover:bg-white/30 transition-colors flex items-center"
              >
                <span className="truncate max-w-[200px]">{peerId || "Connecting..."}</span>
                <Copy className="ml-2 h-4 w-4" />
              </div>
              <AnimatePresence>
                {copied && (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-xs bg-green-400 text-green-900 px-2 py-1 rounded-full"
                  >
                    Copied!
                  </motion.div>
                )}
              </AnimatePresence>
              {messages.length > 0 && (
                <button
                  onClick={clearChatHistory}
                  className="ml-auto text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded-full transition-colors"
                >
                  Clear History
                </button>
              )}
            </motion.div>
          </header>
          <div className="p-6 border-b dark:border-gray-700">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter remote Peer ID"
                value={remoteId}
                onChange={(e) => setRemoteId(e.target.value)}
                className="flex-1 p-3 border dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-400 transition-all"
              />
              <button
                onClick={connectToPeer}
                disabled={connectionStatus === "connecting" || !remoteId}
                className="bg-violet-500 hover:bg-violet-600 text-white px-6 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]"
              >
                {connectionStatus === "connecting" ? (
                  <Loader2 className="animate-spin h-5 w-5" />
                ) : connectionStatus === "connected" ? (
                  "Connected"
                ) : (
                  "Connect"
                )}
              </button>
            </div>
            {!isOnline && (
              <div className="mt-2 text-sm text-red-500 flex items-center">
                <WifiOff className="h-4 w-4 mr-1" /> You are currently offline. Reconnection will be attempted when you're back online.
              </div>
            )}
            {reconnectAttempts > 0 && connectionStatus !== "connected" && (
              <div className="mt-2 text-sm text-yellow-500">
                Connection lost. Reconnection attempt {reconnectAttempts}/5...
              </div>
            )}
          </div>
          <div className="flex-1 p-6 overflow-y-auto bg-white dark:bg-gray-900 min-h-[400px] max-h-[60vh]">
            <AnimatePresence>
              {messages.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400"
                >
                  <p className="text-center">No messages yet. Connect to a peer and start chatting!</p>
                </motion.div>
              ) : (
                messages.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className={`mb-4 flex ${msg.sender === "you" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                        msg.sender === "you"
                          ? "bg-violet-500 text-white rounded-tr-none"
                          : "bg-white dark:bg-gray-800 shadow-md rounded-tl-none"
                      }`}
                    >
                      <div className="text-sm">{msg.text}</div>
                      {msg.file && <div className="mt-2">{renderFilePreview(msg.file)}</div>}
                      <div className={`text-xs mt-1 text-right ${msg.sender === "you" ? "text-violet-200" : "text-gray-500"}`}>
                        {msg.timestamp ? formatTime(msg.timestamp) : ""}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
          <AnimatePresence>
            {filePreview && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 border-t dark:border-gray-700 bg-white dark:bg-gray-800"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getFileIcon(filePreview.type)}
                    <span className="text-sm truncate max-w-[200px]">{filePreview.name}</span>
                  </div>
                  <button onClick={cancelFileSelection} className="text-red-500 hover:text-red-600 text-sm">
                    Cancel
                  </button>
                </div>
                {filePreview.url && filePreview.type.startsWith("image/") && (
                  <div className="mt-2">
                    <img
                      src={filePreview.url || "/placeholder.svg"}
                      alt={filePreview.name}
                      className="max-h-32 max-w-full object-contain rounded"
                    />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          <form onSubmit={sendMessage} className="p-4 border-t dark:border-gray-700 bg-white dark:bg-gray-800 relative">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={connectionStatus !== "connected"}
                className="p-3 rounded-xl bg-white dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
              </button>
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                disabled={connectionStatus !== "connected"}
                className="p-3 rounded-xl bg-white dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                😀
              </button>
              <input
                type="text"
                placeholder="Type your message..."
                value={messageInput}
                onChange={handleTyping}
                disabled={connectionStatus !== "connected"}
                className="flex-1 p-3 border dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-400 transition-all disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={connectionStatus !== "connected" || (!messageInput.trim() && !fileToSend)}
                className="bg-violet-500 hover:bg-violet-600 text-white p-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
            <AnimatePresence>
              {showEmojiPicker && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute bottom-full mb-2 left-0 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-2 shadow-lg z-20 max-h-40 overflow-y-auto"
                >
                  <div className="grid grid-cols-8 gap-2">
                    {emojis.map((emoji, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => addEmoji(emoji)}
                        className="text-xl hover:bg-gray-100 dark:hover:bg-gray-700 rounded p-1"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </motion.div>
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400"
        >
          LANtern Messenger - Secure P2P Communication
        </motion.footer>
      </div>
    </div>
  )
}

export default App
