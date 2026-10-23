import type { ObjectId } from "mongodb";

/**
 * Shapes of the documents stored in MongoDB.
 * `Id` is ObjectId for documents read from the DB, and string once they are serialized
 * for the client or stored in the session.
 */

export type MovementType = "IN" | "OUT";

/** A user's membership in one organization (an entry of `users.organizations`). */
export interface Membership<Id = ObjectId> {
    clientId: Id;
    clientName?: string;
    clientCode?: string;
    role: string; // "admin", "user", "pending_user", ... see ROLES
    status: "active" | "inactive" | "pending" | "suspended";
    departments?: Id[];
    joinedAt?: Date;
}

/** Membership as stored in the session/JWT, with ids as strings. */
export type SessionMembership = Membership<string>;

export interface User {
    _id: ObjectId;
    name: string;
    email: string;
    image?: string;
    isActive: boolean;
    organizations: Membership[];
    activeOrganization?: ObjectId | null;
}

/** An organization. Stored in the "clients" collection. */
export interface Organization {
    _id: ObjectId;
    name: string;
    clientCode: string;
    planId: ObjectId;
    ownerEmail: string;
    createdAt: Date;
    /** Missing on organizations created before it existed, which are open. See closeOrganization. */
    status?: "active" | "closed";
    closedAt?: Date;
    closedBy?: string; // Email of who closed it
}

export interface Plan {
    _id: ObjectId;
    name: string;
    price: number;
    maxDepartments: number;
    maxUsers: number;
    maxItems: number;
    features: string[];
    isActive: boolean;
}

export interface Department<Id = ObjectId> {
    _id: Id;
    name: string;
    description?: string;
    clientId: Id;
    createdAt: Date;
}

/** A product in a department's inventory ("department_stock" collection). */
export interface StockItem<Id = ObjectId> {
    _id: Id;
    departmentId: Id;
    departmentName: string;
    clientId?: Id;
    productName: string;
    sku: string;
    unit: string;
    category?: string;
    quantity: number;
    minStock: number;
    isDeleted?: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/** Audit log entry for every quantity change ("stock_movements" collection). */
export interface StockMovement<Id = ObjectId> {
    _id: Id;
    inventoryId: Id;
    departmentId: Id;
    departmentName: string;
    clientId?: Id;
    productName: string;
    sku: string;
    type: MovementType;
    amount: number;
    previousBalance?: number;
    newBalance?: number;
    reason: string;
    user: { id?: Id; name?: string | null; email?: string | null };
    createdAt: Date;
}

/** One product row of the consumption report. */
export interface ConsumptionReportItem {
    inventoryId: string;
    productName: string;
    sku: string;
    initialQuantity: number;
    totalIn: number;
    totalOut: number;
    finalBalance: number;
    finalQuantity: number;
}

export interface ConsumptionReportDepartment {
    _id: string;
    departmentName: string;
    items: ConsumptionReportItem[];
}
