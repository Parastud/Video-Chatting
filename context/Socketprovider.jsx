
import { createContext, useContext, useMemo } from "react";
import { io } from "socket.io-client";


const SocketContext = createContext(null);
export const useSocket = () => {
  const context = useContext(SocketContext);
  return context;
}
export const SocketProvider = ({ children }) => {

  const socket = useMemo(() => io(`${"http://192.168.0.119:8000"}`), []);
  console.log(socket)
  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};
