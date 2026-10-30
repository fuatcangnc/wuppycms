// AWS/Node girişi için Hono sarmalayıcı: worker.ts'in yaptığı mount'ları
// (api + preview) aynı yollarla uygular.

import { Hono } from "hono";
import { api } from "./api/app";
import { preview } from "./api/preview";

export const awsApp = new Hono();
awsApp.route("/api", api);
awsApp.route("/preview", preview);
