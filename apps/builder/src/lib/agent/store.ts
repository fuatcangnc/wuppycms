// Ajan deposu facade'i — AWS'de S3 (AGENT_STORE=s3), yerelde SQLite.
// Lambda örnekleri arasında oturum/olay tutarlılığı için varsayılan AWS modu S3.

import * as s3 from "./store-s3";
import * as sql from "./store-sql";

export type { ChangeRecord } from "./store-sql";

export const newId = sql.newId;

function backend(): typeof sql {
	return typeof process !== "undefined" && process.env?.AGENT_STORE === "s3" ? s3 : sql;
}

export const createSession: typeof sql.createSession = (...args) =>
	backend().createSession(...args);
export const getSessionRow: typeof sql.getSessionRow = (...args) =>
	backend().getSessionRow(...args);
export const listSessions: typeof sql.listSessions = (...args) => backend().listSessions(...args);
export const deleteSession: typeof sql.deleteSession = (...args) =>
	backend().deleteSession(...args);
export const removeChangeIdFromMessages: typeof sql.removeChangeIdFromMessages = (...args) =>
	backend().removeChangeIdFromMessages(...args);
export const loadMessages: typeof sql.loadMessages = (...args) => backend().loadMessages(...args);
export const loadSession: typeof sql.loadSession = (...args) => backend().loadSession(...args);
export const appendMessage: typeof sql.appendMessage = (...args) =>
	backend().appendMessage(...args);
export const touchSession: typeof sql.touchSession = (...args) =>
	backend().touchSession(...args);
export const updateTitle: typeof sql.updateTitle = (...args) => backend().updateTitle(...args);
export const attachChangeIds: typeof sql.attachChangeIds = (...args) =>
	backend().attachChangeIds(...args);
export const createRun: typeof sql.createRun = (...args) => backend().createRun(...args);
export const finishRun: typeof sql.finishRun = (...args) => backend().finishRun(...args);
export const requestStop: typeof sql.requestStop = (...args) => backend().requestStop(...args);
export const isStopRequested: typeof sql.isStopRequested = (...args) =>
	backend().isStopRequested(...args);
export const getRun: typeof sql.getRun = (...args) => backend().getRun(...args);
export const appendEvent: typeof sql.appendEvent = (...args) => backend().appendEvent(...args);
export const readEvents: typeof sql.readEvents = (...args) => backend().readEvents(...args);
export const recordChange: typeof sql.recordChange = (...args) => backend().recordChange(...args);
export const latestChange: typeof sql.latestChange = (...args) =>
	backend().latestChange(...args);
export const markChangeReverted: typeof sql.markChangeReverted = (...args) =>
	backend().markChangeReverted(...args);
