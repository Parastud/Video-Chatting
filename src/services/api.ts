import axios from "axios";
import { API_URL } from "../../app.env";

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

export default api;
