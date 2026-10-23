import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import mongo from "@/lib/mongodb";

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

export function apiError(message: string, status: number) {
    return NextResponse.json({ error: message }, { status });
}

export const unauthorized = () => apiError("No autorizado", 401);
export const forbidden = (message = "Acceso denegado") => apiError(message, 403);
export const notFound = (message = "No encontrado") => apiError(message, 404);
export const badRequest = (message = "Datos inválidos") => apiError(message, 400);
export const serverError = () => apiError("Error interno del servidor", 500);
