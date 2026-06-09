// Точка входу: запускає веб-сервер мета-агента.
// "./env.js" імпортуємо найпершим — щоб .env підхопився до читання конфігурації.
import "./env.js";
import { startServer } from "./server.js";

startServer();
