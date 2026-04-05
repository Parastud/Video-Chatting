import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Button, TextInput, View } from "react-native";
import { useSocket } from "../context/Socketprovider";
import { UsernameState } from "../store/store";
export default function Index() {
  const io = useSocket();
  const { setUser } = UsernameState();
  const Router = useRouter();
  const [form, setform] = useState({})
  const handleChange = (name, value) => {
    setform((prev) => ({
      ...prev,
      [name]: value
    }))
  }



  const handleSubmit = useCallback((e) => {
    e.preventDefault();

    io.emit("joinRoom", { Username: form.Username, RoomId: form.RoomId }, (response) => {
      if (response.success) {
        Router.push(`/Room/${response.roomId}`);
      } else {
        console.log("Error joining room:", response.error);
      }
    });

    setUser({
      Username: form.Username,
      RoomId: form.RoomId,
    });

  }, [io, form.Username, form.RoomId]);

  return (
    <View className="flex-1 items-center justify-center bg-slate-600">

      <View className="w-64 gap-4">

        <TextInput
          type="text"
          name="Username"
          placeholder="Username"
          className="w-full p-2 border border-gray-300 rounded"
          value={form.Username}
          onChangeText={(value) => handleChange("Username", value)}
        />
        <TextInput
          type="text"
          name="RoomId"
          placeholder="Room ID"
          className="w-full p-2 border border-gray-300 rounded"
          value={form.RoomId}
          onChangeText={(value) => handleChange("RoomId", value)}
        />
        <Button
          title="Join Room"
          className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
          onPress={handleSubmit}
        />
      </View>
    </View>
  );
}
