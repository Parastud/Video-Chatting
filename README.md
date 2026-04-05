# Real-Time Video Chat Application

> ⚠️ This project is currently a work in progress / demo. Some features may be incomplete.

A peer-to-peer real-time video chat application built with **Expo (React Native)**, **WebRTC**, and **Socket.IO**. Supports low-latency streaming under 300ms with a custom Node.js signaling server handling 50+ concurrent connections.

---

## ✨ Features

- 🎥 Peer-to-peer video streaming with latency under 300ms
- 🔁 Custom signaling server using Socket.IO rooms
- 🌐 ICE candidate negotiation with STUN/TURN server support for NAT traversal
- 📱 Responsive UI built with NativeWind (Tailwind CSS for React Native)
- 🗂️ File-based routing via Expo Router
- 🗃️ State management with Context API and Redux store
- 👥 Supports 50+ concurrent connections

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | Expo (React Native) |
| Routing | Expo Router (file-based) |
| Styling | NativeWind / Tailwind CSS |
| Real-time video | WebRTC |
| Signaling | Socket.IO |
| Backend | Node.js |
| State | Context API, Redux (Zustand/store) |
| Build | EAS Build |

---

## 📁 Project Structure

```
Video-Chatting/
├── app/              # Expo Router screens (file-based routing)
├── OtherScreens/     # Additional screen components
├── assets/           # Images, fonts, static files
├── context/          # React Context providers
├── store/            # Redux store
├── server/           # Node.js + Socket.IO signaling server
├── app.json          # Expo config
├── eas.json          # EAS Build config
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
