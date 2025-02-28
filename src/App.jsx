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

const NEW_MESSAGE_SOUND = new Audio("/sounds/message.mp3")
const emojis = ["😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤭","🤫","🤥","😶","😐","😑","😬","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕","🤑","🤠","😈","👿","👹","👺","🤡","💩","👻","💀","☠️","👽","👾","🤖","🎃","😺","😸","😹","😻","😼","😽","🙀","😿","😾"]

function App() {
  const [peerId, setPeerId] = useState("")
  const [remoteId, setRemoteId] = useState("")
  const [messages, setMessages] = useLocalStorage("lantern-messages", [])
  const [messageInput, setMessageInput] = useState("")
  const [connectionStatus, setConnectionStatus] = useState("disconnected")
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
    if (darkMode) document.documentElement.classList.add("dark")
    else document.documentElement.classList.remove("dark")
  }, [darkMode])

  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission().then(permission => {
        setNotificationsEnabled(permission === "granted")
      })
    }
  }, [])

  useEffect(() => {
    initializePeer()
    return () => {
      peerInstance.current?.destroy()
      reconnectTimeoutRef.current && clearTimeout(reconnectTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!isOnline && connectionStatus === "connected") setConnectionStatus("disconnected")
    else if (isOnline && connectionStatus === "disconnected" && remoteId && reconnectAttempts < 5) reconnectToPeer()
  }, [isOnline, connectionStatus, remoteId, reconnectAttempts])

  const initializePeer = () => {
    const peer = new Peer()
    peer.on("open", id => {
      setPeerId(id)
      setReconnectAttempts(0)
    })
    peer.on("connection", handleIncomingConnection)
    peer.on("error", err => handlePeerError(err))
    peer.on("disconnected", handlePeerDisconnect)
    peerInstance.current = peer
  }

  const handleIncomingConnection = conn => {
    setConnectionStatus("connected")
    setRemoteId(conn.peer)
    conn.on("data", handleIncomingData)
    conn.on("close", handleConnectionClose)
    connRef.current = conn
  }

  const handleIncomingData = data => {
    if (data.type === "message") handleIncomingMessage(data)
    else if (data.type === "typing") setPeerIsTyping(data.isTyping)
    else if (data.type === "file") handleIncomingFile(data)
  }

  const handleIncomingMessage = data => {
    const newMessage = { sender: "peer", text: data.text, timestamp: new Date() }
    setMessages(prev => [...prev, newMessage])
    NEW_MESSAGE_SOUND.play().catch(console.error)
    if (notificationsEnabled && document.visibilityState !== "visible") showNotification(data.text)
  }

  const handleIncomingFile = data => {
    const blob = base64ToBlob(data.fileData, data.fileType)
    const url = URL.createObjectURL(blob)
    const newMessage = {
      sender: "peer",
      text: `Sent a file: ${data.fileName}`,
      timestamp: new Date(),
      file: { name: data.fileName, type: data.fileType, url }
    }
    setMessages(prev => [...prev, newMessage])
    NEW_MESSAGE_SOUND.play().catch(console.error)
    if (notificationsEnabled && document.visibilityState !== "visible") showNotification(`Received file: ${data.fileName}`)
  }

  const reconnectToPeer = () => {
    if (!remoteId || !peerInstance.current) return
    setConnectionStatus("connecting")
    const conn = peerInstance.current.connect(remoteId)
    conn.on("open", () => {
      setConnectionStatus("connected")
      setReconnectAttempts(0)
      conn.on("data", handleIncomingData)
      conn.on("close", handleConnectionClose)
      connRef.current = conn
    })
    conn.on("error", handleConnectionError)
  }

  const connectToPeer = () => {
    if (!remoteId || remoteId === peerId) return
    setConnectionStatus("connecting")
    const conn = peerInstance.current.connect(remoteId)
    conn.on("open", () => {
      setConnectionStatus("connected")
      setReconnectAttempts(0)
      conn.on("data", handleIncomingData)
      conn.on("close", handleConnectionClose)
      connRef.current = conn
    })
    conn.on("error", handleConnectionError)
  }

  const disconnectFromPeer = () => {
    if (connRef.current) {
      connRef.current.close()
      connRef.current = null
      setRemoteId("")
      setConnectionStatus("disconnected")
    }
  }

  const handleConnectionClose = () => {
    setConnectionStatus("disconnected")
    setPeerIsTyping(false)
    if (reconnectAttempts < 5) scheduleReconnect()
  }

  const handlePeerError = err => {
    console.error("Peer error:", err)
    setConnectionStatus("disconnected")
    if (reconnectAttempts < 5) scheduleReconnect()
  }

  const handleConnectionError = err => {
    console.error("Connection error:", err)
    setConnectionStatus("disconnected")
    if (reconnectAttempts < 5) scheduleReconnect()
  }

  const scheduleReconnect = () => {
    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectToPeer()
      setReconnectAttempts(prev => prev + 1)
    }, 5000)
  }

  const sendMessage = e => {
    e?.preventDefault()
    if (connRef.current && messageInput.trim()) {
      connRef.current.send({ type: "message", text: messageInput })
      setMessages(prev => [...prev, { sender: "you", text: messageInput, timestamp: new Date() }])
      setMessageInput("")
      sendTypingIndicator(false)
    }
    if (fileToSend) sendFile()
  }

  const handleTyping = e => {
    setMessageInput(e.target.value)
    if (!isTyping) {
      setIsTyping(true)
      sendTypingIndicator(true)
    }
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false)
      sendTypingIndicator(false)
    }, 2000)
  }

  const sendTypingIndicator = isTyping => {
    connRef.current?.send({ type: "typing", isTyping })
  }

  const sendFile = () => {
    if (!connRef.current || !fileToSend) return
    const reader = new FileReader()
    reader.onload = e => {
      const base64Data = e.target.result.split(",")[1]
      connRef.current.send({ type: "file", fileName: fileToSend.name, fileType: fileToSend.type, fileData: base64Data })
      setMessages(prev => [...prev, {
        sender: "you",
        text: `Sent a file: ${fileToSend.name}`,
        timestamp: new Date(),
        file: { name: fileToSend.name, type: fileToSend.type, url: URL.createObjectURL(fileToSend) }
      }])
      cancelFileSelection()
    }
    reader.readAsDataURL(fileToSend)
  }

  const base64ToBlob = (base64, mimeType) => {
    const byteCharacters = atob(base64)
    const byteArrays = []
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const byteNumbers = new Uint8Array(byteCharacters.slice(offset, offset + 512).split("").map(c => c.charCodeAt(0)))
      byteArrays.push(byteNumbers)
    }
    return new Blob(byteArrays, { type: mimeType })
  }

  const showNotification = body => {
    new Notification("LANtern Message", { body, icon: "/Lantern.png" })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 bg-gray-100 dark:bg-gray-900">
      <div className="w-full max-w-4xl">
        <motion.div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden flex flex-col">
          <header className="p-4 md:p-6 bg-gradient-to-r from-violet-500 to-purple-500 text-white">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                <img src="/Lantern.png" alt="LANtern Logo" className="h-8 md:h-10 w-auto" />
                <h1 className="text-2xl md:text-3xl font-bold">LANtern Messenger</h1>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full bg-white/20 hover:bg-white/30">
                  {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </button>
                <div className={`flex items-center ${connectionStatus === "connected" ? "text-green-300" : "text-yellow-300"}`}>
                  {connectionStatus === "connected" ? <Wifi className="mr-2" /> : <WifiOff className="mr-2" />}
                  <span className="capitalize">{connectionStatus}</span>
                </div>
                {connectionStatus === "connected" && (
                  <button onClick={disconnectFromPeer} className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full">
                    Disconnect
                  </button>
                )}
              </div>
            </div>
            <div className="mt-4 flex items-center flex-wrap gap-2">
              <div className="text-sm">Your Peer ID:</div>
              <div onClick={copyPeerId} className="font-mono bg-white/20 px-3 py-1 rounded-full text-sm cursor-pointer hover:bg-white/30 flex items-center">
                <span className="truncate max-w-[200px]">{peerId || "Connecting..."}</span>
                <Copy className="ml-2 h-4 w-4" />
              </div>
              {copied && <div className="text-xs bg-green-400 text-green-900 px-2 py-1 rounded-full">Copied!</div>}
              {messages.length > 0 && (
                <button onClick={() => setMessages([])} className="ml-auto text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded-full">
                  Clear History
                </button>
              )}
            </div>
          </header>

          <div className="p-6 border-b dark:border-gray-700">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter remote Peer ID"
                value={remoteId}
                onChange={e => setRemoteId(e.target.value)}
                className="flex-1 p-3 border dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
              <button
                onClick={connectToPeer}
                disabled={connectionStatus === "connecting" || !remoteId}
                className="bg-violet-500 hover:bg-violet-600 text-white px-6 py-3 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]"
              >
                {connectionStatus === "connecting" ? <Loader2 className="animate-spin h-5 w-5" /> : connectionStatus === "connected" ? "Connected" : "Connect"}
              </button>
            </div>
          </div>

          <div className="flex-1 p-6 overflow-y-auto bg-white dark:bg-gray-900 min-h-[400px] max-h-[60vh]">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                <p>No messages yet. Connect to a peer and start chatting!</p>
              </div>
            ) : messages.map((msg, idx) => (
              <div key={idx} className={`mb-4 flex ${msg.sender === "you" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] px-4 py-3 rounded-2xl ${msg.sender === "you" ? "bg-violet-500 text-white rounded-tr-none" : "bg-white dark:bg-gray-800 shadow-md rounded-tl-none"}`}>
                  <div className="text-sm">{msg.text}</div>
                  {msg.file && (
                    <div className="mt-2">
                      {msg.file.type.startsWith("image/") ? (
                        <img src={msg.file.url} alt={msg.file.name} className="max-w-full max-h-48 rounded-lg object-contain" />
                      ) : (
                        <a href={msg.file.url} download={msg.file.name} className="text-blue-500 hover:underline">
                          Download {msg.file.name}
                        </a>
                      )}
                    </div>
                  )}
                  <div className={`text-xs mt-1 text-right ${msg.sender === "you" ? "text-violet-200" : "text-gray-500"}`}>
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="p-4 border-t dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={connectionStatus !== "connected"}
                className="p-3 rounded-xl bg-white dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                <input type="file" ref={fileInputRef} onChange={e => setFileToSend(e.target.files[0])} className="hidden" />
              </button>
              <input
                type="text"
                placeholder="Type your message..."
                value={messageInput}
                onChange={handleTyping}
                disabled={connectionStatus !== "connected"}
                className="flex-1 p-3 border dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
              <button
                type="submit"
                disabled={connectionStatus !== "connected" || (!messageInput.trim() && !fileToSend)}
                className="bg-violet-500 hover:bg-violet-600 text-white p-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  )
}

export default App
