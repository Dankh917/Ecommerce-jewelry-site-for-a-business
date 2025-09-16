import { http } from "./http";
import type { JewelryItemForCard } from "../types/JewelryItemForCard";
import type { JewelryItemDetails } from "../types/JewelryItemDetails";

export async function getCatalog(): Promise<JewelryItemForCard[]> {
    const res = await http.get<JewelryItemForCard[]>("/api/jewelryItem");
    return res.data;
}

export async function getCategories(): Promise<string[]> {
    const res = await http.get<string[]>("/api/jewelryItem/categories");
    return res.data;
}

export async function getCollections(): Promise<string[]> {
    const res = await http.get<string[]>("/api/jewelryItem/collections");
    return res.data;
}

// NEW: Get item details by ID
export async function getJewelryItemById(id: number): Promise<JewelryItemDetails> {
    const res = await http.get<JewelryItemDetails>(`/api/jewelryItem/${id}`);
    return res.data;
}
