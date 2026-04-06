# 🎥 Real-Time Video Chat Application

<p align="center">
  <img src="https://img.shields.io/badge/React%20Native-Expo-blue?logo=react" />
  <img src="https://img.shields.io/badge/WebRTC-Streaming-black?logo=webrtc" />
  <img src="https://img.shields.io/badge/Socket.IO-Realtime-black?logo=socket.io" />
  <img src="https://img.shields.io/badge/Node.js-Backend-green?logo=node.js" />
  <img src="https://img.shields.io/badge/CI/CD-EAS%20Build-orange" />
  <img src="https://img.shields.io/badge/License-MIT-yellow" />
  <img src="https://img.shields.io/badge/Status-WIP-red" />
</p>

---

> ⚠️ **Work in Progress**  
> This project is currently under development. Some features may be incomplete or evolving.

---

## 📱 Overview

A peer-to-peer real-time video chat application built with **Expo (React Native)**, **WebRTC**, and **Socket.IO**.  
Designed for ultra-low latency communication, the app supports real-time video streaming under **300ms latency** using a custom Node.js signaling server.

---

## 📸 App Preview

<p align="center">
  <img src="https://media.discordapp.net/attachments/1192562807279976560/1490651385014784011/ChatGPT_Image_Apr_6_2026_03_26_11_PM.png?ex=69d4d4c9&is=69d38349&hm=67285d2e15600c74b428bf79f9366cca0489e69569f6dc67c2aa9f31ab4a1337&=&format=webp&quality=lossless&width=427&height=641" width="300"/>
</p>

---

## ✨ Features

- 🎥 Peer-to-peer video streaming with latency under **300ms**  
- 🔁 Custom signaling server using **Socket.IO rooms**  
- 🌐 ICE candidate negotiation with **STUN/TURN support**  
- 📱 Responsive UI with **NativeWind (Tailwind CSS)**  
- 🗂️ File-based routing via **Expo Router**  
- 🗃️ State management using **Context API + Redux**  
- 👥 Supports **50+ concurrent connections**  

---

## 🛠️ Tech Stack

| Layer        | Technology |
|-------------|-----------|
| 📱 Mobile    | Expo (React Native) |
| 🧭 Routing   | Expo Router |
| 🎨 Styling   | NativeWind / Tailwind CSS |
| 🎥 Streaming | WebRTC |
| ⚡ Signaling | Socket.IO |
| 🌐 Backend   | Node.js |
| 🗃️ State     | Context API, Redux |
| 🚀 Build     | EAS Build |

---

## 🧠 How It Works

1. 📷 Users join a room and initiate a video session  
2. 📡 Signaling server (Socket.IO) exchanges SDP offers/answers  
3. 🌐 ICE candidates are exchanged for NAT traversal  
4. 🔗 Peer-to-peer WebRTC connection is established  
5. 🎥 Direct low-latency video stream begins  

---

## 📁 Project Structure

```bash
Video-Chatting/
├── app/              # Expo Router screens
├── OtherScreens/     # Additional UI screens
├── assets/           # Static assets
├── context/          # Context providers
├── store/            # Redux store
├── server/           # Node.js signaling server
├── app.json          # Expo configuration
├── eas.json          # EAS build config
└── tailwind.config.js
```

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18
- npm or yarn
- Expo CLI — `npm install -g expo-cli`
- EAS CLI — `npm install -g eas-cli`

### Installation

```bash
# Clone the repository
git clone https://github.com/Parastud/Video-Chatting.git
cd Video-Chatting

# Install dependencies
npm install

# Start the app
npx expo start
```

### Running the Signaling Server

```bash
cd server
npm install
node index.js
```

> Update the Socket.IO server URL in the app to your local machine's IP before running.

### STUN/TURN Configuration

In your WebRTC config, set your ICE servers:

```js
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    // Add TURN server here if needed for production
  ],
};
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a new branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

> Built by [Parth Sharma](https://github.com/parastud)
