export type StockTracker = {
    _id: string;
    name: string;
    client_code: string;
}

export interface Plan {
    _id: string;
    name: string;
    price: number;
    maxDepartments: number;
    maxUsers: number;
    maxItems: number;
    features: string[];
    isActive: boolean;
}