import { ObjectId } from "mongodb";

interface UserOrganization {
    clientId: string | ObjectId;
    role: string;
    status: "active" | "pending" | "suspended";
    joinedAt: Date;
}

export interface User {
    _id: string;
    name: string;
    email: string;
    image?: string;
    role: string; // "superadmin", "admin", "runner", etc.
    clientId?: string | ObjectId; // For regular users, this links to their organization
    clientCode?: string; // Optional code for client-specific logic
    isActive: boolean; // To handle user activation status
    permissions?: Record<string, boolean>; // Optional direct permissions for the user
    organizations: UserOrganization[]; // List of organizations the user belongs to
}
