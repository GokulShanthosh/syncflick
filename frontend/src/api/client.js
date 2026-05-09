import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || "",
});

export async function createRoom() {
  const { data } = await api.post("/rooms");
  return data; // { id, status }
}

export async function getRoom(roomId) {
  const { data } = await api.get(`/rooms/${roomId}`);
  return data;
}

export async function uploadVideo(roomId, file, onProgress) {
  const form = new FormData();
  form.append("file", file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${import.meta.env.VITE_BACKEND_URL || ""}/upload/${roomId}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => resolve(JSON.parse(xhr.responseText));
    xhr.onerror = reject;
    xhr.send(form);
  });
}
