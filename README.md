# 🔦 LANtern Messenger - P2P Offline-First Chat

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/yourusername/lantern-messenger/pulls)

A secure peer-to-peer messaging application that works **offline** over local networks, built for the PEARS Hackathon.

![LANtern Messenger Demo](./public/screenshot.png)

## 🌟 Features

- **Local Network Discovery** - Automatically find peers on the same Wi-Fi
- **Offline-First Messaging** - Works without internet connection
- **File Sharing** - Send images, documents, and other files (PDF, TXT, etc.)
- **Secure Communication** - Direct peer-to-peer connections with no central server
- **Message History** - Local storage of conversations
- **Typing Indicators** - See when others are typing
- **Lightweight UI** - Clean and intuitive interface

## 🛠 Tech Stack

- **PeerJS** (WebRTC for P2P communication)
- **PEAR** (Hyperswarm,HyperBee,CoreStore)
- **React** + **Vite** (Frontend framework)
- **multicast-dns** (Local network peer discovery)
- **Tailwind CSS** (Styling)
- **Framer Motion** (Animations)
- **LocalStorage** (Message persistence)

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm (v9+)

### Installation
1. Clone the repository:
```bash
git clone https://github.com/yourusername/lantern-messenger.git
cd lantern-messenger
📖 Usage
Share Your Peer ID:

Copy your unique peer ID from the header

Share via QR code or manually with other users

Connect to Peers:

Enter a peer's ID in the connection box

Click "Connect"

Start Chatting:

Send text messages or files

View message history even when offline

Drag-and-drop file sharing supported

🌐 About (PEARS Hackathon Submission)
LANtern Messenger addresses the critical need for offline communication in scenarios where internet access is unavailable or unreliable. Designed for:

Emergency situations

Remote areas with poor connectivity

Secure local team communication

Privacy-conscious users

Why It Stands Out:

🛡️ No Third-Party Servers: All data stays between devices

🔋 Low Bandwidth Usage: Optimized for weak networks

📁 File Sharing: Exchange crucial documents offline

🔄 Auto-Reconnect: Maintains connections through network instability

🤝 Contributing
Fork the repository

Create your feature branch (git checkout -b feature/AmazingFeature)

Commit your changes (git commit -m 'Add some AmazingFeature')

Push to the branch (git push origin feature/AmazingFeature)

Open a Pull Request

📜 License
Distributed under the MIT License. See LICENSE for more information.

🙏 Acknowledgments
PeerJS team for the excellent P2P library

Vite team for the fast React tooling

Tailwind CSS for the utility-first styling
