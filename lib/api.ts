import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getTranslations } from "next-intl/server";
import mongo from "@/lib/mongodb";
import type en from "@/messages/en.json";

/**
 * Shared helpers for API route handlers.
 * Every route returns errors with the same shape: `{ error: string }`.
 */

/** Returns the app database. MONGODB_DB is optional: without it the database named in MONGODB_URI is used. */
export async function getDb() {
    const client = await mongo;
    return client.db(process.env.MONGODB_DB);
}

/** Converts a string to an ObjectId, or returns null when it isn't a valid id (instead of throwing). */
export function toObjectId(id: unknown): ObjectId | null {
    if (id instanceof ObjectId) return id;
    return typeof id === "string" && ObjectId.isValid(id) ? new ObjectId(id) : null;
}

/** Key of a message in the "errors" namespace of messages/*.json. */
export type ErrorKey = keyof typeof en.errors;

/** Error response with the message translated to the request's locale. */
export async function apiError(key: ErrorKey, status: number) {
    const t = await getTranslations("errors");
    return NextResponse.json({ error: t(key) }, { status });
}

export const unauthorized = () => apiError("unauthorized", 401);
export const forbidden = (key: ErrorKey = "forbidden") => apiError(key, 403);
export const notFound = (key: ErrorKey = "notFound") => apiError(key, 404);
export const badRequest = (key: ErrorKey = "invalidData") => apiError(key, 400);
export const serverError = () => apiError("serverError", 500);
